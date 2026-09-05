using HRDesk.Web.Constants;
using HRDesk.Web.Core;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceReportsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly AttendanceSummaryService _attendanceSummaryService;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public AttendanceReportsController(
        BiometricAttendanceDbContext db,
        AttendanceSummaryService attendanceSummaryService,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _attendanceSummaryService = attendanceSummaryService;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("monthly-sheet")]
    public async Task<IActionResult> GetMonthlyAttendanceSheet(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceView))
        {
            return Forbid();
        }

        var selectedYear = year ?? IstDateTime.Now.Year;
        var selectedMonth = month ?? IstDateTime.Now.Month;

        var startDate = new DateOnly(selectedYear, selectedMonth, 1);
        var daysInMonth = DateTime.DaysInMonth(selectedYear, selectedMonth);
        var endDate = startDate.AddMonths(1);

        var sw = System.Diagnostics.Stopwatch.StartNew();

        var empQuery = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Where(e =>
                (e.JoiningDate == null || e.JoiningDate < endDate) &&
                (
                    e.Status == "Active" || e.Status == "active" || e.Status == null ||
                    (e.LastWorkingDate != null && e.LastWorkingDate >= startDate)
                ));

        // Branch Scoping Filter
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            empQuery = empQuery.Where(e => e.BranchId == activeBranch.Value);
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            empQuery = empQuery.Where(e => e.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            empQuery = empQuery.Where(e => e.EmployeeName.ToLower().Contains(s));
        }

        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceView);

        var totalCount = await empQuery.CountAsync();
        var tCount = sw.ElapsedMilliseconds;

        if (pageSize <= 0) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var employees = await empQuery
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        var tEmps = sw.ElapsedMilliseconds;

        var pagedEmpIds = employees.Select(e => e.EmployeeId).ToList();

        var logs = await _db.DailyAttendance
            .AsNoTracking()
            .Where(a => a.RecordDate >= startDate && a.RecordDate < endDate && pagedEmpIds.Contains(a.EmployeeId))
            .ToListAsync();
        var tLogs = sw.ElapsedMilliseconds;

        var leaveApps = await _db.LeaveApplications
            .AsNoTracking()
            .Include(la => la.LeaveType)
            .Where(la => (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate < endDate &&
                         la.EndDate >= startDate &&
                         pagedEmpIds.Contains(la.EmployeeId))
            .ToListAsync();
        var tLeaves = sw.ElapsedMilliseconds;

        var holidays = await _db.Holidays
            .AsNoTracking()
            .Where(h => h.ArchivedAt == null && h.StartDate < endDate && h.EndDate >= startDate)
            .ToListAsync();

        var monthRosters = await _db.ShiftRosters
            .AsNoTracking()
            .Where(r => r.RosterDate >= startDate && r.RosterDate <= endDate && pagedEmpIds.Contains(r.EmployeeId))
            .ToListAsync();
        var tData = sw.ElapsedMilliseconds;

        // O(1) Pre-indexing into Hash Maps for ultra-fast lookup
        var logsByEmpAndDate = logs
            .GroupBy(l => l.EmployeeId)
            .ToDictionary(g => g.Key, g => g.GroupBy(x => x.RecordDate).ToDictionary(d => d.Key, d => d.First()));

        var leavesByEmp = leaveApps
            .GroupBy(la => la.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var rostersByEmpAndDate = monthRosters
            .GroupBy(r => r.EmployeeId)
            .ToDictionary(g => g.Key, g => g.GroupBy(x => x.RosterDate).ToDictionary(d => d.Key, d => d.First()));

        var items = new List<object>(employees.Count);

        foreach (var emp in employees)
        {
            logsByEmpAndDate.TryGetValue(emp.EmployeeId, out var empLogsByDate);
            leavesByEmp.TryGetValue(emp.EmployeeId, out var empLeaves);
            rostersByEmpAndDate.TryGetValue(emp.EmployeeId, out var empRostersByDate);

            empLogsByDate ??= new Dictionary<DateOnly, DailyAttendance>();
            empLeaves ??= new List<LeaveApplication>();
            empRostersByDate ??= new Dictionary<DateOnly, ShiftRoster>();

            var dailyRecords = new Dictionary<string, object>(daysInMonth);
            var dailyStatus = new Dictionary<string, string>(daysInMonth);

            for (int day = 1; day <= daysInMonth; day++)
            {
                var date = new DateOnly(selectedYear, selectedMonth, day);
                empLogsByDate.TryGetValue(date, out var log);

                bool isEmployedOnDate = (emp.JoiningDate == null || date >= emp.JoiningDate) &&
                    (emp.LastWorkingDate == null || date <= emp.LastWorkingDate);

                bool isDefaultWeekoff = isEmployedOnDate && !string.IsNullOrWhiteSpace(emp.Weekoff) &&
                    emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase);

                empRostersByDate.TryGetValue(date, out var rosterOverride);
                bool isWeekOff = rosterOverride != null ? rosterOverride.IsWeekOff : isDefaultWeekoff;

                // Match Holiday applicable to this employee
                var activeHoliday = isEmployedOnDate ? holidays.FirstOrDefault(h =>
                    date >= h.StartDate && date <= h.EndDate &&
                    (h.OrganizationId == 0 || h.OrganizationId == emp.OrganizationId) &&
                    (h.IsGlobal ||
                     (!h.BranchId.HasValue && !h.DepartmentId.HasValue && string.IsNullOrEmpty(h.DepartmentIds)) ||
                     (h.BranchId.HasValue && h.BranchId.Value == emp.BranchId && !h.DepartmentId.HasValue && string.IsNullOrEmpty(h.DepartmentIds)) ||
                     (emp.DepartmentId.HasValue && (
                         (h.DepartmentId.HasValue && h.DepartmentId.Value == emp.DepartmentId.Value) ||
                         (!string.IsNullOrEmpty(h.DepartmentIds) && ("," + h.DepartmentIds + ",").Contains("," + emp.DepartmentId.Value + ","))
                     ) && (!h.BranchId.HasValue || h.BranchId == emp.BranchId)))) : null;

                var activeApp = empLeaves.FirstOrDefault(la => date >= la.StartDate && date <= la.EndDate && la.Status == "Approved");

                string statusChar = "-";
                string inTime = "";
                string outTime = "";
                string tooltip = "";
                string textColor = "inherit";
                string bgColor = "transparent";

                if (log != null)
                {
                    inTime = log.InTime?.ToString("HH:mm") ?? "";
                    outTime = log.OutTime?.ToString("HH:mm") ?? "";

                    if (log.Status == "Holiday" || (activeHoliday != null && log.InTime == null && log.OutTime == null))
                    {
                        statusChar = "HLD";
                        textColor = "#7b1fa2";
                        bgColor = "#f3e5f5";
                        tooltip = activeHoliday?.HolidayName ?? "Holiday";
                    }
                    else if (activeHoliday != null && log.InTime != null)
                    {
                        statusChar = "HLD+";
                        textColor = "#2e7d32";
                        bgColor = "#e8f5e9";
                        tooltip = $"Worked on Holiday ({activeHoliday.HolidayName})";
                    }
                    else if (log.Status == "W/O" || log.Status == "Weekoff")
                    {
                        statusChar = "WO";
                        textColor = "#1976d2";
                        bgColor = "#e3f2fd";
                        tooltip = "Weekoff";
                    }
                    else if (activeApp?.LeaveType != null)
                    {
                        textColor = activeApp.LeaveType.TextColor ?? "#ffffff";
                        bgColor = activeApp.LeaveType.BackgroundColor ?? "#0288d1";
                        if (activeApp.DayType == "First Half" || log.Status == "FH" || log.Status == "1H" || log.Status == "1HF")
                        {
                            statusChar = activeApp.LeaveType.Code + "-1H";
                            tooltip = $"{activeApp.LeaveType.Name} (First Half Leave) (#{activeApp.Id})";
                        }
                        else if (activeApp.DayType == "Second Half" || log.Status == "SH" || log.Status == "2H" || log.Status == "2HF")
                        {
                            statusChar = activeApp.LeaveType.Code + "-2H";
                            tooltip = $"{activeApp.LeaveType.Name} (Second Half Leave) (#{activeApp.Id})";
                        }
                        else if (log.IsHalfDay || activeApp.TotalDays == 0.5m)
                        {
                            statusChar = activeApp.LeaveType.Code + "HF";
                            tooltip = $"{activeApp.LeaveType.Name} (Half Day) (#{activeApp.Id})";
                        }
                        else
                        {
                            statusChar = activeApp.LeaveType.Code;
                            tooltip = $"{activeApp.LeaveType.Name} (#{activeApp.Id})";
                        }
                    }
                    else
                    {
                        bool isToday = date == DateOnly.FromDateTime(IstDateTime.Now);
                        bool isClockedInToday = (isToday && log.InTime != null && (log.OutTime == null || log.InTime == log.OutTime)) ||
                                                log.Status == "Clocked In" || log.Status == "In Progress";

                        if (isClockedInToday)
                        {
                            statusChar = "IP";
                            textColor = "#0284c7";
                            bgColor = "#e0f2fe";
                            tooltip = $"Clocked in at {inTime} — Shift in progress";
                            if (string.IsNullOrEmpty(outTime) || (log.InTime.HasValue && log.OutTime.HasValue && log.InTime == log.OutTime))
                            {
                                outTime = "—";
                            }
                        }
                        else if (log.Status == "Single Punch" || log.Status == "SP" || (!isToday && log.InTime != null && log.OutTime == null && log.Status != "Holiday" && log.Status != "Weekoff" && log.Status != "W/O"))
                        {
                            statusChar = "SP";
                            textColor = "#b45309";
                            bgColor = "#fef3c7";
                            if (log.InTime != null && log.OutTime == null)
                            {
                                tooltip = $"Single Punch (In: {inTime} | Out Missing) — Regularization Required";
                                outTime = "—";
                            }
                            else if (log.InTime == null && log.OutTime != null)
                            {
                                tooltip = $"Single Punch (In Missing | Out: {outTime}) — Regularization Required";
                                inTime = "—";
                            }
                            else
                            {
                                tooltip = "Single Punch — Regularization Required";
                            }
                        }
                        else
                        {
                            statusChar = log.Status switch
                            {
                                "Present" => "P",
                                "Absent" => "A",
                                "Clocked In" or "In Progress" => "IP",
                                "Single Punch" or "SP" => "SP",
                                "COHF" => "COHF",
                                "CO-1H" or "COHF-1" or "CO-FH" => "CO-1H",
                                "CO-2H" or "COHF-2" or "CO-SH" => "CO-2H",
                                "PHF" or "PLHF" => "PLHF",
                                "SHF" or "SLHF" => "SLHF",
                                "1H" or "FH" or "1HF" or "HF-1" or "First Half" => "1H",
                                "2H" or "SH" or "2HF" or "HF-2" or "Second Half" => "2H",
                                "HF" or "Half Day" or "HalfDay" => "HF",
                                "CO" => "CO",
                                _ => log.Status ?? "-"
                            };

                            if (statusChar == "P") { textColor = "#2e7d32"; bgColor = "#e8f5e9"; }
                            else if (statusChar == "A") { textColor = "#d32f2f"; bgColor = "#ffebee"; }
                            else if (statusChar == "IP") { textColor = "#0284c7"; bgColor = "#e0f2fe"; tooltip = $"Clocked in at {inTime} — Shift in progress"; }
                            else if (statusChar == "SP") { textColor = "#b45309"; bgColor = "#fef3c7"; tooltip = $"Single Punch — Regularization Required"; }
                            else if (statusChar == "WO" || statusChar == "W/O") { textColor = "#1976d2"; bgColor = "#e3f2fd"; }
                            else if (statusChar.EndsWith("HF") || statusChar == "1H" || statusChar == "2H") { textColor = "#ef6c00"; bgColor = "#fff3e0"; }

                            if (log.InTime.HasValue && log.OutTime.HasValue && log.InTime == log.OutTime)
                            {
                                outTime = "—";
                            }
                        }
                    }
                }
                else
                {
                    // ── LOG == NULL (Future date or no attendance record generated yet) ──
                    if (activeHoliday != null)
                    {
                        statusChar = "HLD";
                        textColor = "#7b1fa2";
                        bgColor = "#f3e5f5";
                        tooltip = activeHoliday.HolidayName;
                    }
                    else if (activeApp?.LeaveType != null)
                    {
                        textColor = activeApp.LeaveType.TextColor ?? "#ffffff";
                        bgColor = activeApp.LeaveType.BackgroundColor ?? "#0288d1";
                        if (activeApp.DayType == "First Half")
                        {
                            statusChar = activeApp.LeaveType.Code + "-1H";
                            tooltip = $"{activeApp.LeaveType.Name} (First Half Leave) (#{activeApp.Id})";
                        }
                        else if (activeApp.DayType == "Second Half")
                        {
                            statusChar = activeApp.LeaveType.Code + "-2H";
                            tooltip = $"{activeApp.LeaveType.Name} (Second Half Leave) (#{activeApp.Id})";
                        }
                        else if (activeApp.TotalDays == 0.5m)
                        {
                            statusChar = activeApp.LeaveType.Code + "HF";
                            tooltip = $"{activeApp.LeaveType.Name} (Half Day) (#{activeApp.Id})";
                        }
                        else
                        {
                            statusChar = activeApp.LeaveType.Code;
                            tooltip = $"{activeApp.LeaveType.Name} (#{activeApp.Id})";
                        }
                    }
                    else if (isWeekOff)
                    {
                        statusChar = "WO";
                        textColor = "#1976d2";
                        bgColor = "#e3f2fd";
                        tooltip = "Default Weekoff";
                    }
                }

                var dayKey = day.ToString();
                dailyStatus[dayKey] = statusChar;
                dailyRecords[dayKey] = new
                {
                    day,
                    status = statusChar,
                    inTime,
                    outTime,
                    tooltip,
                    textColor,
                    bgColor,
                    isWeekOff
                };
            }

            // Single Source of Truth attendance computation
            var counts = _attendanceSummaryService.ComputeSummary(emp.EmployeeId, selectedYear, selectedMonth, logs, leaveApps);

            items.Add(new
            {
                employee = new
                {
                    employeeId = emp.EmployeeId,
                    employeeName = emp.EmployeeName,
                    department = emp.Department?.DepartmentName ?? "General",
                    departmentName = emp.Department?.DepartmentName ?? "General",
                    weekoff = emp.Weekoff,
                    photoPath = emp.PhotoPath,
                    photoUrl = $"/api/employees/{emp.EmployeeId}/public-photo",
                    avatarUrl = $"/api/employees/{emp.EmployeeId}/public-photo"
                },
                dailyRecords,
                dailyStatus,
                summary = new
                {
                    presentDays = counts.PresentCount,
                    absentDays = counts.AbsentCount,
                    halfDays = counts.HalfDayCount,
                    weekoffDays = counts.WeekoffCount,
                    holidayDays = counts.HolidayCount,
                    leaveDays = counts.LeaveCount,
                    unpaidDays = counts.UnpaidLeaveCount,
                    payableDays = counts.PayableDays
                }
            });
        }

        return Ok(new
        {
            year = selectedYear,
            month = selectedMonth,
            daysInMonth,
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            timings = new
            {
                countMs = tCount,
                empsMs = tEmps - tCount,
                logsMs = tLogs - tEmps,
                leavesMs = tLeaves - tLogs,
                dataMs = tData - tLeaves,
                loopMs = sw.ElapsedMilliseconds - tData,
                totalMs = sw.ElapsedMilliseconds
            }
        });
    }

    [HttpGet("summary/{employeeId}")]
    public async Task<IActionResult> GetEmployeeSummary(int employeeId, [FromQuery] int? year, [FromQuery] int? month)
    {
        var targetYear = year ?? IstDateTime.Today.Year;
        var targetMonth = month ?? IstDateTime.Today.Month;
        
        var query = _db.Employees.AsNoTracking().Where(e => e.EmployeeId == employeeId);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);
        if (!await query.AnyAsync())
        {
            return Forbid();
        }

        var summary = await _attendanceSummaryService.GetSummaryAsync(employeeId, targetYear, targetMonth);
        return Ok(summary);
    }

    [HttpGet("daily-logs")]
    public async Task<IActionResult> GetDailyLogs(
        [FromQuery] DateOnly? date = null,
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceView))
        {
            return Forbid();
        }

        var targetDate = date ?? IstDateTime.Today;

        var query = _db.DailyAttendance
            .AsNoTracking()
            .Include(a => a.Employee)
                .ThenInclude(e => e!.Department)
            .Include(a => a.Shift)
            .Where(a => a.RecordDate == targetDate);

        // Branch Scoping Filter
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(a => a.BranchId == activeBranch.Value || (a.Employee != null && a.Employee.BranchId == activeBranch.Value));
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(a => a.Employee != null && a.Employee.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a => a.Employee != null && a.Employee.EmployeeName.ToLower().Contains(s));
        }

        query = await _permissionService.ApplyAttendanceScopeAsync(query, User, AppPermissions.Keys.AttendanceView);

        var logs = await query
            .OrderBy(a => a.Employee != null ? a.Employee.EmployeeName : string.Empty)
            .Select(a => new
            {
                id = a.Id,
                employeeId = a.EmployeeId,
                employeeName = a.Employee != null ? a.Employee.EmployeeName : string.Empty,
                department = (a.Employee != null && a.Employee.Department != null) ? a.Employee.Department.DepartmentName : "General",
                recordDate = a.RecordDate,
                inTime = a.InTime != null ? a.InTime.Value.ToString("HH:mm") : null,
                outTime = a.OutTime != null ? a.OutTime.Value.ToString("HH:mm") : null,
                workMinutes = a.WorkMinutes,
                breakMinutes = a.BreakMinutes,
                status = a.Status,
                shiftName = a.Shift != null ? a.Shift.ShiftName : "General Shift",
                lateMinutes = a.LateMinutes,
                isLate = a.IsLate,
                isEarly = a.IsEarly,
                isHalfDay = a.IsHalfDay
            })
            .ToListAsync();

        return Ok(new { date = targetDate.ToString("yyyy-MM-dd"), total = logs.Count, items = logs, logs });
    }
}
