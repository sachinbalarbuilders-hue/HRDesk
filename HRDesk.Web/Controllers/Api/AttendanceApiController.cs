using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.AI;
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
    private readonly IFaceRecognitionService _faceRecognitionService;

    public AttendanceController(
        BiometricAttendanceDbContext db,
        IAttendanceSummaryService attendanceSummaryService,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        IAttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider,
        IFaceRecognitionService faceRecognitionService)
    {
        _db = db;
        _attendanceSummaryService = attendanceSummaryService;
        _permissionService = permissionService;
        _cache = cache;
        _processor = processor;
        _tenantProvider = tenantProvider;
        _faceRecognitionService = faceRecognitionService;
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

        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceMonthlySheet);

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
            .Where(h => h.StartDate < endDate && h.EndDate >= startDate)
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

                bool isDefaultWeekoff = !string.IsNullOrWhiteSpace(emp.Weekoff) &&
                    emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase) &&
                    (emp.JoiningDate == null || date >= emp.JoiningDate) &&
                    (emp.LastWorkingDate == null || date <= emp.LastWorkingDate);

                empRostersByDate.TryGetValue(date, out var rosterOverride);
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

                    var activeApp = empLeaves.FirstOrDefault(la => date >= la.StartDate && date <= la.EndDate && la.Status == "Approved");

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
                        statusChar = log.Status switch
                        {
                            "Present" => "P",
                            "Absent" => "A",
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
                        else if (statusChar == "WO" || statusChar == "W/O") { textColor = "#1976d2"; bgColor = "#e3f2fd"; }
                        else if (statusChar.EndsWith("HF") || statusChar == "1H" || statusChar == "2H") { textColor = "#ef6c00"; bgColor = "#fff3e0"; }
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

        // ── Fetch employee + branch for restriction checks ──────────────────
        var employee = await _db.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId);

        if (employee == null)
            return BadRequest(new { message = "Employee not found." });

        Branch? branch = null;
        if (employee.BranchId.HasValue)
        {
            branch = await _db.Branches
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == employee.BranchId.Value);
        }

        // ── 0. FACE LIVENESS + IDENTITY CHECK ───────────────────────────────
        // Applies to AttendanceType containing "face".
        // flutter_face_liveness runs on-device (FaceNet TFLite) and sends:
        // ── 0. FACE LIVENESS + PROFILE PHOTO MATCH CHECK ───────────────────
        // Applies to AttendanceType containing "face".
        // Strict Rule: If no official profile picture is uploaded for the employee,
        // face attendance is disallowed.
        // ── 0. FACE LIVENESS + PROFILE PHOTO MATCH CHECK ───────────────────
        // Applies to AttendanceType containing "face".
        // Strict Rule: If no official profile picture is uploaded for the employee,
        // face attendance is disallowed.
        var attType = employee.AttendanceType?.ToLowerInvariant() ?? "";
        bool requiresFace = attType.Contains("face");
        byte[]? enrolledPhotoBytes = null;

        if (requiresFace)
        {
            // 1. Fetch PhotoData from database if available
            try
            {
                var conn = Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.GetDbConnection(_db.Database);
                if (conn.State == System.Data.ConnectionState.Closed) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT PhotoData FROM employees WHERE employee_id = @id AND organization_id = @org";
                var pId = cmd.CreateParameter(); pId.ParameterName = "@id"; pId.Value = targetEmpId; cmd.Parameters.Add(pId);
                var pOrg = cmd.CreateParameter(); pOrg.ParameterName = "@org"; pOrg.Value = employee.OrganizationId; cmd.Parameters.Add(pOrg);
                var dbPhoto = await cmd.ExecuteScalarAsync();
                if (dbPhoto != null && dbPhoto != DBNull.Value)
                {
                    enrolledPhotoBytes = (byte[])dbPhoto;
                }
            }
            catch {}

            // 2. Fallback to PhotoPath file on disk if PhotoData was empty
            if (enrolledPhotoBytes == null || enrolledPhotoBytes.Length == 0)
            {
                if (!string.IsNullOrWhiteSpace(employee.PhotoPath))
                {
                    var cleanEnrolled = employee.PhotoPath.TrimStart('/', '\\');
                    var enrolledDiskPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", cleanEnrolled);
                    if (!System.IO.File.Exists(enrolledDiskPath))
                    {
                        enrolledDiskPath = Path.Combine(Directory.GetCurrentDirectory(), cleanEnrolled);
                    }

                    if (System.IO.File.Exists(enrolledDiskPath))
                    {
                        enrolledPhotoBytes = await System.IO.File.ReadAllBytesAsync(enrolledDiskPath);
                    }
                }
            }

            // Strictly disallow punch if no profile photo exists in DB or disk
            if (enrolledPhotoBytes == null || enrolledPhotoBytes.Length == 0)
            {
                return BadRequest(new
                {
                    message = "Face attendance cannot be completed: No official profile photo has been uploaded for your profile. Please contact HR to upload your profile photo first.",
                    requiresFace = true,
                    isFaceEnrolled = false
                });
            }

            if (dto.LivenessVerified != true)
            {
                return BadRequest(new
                {
                    message = "Face liveness verification is required for this employee's attendance type.",
                    requiresFace = true,
                    isFaceEnrolled = true
                });
            }

            if (string.IsNullOrEmpty(employee.FaceId))
            {
                // First face punch — mark employee as enrolled
                var enrollEmp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId);
                if (enrollEmp != null)
                {
                    enrollEmp.FaceId = "ENROLLED";
                    await _db.SaveChangesAsync();
                }
            }
            else
            {
                // Verification: If the on-device biometric neural net indicates this is a different/new face, reject
                if (dto.IsFaceIdNew == true)
                {
                    return BadRequest(new
                    {
                        message = "Face identity mismatch: The face in front of the camera does not match the enrolled face for this employee. Access denied.",
                        requiresFace = true,
                        isFaceEnrolled = true
                    });
                }

                // Confidence threshold check
                if (dto.FaceConfidence.HasValue && dto.FaceConfidence.Value < 0.65)
                {
                    return BadRequest(new
                    {
                        message = $"Face confidence score is too low ({dto.FaceConfidence.Value * 100:F0}%). Please align your face in good lighting and try again.",
                        requiresFace = true,
                        isFaceEnrolled = true
                    });
                }
            }
        }

        // ── 1. IP RESTRICTION CHECK ─────────────────────────────────────────
        bool? isIpValid = null;
        bool requiresIp = attType.Contains("ip") || attType.Contains("network");

        if (requiresIp)
        {
            if (branch == null || string.IsNullOrWhiteSpace(branch.AllowedIPs))
            {
                return BadRequest(new
                {
                    message = "Allowed office IP addresses have not been configured for your assigned branch. Please contact your HR administrator."
                });
            }
        }

        if (branch != null && !string.IsNullOrWhiteSpace(branch.AllowedIPs))
        {
            var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
            // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.x.x)
            if (remoteIp.StartsWith("::ffff:"))
                remoteIp = remoteIp[7..];

            var allowedList = branch.AllowedIPs
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            // Allow localhost / loopback during local development if configured or if loopback is present
            isIpValid = allowedList.Contains(remoteIp) || 
                        ((remoteIp == "::1" || remoteIp == "127.0.0.1") && (allowedList.Contains("localhost") || allowedList.Contains("127.0.0.1") || allowedList.Contains("::1")));

            if (isIpValid == false)
            {
                return BadRequest(new
                {
                    message = $"Clock-in rejected: your IP address ({remoteIp}) is not in the list of allowed office IPs for {branch.Name}."
                });
            }
        }

        // ── 2. GEO-FENCING & LOCATION TRACKING ──────────────────────────────
        bool isStrictGeofence = attType.Contains("geo-fencing") || attType.Contains("geofence");
        bool requiresGps = isStrictGeofence || attType.Contains("location");
        bool? isGeofenceValid = null;

        if (requiresGps)
        {
            if (!dto.Latitude.HasValue || !dto.Longitude.HasValue)
            {
                return BadRequest(new
                {
                    message = "GPS location is required for this employee's attendance type. Please enable location access and try again."
                });
            }
        }

        if (dto.Latitude.HasValue && dto.Longitude.HasValue && 
            branch?.Latitude.HasValue == true && branch?.Longitude.HasValue == true && branch?.RadiusMeters.HasValue == true)
        {
            var distanceMeters = HaversineDistanceMeters(
                dto.Latitude.Value, dto.Longitude.Value,
                branch.Latitude.Value, branch.Longitude.Value);

            isGeofenceValid = distanceMeters <= branch.RadiusMeters.Value;

            // Only strictly reject if AttendanceType is specifically strict Geo-Fencing
            if (isStrictGeofence && isGeofenceValid == false)
            {
                return BadRequest(new
                {
                    message = $"Clock-in rejected: you are {distanceMeters:F0}m away from {branch.Name} (allowed radius: {branch.RadiusMeters.Value:F0}m).",
                    distanceMeters,
                    allowedRadius = branch.RadiusMeters.Value
                });
            }
        }

        // ── 3. PHOTO SAVE & ONNX SERVER-SIDE FACE VERIFICATION ──────────────
        string? photoUrl = null;
        double? calculatedConfidence = dto.FaceConfidence;
        bool onDeviceVerified = dto.IsFaceIdNew == false;

        if (!string.IsNullOrWhiteSpace(dto.PhotoBase64))
        {
            try
            {
                var base64Data = dto.PhotoBase64.Contains(',')
                    ? dto.PhotoBase64[(dto.PhotoBase64.IndexOf(',') + 1)..]
                    : dto.PhotoBase64;

                var photoBytes = Convert.FromBase64String(base64Data);
                var folderPath = Path.Combine(
                    Directory.GetCurrentDirectory(), "wwwroot", "attendance_photos",
                    today.Year.ToString(), today.Month.ToString("D2"), today.Day.ToString("D2"));

                Directory.CreateDirectory(folderPath);

                var fileName = $"emp{targetEmpId}_{now:HHmmss}.jpg";
                var filePath = Path.Combine(folderPath, fileName);
                await System.IO.File.WriteAllBytesAsync(filePath, photoBytes);

                photoUrl = $"/attendance_photos/{today.Year}/{today.Month:D2}/{today.Day:D2}/{fileName}";

                if (_faceRecognitionService.IsModelAvailable && enrolledPhotoBytes != null && enrolledPhotoBytes.Length > 0)
                {
                    // Threshold 0.40: with YuNet 5-point alignment, the genuine employee scores
                    // ~0.9 and a different person ~0.1 (measured), so 0.40 separates them with a
                    // wide safety margin in both directions.
                    var matchResult = await _faceRecognitionService.CompareFacesAsync(photoBytes, enrolledPhotoBytes, threshold: 0.40f);
                    
                    if (matchResult.IsSuccess)
                    {
                        calculatedConfidence = Math.Round((double)matchResult.SimilarityScore, 4);
                        // Log score for threshold calibration
                        Console.WriteLine($"[ONNX] score={matchResult.SimilarityScore:F4} isMatch={matchResult.IsMatch} onDevice={onDeviceVerified}");

                        if (requiresFace && !matchResult.IsMatch && !onDeviceVerified)
                        {
                            return BadRequest(new
                            {
                                message = $"Face identity mismatch: {matchResult.Message}",
                                requiresFace = true,
                                isFaceEnrolled = true,
                                confidence = calculatedConfidence
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // Photo saving/processing is non-critical for non-face fallback
                if (requiresFace && ex is not FormatException)
                {
                    // Log warning and continue
                }
            }
        }

        // ── 4. RECORD AttendanceLog ──────────────────────────────────────────
        var punchLog = new AttendanceLog
        {
            EmployeeId = targetEmpId,
            PunchTime = now,
            OrganizationId = employee.OrganizationId,
            SyncedAt = now,
            CreatedAt = now,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            PhotoUrl = photoUrl,
            IsGeofenceValid = isGeofenceValid,
            IsIpValid = isIpValid,
            // Auto-set VerifyType based on attendance type so the timeline icons render correctly.
            // Explicit Source from the client always takes priority.
            VerifyType = !string.IsNullOrWhiteSpace(dto.Source)
                ? dto.Source
                : requiresFace ? "Face" : "Web",
            FaceConfidence = calculatedConfidence,
        };
        _db.AttendanceLogs.Add(punchLog);

        // ── 5. UPDATE DailyAttendance (In / Out) ────────────────────────────
        var existingLog = await _db.DailyAttendance
            .FirstOrDefaultAsync(a => a.EmployeeId == targetEmpId && a.RecordDate == today);

        string punchMessage;
        var reqType = dto.PunchType?.Trim().ToLowerInvariant() ?? "";

        if (reqType == "in")
        {
            if (existingLog == null)
            {
                existingLog = new DailyAttendance
                {
                    EmployeeId = targetEmpId,
                    RecordDate = today,
                    InTime = timeOnly,
                    Status = "Present",
                    OrganizationId = employee.OrganizationId,
                    BranchId = employee.BranchId
                };
                _db.DailyAttendance.Add(existingLog);
                punchMessage = $"Clocked in successfully at {timeOnly:HH:mm}.";
            }
            else
            {
                // An explicit "in" punch always updates the clock-in time to the current punch
                // and starts a fresh session: clear any earlier OutTime so the single toggle
                // button flips back to "Clock Out". (Latest in/out session wins for the day.)
                existingLog.InTime = timeOnly;
                existingLog.OutTime = null;
                existingLog.WorkMinutes = 0;
                existingLog.Status = "Present";
                punchMessage = $"Clocked in successfully at {timeOnly:HH:mm}.";
            }
        }
        else if (reqType == "out")
        {
            if (existingLog == null)
            {
                existingLog = new DailyAttendance
                {
                    EmployeeId = targetEmpId,
                    RecordDate = today,
                    OutTime = timeOnly,
                    Status = "Present",
                    OrganizationId = employee.OrganizationId,
                    BranchId = employee.BranchId
                };
                _db.DailyAttendance.Add(existingLog);
            }
            else
            {
                existingLog.OutTime = timeOnly;
                if (existingLog.InTime.HasValue)
                {
                    var workDuration = timeOnly - existingLog.InTime.Value;
                    existingLog.WorkMinutes = Math.Max(0, (int)workDuration.TotalMinutes);
                }
            }
            punchMessage = $"Clocked out successfully at {timeOnly:HH:mm}.";
        }
        else
        {
            // Fallback toggle mode if no punch type specified
            if (existingLog == null || !existingLog.InTime.HasValue)
            {
                if (existingLog == null)
                {
                    existingLog = new DailyAttendance
                    {
                        EmployeeId = targetEmpId,
                        RecordDate = today,
                        InTime = timeOnly,
                        Status = "Present",
                        OrganizationId = employee.OrganizationId,
                        BranchId = employee.BranchId
                    };
                    _db.DailyAttendance.Add(existingLog);
                }
                else
                {
                    existingLog.InTime = timeOnly;
                    existingLog.Status = "Present";
                }
                punchMessage = $"Clocked in successfully at {timeOnly:HH:mm}.";
            }
            else
            {
                existingLog.OutTime = timeOnly;
                var workDuration = timeOnly - existingLog.InTime.Value;
                existingLog.WorkMinutes = Math.Max(0, (int)workDuration.TotalMinutes);
                punchMessage = $"Clocked out successfully at {timeOnly:HH:mm}.";
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = punchMessage,
            inTime = existingLog.InTime?.ToString("HH:mm"),
            outTime = existingLog.OutTime?.ToString("HH:mm"),
            photoUrl,
            isGeofenceValid,
            isIpValid,
            confidence = calculatedConfidence,
            isClockedIn = existingLog.InTime.HasValue && !existingLog.OutTime.HasValue
        });
    }

    /// <summary>
    /// Returns the current (self) employee's clock in/out state for today. Used by the mobile
    /// app to show a single toggle button: "Clock Out" when clocked in, otherwise "Clock In".
    /// </summary>
    [HttpGet("today-status")]
    public async Task<IActionResult> GetTodayStatus()
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (currentEmpId == null)
        {
            return Ok(new { hasEmployee = false, isClockedIn = false, inTime = (string?)null, outTime = (string?)null });
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        var log = await _db.DailyAttendance
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.EmployeeId == currentEmpId.Value && a.RecordDate == today);

        return Ok(new
        {
            hasEmployee = true,
            isClockedIn = log?.InTime != null && log.OutTime == null,
            inTime = log?.InTime?.ToString("HH:mm"),
            outTime = log?.OutTime?.ToString("HH:mm")
        });
    }

    [HttpGet("day-details")]
    public async Task<IActionResult> GetDayDetails([FromQuery] int employeeId, [FromQuery] string date)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceMonthlySheet))
        {
            return Forbid();
        }

        if (!DateOnly.TryParse(date, out var recordDate))
        {
            return BadRequest(new { message = "Invalid date format. Expected YYYY-MM-DD." });
        }

        var dayStart = recordDate.ToDateTime(TimeOnly.MinValue);
        var dayEnd = recordDate.ToDateTime(TimeOnly.MaxValue);

        // 1. Employee metadata
        var employee = await _db.Employees
            .AsNoTracking()
            .Where(e => e.EmployeeId == employeeId)
            .Select(e => new
            {
                e.EmployeeId,
                e.PublicId,
                name = e.EmployeeName,
                code = $"EMP#{e.EmployeeId:D3}",
                department = e.Department != null ? e.Department.DepartmentName : "General",
                designation = e.Designation != null ? e.Designation.DesignationName : "-",
                branch = e.Branch != null ? e.Branch.Name : "-",
                organization = e.Organization != null ? e.Organization.Name : "-"
            })
            .FirstOrDefaultAsync();

        if (employee == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        // 2. Daily Attendance summary for that date
        var dailySummary = await _db.DailyAttendance
            .AsNoTracking()
            .Where(d => d.EmployeeId == employeeId && d.RecordDate == recordDate)
            .Select(d => new
            {
                d.InTime,
                d.OutTime,
                d.WorkMinutes,
                d.BreakMinutes,
                d.Status,
                d.IsLate,
                d.LateMinutes,
                d.IsEarly,
                d.EarlyMinutes,
                d.IsHalfDay,
                ShiftName = d.Shift != null ? d.Shift.ShiftName : null,
                ShiftStart = d.Shift != null ? d.Shift.StartTime : (TimeOnly?)null,
                ShiftEnd = d.Shift != null ? d.Shift.EndTime : (TimeOnly?)null,
                ShiftColor = d.Shift != null ? d.Shift.ColorCode : null
            })
            .FirstOrDefaultAsync();

        // 3. Raw punch logs
        var rawLogs = await _db.AttendanceLogs
            .AsNoTracking()
            .Where(l => l.EmployeeId == employeeId && l.PunchTime >= dayStart && l.PunchTime <= dayEnd)
            .OrderBy(l => l.PunchTime)
            .Select(l => new
            {
                l.Id,
                l.PunchTime,
                l.VerifyMode,
                l.VerifyType,
                l.MachineNumber,
                l.IpAddress,
                l.Latitude,
                l.Longitude,
                l.IsGeofenceValid,
                l.IsIpValid,
                l.PhotoUrl
            })
            .ToListAsync();

        // 4. Approved leave
        var leaveApp = await _db.LeaveApplications
            .AsNoTracking()
            .Where(l => l.EmployeeId == employeeId && 
                        l.StartDate <= recordDate && 
                        l.EndDate >= recordDate && 
                        (l.Status == "Approved" || l.Status == "Adjusted"))
            .Select(l => new
            {
                l.Id,
                type = l.LeaveType != null ? l.LeaveType.Name : null,
                l.Reason,
                l.Status
            })
            .FirstOrDefaultAsync();

        // 5. Holiday
        var holiday = await _db.Holidays
            .AsNoTracking()
            .Where(h => h.StartDate <= recordDate && h.EndDate >= recordDate)
            .Select(h => new
            {
                h.Id,
                name = h.HolidayName,
                description = h.Description
            })
            .FirstOrDefaultAsync();

        // Format raw punches list
        var punches = new List<object>();
        for (int i = 0; i < rawLogs.Count; i++)
        {
            var log = rawLogs[i];
            string punchType = log.VerifyMode switch
            {
                1 => "In",
                2 => "Out",
                3 => "Break",
                4 => "Return",
                _ => (i % 2 == 0 ? "In" : "Out")
            };

            punches.Add(new
            {
                id = log.Id,
                time = log.PunchTime.ToString("HH:mm:ss"),
                timeShort = log.PunchTime.ToString("hh:mm tt"),
                dateTime = log.PunchTime,
                punchType,
                verifyType = log.VerifyType ?? "Biometric",
                machineNumber = log.MachineNumber > 0 ? $"Biometric Device #{log.MachineNumber}" : "Web / Mobile",
                ipAddress = log.IpAddress,
                latitude = log.Latitude,
                longitude = log.Longitude,
                isGeofenceValid = log.IsGeofenceValid,
                isIpValid = log.IsIpValid,
                photoUrl = log.PhotoUrl
            });
        }

        // Determine actual distinct In and Out times
        TimeOnly? effectiveInTime = dailySummary?.InTime;
        TimeOnly? effectiveOutTime = dailySummary?.OutTime;

        if (rawLogs.Count == 1)
        {
            // Only a single punch recorded -> It is First In, Out Time is null/open
            effectiveInTime = TimeOnly.FromDateTime(rawLogs[0].PunchTime);
            effectiveOutTime = null;
        }
        else if (rawLogs.Count > 1)
        {
            effectiveInTime = TimeOnly.FromDateTime(rawLogs.First().PunchTime);
            effectiveOutTime = TimeOnly.FromDateTime(rawLogs.Last().PunchTime);
        }
        else if (effectiveInTime.HasValue && effectiveOutTime.HasValue && effectiveInTime == effectiveOutTime)
        {
            // If DB has identical In and Out time, treat Out as missing
            effectiveOutTime = null;
        }

        int effectiveWorkMinutes = 0;
        if (effectiveInTime.HasValue && effectiveOutTime.HasValue && effectiveOutTime > effectiveInTime)
        {
            effectiveWorkMinutes = (int)(effectiveOutTime.Value - effectiveInTime.Value).TotalMinutes;
        }
        else if (dailySummary?.WorkMinutes > 0 && effectiveOutTime.HasValue)
        {
            effectiveWorkMinutes = dailySummary.WorkMinutes;
        }

        string workDurationFormatted = effectiveWorkMinutes > 0
            ? $"{effectiveWorkMinutes / 60}h {effectiveWorkMinutes % 60}m"
            : "--";

        return Ok(new
        {
            employee = new
            {
                employeeId = employee.EmployeeId,
                publicId = employee.PublicId,
                name = employee.name,
                code = employee.code,
                department = employee.department,
                designation = employee.designation,
                branch = employee.branch,
                organization = employee.organization
            },
            date = recordDate.ToString("yyyy-MM-dd"),
            formattedDate = recordDate.ToString("dddd, MMMM dd, yyyy"),
            status = dailySummary?.Status ?? (leaveApp != null ? leaveApp.type : (holiday != null ? "Holiday" : "Absent")),
            inTime = effectiveInTime?.ToString("HH:mm"),
            outTime = effectiveOutTime?.ToString("HH:mm"),
            workMinutes = effectiveWorkMinutes,
            workDurationFormatted,
            breakMinutes = dailySummary?.BreakMinutes ?? 0,
            isLate = dailySummary?.IsLate ?? false,
            lateMinutes = dailySummary?.LateMinutes ?? 0,
            isEarly = dailySummary?.IsEarly ?? false,
            earlyMinutes = dailySummary?.EarlyMinutes ?? 0,
            isHalfDay = dailySummary?.IsHalfDay ?? false,
            shift = dailySummary?.ShiftName != null ? new
            {
                name = dailySummary.ShiftName,
                startTime = dailySummary.ShiftStart?.ToString("HH:mm"),
                endTime = dailySummary.ShiftEnd?.ToString("HH:mm"),
                colorCode = dailySummary.ShiftColor
            } : null,
            leave = leaveApp != null ? new
            {
                id = leaveApp.Id,
                type = leaveApp.type,
                reason = leaveApp.Reason,
                status = leaveApp.Status
            } : null,
            holiday = holiday != null ? new
            {
                id = holiday.Id,
                name = holiday.name,
                description = holiday.description
            } : null,
            punches,
            totalPunches = punches.Count
        });
    }

    // ── Haversine formula: returns distance in metres between two GPS points ──
    private static double HaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth radius in metres
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }
}

public record PunchRequestDto(
    int? EmployeeId,
    string? PunchType,
    string? Source,
    double? Latitude,
    double? Longitude,
    string? PhotoBase64,
    /// <summary>
    /// Set to true by the Flutter app after flutter_face_liveness passes.
    /// Required for employees whose AttendanceType contains "face".
    /// </summary>
    bool? LivenessVerified = null,
    /// <summary>
    /// Optional face similarity confidence score (0.0–1.0). Stored for audit.
    /// </summary>
    double? FaceConfidence = null,
    /// <summary>
    /// Persistent face identity token from flutter_face_liveness FaceNet TFLite.
    /// Format: "FID-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    /// Null on first punch (enrollment). Must match stored FaceId on subsequent punches.
    /// </summary>
    string? FaceId = null,
    /// <summary>
    /// Passed from flutter_face_liveness: false = on-device FaceNet already matched
    /// this face against the stored embedding (same person). True = new/unrecognised face.
    /// The backend uses this instead of string equality to handle slight embedding drift
    /// between sessions.
    /// </summary>
    bool? IsFaceIdNew = null
);

