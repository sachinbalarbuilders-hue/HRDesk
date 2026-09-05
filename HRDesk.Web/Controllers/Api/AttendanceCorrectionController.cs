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
public class AttendanceCorrectionController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly AttendanceProcessorService _processor;
    private readonly ICurrentTenantProvider _tenantProvider;

    public AttendanceCorrectionController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        AttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _processor = processor;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("eligible-employees")]
    public async Task<IActionResult> GetEligibleEmployees([FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceCreate))
        {
            return StatusCode(403, new { message = "You do not have permission to add attendance punches." });
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Branch)
            .Where(e => e.Status == "Active" || e.Status == "active" || e.Status == "Onboarding" || e.Status == "onboarding")
            .AsQueryable();

        var scope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.AttendanceCreate);

        if (string.Equals(scope, AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase))
        {
            var activeBranch = branchId ?? _tenantProvider.BranchId;
            if (activeBranch.HasValue && activeBranch.Value > 0)
            {
                query = query.Where(e => e.BranchId == activeBranch.Value);
            }
        }
        else
        {
            query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.AttendanceCreate);
        }

        var list = await query
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                employeeId = e.EmployeeId,
                employeeName = e.EmployeeName,
                departmentId = e.DepartmentId,
                departmentName = e.Department != null ? e.Department.DepartmentName : null,
                branchId = e.BranchId,
                branchName = e.Branch != null ? e.Branch.Name : null
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("manual-punch")]
    public async Task<IActionResult> AddManualPunch([FromBody] ManualPunchDto dto)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceCreate);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to add attendance punches." });
        }

        if (dto.EmployeeId <= 0) return BadRequest(new { message = "Valid Employee ID is required." });
        if (string.IsNullOrWhiteSpace(dto.PunchDate)) return BadRequest(new { message = "Punch Date is required." });
        if (string.IsNullOrWhiteSpace(dto.InTime) && string.IsNullOrWhiteSpace(dto.OutTime))
            return BadRequest(new { message = "At least In Time or Out Time is required." });

        if (!DateOnly.TryParse(dto.PunchDate, out var punchDate))
            return BadRequest(new { message = $"Invalid date format: {dto.PunchDate}" });

        TimeOnly? inTime = null;
        TimeOnly? outTime = null;

        if (!string.IsNullOrWhiteSpace(dto.InTime))
        {
            if (!TimeOnly.TryParse(dto.InTime, out var parsed))
                return BadRequest(new { message = $"Invalid In Time format: {dto.InTime}" });
            inTime = parsed;
        }

        if (!string.IsNullOrWhiteSpace(dto.OutTime))
        {
            if (!TimeOnly.TryParse(dto.OutTime, out var parsed))
                return BadRequest(new { message = $"Invalid Out Time format: {dto.OutTime}" });
            outTime = parsed;
        }

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceCreate);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
        
        if (employee == null) return NotFound(new { message = "Employee not found or you do not have permission to manage attendance for this employee." });

        // Insert In punch
        if (inTime.HasValue)
        {
            _db.AttendanceLogs.Add(new AttendanceLog
            {
                EmployeeId = dto.EmployeeId,
                PunchTime = punchDate.ToDateTime(inTime.Value),
                MachineNumber = 0,
                VerifyMode = 99,
                VerifyType = "Manual-In",
                OrganizationId = employee.OrganizationId,
                CreatedAt = IstDateTime.Now,
                SyncedAt = IstDateTime.Now,
            });
        }

        // Insert Out punch
        if (outTime.HasValue)
        {
            _db.AttendanceLogs.Add(new AttendanceLog
            {
                EmployeeId = dto.EmployeeId,
                PunchTime = punchDate.ToDateTime(outTime.Value),
                MachineNumber = 0,
                VerifyMode = 99,
                VerifyType = "Manual-Out",
                OrganizationId = employee.OrganizationId,
                CreatedAt = IstDateTime.Now,
                SyncedAt = IstDateTime.Now,
            });
        }

        await _db.SaveChangesAsync();

        // Trigger processor so DailyAttendance is updated immediately
        await _processor.ProcessDailyAttendanceAsync(punchDate, dto.EmployeeId);

        return Ok(new { message = "Attendance saved successfully." });
    }

    [HttpDelete("day")]
    public async Task<IActionResult> DeleteDayAttendance([FromQuery] int employeeId, [FromQuery] string date)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceDelete);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to delete attendance records." });
        }

        if (employeeId <= 0) return BadRequest(new { message = "Valid Employee ID is required." });
        if (string.IsNullOrWhiteSpace(date)) return BadRequest(new { message = "Date is required." });

        if (!DateOnly.TryParse(date, out var recordDate))
            return BadRequest(new { message = $"Invalid date format: {date}. Expected YYYY-MM-DD." });

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceEdit);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

        if (employee == null)
        {
            return StatusCode(403, new { message = "You do not have permission to delete attendance for this employee." });
        }

        var dayStart = recordDate.ToDateTime(TimeOnly.MinValue);
        var dayEnd = recordDate.ToDateTime(TimeOnly.MaxValue);

        var logs = await _db.AttendanceLogs
            .Where(l => l.EmployeeId == employeeId && l.PunchTime >= dayStart && l.PunchTime <= dayEnd)
            .ToListAsync();

        if (logs.Any())
        {
            _db.AttendanceLogs.RemoveRange(logs);
        }

        var daily = await _db.DailyAttendance
            .FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.RecordDate == recordDate);

        if (daily != null)
        {
            _db.DailyAttendance.Remove(daily);
        }

        await _db.SaveChangesAsync();

        // Recalculate daily attendance so roster/leave/holiday/absent status is cleanly re-established
        await _processor.ProcessDailyAttendanceAsync(recordDate, employeeId);

        return Ok(new { message = "Attendance record deleted and day recalculated successfully." });
    }

    [HttpDelete("punch/{id:long}")]
    public async Task<IActionResult> DeletePunch([FromRoute] long id)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceDelete);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to delete punch records." });
        }

        var punch = await _db.AttendanceLogs.FirstOrDefaultAsync(l => l.Id == id);
        if (punch == null)
        {
            return NotFound(new { message = "Punch log not found." });
        }

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceEdit);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == punch.EmployeeId);

        if (employee == null)
        {
            return StatusCode(403, new { message = "You do not have permission to delete punches for this employee." });
        }

        var punchDate = DateOnly.FromDateTime(punch.PunchTime);
        int employeeId = punch.EmployeeId;

        _db.AttendanceLogs.Remove(punch);
        await _db.SaveChangesAsync();

        // Recalculate daily attendance with remaining punches
        await _processor.ProcessDailyAttendanceAsync(punchDate, employeeId);

        return Ok(new { message = "Punch log deleted and day recalculated successfully." });
    }

    [HttpPut("punch/{id:long}")]
    public async Task<IActionResult> EditPunch([FromRoute] long id, [FromBody] EditSinglePunchDto dto)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceEdit);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to edit punch records." });
        }

        var punch = await _db.AttendanceLogs.FirstOrDefaultAsync(l => l.Id == id);
        if (punch == null)
        {
            return NotFound(new { message = "Punch log not found." });
        }

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceEdit);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == punch.EmployeeId);

        if (employee == null)
        {
            return StatusCode(403, new { message = "You do not have permission to edit punches for this employee." });
        }

        if (string.IsNullOrWhiteSpace(dto.Time) || !TimeOnly.TryParse(dto.Time, out var newTime))
        {
            return BadRequest(new { message = $"Invalid time: {dto.Time}. Expected format HH:mm." });
        }

        var punchDate = DateOnly.FromDateTime(punch.PunchTime);
        punch.PunchTime = punchDate.ToDateTime(newTime);
        punch.VerifyType = !string.IsNullOrWhiteSpace(dto.Reason) ? $"Manual (Edited: {dto.Reason})" : "Manual (Edited)";
        punch.SyncedAt = IstDateTime.Now;

        await _db.SaveChangesAsync();

        // Recalculate daily attendance for the punch date
        await _processor.ProcessDailyAttendanceAsync(punchDate, punch.EmployeeId);

        return Ok(new { message = "Punch updated and day recalculated successfully." });
    }

    [HttpDelete("pair")]
    public async Task<IActionResult> DeletePunchPair([FromQuery] long punchId1, [FromQuery] long? punchId2 = null)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceDelete);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to delete attendance records." });
        }

        var ids = new List<long> { punchId1 };
        if (punchId2.HasValue && punchId2.Value > 0)
        {
            ids.Add(punchId2.Value);
        }

        var punches = await _db.AttendanceLogs.Where(l => ids.Contains(l.Id)).ToListAsync();
        if (!punches.Any())
        {
            return NotFound(new { message = "Punch logs not found." });
        }

        var employeeId = punches.First().EmployeeId;
        var punchDate = DateOnly.FromDateTime(punches.First().PunchTime);

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceEdit);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

        if (employee == null)
        {
            return StatusCode(403, new { message = "You do not have permission to delete punches for this employee." });
        }

        _db.AttendanceLogs.RemoveRange(punches);
        await _db.SaveChangesAsync();

        // Recalculate daily attendance with remaining punches
        await _processor.ProcessDailyAttendanceAsync(punchDate, employeeId);

        return Ok(new { message = "Punch pair deleted and day recalculated successfully." });
    }

    [HttpPut("edit")]
    public async Task<IActionResult> EditDayAttendance([FromBody] EditAttendanceDto dto)
    {
        var hasPermission = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceEdit);
        if (!hasPermission)
        {
            return StatusCode(403, new { message = "You do not have permission to edit attendance records." });
        }

        if (dto.EmployeeId <= 0) return BadRequest(new { message = "Valid Employee ID is required." });
        if (string.IsNullOrWhiteSpace(dto.Date)) return BadRequest(new { message = "Date is required." });

        if (!DateOnly.TryParse(dto.Date, out var recordDate))
            return BadRequest(new { message = $"Invalid date format: {dto.Date}. Expected YYYY-MM-DD." });

        if (string.IsNullOrWhiteSpace(dto.InTime) && string.IsNullOrWhiteSpace(dto.OutTime))
            return BadRequest(new { message = "At least In Time or Out Time must be provided." });

        TimeOnly? inTime = null;
        TimeOnly? outTime = null;

        if (!string.IsNullOrWhiteSpace(dto.InTime))
        {
            if (!TimeOnly.TryParse(dto.InTime, out var parsedIn))
                return BadRequest(new { message = $"Invalid In Time: {dto.InTime}" });
            inTime = parsedIn;
        }

        if (!string.IsNullOrWhiteSpace(dto.OutTime))
        {
            if (!TimeOnly.TryParse(dto.OutTime, out var parsedOut))
                return BadRequest(new { message = $"Invalid Out Time: {dto.OutTime}" });
            outTime = parsedOut;
        }

        var empQuery = _db.Employees.AsQueryable();
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.AttendanceEdit);
        var employee = await empQuery.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);

        if (employee == null)
        {
            return StatusCode(403, new { message = "You do not have permission to edit attendance for this employee." });
        }

        var dayStart = recordDate.ToDateTime(TimeOnly.MinValue);
        var dayEnd = recordDate.ToDateTime(TimeOnly.MaxValue);

        if ((dto.PunchId1.HasValue && dto.PunchId1.Value > 0) || (dto.PunchId2.HasValue && dto.PunchId2.Value > 0))
        {
            var pairIds = new List<long>();
            if (dto.PunchId1.HasValue && dto.PunchId1.Value > 0) pairIds.Add(dto.PunchId1.Value);
            if (dto.PunchId2.HasValue && dto.PunchId2.Value > 0) pairIds.Add(dto.PunchId2.Value);

            var existingPairLogs = await _db.AttendanceLogs
                .Where(l => pairIds.Contains(l.Id))
                .ToListAsync();

            if (existingPairLogs.Any())
            {
                _db.AttendanceLogs.RemoveRange(existingPairLogs);
            }
        }
        else
        {
            var existingLogs = await _db.AttendanceLogs
                .Where(l => l.EmployeeId == dto.EmployeeId && l.PunchTime >= dayStart && l.PunchTime <= dayEnd)
                .ToListAsync();

            if (existingLogs.Any())
            {
                _db.AttendanceLogs.RemoveRange(existingLogs);
            }
        }

        if (inTime.HasValue)
        {
            _db.AttendanceLogs.Add(new AttendanceLog
            {
                EmployeeId = dto.EmployeeId,
                PunchTime = recordDate.ToDateTime(inTime.Value),
                MachineNumber = 0,
                VerifyMode = 1,
                VerifyType = "Manual-In (Edited)",
                OrganizationId = employee.OrganizationId,
                CreatedAt = IstDateTime.Now,
                SyncedAt = IstDateTime.Now,
            });
        }

        if (outTime.HasValue)
        {
            _db.AttendanceLogs.Add(new AttendanceLog
            {
                EmployeeId = dto.EmployeeId,
                PunchTime = recordDate.ToDateTime(outTime.Value),
                MachineNumber = 0,
                VerifyMode = 2,
                VerifyType = "Manual-Out (Edited)",
                OrganizationId = employee.OrganizationId,
                CreatedAt = IstDateTime.Now,
                SyncedAt = IstDateTime.Now,
            });
        }

        await _db.SaveChangesAsync();

        // Recalculate daily attendance with the new times
        await _processor.ProcessDailyAttendanceAsync(recordDate, dto.EmployeeId);

        return Ok(new { message = "Attendance record updated successfully." });
    }
}
