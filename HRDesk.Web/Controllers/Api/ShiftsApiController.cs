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
    private readonly IAttendanceProcessorService _processor;

    public ShiftsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IAttendanceProcessorService processor)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _processor = processor;
    }

    public record ShiftDto(
        string ShiftName,
        string ShiftCode,
        string StartTime, // HH:mm
        string EndTime,   // HH:mm
        int? LateComingGraceMinutes,
        int? EarlyLeaveGraceMinutes,
        string? ColorCode,
        string? HalfTime = null,
        int? BranchId = null
    );

    public record AssignRosterDto(
        List<int> EmployeeIds,
        DateOnly StartDate,
        DateOnly EndDate,
        int? ShiftId,
        bool IsWeekOff,
        bool Overwrite = false,
        bool UpdateMasterShift = false,
        int? BranchId = null
    );

    public record ShiftCycleSlotDto(int SlotIndex, int? ShiftId, bool IsWeekOff);

    public record CreateShiftCycleDto(
        string Name,
        string? Description,
        int CycleLengthDays,
        List<ShiftCycleSlotDto> Slots,
        int? BranchId = null
    );

    public record GenerateFromCycleDto(
        List<int> EmployeeIds,
        int CycleId,
        DateOnly CycleStartDate,
        DateOnly GenerateUntil,
        bool Overwrite = false,
        int? BranchId = null
    );

    // ==========================================
    // SHIFT MASTERS
    // ==========================================

    [HttpGet]
    public async Task<IActionResult> GetShifts([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var query = _db.Shifts.AsNoTracking().AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(s => s.BranchId == activeBranch.Value);
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
                halfTime = s.HalfTime.HasValue ? s.HalfTime.Value.ToString("HH:mm") : null,
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
            LunchBreakDuration = 60,
            WorkingHours = Math.Round((decimal)(eTime.ToTimeSpan() - sTime.ToTimeSpan()).TotalHours - 1m, 2),
            HalfTime = !string.IsNullOrWhiteSpace(dto.HalfTime) && TimeOnly.TryParse(dto.HalfTime, out var hTime)
                ? hTime
                : TimeOnly.FromTimeSpan(sTime.ToTimeSpan() + (eTime.ToTimeSpan() - sTime.ToTimeSpan()) / 2),
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
        if (!string.IsNullOrWhiteSpace(dto.HalfTime) && TimeOnly.TryParse(dto.HalfTime, out var hTimeEdit)) shift.HalfTime = hTimeEdit;

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

        var parsedEnd = parsedStart.AddDays(6);
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var empQuery = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Where(e => e.Status == "active")
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
            empQuery = empQuery.Where(e => e.BranchId == activeBranch.Value);

        if (departmentId.HasValue && departmentId.Value > 0)
            empQuery = empQuery.Where(e => e.DepartmentId == departmentId.Value);

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
            return BadRequest(new { message = "At least one employee must be selected." });

        if (dto.EndDate < dto.StartDate)
            return BadRequest(new { message = "End date cannot be earlier than start date." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        if (dto.UpdateMasterShift && dto.ShiftId.HasValue)
        {
            var currentAssignments = await _db.EmployeeShiftAssignments
                .Where(a => dto.EmployeeIds.Contains(a.EmployeeId) && a.ToDate == null)
                .ToListAsync();

            foreach (var empId in dto.EmployeeIds)
            {
                var existing = currentAssignments.FirstOrDefault(a => a.EmployeeId == empId);
                if (existing != null)
                    existing.ToDate = dto.StartDate.AddDays(-1);

                _db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
                {
                    OrganizationId = orgId,
                    BranchId = targetBranch,
                    EmployeeId = empId,
                    ShiftId = dto.ShiftId.Value,
                    FromDate = dto.StartDate,
                    ToDate = null,
                    CreatedAt = DateTime.Now
                });
            }
        }

        var existingRosters = await _db.ShiftRosters
            .Where(r => dto.EmployeeIds.Contains(r.EmployeeId) && r.RosterDate >= dto.StartDate && r.RosterDate <= dto.EndDate)
            .ToListAsync();

        if (dto.Overwrite)
            _db.ShiftRosters.RemoveRange(existingRosters);

        var existingDates = dto.Overwrite
            ? new HashSet<string>()
            : existingRosters.Select(r => $"{r.EmployeeId}_{r.RosterDate}").ToHashSet();

        var employees = await _db.Employees
            .Where(e => dto.EmployeeIds.Contains(e.EmployeeId))
            .Select(e => new { e.EmployeeId, e.BranchId, e.Weekoff })
            .ToListAsync();

        var newRosters = new List<ShiftRoster>();
        foreach (var emp in employees)
        {
            var branchToSet = targetBranch ?? emp.BranchId;
            for (var d = dto.StartDate; d <= dto.EndDate; d = d.AddDays(1))
            {
                var key = $"{emp.EmployeeId}_{d}";
                if (!dto.Overwrite && existingDates.Contains(key)) continue;

                var isWeekoff = dto.IsWeekOff || (!string.IsNullOrWhiteSpace(emp.Weekoff) &&
                    emp.Weekoff.Trim().Equals(d.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase));

                newRosters.Add(new ShiftRoster
                {
                    OrganizationId = orgId,
                    BranchId = branchToSet,
                    EmployeeId = emp.EmployeeId,
                    ShiftId = isWeekoff ? null : dto.ShiftId,
                    RosterDate = d,
                    IsWeekOff = isWeekoff,
                    CreatedAt = DateTime.Now
                });
            }
        }

        _db.ShiftRosters.AddRange(newRosters);
        await _db.SaveChangesAsync();

        // If any past dates were updated, automatically re-evaluate DailyAttendance with the corrected shift
        var today = DateOnly.FromDateTime(DateTime.Today);
        if (dto.StartDate <= today)
        {
            var endPast = dto.EndDate < today ? dto.EndDate : today;
            for (var d = dto.StartDate; d <= endPast; d = d.AddDays(1))
            {
                foreach (var empId in dto.EmployeeIds)
                {
                    try
                    {
                        await _processor.ProcessDailyAttendanceAsync(d, empId);
                    }
                    catch { /* Non-blocking */ }
                }
            }
        }

        return Ok(new { message = $"Roster generated for {dto.EmployeeIds.Count} employee(s) across {newRosters.Count} date-slots.", count = newRosters.Count });
    }

    // ==========================================
    // SHIFT CYCLES — CRUD
    // ==========================================

    [HttpGet("cycles")]
    public async Task<IActionResult> GetShiftCycles([FromQuery] int? branchId = null)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.ShiftCycles
            .AsNoTracking()
            .Include(c => c.Slots).ThenInclude(s => s.Shift)
            .Where(c => c.OrganizationId == orgId && c.IsActive);

        if (activeBranch.HasValue && activeBranch.Value > 0)
            query = query.Where(c => c.BranchId == activeBranch.Value);

        var cycles = await query.OrderBy(c => c.Name).Select(c => new
        {
            id = c.Id,
            name = c.Name,
            description = c.Description,
            cycleLengthDays = c.CycleLengthDays,
            branchId = c.BranchId,
            createdAt = c.CreatedAt,
            slots = c.Slots.OrderBy(s => s.SlotIndex).Select(s => new
            {
                id = s.Id,
                slotIndex = s.SlotIndex,
                shiftId = s.ShiftId,
                shiftName = s.Shift != null ? s.Shift.ShiftName : null,
                shiftCode = s.Shift != null ? s.Shift.ShiftCode : null,
                colorCode = s.Shift != null ? (s.Shift.ColorCode ?? "#4e73df") : null,
                isWeekOff = s.IsWeekOff
            })
        }).ToListAsync();

        return Ok(cycles);
    }

    [HttpPost("cycles")]
    public async Task<IActionResult> CreateShiftCycle([FromBody] CreateShiftCycleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Cycle name is required." });
        if (dto.CycleLengthDays < 1 || dto.CycleLengthDays > 365)
            return BadRequest(new { message = "Cycle length must be between 1 and 365 days." });
        if (dto.Slots == null || dto.Slots.Count != dto.CycleLengthDays)
            return BadRequest(new { message = $"Provide exactly {dto.CycleLengthDays} slots (one per day in the cycle)." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;
        if (!targetBranch.HasValue || targetBranch.Value <= 0)
            return BadRequest(new { message = "A valid branch is required to create a shift cycle." });

        var cycle = new ShiftCycle
        {
            OrganizationId = orgId,
            BranchId = targetBranch.Value,
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            CycleLengthDays = dto.CycleLengthDays,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Slots = dto.Slots.Select(s => new ShiftCycleSlot
            {
                SlotIndex = s.SlotIndex,
                ShiftId = s.IsWeekOff ? null : s.ShiftId,
                IsWeekOff = s.IsWeekOff
            }).ToList()
        };

        _db.ShiftCycles.Add(cycle);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Shift cycle created successfully.", id = cycle.Id });
    }

    [HttpPut("cycles/{id}")]
    public async Task<IActionResult> UpdateShiftCycle(int id, [FromBody] CreateShiftCycleDto dto)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var cycle = await _db.ShiftCycles.Include(c => c.Slots)
            .FirstOrDefaultAsync(c => c.Id == id && c.OrganizationId == orgId);

        if (cycle == null) return NotFound(new { message = "Shift cycle not found." });
        if (dto.Slots != null && dto.Slots.Count != dto.CycleLengthDays)
            return BadRequest(new { message = $"Provide exactly {dto.CycleLengthDays} slots." });

        cycle.Name = dto.Name?.Trim() ?? cycle.Name;
        cycle.Description = dto.Description?.Trim() ?? cycle.Description;
        cycle.CycleLengthDays = dto.CycleLengthDays;
        cycle.UpdatedAt = DateTime.UtcNow;

        if (dto.Slots != null)
        {
            _db.ShiftCycleSlots.RemoveRange(cycle.Slots);
            cycle.Slots = dto.Slots.Select(s => new ShiftCycleSlot
            {
                CycleId = cycle.Id,
                SlotIndex = s.SlotIndex,
                ShiftId = s.IsWeekOff ? null : s.ShiftId,
                IsWeekOff = s.IsWeekOff
            }).ToList();
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Shift cycle updated successfully." });
    }

    [HttpDelete("cycles/{id}")]
    public async Task<IActionResult> DeleteShiftCycle(int id)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var cycle = await _db.ShiftCycles.FirstOrDefaultAsync(c => c.Id == id && c.OrganizationId == orgId);
        if (cycle == null) return NotFound(new { message = "Shift cycle not found." });

        // Soft delete — preserves roster history
        cycle.IsActive = false;
        cycle.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Shift cycle deleted." });
    }

    // ==========================================
    // ROSTER GENERATION FROM CYCLE
    // ==========================================

    [HttpPost("roster/generate-from-cycle")]
    public async Task<IActionResult> GenerateRosterFromCycle([FromBody] GenerateFromCycleDto dto)
    {
        if (dto.EmployeeIds == null || dto.EmployeeIds.Count == 0)
            return BadRequest(new { message = "At least one employee must be selected." });
        if (dto.GenerateUntil < dto.CycleStartDate)
            return BadRequest(new { message = "GenerateUntil must be on or after CycleStartDate." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var cycleQuery = _db.ShiftCycles.AsNoTracking().Include(c => c.Slots)
            .Where(c => c.Id == dto.CycleId && c.OrganizationId == orgId && c.IsActive);

        if (targetBranch.HasValue && targetBranch.Value > 0)
            cycleQuery = cycleQuery.Where(c => c.BranchId == targetBranch.Value);

        var cycle = await cycleQuery.FirstOrDefaultAsync();

        if (cycle == null) return NotFound(new { message = "Shift cycle not found for the selected branch." });

        var slotsByIndex = cycle.Slots.ToDictionary(s => s.SlotIndex);

        var employees = await _db.Employees
            .Where(e => dto.EmployeeIds.Contains(e.EmployeeId))
            .Select(e => new { e.EmployeeId, e.BranchId })
            .AsNoTracking()
            .ToListAsync();

        if (dto.Overwrite)
        {
            var toDelete = await _db.ShiftRosters
                .Where(r => dto.EmployeeIds.Contains(r.EmployeeId)
                         && r.RosterDate >= dto.CycleStartDate
                         && r.RosterDate <= dto.GenerateUntil)
                .ToListAsync();
            _db.ShiftRosters.RemoveRange(toDelete);
        }

        var existingKeys = dto.Overwrite
            ? new HashSet<string>()
            : (await _db.ShiftRosters
                .Where(r => dto.EmployeeIds.Contains(r.EmployeeId)
                         && r.RosterDate >= dto.CycleStartDate
                         && r.RosterDate <= dto.GenerateUntil)
                .Select(r => $"{r.EmployeeId}_{r.RosterDate}")
                .ToListAsync()).ToHashSet();

        var newRosters = new List<ShiftRoster>();

        foreach (var emp in employees)
        {
            var branchToSet = targetBranch ?? emp.BranchId;

            for (var d = dto.CycleStartDate; d <= dto.GenerateUntil; d = d.AddDays(1))
            {
                var key = $"{emp.EmployeeId}_{d}";
                if (!dto.Overwrite && existingKeys.Contains(key)) continue;

                // Core rotation formula
                int slotIndex = (d.DayNumber - dto.CycleStartDate.DayNumber) % cycle.CycleLengthDays;

                if (!slotsByIndex.TryGetValue(slotIndex, out var slot)) continue;

                newRosters.Add(new ShiftRoster
                {
                    OrganizationId = orgId,
                    BranchId = branchToSet,
                    EmployeeId = emp.EmployeeId,
                    ShiftId = slot.IsWeekOff ? null : slot.ShiftId,
                    RosterDate = d,
                    IsWeekOff = slot.IsWeekOff,
                    Remarks = $"Cycle: {cycle.Name} (Slot {slotIndex})",
                    CreatedAt = DateTime.Now
                });
            }

            // Track the cycle assignment
            var hasAssignment = await _db.EmployeeShiftAssignments
                .AnyAsync(a => a.EmployeeId == emp.EmployeeId && a.CycleId == dto.CycleId && a.ToDate == null);

            if (!hasAssignment)
            {
                var firstWorkSlot = slotsByIndex.Values.FirstOrDefault(s => !s.IsWeekOff);
                _db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
                {
                    OrganizationId = orgId,
                    BranchId = branchToSet,
                    EmployeeId = emp.EmployeeId,
                    ShiftId = firstWorkSlot?.ShiftId ?? 0,
                    FromDate = dto.CycleStartDate,
                    CycleId = dto.CycleId,
                    CycleStartDate = dto.CycleStartDate,
                    CreatedAt = DateTime.Now
                });
            }
        }

        _db.ShiftRosters.AddRange(newRosters);
        await _db.SaveChangesAsync();

        // If past dates were updated, re-evaluate DailyAttendance for those dates
        var todayCycle = DateOnly.FromDateTime(DateTime.Today);
        if (dto.CycleStartDate <= todayCycle)
        {
            var endPast = dto.GenerateUntil < todayCycle ? dto.GenerateUntil : todayCycle;
            for (var d = dto.CycleStartDate; d <= endPast; d = d.AddDays(1))
            {
                foreach (var emp in employees)
                {
                    try
                    {
                        await _processor.ProcessDailyAttendanceAsync(d, emp.EmployeeId);
                    }
                    catch { /* Non-blocking */ }
                }
            }
        }

        return Ok(new
        {
            message = $"Cycle roster generated for {employees.Count} employee(s) — {newRosters.Count} roster slots created.",
            cycleName = cycle.Name,
            cycleLengthDays = cycle.CycleLengthDays,
            count = newRosters.Count
        });
    }

    // ==========================================
    // SHIFT CHANGE REQUESTS (EMPLOYEE SELF-SERVICE)
    // ==========================================

    public record CreateShiftChangeRequestDto(
        int EmployeeId,
        DateOnly RequestDate,
        int? RequestedShiftId,
        bool IsRequestedWeekOff,
        string? Reason,
        int? BranchId = null
    );

    public record ReviewShiftChangeRequestDto(
        string? RejectionReason = null
    );

    [HttpGet("roster/lookup-for-date")]
    public async Task<IActionResult> LookupShiftForDate([FromQuery] int employeeId, [FromQuery] DateOnly date)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var emp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId && e.OrganizationId == orgId);
        if (emp == null) return NotFound(new { message = "Employee not found." });

        var roster = await _db.ShiftRosters.AsNoTracking().Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.RosterDate == date && r.OrganizationId == orgId);

        if (roster != null)
        {
            return Ok(new
            {
                shiftId = roster.ShiftId,
                shiftName = roster.Shift?.ShiftName,
                shiftCode = roster.Shift?.ShiftCode,
                isWeekOff = roster.IsWeekOff,
                timing = roster.Shift != null ? $"{roster.Shift.StartTime:HH:mm} - {roster.Shift.EndTime:HH:mm}" : null
            });
        }

        // Fallback to employee profile default
        var dayName = date.DayOfWeek.ToString();
        var isProfileWo = string.Equals(emp.Weekoff, dayName, StringComparison.OrdinalIgnoreCase);

        return Ok(new
        {
            shiftId = (int?)null,
            shiftName = isProfileWo ? "Default Weekly Off" : "General Shift",
            shiftCode = isProfileWo ? "W/O" : "GEN",
            isWeekOff = isProfileWo,
            timing = (string?)null
        });
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetShiftChangeRequests(
        [FromQuery] string? status = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? branchId = null)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.ShiftChangeRequests
            .AsNoTracking()
            .Include(r => r.Employee)
            .Include(r => r.CurrentShift)
            .Include(r => r.RequestedShift)
            .Where(r => r.OrganizationId == orgId);

        if (activeBranch.HasValue && activeBranch.Value > 0)
            query = query.Where(r => r.BranchId == activeBranch.Value);

        if (employeeId.HasValue && employeeId.Value > 0)
            query = query.Where(r => r.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
            query = query.Where(r => r.Status.ToLower() == status.ToLower());

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                id = r.Id,
                employeeId = r.EmployeeId,
                employeeName = r.Employee != null ? r.Employee.EmployeeName : $"EMP#{r.EmployeeId}",
                employeeCode = r.Employee != null ? $"EMP#{r.Employee.EmployeeId}" : null,
                departmentName = r.Employee != null && r.Employee.Department != null ? r.Employee.Department.DepartmentName : null,
                requestDate = r.RequestDate,
                currentShiftId = r.CurrentShiftId,
                currentShiftName = r.CurrentShift != null ? r.CurrentShift.ShiftName : (r.IsCurrentWeekOff ? "Weekly Off" : "Default Shift"),
                currentShiftCode = r.CurrentShift != null ? r.CurrentShift.ShiftCode : (r.IsCurrentWeekOff ? "W/O" : "GEN"),
                isCurrentWeekOff = r.IsCurrentWeekOff,
                requestedShiftId = r.RequestedShiftId,
                requestedShiftName = r.RequestedShift != null ? r.RequestedShift.ShiftName : (r.IsRequestedWeekOff ? "Weekly Off" : "Shift"),
                requestedShiftCode = r.RequestedShift != null ? r.RequestedShift.ShiftCode : (r.IsRequestedWeekOff ? "W/O" : "REQ"),
                isRequestedWeekOff = r.IsRequestedWeekOff,
                reason = r.Reason,
                status = r.Status,
                reviewedBy = r.ReviewedBy,
                reviewedAt = r.ReviewedAt,
                rejectionReason = r.RejectionReason,
                createdAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateShiftChangeRequest([FromBody] CreateShiftChangeRequestDto dto)
    {
        if (dto.EmployeeId <= 0)
            return BadRequest(new { message = "Employee ID is required." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var emp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId && e.OrganizationId == orgId);
        if (emp == null) return NotFound(new { message = "Employee not found." });

        var targetBranch = dto.BranchId ?? emp.BranchId ?? _tenantProvider.BranchId;

        // Check if there is already a pending request for this employee on this date
        var alreadyPending = await _db.ShiftChangeRequests.AnyAsync(r =>
            r.OrganizationId == orgId &&
            r.EmployeeId == dto.EmployeeId &&
            r.RequestDate == dto.RequestDate &&
            r.Status == "Pending");

        if (alreadyPending)
            return BadRequest(new { message = "A shift change request is already pending for this date." });

        // Resolve current shift from roster or fallback
        var currentRoster = await _db.ShiftRosters.AsNoTracking().Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == dto.EmployeeId && r.RosterDate == dto.RequestDate && r.OrganizationId == orgId);

        var currentShiftId = currentRoster?.ShiftId;
        var isCurrentWo = currentRoster != null
            ? currentRoster.IsWeekOff
            : string.Equals(emp.Weekoff, dto.RequestDate.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase);

        var request = new ShiftChangeRequest
        {
            OrganizationId = orgId,
            BranchId = targetBranch,
            EmployeeId = dto.EmployeeId,
            RequestDate = dto.RequestDate,
            CurrentShiftId = currentShiftId,
            IsCurrentWeekOff = isCurrentWo,
            RequestedShiftId = dto.IsRequestedWeekOff ? null : dto.RequestedShiftId,
            IsRequestedWeekOff = dto.IsRequestedWeekOff,
            Reason = dto.Reason?.Trim(),
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _db.ShiftChangeRequests.Add(request);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Shift change request submitted successfully.", id = request.Id });
    }

    [HttpPost("requests/{id}/approve")]
    public async Task<IActionResult> ApproveShiftChangeRequest(int id)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var request = await _db.ShiftChangeRequests.Include(r => r.Employee)
            .FirstOrDefaultAsync(r => r.Id == id && r.OrganizationId == orgId);

        if (request == null) return NotFound(new { message = "Shift change request not found." });
        if (request.Status != "Pending") return BadRequest(new { message = $"Request is already {request.Status}." });

        var reviewer = User?.Identity?.Name ?? "Manager";
        request.Status = "Approved";
        request.ReviewedBy = reviewer;
        request.ReviewedAt = DateTime.UtcNow;

        // Update or create ShiftRoster for this date
        var roster = await _db.ShiftRosters
            .FirstOrDefaultAsync(r => r.EmployeeId == request.EmployeeId && r.RosterDate == request.RequestDate && r.OrganizationId == orgId);

        if (roster != null)
        {
            roster.ShiftId = request.IsRequestedWeekOff ? null : request.RequestedShiftId;
            roster.IsWeekOff = request.IsRequestedWeekOff;
            roster.Remarks = $"Shift Request #{request.Id} Approved by {reviewer}";
        }
        else
        {
            _db.ShiftRosters.Add(new ShiftRoster
            {
                OrganizationId = orgId,
                BranchId = request.BranchId ?? request.Employee?.BranchId,
                EmployeeId = request.EmployeeId,
                ShiftId = request.IsRequestedWeekOff ? null : request.RequestedShiftId,
                RosterDate = request.RequestDate,
                IsWeekOff = request.IsRequestedWeekOff,
                Remarks = $"Shift Request #{request.Id} Approved by {reviewer}",
                CreatedAt = DateTime.Now
            });
        }

        await _db.SaveChangesAsync();

        // If date is in the past, recalculate DailyAttendance
        var today = DateOnly.FromDateTime(DateTime.Today);
        if (request.RequestDate <= today)
        {
            try
            {
                await _processor.ProcessDailyAttendanceAsync(request.RequestDate, request.EmployeeId);
            }
            catch { /* Non-blocking */ }
        }

        return Ok(new { message = "Shift change request approved and roster updated successfully." });
    }

    [HttpPost("requests/{id}/reject")]
    public async Task<IActionResult> RejectShiftChangeRequest(int id, [FromBody] ReviewShiftChangeRequestDto dto)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var request = await _db.ShiftChangeRequests.FirstOrDefaultAsync(r => r.Id == id && r.OrganizationId == orgId);

        if (request == null) return NotFound(new { message = "Shift change request not found." });
        if (request.Status != "Pending") return BadRequest(new { message = $"Request is already {request.Status}." });

        var reviewer = User?.Identity?.Name ?? "Manager";
        request.Status = "Rejected";
        request.ReviewedBy = reviewer;
        request.ReviewedAt = DateTime.UtcNow;
        request.RejectionReason = dto.RejectionReason?.Trim();

        await _db.SaveChangesAsync();

        return Ok(new { message = "Shift change request rejected." });
    }
}

