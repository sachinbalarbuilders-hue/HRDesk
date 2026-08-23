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
    private readonly ICompOffService _compOffService;
    private readonly IAttendanceProcessorService _processor;
    private readonly ICurrentTenantProvider _tenantProvider;

    public LeavesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ICompOffService compOffService,
        IAttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _compOffService = compOffService;
        _processor = processor;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("applications")]
    public async Task<IActionResult> GetLeaveApplications(
        [FromQuery] string? status = null,
        [FromQuery] string? archiveFilter = null,
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

        // Archive Filter scoping
        var effArchive = !string.IsNullOrWhiteSpace(archiveFilter) ? archiveFilter.Trim().ToLower() : "active";
        if (status?.ToLower() == "archived" || effArchive == "archived")
        {
            query = query.Where(la => la.Status == "Archived" || la.Status == "Cancelled");
        }
        else if (effArchive == "active")
        {
            query = query.Where(la => la.Status != "Archived" && la.Status != "Cancelled");
            if (!string.IsNullOrWhiteSpace(status) && status != "all" && status != "active")
            {
                query = query.Where(la => la.Status == status);
            }
        }
        else if (effArchive == "all")
        {
            if (!string.IsNullOrWhiteSpace(status) && status != "all")
            {
                query = query.Where(la => la.Status == status);
            }
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

        // Filter leave types by employee eligibility
        var emp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (emp != null)
        {
            leaveTypes = leaveTypes.Where(t => IsLeaveTypeEligible(t, emp)).ToList();
        }

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
    public async Task<IActionResult> GetLeaveTypes([FromQuery] int? employeeId = null)
    {
        var types = await _cache.GetLeaveTypesAsync();

        // If employeeId provided, filter by eligibility
        if (employeeId.HasValue)
        {
            var emp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId.Value);
            if (emp != null)
            {
                types = types.Where(t => IsLeaveTypeEligible(t, emp)).ToList();
            }
        }

        return Ok(types.Select(t => new { LeaveTypeId = t.Id, t.Code, t.Name, t.IsPaid, t.TextColor, t.BackgroundColor }));
    }

    private bool IsLeaveTypeEligible(LeaveType lt, Employee emp)
    {
        // Gender check: empty/null/All = no restriction
        if (!string.IsNullOrEmpty(lt.GenderApplicability) && lt.GenderApplicability != "All")
        {
            var allowedGenders = lt.GenderApplicability.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (!allowedGenders.Contains(emp.Gender ?? "", StringComparer.OrdinalIgnoreCase))
                return false;
        }

        // Marital status check
        if (!string.IsNullOrEmpty(lt.MaritalStatusApplicability) && lt.MaritalStatusApplicability != "All")
        {
            var allowedStatuses = lt.MaritalStatusApplicability.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (!allowedStatuses.Contains(emp.MaritalStatus ?? "", StringComparer.OrdinalIgnoreCase))
                return false;
        }

        // Department check
        if (!string.IsNullOrEmpty(lt.DepartmentIds))
        {
            var allowedDepts = lt.DepartmentIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (!allowedDepts.Contains(emp.DepartmentId?.ToString() ?? ""))
                return false;
        }

        // Designation check
        if (!string.IsNullOrEmpty(lt.DesignationIds))
        {
            var allowedDesigs = lt.DesignationIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (!allowedDesigs.Contains(emp.DesignationId?.ToString() ?? ""))
                return false;
        }

        // Role check
        if (!string.IsNullOrEmpty(lt.RoleIds))
        {
            // Role is on User, not Employee — skip if no user linked
            // This would need a join to Users table; for now skip role filtering here
        }

        return true;
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

        // Overlapping leave validation
        var overlappingLeaves = await _db.LeaveApplications
            .Where(la => la.EmployeeId == targetEmpId.Value &&
                         la.Status != "Rejected" &&
                         la.Status != "Cancelled" &&
                         dto.StartDate <= la.EndDate &&
                         dto.EndDate >= la.StartDate)
            .ToListAsync();

        if (overlappingLeaves.Any())
        {
            // Allow only if both are on the same single day and one is First Half and other is Second Half
            bool isAllowedHalfDayCombo = false;
            if (dto.StartDate == dto.EndDate && overlappingLeaves.Count == 1)
            {
                var existing = overlappingLeaves.First();
                if (existing.StartDate == existing.EndDate && existing.StartDate == dto.StartDate)
                {
                    if ((dto.DayType == "First Half" && existing.DayType == "Second Half") ||
                        (dto.DayType == "Second Half" && existing.DayType == "First Half"))
                    {
                        isAllowedHalfDayCombo = true;
                    }
                }
            }

            if (!isAllowedHalfDayCombo)
            {
                var conflict = overlappingLeaves.First();
                return BadRequest(new
                {
                    message = $"Leave overlap error: An active leave application already exists for {emp.EmployeeName} covering {conflict.StartDate:dd MMM yyyy} to {conflict.EndDate:dd MMM yyyy} ({conflict.DayType}, Status: {conflict.Status}). Cannot apply multiple leaves for the same date."
                });
            }
        }

        bool isHalf = dto.DayType == "First Half" || dto.DayType == "Second Half";
        decimal totalDays = isHalf ? 0.5m : (dto.EndDate.DayNumber - dto.StartDate.DayNumber + 1);

        var leaveApp = new LeaveApplication
        {
            ApplicationNumber = null,
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

        leaveApp.ApplicationNumber = leaveApp.Id.ToString();

        // Trigger notification for Admins/HR
        await _db.InAppNotifications.AddAsync(new InAppNotification
        {
            OrganizationId = emp.OrganizationId,
            RoleScope = "Admin",
            Title = $"New Leave Request: {emp.EmployeeName}",
            Message = $"{emp.EmployeeName} requested {totalDays} day(s) leave from {dto.StartDate:dd MMM} to {dto.EndDate:dd MMM}.",
            Type = "Leave",
            Severity = "info",
            LinkUrl = "/leaves",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Leave application submitted successfully.", id = leaveApp.Id, applicationNumber = leaveApp.ApplicationNumber });
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

        // Notify Employee
        _db.InAppNotifications.Add(new InAppNotification
        {
            OrganizationId = leave.OrganizationId,
            EmployeeId = leave.EmployeeId,
            Title = $"Leave Request {dto.Status}",
            Message = $"Your leave request for {leave.StartDate:dd MMM} to {leave.EndDate:dd MMM} was marked as {dto.Status}.",
            Type = "Leave",
            Severity = dto.Status.Equals("Approved", StringComparison.OrdinalIgnoreCase) ? "success" : "danger",
            LinkUrl = "/leaves",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

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

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLeave(int id, [FromQuery] bool permanent = false)
    {
        var query = _db.LeaveApplications.Where(la => la.Id == id);
        query = await _permissionService.ApplyLeaveScopeAsync(query, User, AppPermissions.Keys.LeavesApply);

        var leave = await query.FirstOrDefaultAsync();
        if (leave == null)
        {
            return NotFound(new { message = "Leave application not found or unauthorized." });
        }

        bool wasApprovedOrAdjusted = leave.Status == "Approved" || leave.Status == "Adjusted";
        var empId = leave.EmployeeId;
        var sDate = leave.StartDate;
        var eDate = leave.EndDate;

        if (permanent || leave.Status == "Archived" || leave.Status == "Cancelled")
        {
            // Permanent hard delete
            _db.LeaveApplications.Remove(leave);
            await _db.SaveChangesAsync();

            if (wasApprovedOrAdjusted)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        for (var d = sDate; d <= eDate; d = d.AddDays(1))
                        {
                            await _processor.ProcessDailyAttendanceAsync(d, empId);
                        }
                    }
                    catch { }
                });
            }

            return Ok(new { success = true, permanent = true, message = "Leave application permanently deleted." });
        }
        else
        {
            // Soft delete / Move to Archive
            leave.Status = "Archived";
            await _db.SaveChangesAsync();

            if (wasApprovedOrAdjusted)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        for (var d = sDate; d <= eDate; d = d.AddDays(1))
                        {
                            await _processor.ProcessDailyAttendanceAsync(d, empId);
                        }
                    }
                    catch { }
                });
            }

            return Ok(new { success = true, permanent = false, message = "Leave application moved to archive." });
        }
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreLeave(int id)
    {
        var query = _db.LeaveApplications.Where(la => la.Id == id);
        query = await _permissionService.ApplyLeaveScopeAsync(query, User, AppPermissions.Keys.LeavesApply);

        var leave = await query.FirstOrDefaultAsync();
        if (leave == null)
        {
            return NotFound(new { message = "Leave application not found or unauthorized." });
        }

        if (leave.Status != "Archived" && leave.Status != "Cancelled")
        {
            return BadRequest(new { message = "Only archived or cancelled leaves can be restored." });
        }

        // Check for overlapping leaves before restoring
        var overlappingLeaves = await _db.LeaveApplications
            .Where(la => la.Id != id &&
                         la.EmployeeId == leave.EmployeeId &&
                         la.Status != "Rejected" &&
                         la.Status != "Cancelled" &&
                         la.Status != "Archived" &&
                         leave.StartDate <= la.EndDate &&
                         leave.EndDate >= la.StartDate)
            .ToListAsync();

        if (overlappingLeaves.Any())
        {
            var conflict = overlappingLeaves.First();
            return BadRequest(new
            {
                message = $"Cannot restore: Another active leave (#{conflict.ApplicationNumber ?? conflict.Id.ToString()}) already exists for this period ({conflict.StartDate:dd MMM yyyy} to {conflict.EndDate:dd MMM yyyy})."
            });
        }

        leave.Status = "Pending";
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Leave application restored to Pending status." });
    }

    public record LeaveApplyRequestDto(int? EmployeeId, int LeaveTypeId, DateOnly StartDate, DateOnly EndDate, string? DayType, string? Reason);
    public record LeaveStatusUpdateDto(string Status, string? Remarks);
}
