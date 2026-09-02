using HRDesk.Web.Constants;
using HRDesk.Web.Core;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.AI;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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
    private readonly IFaceAntiSpoofingService _faceAntiSpoofingService;
    private readonly IFaceMotionService _faceMotionService;
    private readonly IFaceChallengeService _faceChallengeService;
    private readonly IConfiguration _configuration;

    public AttendanceController(
        BiometricAttendanceDbContext db,
        IAttendanceSummaryService attendanceSummaryService,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        IAttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider,
        IFaceRecognitionService faceRecognitionService,
        IFaceAntiSpoofingService faceAntiSpoofingService,
        IFaceMotionService faceMotionService,
        IFaceChallengeService faceChallengeService,
        IConfiguration configuration)
    {
        _db = db;
        _attendanceSummaryService = attendanceSummaryService;
        _permissionService = permissionService;
        _cache = cache;
        _processor = processor;
        _tenantProvider = tenantProvider;
        _faceRecognitionService = faceRecognitionService;
        _faceAntiSpoofingService = faceAntiSpoofingService;
        _faceMotionService = faceMotionService;
        _faceChallengeService = faceChallengeService;
        _configuration = configuration;
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

    // ── Active Liveness: Request Challenge ──────────────────────────────────
    /// <summary>
    /// Issues a one-time, short-lived, random head-movement challenge.
    ///
    /// The client must:
    ///   1. Display the instruction to the user.
    ///   2. Record exactly FrameCount JPEG frames at IntervalMs intervals
    ///      starting immediately after the instruction appears.
    ///   3. Send { challengeId, frames[] } to POST /api/attendance/punch.
    ///      The client must NOT send any boolean like "challengeCompleted".
    ///      The server independently verifies the frames.
    ///
    /// Security: challenge is bound to (employeeId, punchType), expires in
    /// ChallengeTtlSeconds, and is one-time use. Replay attacks are rejected.
    /// </summary>
    [HttpPost("request-challenge")]
    public async Task<IActionResult> RequestChallenge([FromBody] RequestChallengeDto dto)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId  = dto.EmployeeId ?? currentEmpId;

        if (!targetEmpId.HasValue)
        {
            return BadRequest(new { message = "No employee profile associated with this account." });
        }

        // Confirm this is a face-attendance employee before issuing a challenge.
        // Must scope by OrganizationId (EF Core global query filter handles this via
        // ICurrentTenantProvider — the filter is applied automatically for Scoped DbContext).
        var employee = await _db.Employees
            .AsNoTracking()
            .Select(e => new { e.EmployeeId, e.AttendanceType })
            .FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId.Value);

        if (employee == null)
            return BadRequest(new { message = "Employee not found." });

        var attType = employee.AttendanceType?.ToLowerInvariant() ?? "";
        if (!attType.Contains("face"))
        {
            return BadRequest(new
            {
                message = "Active liveness challenge is only required for face attendance employees."
            });
        }

        var challenge = _faceChallengeService.Issue(targetEmpId.Value, dto.PunchType ?? "in");

        return Ok(new
        {
            challengeId   = challenge.ChallengeId,
            challengeType = challenge.ChallengeType.ToString(),
            instruction   = challenge.Instruction,
            expiresAt     = challenge.ExpiresAt,
            frameCount    = challenge.FrameCount,
            intervalMs    = challenge.IntervalMs,
        });
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
        var now = IstDateTime.Now;
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

        // ── 0. FACE QUALITY + SERVER-SIDE LIVENESS + IDENTITY GATE ──────────
        // Applies to employees whose AttendanceType contains "face".
        //
        // Pipeline (all three must pass — fail-closed):
        //   0a. Photo present and decodable
        //   0b. Decode base64 → photoBytes (reused in section 3 for disk save + identity)
        //   0c. Load enrolled profile photo
        //   0d. FaceQualityValidator — brightness, blur, size (retry signal, NOT fraud)
        //   0e. FaceAntiSpoofingService — MiniFASNetV2 + MiniFASNetV1SE ONNX fusion
        //       Fail-closed: models missing → 503. Inference error → 503.
        //       dto.LivenessVerified is IGNORED — retained in DTO for wire-compat only.
        //   0f. First-punch enrollment marker (metadata, not a security check)
        //   Identity check (ArcFace cosine similarity) runs in section 3 below.

        byte[]? photoBytes = null;  // decoded punch photo; reused in section 3
        var attType = employee.AttendanceType?.ToLowerInvariant()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(attType) || attType == "none")
        {
            return BadRequest(new
            {
                message = "Attendance tracking is not configured for your account (Attendance Type is unset or set to None). Please contact your administrator."
            });
        }

        bool isWebPunch = string.Equals(dto.Source, "Web", StringComparison.OrdinalIgnoreCase);

        // 1. Biometric Machine Only
        if (attType == "biometric")
        {
            return BadRequest(new
            {
                message = isWebPunch
                    ? "Web clock-in is disabled for your profile. Your attendance is tracked exclusively via the office Biometric Machine."
                    : "Mobile clock-in is disabled for your account. Your attendance is tracked exclusively via the office Biometric Machine."
            });
        }

        // 2. Face Recognition + Location (Mobile Only)
        if (attType.Contains("face") && isWebPunch)
        {
            return BadRequest(new
            {
                message = "Web clock-in is not permitted for your profile. Your attendance type is set to 'Face Recognition + Location'. Please punch in using the HRDesk Mobile App."
            });
        }

        // 3. Manual Entry (HR/Admin only)
        if (attType == "manual")
        {
            return BadRequest(new
            {
                message = "Self clock-in is disabled for your account. Your attendance type is set to Manual (managed by HR/Admin)."
            });
        }

        bool requiresFace = attType.Contains("face");
        byte[]? enrolledPhotoBytes = null;

        if (requiresFace)
        {
            // ── -1. ACTIVE CHALLENGE VERIFICATION (fail-closed) ───────────────
            // The client must obtain a challenge via POST /api/attendance/request-challenge
            // BEFORE calling this endpoint and must send back the challengeId plus the
            // raw frame sequence. The server independently verifies the head movement.
            //
            // Security properties:
            //   - dto.ChallengeId is validated against server-side state (MemoryCache).
            //   - Challenge is bound to (targetEmpId, punchType) — cannot reuse across employees.
            //   - Challenge is one-time: marked used on first Consume(), replay → null.
            //   - Challenge expires in ChallengeTtlSeconds (default 30s) regardless of use.
            //   - The server runs YuNet on each frame to measure nose-offset delta across time.
            //   - No client-supplied boolean can claim the challenge passed.

            if (string.IsNullOrWhiteSpace(dto.ChallengeId))
            {
                return BadRequest(new
                {
                    message = "A liveness challenge is required. Please call /api/attendance/request-challenge first.",
                    requiresChallenge = true,
                    requiresFace = true
                });
            }

            if (dto.Frames == null || dto.Frames.Count < 2)
            {
                return BadRequest(new
                {
                    message = "Frame sequence is missing or too short. Please complete the liveness challenge.",
                    requiresChallenge = true,
                    requiresFace = true
                });
            }

            // Consume the challenge — validates binding and one-time use
            var punchTypeForChallenge = (dto.PunchType ?? "in").Trim().ToLowerInvariant();
            var challenge = _faceChallengeService.Consume(dto.ChallengeId, targetEmpId, punchTypeForChallenge);

            if (challenge == null)
            {
                // Unknown, expired, already used, or binding mismatch — fail closed
                return BadRequest(new
                {
                    message = "Liveness challenge is invalid, expired, or already used. Please start a new attendance attempt.",
                    requiresChallenge = true,
                    requiresFace = true
                });
            }

            // Decode frames from base64
            List<byte[]> frameBytesList;
            try
            {
                frameBytesList = dto.Frames.Select(f =>
                {
                    var b64 = f.Contains(',') ? f[(f.IndexOf(',') + 1)..] : f;
                    return Convert.FromBase64String(b64);
                }).ToList();
            }
            catch
            {
                return BadRequest(new
                {
                    message = "One or more frames could not be decoded. Please retry the liveness challenge.",
                    requiresChallenge = true,
                    requiresFace = true,
                    retryable = true
                });
            }

            // Run temporal motion analysis using YuNet landmarks
            var minTurnDelta = _configuration.GetValue<float>("FaceVerification:ChallengeMinTurnDelta", 0.15f);
            var motionResult = await _faceMotionService.VerifyMotionAsync(
                frameBytesList, challenge.ChallengeType, minTurnDelta);

            Console.WriteLine(
                $"[CHALLENGE] type={challenge.ChallengeType} verified={motionResult.IsVerified} " +
                $"offsets=[{string.Join(",", motionResult.FrameOffsets.Select(o => o.ToString("F3")))}]");

            if (!motionResult.IsVerified)
            {
                // Motion check failed — neutral message, does not reveal algorithm details
                return BadRequest(new
                {
                    message = motionResult.FailReason ?? "Liveness challenge not completed. Please follow the on-screen instruction clearly.",
                    requiresChallenge = true,
                    requiresFace = true,
                    retryable = true
                });
            }

            // Challenge passed — use the last frame as the attendance photo
            // (frame index = FrameCount-1, i.e. the most turned position)
            // Override dto.PhotoBase64 with the last frame for the rest of the pipeline.
            // The last frame is the final position — clearest face for identity matching.
            var lastFrameB64 = dto.Frames[^1];
            dto = dto with { PhotoBase64 = lastFrameB64 };
        }

        if (requiresFace)
        {
            // ── 0a. Photo must be present ─────────────────────────────────────
            if (string.IsNullOrWhiteSpace(dto.PhotoBase64))
            {
                return BadRequest(new
                {
                    message = "A selfie photo is required for face attendance. Please retake and submit.",
                    requiresFace = true,
                    isFaceEnrolled = true
                });
            }

            // ── 0b. Decode base64 punch photo ─────────────────────────────────
            try
            {
                var b64 = dto.PhotoBase64.Contains(',')
                    ? dto.PhotoBase64[(dto.PhotoBase64.IndexOf(',') + 1)..]
                    : dto.PhotoBase64;
                photoBytes = Convert.FromBase64String(b64);
            }
            catch
            {
                return BadRequest(new
                {
                    message = "Could not read the photo. Please try again.",
                    requiresFace = true,
                    isFaceEnrolled = true,
                    retryable = true
                });
            }

            // ── 0c. Load enrolled profile photo ───────────────────────────────
            try
            {
                var conn = Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.GetDbConnection(_db.Database);
                if (conn.State == System.Data.ConnectionState.Closed) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT PhotoData FROM employees WHERE employee_id = @id AND organization_id = @org";
                var pId  = cmd.CreateParameter(); pId.ParameterName  = "@id";  pId.Value  = targetEmpId;           cmd.Parameters.Add(pId);
                var pOrg = cmd.CreateParameter(); pOrg.ParameterName = "@org"; pOrg.Value = employee.OrganizationId; cmd.Parameters.Add(pOrg);
                var dbPhoto = await cmd.ExecuteScalarAsync();
                if (dbPhoto != null && dbPhoto != DBNull.Value)
                    enrolledPhotoBytes = (byte[])dbPhoto;
            }
            catch { }

            if (enrolledPhotoBytes == null || enrolledPhotoBytes.Length == 0)
            {
                if (!string.IsNullOrWhiteSpace(employee.PhotoPath))
                {
                    var cleanEnrolled   = employee.PhotoPath.TrimStart('/', '\\');
                    var enrolledDiskPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", cleanEnrolled);
                    if (!System.IO.File.Exists(enrolledDiskPath))
                        enrolledDiskPath = Path.Combine(Directory.GetCurrentDirectory(), cleanEnrolled);
                    if (System.IO.File.Exists(enrolledDiskPath))
                        enrolledPhotoBytes = await System.IO.File.ReadAllBytesAsync(enrolledDiskPath);
                }
            }

            if (enrolledPhotoBytes == null || enrolledPhotoBytes.Length == 0)
            {
                return BadRequest(new
                {
                    message = "Face attendance cannot be completed: No official profile photo has been uploaded for your profile. Please contact HR to upload your profile photo first.",
                    requiresFace = true,
                    isFaceEnrolled = false
                });
            }

            // ── 0d. Face quality check (retry signal — not a fraud signal) ─────
            var quality = FaceQualityValidator.Validate(photoBytes);
            if (!quality.IsAcceptable)
            {
                return BadRequest(new
                {
                    message  = quality.UserMessage ?? "Photo quality is insufficient. Please try again.",
                    requiresFace  = true,
                    isFaceEnrolled = true,
                    retryable = true
                });
            }

            // ── 0e. Server-side liveness check (fail-closed) ──────────────────
            // The backend independently determines liveness via ONNX inference.
            // dto.LivenessVerified is IGNORED regardless of its value.
            if (!_faceAntiSpoofingService.IsAvailable)
            {
                // Both spoof model files must be present in App_Data/models/.
                // Until then, all face punches are blocked (fail-closed policy).
                return StatusCode(503, new
                {
                    message = "Attendance verification is temporarily unavailable. Please try again later or contact your administrator."
                });
            }

            var livenessThreshold = _configuration.GetValue<float>("FaceVerification:LivenessThreshold", 0.60f);
            var livenessResult    = await _faceAntiSpoofingService.CheckLivenessAsync(photoBytes, livenessThreshold);

            if (!livenessResult.IsSuccess)
            {
                // Inference error — fail closed
                return StatusCode(503, new
                {
                    message = "Attendance verification is temporarily unavailable. Please try again later or contact your administrator."
                });
            }

            if (!livenessResult.IsLive)
            {
                // Neutral message — does not expose anti-spoofing details to the client
                return BadRequest(new
                {
                    message = "Face verification failed. Please ensure you are in good lighting and looking directly at the camera.",
                    requiresFace  = true,
                    isFaceEnrolled = true
                });
            }

            // ── 0f. First-punch enrollment marker (metadata only) ─────────────
            if (string.IsNullOrEmpty(employee.FaceId))
            {
                var enrollEmp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId);
                if (enrollEmp != null)
                {
                    enrollEmp.FaceId = "ENROLLED";
                    await _db.SaveChangesAsync();
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

        // ── 3. PHOTO SAVE & ONNX SERVER-SIDE IDENTITY VERIFICATION ─────────
        // photoBytes was decoded in section 0 for face employees.
        // For non-face employees who include a photo, decode it here.
        string? photoUrl = null;
        double? calculatedConfidence = null;  // always server-measured; never seeded from client

        if (photoBytes == null && !string.IsNullOrWhiteSpace(dto.PhotoBase64))
        {
            try
            {
                var b64 = dto.PhotoBase64.Contains(',')
                    ? dto.PhotoBase64[(dto.PhotoBase64.IndexOf(',') + 1)..]
                    : dto.PhotoBase64;
                photoBytes = Convert.FromBase64String(b64);
            }
            catch { /* non-face photo decode failure is non-critical */ }
        }

        if (photoBytes != null)
        {
            try
            {
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
                    // Read identity threshold from config (default 0.50 — do not change
                    // until real calibration data is collected; see FaceVerification config).
                    var identityThreshold = _configuration.GetValue<float>("FaceVerification:IdentityThreshold", 0.50f);
                    var matchResult = await _faceRecognitionService.CompareFacesAsync(photoBytes, enrolledPhotoBytes, threshold: identityThreshold);

                    if (matchResult.IsSuccess)
                    {
                        calculatedConfidence = Math.Round((double)matchResult.SimilarityScore, 4);
                        Console.WriteLine($"[ONNX] score={matchResult.SimilarityScore:F4} isMatch={matchResult.IsMatch} threshold={identityThreshold:F2}");

                        // Server is the sole authority — no on-device bypass
                        if (requiresFace && !matchResult.IsMatch)
                        {
                            return BadRequest(new
                            {
                                message    = $"Face identity mismatch: {matchResult.Message}",
                                requiresFace   = true,
                                isFaceEnrolled = true,
                                confidence = calculatedConfidence
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                if (requiresFace)
                    Console.WriteLine($"[ONNX] Photo processing error: {ex.Message}");
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

        var today = IstDateTime.Today;
        var log = await _db.DailyAttendance
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.EmployeeId == currentEmpId.Value && a.RecordDate == today);

        // Resolve active shift for employee today
        var roster = await _db.ShiftRosters
            .AsNoTracking()
            .Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == currentEmpId.Value && r.RosterDate == today);

        Shift? shift = roster?.Shift;
        if (shift == null)
        {
            var assignment = await _db.EmployeeShiftAssignments
                .AsNoTracking()
                .Include(a => a.Shift)
                .FirstOrDefaultAsync(a => a.EmployeeId == currentEmpId.Value && a.FromDate <= today && (a.ToDate == null || a.ToDate >= today));
            shift = assignment?.Shift;
        }

        if (shift == null)
        {
            var employee = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == currentEmpId.Value);
            shift = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => (employee != null && s.BranchId == employee.BranchId) || s.BranchId == null);
        }

        string shiftName = shift?.ShiftName ?? "General Shift";
        string shiftStart = shift?.StartTime.ToString("hh:mm tt") ?? "09:30 AM";
        string shiftEnd = shift?.EndTime.ToString("hh:mm tt") ?? "06:30 PM";
        decimal targetHours = shift?.WorkingHours > 0 ? shift.WorkingHours : 9.0m;

        return Ok(new
        {
            hasEmployee = true,
            isClockedIn = log?.InTime != null && log.OutTime == null,
            inTime = log?.InTime?.ToString("HH:mm"),
            outTime = log?.OutTime?.ToString("HH:mm"),
            workMinutes = log?.WorkMinutes ?? 0,
            status = log?.Status ?? "Absent",
            isLate = log?.IsLate ?? false,
            lateMinutes = log?.LateMinutes ?? 0,
            shiftName,
            shiftStart,
            shiftEnd,
            targetHours
        });
    }

    [HttpGet("day-details")]
    public async Task<IActionResult> GetDayDetails([FromQuery] int employeeId, [FromQuery] string date)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        bool isSelf = currentEmpId.HasValue && currentEmpId.Value == employeeId;
        if (!isSelf && !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceView))
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

    [HttpGet("my-monthly")]
    public async Task<IActionResult> GetMyMonthlyAttendance(
        [FromQuery] int? employeeId = null,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId = employeeId ?? currentEmpId;

        if (!targetEmpId.HasValue)
        {
            targetEmpId = await _db.Employees
                .AsNoTracking()
                .OrderBy(e => e.EmployeeId)
                .Select(e => (int?)e.EmployeeId)
                .FirstOrDefaultAsync();
        }

        if (!targetEmpId.HasValue)
        {
            return BadRequest(new { message = "No employee found." });
        }

        var selectedYear = year ?? IstDateTime.Now.Year;
        var selectedMonth = month ?? IstDateTime.Now.Month;
        var startDate = new DateOnly(selectedYear, selectedMonth, 1);
        var daysInMonth = DateTime.DaysInMonth(selectedYear, selectedMonth);
        var endDate = startDate.AddMonths(1);

        var employee = await _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId.Value);

        if (employee == null) return NotFound(new { message = "Employee not found." });

        var logs = await _db.DailyAttendance
            .AsNoTracking()
            .Where(a => a.RecordDate >= startDate && a.RecordDate < endDate && a.EmployeeId == targetEmpId.Value)
            .ToListAsync();

        var leaveApps = await _db.LeaveApplications
            .AsNoTracking()
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == targetEmpId.Value && l.StartDate < endDate && l.EndDate >= startDate && (l.Status == "Approved" || l.Status == "Adjusted"))
            .ToListAsync();

        var holidays = await _db.Holidays
            .AsNoTracking()
            .Where(h => h.StartDate < endDate && h.EndDate >= startDate)
            .ToListAsync();

        var monthRosters = await _db.ShiftRosters
            .AsNoTracking()
            .Where(r => r.EmployeeId == targetEmpId.Value && r.RosterDate >= startDate && r.RosterDate < endDate)
            .ToListAsync();

        var today = IstDateTime.Today;

        // Quick check for today's live punches only if today's DailyAttendance is missing
        if (selectedYear == today.Year && selectedMonth == today.Month)
        {
            var existingToday = logs.FirstOrDefault(l => l.RecordDate == today);
            if (existingToday == null)
            {
                var todayStart = today.ToDateTime(TimeOnly.MinValue);
                var todayEnd = today.ToDateTime(TimeOnly.MaxValue);
                var todayPunches = await _db.AttendanceLogs
                    .AsNoTracking()
                    .Where(l => l.EmployeeId == targetEmpId.Value && l.PunchTime >= todayStart && l.PunchTime <= todayEnd)
                    .OrderBy(l => l.PunchTime)
                    .ToListAsync();

                if (todayPunches.Count > 0)
                {
                    var firstIn = TimeOnly.FromDateTime(todayPunches.First().PunchTime);
                    TimeOnly? lastOut = todayPunches.Count > 1 ? TimeOnly.FromDateTime(todayPunches.Last().PunchTime) : null;
                    int workMins = 0;
                    if (lastOut.HasValue && lastOut > firstIn)
                    {
                        workMins = (int)(lastOut.Value - firstIn).TotalMinutes;
                    }
                    logs.Add(new DailyAttendance
                    {
                        EmployeeId = targetEmpId.Value,
                        RecordDate = today,
                        InTime = firstIn,
                        OutTime = lastOut,
                        WorkMinutes = workMins,
                        Status = "Present"
                    });
                }
            }
        }

        // Compute summary via shared Single Source of Truth service
        var summary = _attendanceSummaryService.ComputeSummary(targetEmpId.Value, selectedYear, selectedMonth, logs, leaveApps);

        // Group safely by date to prevent duplicate key crashes
        var logsByDate = logs
            .GroupBy(l => l.RecordDate)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(l => l.OutTime ?? l.InTime).First());

        var days = new List<object>();

        for (int day = 1; day <= daysInMonth; day++)
        {
            var date = new DateOnly(selectedYear, selectedMonth, day);
            logsByDate.TryGetValue(date, out var log);

            var leave = leaveApps.FirstOrDefault(l => l.StartDate <= date && l.EndDate >= date && l.Status == "Approved");
            var holiday = holidays.FirstOrDefault(h => h.StartDate <= date && h.EndDate >= date);
            var roster = monthRosters.FirstOrDefault(r => r.RosterDate == date);

            bool isDefaultWeekoff = !string.IsNullOrWhiteSpace(employee.Weekoff)
                ? string.Equals(employee.Weekoff.Trim(), date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase)
                : date.DayOfWeek == DayOfWeek.Sunday;

            bool isWeekoff = roster != null ? roster.IsWeekOff : isDefaultWeekoff;

            string status;
            if (log != null && !string.IsNullOrWhiteSpace(log.Status) && log.Status != "-")
            {
                status = log.Status;
            }
            else if (leave != null)
            {
                status = leave.LeaveType?.Code ?? "Leave";
            }
            else if (holiday != null)
            {
                status = "Holiday";
            }
            else if (isWeekoff)
            {
                status = "Weekoff";
            }
            else if (date > today)
            {
                status = "Upcoming";
            }
            else
            {
                status = "Absent";
            }

            days.Add(new
            {
                day,
                date = date.ToString("yyyy-MM-dd"),
                dayOfWeek = date.ToString("ddd"),
                fullDayOfWeek = date.ToString("dddd"),
                status,
                inTime = log?.InTime?.ToString("HH:mm"),
                outTime = log?.OutTime?.ToString("HH:mm"),
                workMinutes = log?.WorkMinutes ?? 0,
                workDuration = log?.WorkMinutes > 0 ? $"{log.WorkMinutes / 60}h {log.WorkMinutes % 60}m" : "--",
                isLate = log?.IsLate ?? false,
                lateMinutes = log?.LateMinutes ?? 0,
                isHalfDay = log?.IsHalfDay ?? false,
                hasLeave = leave != null,
                leaveType = leave?.LeaveType?.Name,
                hasHoliday = holiday != null,
                holidayName = holiday?.HolidayName
            });
        }

        return Ok(new
        {
            employeeId = targetEmpId.Value,
            employeeName = employee.EmployeeName,
            year = selectedYear,
            month = selectedMonth,
            daysInMonth,
            summary = new
            {
                presentCount = summary.PresentCount,
                absentCount = summary.AbsentCount,
                halfDayCount = summary.HalfDayCount,
                weekoffCount = summary.WeekoffCount,
                holidayCount = summary.HolidayCount,
                leaveCount = summary.LeaveCount,
                unpaidLeaveCount = summary.UnpaidLeaveCount,
                payableDays = summary.PayableDays
            },
            days
        });
    }

    // ── SuperAdmin calibration endpoint ─────────────────────────────────────
    /// <summary>
    /// PlatformSuperAdmin-only endpoint for calibrating liveness and identity thresholds.
    ///
    /// Accepts two photos and returns all intermediate AI pipeline scores without
    /// recording any attendance. Use these scores to build an internal test dataset
    /// and determine appropriate LivenessThreshold and IdentityThreshold values for
    /// your specific camera, environment, and employee population.
    ///
    /// Security:
    ///   - Requires IsPlatformUser JWT claim (server-signed, cannot be forged)
    ///   - Returns 404 when CalibrationEndpointEnabled = false in config (invisible)
    ///   - Does NOT create AttendanceLog or DailyAttendance records
    ///   - Does NOT write images to disk
    ///
    /// Disable after calibration by setting:
    ///   "FaceVerification": { "CalibrationEndpointEnabled": false }
    /// </summary>
    [HttpPost("debug-face-scores")]
    public async Task<IActionResult> DebugFaceScores([FromBody] DebugFaceScoresRequestDto dto)
    {
        // ── Gate 1: disableable via config (returns 404 — endpoint is invisible) ──
        var enabled = _configuration.GetValue<bool>("FaceVerification:CalibrationEndpointEnabled", false);
        if (!enabled)
            return NotFound();

        // ── Gate 2: PlatformSuperAdmin only ──────────────────────────────────
        var isPlatformAdmin = string.Equals(
            User.FindFirst("IsPlatformUser")?.Value, "true",
            StringComparison.OrdinalIgnoreCase);
        if (!isPlatformAdmin)
            return Forbid();

        try
        {
            // ── Decode photos (never written to disk) ─────────────────────────
            byte[] punchBytes;
            byte[] enrolledBytes;
            try
            {
                var p = dto.PunchPhotoBase64.Contains(',')
                    ? dto.PunchPhotoBase64[(dto.PunchPhotoBase64.IndexOf(',') + 1)..]
                    : dto.PunchPhotoBase64;
                punchBytes = Convert.FromBase64String(p);

                var e = dto.EnrolledPhotoBase64.Contains(',')
                    ? dto.EnrolledPhotoBase64[(dto.EnrolledPhotoBase64.IndexOf(',') + 1)..]
                    : dto.EnrolledPhotoBase64;
                enrolledBytes = Convert.FromBase64String(e);
            }
            catch
            {
                return BadRequest(new { error = "Could not decode one or both base64 images." });
            }

            // ── Quality check ─────────────────────────────────────────────────
            var quality = FaceQualityValidator.Validate(punchBytes);

            // ── Liveness check ────────────────────────────────────────────────
            var livenessThreshold = _configuration.GetValue<float>("FaceVerification:LivenessThreshold", 0.60f);
            AntiSpoofResult? liveness = null;
            if (_faceAntiSpoofingService.IsAvailable)
                liveness = await _faceAntiSpoofingService.CheckLivenessAsync(punchBytes, livenessThreshold);

            // ── Identity check ────────────────────────────────────────────────
            var identityThreshold = _configuration.GetValue<float>("FaceVerification:IdentityThreshold", 0.50f);
            FaceMatchResult? identity = null;
            if (_faceRecognitionService.IsModelAvailable)
                identity = await _faceRecognitionService.CompareFacesAsync(punchBytes, enrolledBytes, identityThreshold);

            // ── Return all scores — no attendance side effects ─────────────────
            return Ok(new
            {
                qualityAcceptable  = quality.IsAcceptable,
                qualityFailReason  = quality.FailReason,
                qualityUserMessage = quality.UserMessage,

                livenessAvailable  = _faceAntiSpoofingService.IsAvailable,
                livenessThreshold,
                liveScoreV2        = liveness?.LiveScoreV2,
                liveScoreV1SE      = liveness?.LiveScoreV1SE,
                liveFusedScore     = liveness?.LiveScore,
                isLive             = liveness?.IsLive,
                livenessReason     = liveness?.Reason,

                identityAvailable  = _faceRecognitionService.IsModelAvailable,
                identityThreshold,
                identitySimilarity = identity?.SimilarityScore,
                isMatch            = identity?.IsMatch,
                identityMessage    = identity?.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
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
    /// [IGNORED BY BACKEND] Retained for wire-compatibility with older app versions only.
    /// The backend independently determines liveness via server-side ONNX inference
    /// (MiniFASNetV2 + MiniFASNetV1SE fusion). The value sent by the client has no
    /// effect on the attendance decision.
    /// </summary>
    bool? LivenessVerified = null,
    /// <summary>
    /// Retained for wire-compatibility. The backend overwrites FaceConfidence in the
    /// attendance log with the server-measured ONNX cosine similarity score.
    /// </summary>
    double? FaceConfidence = null,
    /// <summary>
    /// Retained for wire-compatibility. Not used in the server-side verification pipeline.
    /// </summary>
    string? FaceId = null,
    /// <summary>
    /// [IGNORED BY BACKEND] Retained for wire-compatibility. The server does not trust
    /// on-device face matching results. The onDeviceVerified bypass has been removed.
    /// </summary>
    bool? IsFaceIdNew = null,
    /// <summary>
    /// One-time challenge token obtained from POST /api/attendance/request-challenge.
    /// Required for face attendance employees. The server validates this against
    /// server-side state — sending a fake or reused ID will be rejected.
    /// </summary>
    string? ChallengeId = null,
    /// <summary>
    /// Sequence of base64-encoded JPEG frames captured during the challenge window.
    /// Order matters: frame[0] = baseline (face forward), frame[N-1] = peak movement.
    /// The server runs YuNet on each frame to verify temporal head movement.
    /// Intermediate frames are processed in memory only — not written to disk.
    /// The last frame is used as the attendance photo.
    /// </summary>
    IReadOnlyList<string>? Frames = null
);

/// <summary>Request body for POST /api/attendance/request-challenge.</summary>
public record RequestChallengeDto(
    int? EmployeeId = null,
    string? PunchType = null
);

/// <summary>
/// Request body for POST /api/attendance/debug-face-scores.
/// Both images are base64-encoded JPEG (with or without data URI prefix).
/// Neither image is written to disk — used only for in-memory AI pipeline scoring.
/// </summary>
public record DebugFaceScoresRequestDto(
    string PunchPhotoBase64,
    string EnrolledPhotoBase64
);

