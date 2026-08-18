using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IAttendanceSummaryService _attendanceSummaryService;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly IAttendanceProcessorService _processor;
    private readonly ICurrentTenantProvider _tenantProvider;

    public AttendanceController(
        BiometricAttendanceDbContext db,
        IAttendanceSummaryService attendanceSummaryService,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        IAttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _attendanceSummaryService = attendanceSummaryService;
        _permissionService = permissionService;
        _cache = cache;
        _processor = processor;
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
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceMonthlySheet))
        {
            return Forbid();
        }

        var selectedYear = year ?? DateTime.Now.Year;
        var selectedMonth = month ?? DateTime.Now.Month;

        var startDate = new DateOnly(selectedYear, selectedMonth, 1);
        var daysInMonth = DateTime.DaysInMonth(selectedYear, selectedMonth);
        var endDate = startDate.AddMonths(1);

        var empQuery = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Where(e =>
                (e.JoiningDate == null || e.JoiningDate < endDate) &&
                (
                    (e.Status != null && e.Status.ToLower() == "active") ||
                    (e.LastWorkingDate != null && e.LastWorkingDate >= startDate) ||
                    (_db.DailyAttendance.Any(a => a.EmployeeId == e.EmployeeId && a.RecordDate >= startDate && a.RecordDate < endDate && a.InTime != null))
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

        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceMonthlySheet);

        var totalCount = await empQuery.CountAsync();

        if (pageSize <= 0) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var employees = await empQuery
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var pagedEmpIds = employees.Select(e => e.EmployeeId).ToList();

        var logs = await _db.DailyAttendance
            .AsNoTracking()
            .Include(a => a.Shift)
            .Where(a => a.RecordDate >= startDate && a.RecordDate < endDate && pagedEmpIds.Contains(a.EmployeeId))
            .ToListAsync();

        var leaveApps = await _db.LeaveApplications
            .AsNoTracking()
            .Include(la => la.LeaveType)
            .Where(la => (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate < endDate &&
                         la.EndDate >= startDate &&
                         pagedEmpIds.Contains(la.EmployeeId))
            .ToListAsync();

        var holidays = await _db.Holidays
            .AsNoTracking()
            .Where(h => h.StartDate < endDate && h.EndDate >= startDate)
            .ToListAsync();

        var monthRosters = await _db.ShiftRosters
            .AsNoTracking()
            .Where(r => r.RosterDate >= startDate && r.RosterDate <= endDate && pagedEmpIds.Contains(r.EmployeeId))
            .ToListAsync();

        var items = new List<object>();

        foreach (var emp in employees)
        {
            var empLogs = logs.Where(l => l.EmployeeId == emp.EmployeeId).ToList();
            var dailyRecords = new Dictionary<string, object>();
            var dailyStatus = new Dictionary<string, string>();

            for (int day = 1; day <= daysInMonth; day++)
            {
                var date = new DateOnly(selectedYear, selectedMonth, day);
                var log = empLogs.FirstOrDefault(l => l.RecordDate == date);

                bool isDefaultWeekoff = !string.IsNullOrWhiteSpace(emp.Weekoff) &&
                    emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase) &&
                    (emp.JoiningDate == null || date >= emp.JoiningDate) &&
                    (emp.LastWorkingDate == null || date <= emp.LastWorkingDate);

                var rosterOverride = monthRosters.FirstOrDefault(r => r.EmployeeId == emp.EmployeeId && r.RosterDate == date);
                bool isWeekOff = rosterOverride != null ? rosterOverride.IsWeekOff : isDefaultWeekoff;

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

                    var activeApp = leaveApps.FirstOrDefault(la => la.EmployeeId == emp.EmployeeId && date >= la.StartDate && date <= la.EndDate && la.Status == "Approved");

                    if (log.Status == "Holiday")
                    {
                        statusChar = "HLD";
                        textColor = "#7b1fa2";
                        bgColor = "#f3e5f5";
                        var hol = holidays.FirstOrDefault(h => date >= h.StartDate && date <= h.EndDate);
                        tooltip = hol?.HolidayName ?? "Holiday";
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
                        statusChar = (log.IsHalfDay || activeApp.TotalDays == 0.5m)
                            ? (activeApp.LeaveType.Code + "HF")
                            : activeApp.LeaveType.Code;
                        tooltip = $"{activeApp.LeaveType.Name} (#{activeApp.ApplicationNumber})";
                    }
                    else
                    {
                        statusChar = log.Status switch
                        {
                            "Present" => "P",
                            "Absent" => "A",
                            "COHF" => "COHF",
                            "PHF" => "PHF",
                            "SHF" => "SHF",
                            "HF" => "HF",
                            "CO" => "CO",
                            _ => log.Status ?? "-"
                        };

                        if (statusChar == "P") { textColor = "#2e7d32"; bgColor = "#e8f5e9"; }
                        else if (statusChar == "A") { textColor = "#d32f2f"; bgColor = "#ffebee"; }
                        else if (statusChar == "WO" || statusChar == "W/O") { textColor = "#1976d2"; bgColor = "#e3f2fd"; }
                        else if (statusChar.EndsWith("HF")) { textColor = "#ef6c00"; bgColor = "#fff3e0"; }
                    }
                }
                else if (isWeekOff)
                {
                    statusChar = "WO";
                    textColor = "#1976d2";
                    bgColor = "#e3f2fd";
                    tooltip = "Default Weekoff";
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
                    weekoff = emp.Weekoff
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
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("summary/{employeeId}")]
    public async Task<IActionResult> GetEmployeeSummary(int employeeId, [FromQuery] int? year, [FromQuery] int? month)
    {
        var targetYear = year ?? DateTime.Today.Year;
        var targetMonth = month ?? DateTime.Today.Month;
        
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

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.Today);

        var query = _db.DailyAttendance
            .AsNoTracking()
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Include(a => a.Shift)
            .Where(a => a.RecordDate == targetDate);

        // Branch Scoping Filter
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(a => a.BranchId == activeBranch.Value || a.Employee.BranchId == activeBranch.Value);
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(a => a.Employee.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a => a.Employee.EmployeeName.ToLower().Contains(s));
        }

        query = await _permissionService.ApplyAttendanceScopeAsync(query, User, AppPermissions.Keys.AttendanceView);

        var logs = await query
            .OrderBy(a => a.Employee.EmployeeName)
            .Select(a => new
            {
                id = a.Id,
                employeeId = a.EmployeeId,
                employeeName = a.Employee.EmployeeName,
                department = a.Employee.Department != null ? a.Employee.Department.DepartmentName : "General",
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

    [HttpPost("punch")]
    public async Task<IActionResult> PunchIn([FromBody] PunchRequestDto dto)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!currentEmpId.HasValue && !dto.EmployeeId.HasValue)
        {
            return BadRequest(new { message = "No employee profile associated with this account." });
        }

        var targetEmpId = dto.EmployeeId ?? currentEmpId!.Value;
        var now = DateTime.Now;
        var today = DateOnly.FromDateTime(now);
        var timeOnly = TimeOnly.FromDateTime(now);

        var existingLog = await _db.DailyAttendance
            .FirstOrDefaultAsync(a => a.EmployeeId == targetEmpId && a.RecordDate == today);

        if (existingLog == null)
        {
            existingLog = new DailyAttendance
            {
                EmployeeId = targetEmpId,
                RecordDate = today,
                InTime = timeOnly,
                Status = "Present",
                OrganizationId = 1
            };
            _db.DailyAttendance.Add(existingLog);
        }
        else
        {
            existingLog.OutTime = timeOnly;
            if (existingLog.InTime.HasValue)
            {
                var workDuration = timeOnly - existingLog.InTime.Value;
                existingLog.WorkMinutes = (int)workDuration.TotalMinutes;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Punch recorded successfully.", inTime = existingLog.InTime?.ToString("HH:mm"), outTime = existingLog.OutTime?.ToString("HH:mm") });
    }
}

public record PunchRequestDto(int? EmployeeId, string? PunchType, string? Source);
