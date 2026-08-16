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
public class LeavesController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly ISequenceService _sequenceService;
    private readonly ICompOffService _compOffService;
    private readonly IAttendanceProcessorService _processor;
    private readonly ICurrentTenantProvider _tenantProvider;

    public LeavesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ISequenceService sequenceService,
        ICompOffService compOffService,
        IAttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _sequenceService = sequenceService;
        _compOffService = compOffService;
        _processor = processor;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("applications")]
    public async Task<IActionResult> GetLeaveApplications(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesView))
        {
            return Forbid();
        }

        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.LeaveApplications
            .AsNoTracking()
            .Include(la => la.Employee)
                .ThenInclude(e => e.Department)
            .Include(la => la.LeaveType)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(la => la.Employee != null && la.Employee.BranchId == activeBranch.Value);
        }

        query = await _permissionService.ApplyLeaveScopeAsync(query, User, AppPermissions.Keys.LeavesView);

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(la => la.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(la =>
                (la.ApplicationNumber != null && la.ApplicationNumber.ToLower().Contains(s)) ||
                (la.Employee != null && la.Employee.EmployeeName.ToLower().Contains(s)) ||
                (la.Reason != null && la.Reason.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync();
        if (pageSize <= 0) pageSize = 30;

        var items = await query
            .OrderByDescending(la => la.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(la => new
            {
                la.Id,
                la.ApplicationNumber,
                la.EmployeeId,
                EmployeeName = la.Employee != null ? la.Employee.EmployeeName : null,
                Department = la.Employee != null && la.Employee.Department != null ? la.Employee.Department.DepartmentName : null,
                LeaveTypeId = la.LeaveTypeId,
                LeaveTypeCode = la.LeaveType != null ? la.LeaveType.Code : null,
                LeaveTypeName = la.LeaveType != null ? la.LeaveType.Name : null,
                la.StartDate,
                la.EndDate,
                la.TotalDays,
                la.DayType,
                la.Reason,
                la.Status,
                la.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("balances/{employeeId}")]
    public async Task<IActionResult> GetLeaveBalances(int employeeId)
    {
        var targetEmpQuery = _db.Employees.Where(e => e.EmployeeId == employeeId);
        targetEmpQuery = await _permissionService.ApplyEmployeeScopeAsync(targetEmpQuery, User, AppPermissions.Keys.LeavesView);
        if (!await targetEmpQuery.AnyAsync())
        {
            return Forbid();
        }

        var leaveTypes = await _cache.GetLeaveTypesAsync();
        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentYear = today.Year;

        var allocations = await _db.LeaveAllocations
            .Where(la => la.EmployeeId == employeeId && la.Year == currentYear)
            .ToListAsync();

        var approvedLeaves = await _db.LeaveApplications
            .Where(la => la.EmployeeId == employeeId &&
                         la.Status == "Approved" &&
                         la.StartDate.Year == currentYear)
            .ToListAsync();

        var compOffBalance = await _compOffService.GetValidBalanceAsync(employeeId, today);

        var balances = leaveTypes.Select(lt =>
        {
            if (lt.Code == "CO")
            {
                return new
                {
                    LeaveTypeId = lt.Id,
                    lt.Code,
                    lt.Name,
                    Allocated = compOffBalance,
                    Used = approvedLeaves.Where(l => l.LeaveTypeId == lt.Id).Sum(l => l.TotalDays),
                    Remaining = compOffBalance
                };
            }

            var alloc = allocations.FirstOrDefault(a => a.LeaveTypeId == lt.Id);
            var allocated = alloc?.TotalAllocated ?? 0m;
            var used = approvedLeaves.Where(l => l.LeaveTypeId == lt.Id).Sum(l => l.TotalDays);
            var remaining = Math.Max(0, (alloc?.RemainingCount ?? 0m));

            return new
            {
                LeaveTypeId = lt.Id,
                lt.Code,
                lt.Name,
                Allocated = allocated,
                Used = used,
                Remaining = remaining
            };
        });

        return Ok(new { employeeId, year = currentYear, balances });
    }

    [HttpGet("types")]
    public async Task<IActionResult> GetLeaveTypes()
    {
        var types = await _cache.GetLeaveTypesAsync();
        return Ok(types.Select(t => new { LeaveTypeId = t.Id, t.Code, t.Name, t.IsPaid, t.TextColor, t.BackgroundColor }));
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyLeave([FromBody] LeaveApplyRequestDto dto)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId = dto.EmployeeId ?? currentEmpId;

        if (!targetEmpId.HasValue)
        {
            return BadRequest(new { message = "Target employee is required." });
        }

        // Scope check
        if (targetEmpId.Value != currentEmpId)
        {
            if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApply))
            {
                return Forbid();
            }
        }

        if (dto.StartDate > dto.EndDate)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        var emp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == targetEmpId.Value);
        if (emp == null) return NotFound(new { message = "Employee not found." });

        var appNumber = await _sequenceService.GenerateApplicationNumberAsync(dto.StartDate);

        bool isHalf = dto.DayType == "First Half" || dto.DayType == "Second Half";
        decimal totalDays = isHalf ? 0.5m : (dto.EndDate.DayNumber - dto.StartDate.DayNumber + 1);

        var leaveApp = new LeaveApplication
        {
            ApplicationNumber = appNumber,
            EmployeeId = targetEmpId.Value,
            LeaveTypeId = dto.LeaveTypeId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            TotalDays = totalDays,
            DayType = dto.DayType ?? "Full Day",
            Reason = dto.Reason,
            Status = "Pending",
            CreatedAt = DateTime.Now,
            OrganizationId = emp.OrganizationId
        };

        _db.LeaveApplications.Add(leaveApp);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Leave application submitted successfully.", applicationNumber = appNumber });
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] LeaveStatusUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApprove))
        {
            return Forbid();
        }

        var query = _db.LeaveApplications.Where(la => la.Id == id);
        query = await _permissionService.ApplyLeaveScopeAsync(query, User, AppPermissions.Keys.LeavesApprove);

        var leave = await query.FirstOrDefaultAsync();
        if (leave == null)
        {
            return NotFound(new { message = "Leave application not found or unauthorized." });
        }

        leave.Status = dto.Status;
        leave.ApprovedBy = User.Identity?.Name;
        await _db.SaveChangesAsync();

        // Reprocess attendance in background for that date range
        _ = Task.Run(async () =>
        {
            try
            {
                for (var d = leave.StartDate; d <= leave.EndDate; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, leave.EmployeeId);
                }
            }
            catch { }
        });

        return Ok(new { message = $"Leave application marked as {dto.Status}." });
    }

    public record LeaveApplyRequestDto(int? EmployeeId, int LeaveTypeId, DateOnly StartDate, DateOnly EndDate, string? DayType, string? Reason);
    public record LeaveStatusUpdateDto(string Status, string? Remarks);
}
