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
public class ShiftsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public ShiftsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    public record ShiftDto(
        string ShiftName,
        string ShiftCode,
        string StartTime, // HH:mm
        string EndTime,   // HH:mm
        int? LateComingGraceMinutes,
        int? EarlyLeaveGraceMinutes,
        string? ColorCode,
        int? BranchId = null
    );

    public record AssignRosterDto(
        List<int> EmployeeIds,
        DateOnly StartDate,
        DateOnly EndDate,
        int? ShiftId,
        bool IsWeekOff,
        int? BranchId = null
    );

    [HttpGet]
    public async Task<IActionResult> GetShifts([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var query = _db.Shifts.AsNoTracking().AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(s => s.BranchId == activeBranch.Value || s.BranchId == null);
        }

        var shifts = await query
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                id = s.Id,
                shiftName = s.ShiftName,
                shiftCode = s.ShiftCode,
                startTime = s.StartTime.ToString("HH:mm"),
                endTime = s.EndTime.ToString("HH:mm"),
                workingHours = s.WorkingHours,
                lateComingGraceMinutes = s.LateComingGraceMinutes ?? 15,
                earlyLeaveGraceMinutes = s.EarlyLeaveGraceMinutes ?? 15,
                colorCode = s.ColorCode ?? "#4e73df",
                branchId = s.BranchId
            })
            .ToListAsync();

        return Ok(shifts);
    }

    [HttpPost]
    public async Task<IActionResult> CreateShift([FromBody] ShiftDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ShiftName)) return BadRequest(new { message = "Shift name is required." });
        if (!TimeOnly.TryParse(dto.StartTime, out var sTime)) return BadRequest(new { message = "Invalid start time." });
        if (!TimeOnly.TryParse(dto.EndTime, out var eTime)) return BadRequest(new { message = "Invalid end time." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var shift = new Shift
        {
            ShiftName = dto.ShiftName.Trim(),
            ShiftCode = dto.ShiftCode?.Trim().ToUpper() ?? "GEN",
            StartTime = sTime,
            EndTime = eTime,
            LateComingGraceMinutes = dto.LateComingGraceMinutes ?? 15,
            EarlyLeaveGraceMinutes = dto.EarlyLeaveGraceMinutes ?? 15,
            ColorCode = dto.ColorCode ?? "#4e73df",
            OrganizationId = orgId,
            BranchId = targetBranch,
            Status = "active"
        };

        _db.Shifts.Add(shift);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Shift master created successfully.", id = shift.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateShift(int id, [FromBody] ShiftDto dto)
    {
        var shift = await _db.Shifts.FindAsync(id);
        if (shift == null) return NotFound(new { message = "Shift not found." });

        if (!string.IsNullOrWhiteSpace(dto.ShiftName)) shift.ShiftName = dto.ShiftName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.ShiftCode)) shift.ShiftCode = dto.ShiftCode.Trim().ToUpper();
        if (TimeOnly.TryParse(dto.StartTime, out var sTime)) shift.StartTime = sTime;
        if (TimeOnly.TryParse(dto.EndTime, out var eTime)) shift.EndTime = eTime;
        shift.LateComingGraceMinutes = dto.LateComingGraceMinutes;
        shift.EarlyLeaveGraceMinutes = dto.EarlyLeaveGraceMinutes;
        if (!string.IsNullOrWhiteSpace(dto.ColorCode)) shift.ColorCode = dto.ColorCode;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Shift updated successfully.", id = shift.Id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteShift(int id)
    {
        var shift = await _db.Shifts.FindAsync(id);
        if (shift == null) return NotFound(new { message = "Shift not found." });

        _db.Shifts.Remove(shift);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Shift deleted successfully." });
    }

    // ==========================================
    // ROSTER MANAGEMENT
    // ==========================================
    [HttpGet("roster")]
    public async Task<IActionResult> GetWeeklyRoster(
        [FromQuery] string startDate,
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!DateOnly.TryParse(startDate, out var parsedStart))
        {
            parsedStart = DateOnly.FromDateTime(DateTime.Today);
        }

        var parsedEnd = parsedStart.AddDays(6); // 7-day week window
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var empQuery = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Where(e => e.Status == "active")
            .AsQueryable();

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

        var totalCount = await empQuery.CountAsync();

        var employees = await empQuery
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var empIds = employees.Select(e => e.EmployeeId).ToList();

        // Fetch roster assignments for these employees in this week
        var rosters = await _db.ShiftRosters
            .AsNoTracking()
            .Include(r => r.Shift)
            .Where(r => empIds.Contains(r.EmployeeId) && r.RosterDate >= parsedStart && r.RosterDate <= parsedEnd)
            .ToListAsync();

        var rosterItems = employees.Select(emp =>
        {
            var sched = new Dictionary<string, string>();
            for (int i = 0; i < 7; i++)
            {
                var d = parsedStart.AddDays(i);
                var match = rosters.FirstOrDefault(r => r.EmployeeId == emp.EmployeeId && r.RosterDate == d);
                if (match != null)
                {
                    sched[i.ToString()] = match.IsWeekOff ? "W/O" : (match.Shift?.ShiftCode ?? "GEN");
                }
                else
                {
                    // Default fallback based on employee weekoff
                    var dayName = d.DayOfWeek.ToString();
                    bool isWo = string.Equals(emp.Weekoff, dayName, StringComparison.OrdinalIgnoreCase);
                    sched[i.ToString()] = isWo ? "W/O" : "GEN";
                }
            }

            return new
            {
                employeeId = emp.EmployeeId,
                employeeName = emp.EmployeeName,
                department = emp.Department != null ? emp.Department.DepartmentName : "General",
                designation = emp.Designation != null ? emp.Designation.DesignationName : "Staff",
                schedule = sched
            };
        }).ToList();

        return Ok(new
        {
            startDate = parsedStart.ToString("yyyy-MM-dd"),
            endDate = parsedEnd.ToString("yyyy-MM-dd"),
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            items = rosterItems
        });
    }

    [HttpPost("roster/assign")]
    public async Task<IActionResult> AssignRoster([FromBody] AssignRosterDto dto)
    {
        if (dto.EmployeeIds == null || dto.EmployeeIds.Count == 0)
        {
            return BadRequest(new { message = "At least one employee must be selected." });
        }

        if (dto.EndDate < dto.StartDate)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var existingRosters = await _db.ShiftRosters
            .Where(r => dto.EmployeeIds.Contains(r.EmployeeId) && r.RosterDate >= dto.StartDate && r.RosterDate <= dto.EndDate)
            .ToListAsync();

        _db.ShiftRosters.RemoveRange(existingRosters);

        var employees = await _db.Employees
            .Where(e => dto.EmployeeIds.Contains(e.EmployeeId))
            .ToDictionaryAsync(e => e.EmployeeId, e => e.BranchId);

        var newRosters = new List<ShiftRoster>();
        foreach (var empId in dto.EmployeeIds)
        {
            employees.TryGetValue(empId, out var empBranch);
            var branchToSet = targetBranch ?? empBranch;

            for (var d = dto.StartDate; d <= dto.EndDate; d = d.AddDays(1))
            {
                newRosters.Add(new ShiftRoster
                {
                    OrganizationId = orgId,
                    BranchId = branchToSet,
                    EmployeeId = empId,
                    ShiftId = dto.IsWeekOff ? null : dto.ShiftId,
                    RosterDate = d,
                    IsWeekOff = dto.IsWeekOff,
                    CreatedAt = DateTime.Now
                });
            }
        }

        _db.ShiftRosters.AddRange(newRosters);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Successfully assigned roster across {newRosters.Count} date-slots.", count = newRosters.Count });
    }
}
