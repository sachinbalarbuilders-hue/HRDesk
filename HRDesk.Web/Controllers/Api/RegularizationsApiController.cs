using System.Security.Claims;
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

    public record RejectRequest(string? Reason);
    public record BulkActionRequest(List<int> Ids, string? Reason);

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
        [FromQuery] string? search = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceView) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.AttendanceRegularizations
            .AsNoTracking()
            .Include(r => r.Employee)
                .ThenInclude(e => e.Department)
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
        empScopedQuery = await _permissionService.ApplyEmployeeScopeAsync(empScopedQuery, User, AppPermissions.Keys.AttendanceRegularize);
        var allowedEmpIds = await empScopedQuery.Select(e => e.EmployeeId).ToListAsync();

        query = query.Where(r => allowedEmpIds.Contains(r.EmployeeId));

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(r => r.Status == status);
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
                (r.ApplicationNumber != null && r.ApplicationNumber.ToLower().Contains(s)) ||
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
                r.ApplicationNumber,
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
                ApplicationNumber = null,
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
    // 4. APPROVE REGULARIZATION
    // ==========================================
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveRegularization(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
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
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        var reg = await _db.AttendanceRegularizations.FindAsync(id);
        if (reg == null)
        {
            return NotFound(new { message = "Regularization record not found." });
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
    // 6. BULK APPROVE
    // ==========================================
    [HttpPost("bulk-approve")]
    public async Task<IActionResult> BulkApprove([FromBody] BulkActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        if (request.Ids == null || request.Ids.Count == 0)
        {
            return BadRequest(new { message = "No records selected for approval." });
        }

        var requests = await _db.AttendanceRegularizations
            .Where(r => request.Ids.Contains(r.Id) && r.Status == "Pending")
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
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.AttendanceRegularize))
        {
            return Forbid();
        }

        if (request.Ids == null || request.Ids.Count == 0)
        {
            return BadRequest(new { message = "No records selected for rejection." });
        }

        var requests = await _db.AttendanceRegularizations
            .Where(r => request.Ids.Contains(r.Id) && r.Status == "Pending")
            .ToListAsync();

        var approver = User.Identity?.Name ?? "Admin";
        var now = DateTime.Now;

        foreach (var r in requests)
        {
            r.Status = "Rejected";
            r.ApprovedBy = approver;
            r.ApproveDate = now;
            if (!string.IsNullOrWhiteSpace(request.Reason))
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
    // 8. COMP-OFF REQUESTS & APPROVALS
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
                .ThenInclude(e => e.Department)
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
}
