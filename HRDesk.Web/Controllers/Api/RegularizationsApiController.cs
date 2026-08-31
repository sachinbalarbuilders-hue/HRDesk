using System.Security.Claims;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RegularizationsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IAttendanceProcessorService _processor;
    private readonly ICompOffService _compOffService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public RegularizationsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IAttendanceProcessorService processor,
        ICompOffService compOffService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _processor = processor;
        _compOffService = compOffService;
        _tenantProvider = tenantProvider;
    }

    public record RegularizationCreateItem(
        DateOnly RequestDate,
        string PunchTarget, // "in", "out", "both"
        string? PunchTimeIn, // "HH:mm"
        string? PunchTimeOut, // "HH:mm"
        string? Reason
    );

    public record CreateRegularizationRequest(
        int EmployeeId,
        string RequestType, // "Missed Punch", "Late Coming", "Early Go", "Other"
        bool WaivePenalty,
        string? Reason,
        List<RegularizationCreateItem> Items
    );

    public record UpdateRegularizationRequest(
        DateOnly RequestDate,
        string? RequestType,
        string? PunchTarget, // "in", "out", "both"
        string? PunchTimeIn, // "HH:mm"
        string? PunchTimeOut, // "HH:mm"
        bool WaivePenalty,
        string? Reason
    );

    public record RejectRequest(string? Reason);
    public class BulkActionRequest
    {
        public JsonElement? Ids { get; set; }
        public string? Reason { get; set; }

        public List<int> GetIntIds()
        {
            var result = new List<int>();
            if (!Ids.HasValue) return result;

            if (Ids.Value.ValueKind == JsonValueKind.Array)
            {
                foreach (var elem in Ids.Value.EnumerateArray())
                {
                    if (elem.ValueKind == JsonValueKind.Number && elem.TryGetInt32(out var num))
                    {
                        result.Add(num);
                    }
                    else if (elem.ValueKind == JsonValueKind.String && int.TryParse(elem.GetString(), out var strNum))
                    {
                        result.Add(strNum);
                    }
                }
            }
            return result;
        }
    }

    public record CreateCompOffDto(
        int EmployeeId,
        DateOnly WorkedDate,
        string? InTime,
        string? OutTime,
        decimal CompOffDays,
        string? Reason
    );

    // ==========================================
    // 1. LIST REGULARIZATIONS
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetRegularizations(
        [FromQuery] string? status = null,
        [FromQuery] string? archiveFilter = null,
        [FromQuery] string? search = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsView) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.AttendanceRegularizations
            .AsNoTracking()
            .Include(r => r.Employee)
                .ThenInclude(e => e!.Department)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(r => r.Employee != null && r.Employee.BranchId == activeBranch.Value);
        }

        // RBAC Scoping via Employee filter
        var empScopedQuery = _db.Employees.AsNoTracking().AsQueryable();
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            empScopedQuery = empScopedQuery.Where(e => e.BranchId == activeBranch.Value);
        }
        
        var allowedEmpIds = new List<int>();

        if (await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsView))
        {
            var viewQuery = await _permissionService.ApplyEmployeeScopeAsync(empScopedQuery, User, AppPermissions.Keys.RegularizationsView);
            allowedEmpIds = await viewQuery.Select(e => e.EmployeeId).ToListAsync();
        }

        if (!allowedEmpIds.Any())
        {
            return Ok(new { items = new List<object>(), totalCount = 0, page, pageSize, totalPages = 0 });
        }
        query = query.Where(r => allowedEmpIds.Contains(r.EmployeeId));

        // Archive Filter scoping
        var effArchive = !string.IsNullOrWhiteSpace(archiveFilter) ? archiveFilter.Trim().ToLower() : "active";
        if (status?.ToLower() == "archived" || effArchive == "archived")
        {
            query = query.Where(r => r.Status == "Archived" || r.Status == "Cancelled");
        }
        else if (effArchive == "active")
        {
            query = query.Where(r => r.Status != "Archived" && r.Status != "Cancelled");
            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase) && !status.Equals("active", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.Status == status);
            }
        }
        else if (effArchive == "all")
        {
            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.Status == status);
            }
        }

        if (employeeId.HasValue && employeeId.Value > 0)
        {
            query = query.Where(r => r.EmployeeId == employeeId.Value);
        }

        if (year.HasValue && year.Value > 0)
        {
            query = query.Where(r => r.RequestDate.Year == year.Value);
        }

        if (month.HasValue && month.Value > 0)
        {
            query = query.Where(r => r.RequestDate.Month == month.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                (r.Employee != null && r.Employee.EmployeeName.ToLower().Contains(s)) ||
                (r.Reason != null && r.Reason.ToLower().Contains(s))
            );
        }

        var totalCount = await query.CountAsync();

        var pendingCount = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => allowedEmpIds.Contains(r.EmployeeId) && r.Status == "Pending")
            .CountAsync();

        var approvedCount = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => allowedEmpIds.Contains(r.EmployeeId) && r.Status == "Approved")
            .CountAsync();

        var rejectedCount = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => allowedEmpIds.Contains(r.EmployeeId) && r.Status == "Rejected")
            .CountAsync();

        var archivedCount = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => allowedEmpIds.Contains(r.EmployeeId) && (r.Status == "Archived" || r.Status == "Cancelled"))
            .CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.EmployeeId,
                employeeName = r.Employee != null ? r.Employee.EmployeeName : $"Emp #{r.EmployeeId}",
                departmentName = r.Employee != null && r.Employee.Department != null ? r.Employee.Department.DepartmentName : "Unassigned",
                r.RequestType,
                r.RequestDate,
                r.PunchTimeIn,
                r.PunchTimeOut,
                r.WaivePenalty,
                r.Reason,
                r.Status,
                r.ApprovedBy,
                r.ApproveDate,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            metrics = new
            {
                pending = pendingCount,
                approved = approvedCount,
                rejected = rejectedCount,
                archived = archivedCount,
                total = totalCount
            }
        });
    }

    // ==========================================
    // 2. PREVIEW EXISTING PUNCH & SHIFT TIMINGS
    // ==========================================
    [HttpGet("preview-punch")]
    public async Task<IActionResult> PreviewPunch([FromQuery] int employeeId, [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
        {
            return BadRequest(new { message = "Invalid date format. Expected yyyy-MM-dd." });
        }

        var daily = await _db.DailyAttendance
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.RecordDate == parsedDate);

        var roster = await _db.ShiftRosters
            .AsNoTracking()
            .Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.RosterDate == parsedDate);

        return Ok(new
        {
            date = parsedDate,
            employeeId,
            existingInTime = daily?.InTime?.ToString("HH:mm"),
            existingOutTime = daily?.OutTime?.ToString("HH:mm"),
            currentStatus = daily?.Status ?? "Not Processed",
            shift = roster?.Shift != null ? new
            {
                name = roster.Shift.ShiftName,
                startTime = roster.Shift.StartTime.ToString("HH:mm"),
                endTime = roster.Shift.EndTime.ToString("HH:mm")
            } : null,
            nextApplicationNumber = (string?)null
        });
    }

    [HttpGet("employees")]
    public async Task<IActionResult> GetEligibleEmployees([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Where(e => e.Status == "Active" || e.Status == "Onboarding")
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(e => e.BranchId == activeBranch.Value);
        }

        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.AttendanceRegularize);

        var list = await query
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                employeeId = e.EmployeeId,
                employeeName = e.EmployeeName,
                departmentName = e.Department != null ? e.Department.DepartmentName : null
            })
            .ToListAsync();

        return Ok(list);
    }

    // ==========================================
    // 3. CREATE REGULARIZATION REQUEST(S)
    // ==========================================
    [HttpPost]
    public async Task<IActionResult> CreateRegularization([FromBody] CreateRegularizationRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one regularization date item is required." });
        }

        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.AttendanceRegularize);
        if (!await allowedEmps.AnyAsync(e => e.EmployeeId == request.EmployeeId))
        {
            return Forbid();
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == request.EmployeeId);
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        var createdList = new List<AttendanceRegularization>();
        var now = DateTime.Now;

        foreach (var item in request.Items)
        {
            DateTime? inTime = null;
            DateTime? outTime = null;

            if (item.PunchTarget == "in" || item.PunchTarget == "both")
            {
                if (!string.IsNullOrWhiteSpace(item.PunchTimeIn) && TimeOnly.TryParse(item.PunchTimeIn, out var tIn))
                {
                    inTime = item.RequestDate.ToDateTime(tIn);
                }
            }

            if (item.PunchTarget == "out" || item.PunchTarget == "both")
            {
                if (!string.IsNullOrWhiteSpace(item.PunchTimeOut) && TimeOnly.TryParse(item.PunchTimeOut, out var tOut))
                {
                    outTime = item.RequestDate.ToDateTime(tOut);
                }
            }

            var reg = new AttendanceRegularization
            {
                OrganizationId = employee.OrganizationId,
                EmployeeId = request.EmployeeId,
                RequestType = request.RequestType ?? "Missed Punch",
                WaivePenalty = request.WaivePenalty,
                RequestDate = item.RequestDate,
                Reason = item.Reason ?? request.Reason,
                Status = "Pending",
                PunchTimeIn = inTime,
                PunchTimeOut = outTime,
                CreatedAt = now
            };

            _db.AttendanceRegularizations.Add(reg);
            createdList.Add(reg);
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Created {createdList.Count} regularization request(s) successfully.",
            count = createdList.Count
        });
    }

    // ==========================================
    // 3.1 UPDATE REGULARIZATION REQUEST
    // ==========================================
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRegularization(int id, [FromBody] UpdateRegularizationRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsEdit))
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        if (reg.Status != "Pending")
        {
            return BadRequest(new { message = "Only Pending regularization requests can be edited." });
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsEdit);
        if (!await allowedEmps.AnyAsync(e => e.EmployeeId == reg.EmployeeId))
        {
            return Forbid();
        }

        DateTime? inTime = null;
        DateTime? outTime = null;

        var target = request.PunchTarget ?? "both";
        if (target == "in" || target == "both")
        {
            if (!string.IsNullOrWhiteSpace(request.PunchTimeIn) && TimeOnly.TryParse(request.PunchTimeIn, out var tIn))
            {
                inTime = request.RequestDate.ToDateTime(tIn);
            }
        }

        if (target == "out" || target == "both")
        {
            if (!string.IsNullOrWhiteSpace(request.PunchTimeOut) && TimeOnly.TryParse(request.PunchTimeOut, out var tOut))
            {
                outTime = request.RequestDate.ToDateTime(tOut);
            }
        }

        reg.RequestDate = request.RequestDate;
        reg.RequestType = request.RequestType ?? reg.RequestType;
        reg.PunchTimeIn = inTime;
        reg.PunchTimeOut = outTime;
        reg.WaivePenalty = request.WaivePenalty;
        reg.Reason = request.Reason;

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Regularization request updated successfully.", id = reg.Id });
    }

    // ==========================================
    // 4. APPROVE REGULARIZATION
    // ==========================================
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveRegularization(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsApprove))
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        if (reg.Status == "Approved")
        {
            return BadRequest(new { message = "This request has already been approved." });
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsApprove);
        if (!await allowedEmps.AnyAsync(e => e.EmployeeId == reg.EmployeeId))
        {
            return Forbid();
        }

        reg.Status = "Approved";
        reg.ApprovedBy = User.Identity?.Name ?? "Admin";
        reg.ApproveDate = DateTime.Now;

        await _db.SaveChangesAsync();

        // Immediately recalculate attendance for that date & month
        await _processor.ProcessDailyAttendanceAsync(reg.RequestDate, reg.EmployeeId);

        return Ok(new { message = "Regularization approved and attendance recalculated.", id = reg.Id });
    }

    // ==========================================
    // 5. REJECT REGULARIZATION
    // ==========================================
    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectRegularization(int id, [FromBody] RejectRequest? request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsApprove))
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsApprove);
        if (!await allowedEmps.AnyAsync(e => e.EmployeeId == reg.EmployeeId))
        {
            return Forbid();
        }

        reg.Status = "Rejected";
        reg.ApprovedBy = User.Identity?.Name ?? "Admin";
        reg.ApproveDate = DateTime.Now;
        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            reg.Reason = $"{reg.Reason} [Rejected: {request.Reason}]";
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Regularization rejected.", id = reg.Id });
    }

    // ==========================================
    // 5.1 CANCEL REGULARIZATION
    // ==========================================
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> CancelRegularization(int id, [FromBody] RejectRequest? request)
    {
        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        if (reg.Status != "Pending")
        {
            return BadRequest(new { message = "Only Pending requests can be cancelled." });
        }

        var hasApprove = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsApprove);
        var hasEdit = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsEdit);
        var hasCreate = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize);

        if (!hasApprove && !hasEdit && !hasCreate)
        {
            return Forbid();
        }

        bool isAllowed = false;
        if (hasApprove)
        {
            var allowed = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsApprove);
            isAllowed = await allowed.AnyAsync(e => e.EmployeeId == reg.EmployeeId);
        }
        if (!isAllowed && hasEdit)
        {
            var allowed = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsEdit);
            isAllowed = await allowed.AnyAsync(e => e.EmployeeId == reg.EmployeeId);
        }
        if (!isAllowed && hasCreate)
        {
            var allowed = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.AttendanceRegularize);
            isAllowed = await allowed.AnyAsync(e => e.EmployeeId == reg.EmployeeId);
        }

        if (!isAllowed)
        {
            return Forbid();
        }

        reg.Status = "Cancelled";
        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            reg.Reason = $"{reg.Reason} [Cancelled: {request.Reason}]";
        }

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Regularization request cancelled.", id = reg.Id });
    }

    // ==========================================
    // 6. BULK APPROVE
    // ==========================================
    [HttpPost("bulk-approve")]
    public async Task<IActionResult> BulkApprove([FromBody] BulkActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsApprove))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected for approval." });
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsApprove);
        var allowedEmpIds = await allowedEmps.Select(e => e.EmployeeId).ToListAsync();

        var requests = await _db.AttendanceRegularizations
            .Where(r => idList.Contains(r.Id) && r.Status == "Pending" && allowedEmpIds.Contains(r.EmployeeId))
            .ToListAsync();

        var approver = User.Identity?.Name ?? "Admin";
        var now = DateTime.Now;

        foreach (var r in requests)
        {
            r.Status = "Approved";
            r.ApprovedBy = approver;
            r.ApproveDate = now;
        }

        await _db.SaveChangesAsync();

        // Reprocess distinct affected dates
        var affected = requests.Select(r => new { r.RequestDate, r.EmployeeId }).Distinct().ToList();
        foreach (var item in affected)
        {
            await _processor.ProcessDailyAttendanceAsync(item.RequestDate, item.EmployeeId);
        }

        return Ok(new
        {
            message = $"Successfully approved {requests.Count} regularization request(s).",
            count = requests.Count
        });
    }

    // ==========================================
    // 7. BULK REJECT
    // ==========================================
    [HttpPost("bulk-reject")]
    public async Task<IActionResult> BulkReject([FromBody] BulkActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsApprove))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected for rejection." });
        }

        var allowedEmps = await _permissionService.ApplyEmployeeScopeAsync(_db.Employees, User, AppPermissions.Keys.RegularizationsApprove);
        var allowedEmpIds = await allowedEmps.Select(e => e.EmployeeId).ToListAsync();

        var requests = await _db.AttendanceRegularizations
            .Where(r => idList.Contains(r.Id) && r.Status == "Pending" && allowedEmpIds.Contains(r.EmployeeId))
            .ToListAsync();

        var approver = User.Identity?.Name ?? "Admin";
        var now = DateTime.Now;

        foreach (var r in requests)
        {
            r.Status = "Rejected";
            r.ApprovedBy = approver;
            r.ApproveDate = now;
            if (request != null && !string.IsNullOrWhiteSpace(request.Reason))
            {
                r.Reason = $"{r.Reason} [Rejected: {request.Reason}]";
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Successfully rejected {requests.Count} regularization request(s).",
            count = requests.Count
        });
    }

    // ==========================================
    // 8. DELETE REGULARIZATION (Archive vs Hard Delete)
    // ==========================================
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRegularization(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsDelete))
        {
            return Forbid();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.RegularizationsDelete);
        if (permanent && deleteScope != "Permanent Delete" && deleteScope != "Bulk Delete" && deleteScope != "All")
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        var wasApproved = reg.Status == "Approved";
        var date = reg.RequestDate;
        var empId = reg.EmployeeId;

        if (permanent || reg.Status == "Archived" || reg.Status == "Cancelled")
        {
            _db.AttendanceRegularizations.Remove(reg);
            await _db.SaveChangesAsync();

            if (wasApproved)
            {
                await _processor.ProcessDailyAttendanceAsync(date, empId);
            }

            return Ok(new { success = true, permanent = true, message = "Regularization request permanently deleted." });
        }
        else
        {
            // Soft delete / Move to Archive
            reg.Status = "Archived";
            await _db.SaveChangesAsync();

            if (wasApproved)
            {
                await _processor.ProcessDailyAttendanceAsync(date, empId);
            }

            return Ok(new { success = true, permanent = false, message = "Regularization request moved to archive." });
        }
    }

    // ==========================================
    // 9. RESTORE REGULARIZATION
    // ==========================================
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreRegularization(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsDelete))
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
        }

        if (reg.Status != "Archived" && reg.Status != "Cancelled")
        {
            return BadRequest(new { message = "Only archived or cancelled requests can be restored." });
        }

        reg.Status = "Pending";
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Regularization request restored to Pending status." });
    }

    [HttpPost("bulk-archive")]
    public async Task<IActionResult> BulkArchiveRegularization([FromBody] BulkActionRequest request)
    {
        return await HandleBulkDelete(request, permanent: false);
    }

    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDeleteRegularization([FromBody] BulkActionRequest request)
    {
        return await HandleBulkDelete(request, permanent: true);
    }

    private async Task<IActionResult> HandleBulkDelete(BulkActionRequest request, bool permanent)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsDelete))
        {
            return Forbid();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.RegularizationsDelete);
        if (permanent && deleteScope != "Permanent Delete" && deleteScope != "All")
        {
            return Forbid();
        }
        if (!permanent && deleteScope != "Bulk Delete" && deleteScope != "Permanent Delete" && deleteScope != "All")
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected for deletion." });
        }

        var requests = await _db.AttendanceRegularizations
            .Where(r => idList.Contains(r.Id))
            .ToListAsync();

        var affected = requests.Where(r => r.Status == "Approved" || permanent).Select(r => new { r.RequestDate, r.EmployeeId }).Distinct().ToList();

        if (permanent)
        {
            _db.AttendanceRegularizations.RemoveRange(requests);
        }
        else
        {
            foreach (var r in requests)
            {
                r.Status = "Archived";
            }
        }

        await _db.SaveChangesAsync();

        foreach (var item in affected)
        {
            await _processor.ProcessDailyAttendanceAsync(item.RequestDate, item.EmployeeId);
        }

        return Ok(new { success = true, permanent, message = $"Successfully {(permanent ? "deleted" : "archived")} {requests.Count} request(s)." });
    }

    [HttpPost("bulk-restore")]
    public async Task<IActionResult> BulkRestoreRegularization([FromBody] BulkActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.RegularizationsDelete))
        {
            return Forbid();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.RegularizationsDelete);
        if (deleteScope != "Bulk Delete" && deleteScope != "Permanent Delete" && deleteScope != "All")
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected for restoration." });
        }

        var requests = await _db.AttendanceRegularizations
            .Where(r => idList.Contains(r.Id) && (r.Status == "Archived" || r.Status == "Cancelled"))
            .ToListAsync();

        foreach (var r in requests)
        {
            r.Status = "Pending";
        }

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Successfully restored {requests.Count} request(s)." });
    }

    // ==========================================
    // 10. COMP-OFF REQUESTS & APPROVALS
    // ==========================================
    [HttpGet("compoff")]
    public async Task<IActionResult> GetCompOffRequests(
        [FromQuery] string? status = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.CompOffRequests
            .AsNoTracking()
            .Include(c => c.Employee)
                .ThenInclude(e => e!.Department)
            .Include(c => c.Shift)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(c => c.Employee != null && c.Employee.BranchId == activeBranch.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.Status == status);
        }

        if (employeeId.HasValue && employeeId.Value > 0)
        {
            query = query.Where(c => c.EmployeeId == employeeId.Value);
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(c => c.WorkedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.EmployeeId,
                employeeName = c.Employee != null ? c.Employee.EmployeeName : $"Emp #{c.EmployeeId}",
                departmentName = c.Employee != null && c.Employee.Department != null ? c.Employee.Department.DepartmentName : "Unassigned",
                c.WorkedDate,
                shiftName = c.Shift != null ? c.Shift.ShiftName : null,
                inTime = c.InTime.HasValue ? c.InTime.Value.ToString("HH:mm") : null,
                outTime = c.OutTime.HasValue ? c.OutTime.Value.ToString("HH:mm") : null,
                c.WorkMinutes,
                c.CompOffDays,
                c.Status,
                c.ApprovedBy,
                c.ApprovedDate,
                c.RejectionReason,
                c.CreatedAt
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

    [HttpPost("compoff")]
    public async Task<IActionResult> CreateCompOff([FromBody] CreateCompOffDto dto)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
        if (employee == null) return NotFound(new { message = "Employee not found." });

        TimeOnly? inT = null;
        TimeOnly? outT = null;
        if (!string.IsNullOrWhiteSpace(dto.InTime) && TimeOnly.TryParse(dto.InTime, out var parsedIn)) inT = parsedIn;
        if (!string.IsNullOrWhiteSpace(dto.OutTime) && TimeOnly.TryParse(dto.OutTime, out var parsedOut)) outT = parsedOut;

        var compOff = new CompOffRequest
        {
            OrganizationId = employee.OrganizationId,
            EmployeeId = dto.EmployeeId,
            WorkedDate = dto.WorkedDate,
            InTime = inT,
            OutTime = outT,
            CompOffDays = dto.CompOffDays > 0 ? dto.CompOffDays : 1.0m,
            Status = "Pending",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.CompOffRequests.Add(compOff);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Comp Off request submitted successfully.", id = compOff.Id });
    }

    [HttpPost("compoff/{id}/approve")]
    public async Task<IActionResult> ApproveCompOff(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApprove))
        {
            return Forbid();
        }

        var approver = User.Identity?.Name ?? "Admin";
        await _compOffService.ApproveRequestAsync(id, approver);

        return Ok(new { message = "Comp Off approved and credited to balance.", id });
    }

    [HttpPost("compoff/{id}/reject")]
    public async Task<IActionResult> RejectCompOff(int id, [FromBody] RejectRequest? reasonDto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApprove))
        {
            return Forbid();
        }

        var approver = User.Identity?.Name ?? "Admin";
        await _compOffService.RejectRequestAsync(id, approver, reasonDto?.Reason ?? "Rejected by admin");

        return Ok(new { message = "Comp Off request rejected.", id });
    }

    [HttpPost("compoff/{id}/cancel")]
    public async Task<IActionResult> CancelCompOff(int id, [FromBody] RejectRequest? reasonDto)
    {
        var compOff = await _db.CompOffRequests.FindAsync(id);
        if (compOff == null) return NotFound(new { message = "Comp Off record not found." });

        if (compOff.Status != "Pending")
        {
            return BadRequest(new { message = "Only Pending Comp Off requests can be cancelled." });
        }

        compOff.Status = "Cancelled";
        if (!string.IsNullOrWhiteSpace(reasonDto?.Reason))
        {
            compOff.RejectionReason = $"Cancelled: {reasonDto.Reason}";
        }
        compOff.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Comp Off request cancelled.", id });
    }

    [HttpDelete("compoff/{id}")]
    public async Task<IActionResult> DeleteCompOff(int id)
    {
        var compOff = await _db.CompOffRequests.FindAsync(id);
        if (compOff == null) return NotFound(new { message = "Comp Off record not found." });

        _db.CompOffRequests.Remove(compOff);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Comp Off request deleted.", id });
    }
}
