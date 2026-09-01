using System.Security.Claims;
using System.Text.Json;
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
public class CompOffController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICompOffService _compOffService;
    private readonly IReferenceDataCacheService _cache;
    private readonly ICurrentTenantProvider _tenantProvider;

    public CompOffController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICompOffService compOffService,
        IReferenceDataCacheService cache,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _compOffService = compOffService;
        _cache = cache;
        _tenantProvider = tenantProvider;
    }

    public record CreateCompOffRequestDto(
        int EmployeeId,
        DateOnly WorkedDate,
        string? InTime,
        string? OutTime,
        int? ShiftId,
        decimal CompOffDays,
        string? Reason
    );

    public record UpdateCompOffRequestDto(
        DateOnly WorkedDate,
        string? InTime,
        string? OutTime,
        int? ShiftId,
        decimal CompOffDays,
        string? Reason
    );

    public record RejectCompOffDto(string? Reason);

    public class BulkCompOffActionRequest
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

    // ==========================================
    // 0. ELIGIBLE EMPLOYEES (FOR COMP-OFF APPLY)
    // ==========================================
    [HttpGet("employees")]
    public async Task<IActionResult> GetEligibleEmployees([FromQuery] int? branchId = null)
    {
        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Branch)
            .Where(e => e.Status == "Active" || e.Status == "active" || e.Status == "Onboarding" || e.Status == "onboarding")
            .AsQueryable();

        var scope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffApply);

        if (scope == AppPermissions.Scopes.All)
        {
            var activeBranch = branchId ?? _tenantProvider.BranchId;
            if (activeBranch.HasValue && activeBranch.Value > 0)
            {
                query = query.Where(e => e.BranchId == activeBranch.Value);
            }
        }
        else
        {
            query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.CompOffApply);
        }

        var list = await query
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                employeeId = e.EmployeeId,
                employeeName = e.EmployeeName,
                departmentName = e.Department != null ? e.Department.DepartmentName : null,
                branchId = e.BranchId,
                branchName = e.Branch != null ? e.Branch.Name : null
            })
            .ToListAsync();

        return Ok(list);
    }

    // ==========================================
    // 1. LIST COMP-OFF REQUESTS
    // ==========================================
    [HttpGet]
    [HttpGet("requests")]
    public async Task<IActionResult> GetCompOffRequests(
        [FromQuery] string? status = null,
        [FromQuery] string? archiveFilter = null,
        [FromQuery] string? search = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffView) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApply) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove))
        {
            return Forbid();
        }

        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.CompOffRequests
            .AsNoTracking()
            .Include(c => c.Employee)
                .ThenInclude(e => e!.Department)
            .Include(c => c.Employee)
                .ThenInclude(e => e!.Branch)
            .Include(c => c.Shift)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(c => c.Employee != null && c.Employee.BranchId == activeBranch.Value);
        }

        // Apply RBAC Scoping
        query = await _permissionService.ApplyCompOffScopeAsync(query, User, AppPermissions.Keys.CompOffView);

        // Filter by Employee
        if (employeeId.HasValue && employeeId.Value > 0)
        {
            query = query.Where(c => c.EmployeeId == employeeId.Value);
        }

        // Filter by Department
        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(c => c.Employee != null && c.Employee.DepartmentId == departmentId.Value);
        }

        // Filter by Date Range
        if (startDate.HasValue)
        {
            query = query.Where(c => c.WorkedDate >= startDate.Value);
        }
        if (endDate.HasValue)
        {
            query = query.Where(c => c.WorkedDate <= endDate.Value);
        }

        // Archive Filter scoping
        var effArchive = !string.IsNullOrWhiteSpace(archiveFilter) ? archiveFilter.Trim().ToLower() : "active";
        if (status?.ToLower() == "archived" || effArchive == "archived")
        {
            query = query.Where(c => c.Status == "Archived" || c.Status == "Cancelled");
        }
        else if (effArchive == "active")
        {
            query = query.Where(c => c.Status != "Archived" && c.Status != "Cancelled");
            if (!string.IsNullOrWhiteSpace(status) && status != "all" && status != "active")
            {
                query = query.Where(c => c.Status == status);
            }
        }
        else if (effArchive == "all")
        {
            if (!string.IsNullOrWhiteSpace(status) && status != "all")
            {
                query = query.Where(c => c.Status == status);
            }
        }

        // Search Filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                (c.Employee != null && c.Employee.EmployeeName.ToLower().Contains(s)) ||
                (c.RejectionReason != null && c.RejectionReason.ToLower().Contains(s)) ||
                (c.ApprovedBy != null && c.ApprovedBy.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync();
        if (pageSize <= 0) pageSize = 30;

        var items = await query
            .OrderByDescending(c => c.WorkedDate)
            .ThenByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.EmployeeId,
                EmployeeName = c.Employee != null ? c.Employee.EmployeeName : $"Emp #{c.EmployeeId}",
                Department = c.Employee != null && c.Employee.Department != null ? c.Employee.Department.DepartmentName : null,
                Branch = c.Employee != null && c.Employee.Branch != null ? c.Employee.Branch.Name : null,
                c.WorkedDate,
                c.ShiftId,
                ShiftName = c.Shift != null ? c.Shift.ShiftName : null,
                InTime = c.InTime.HasValue ? c.InTime.Value.ToString("HH:mm") : null,
                OutTime = c.OutTime.HasValue ? c.OutTime.Value.ToString("HH:mm") : null,
                c.WorkMinutes,
                CompOffDays = c.CompOffDays ?? 1.0m,
                c.Status,
                c.ApprovedBy,
                c.ApprovedDate,
                Reason = c.RejectionReason,
                c.CreatedAt,
                c.UpdatedAt
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

    // ==========================================
    // 2. MY COMP-OFF REQUESTS
    // ==========================================
    [HttpGet("my-requests")]
    public async Task<IActionResult> GetMyCompOffRequests([FromQuery] int? employeeId = null)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId = employeeId ?? currentEmpId;

        if (!targetEmpId.HasValue)
        {
            targetEmpId = await _db.Employees.AsNoTracking().Select(e => (int?)e.EmployeeId).FirstOrDefaultAsync();
        }

        if (!targetEmpId.HasValue)
        {
            return Ok(new List<object>());
        }

        var requests = await _db.CompOffRequests
            .AsNoTracking()
            .Include(c => c.Shift)
            .Where(c => c.EmployeeId == targetEmpId.Value)
            .OrderByDescending(c => c.WorkedDate)
            .Take(100)
            .Select(c => new
            {
                c.Id,
                c.EmployeeId,
                c.WorkedDate,
                c.ShiftId,
                ShiftName = c.Shift != null ? c.Shift.ShiftName : null,
                InTime = c.InTime.HasValue ? c.InTime.Value.ToString("HH:mm") : null,
                OutTime = c.OutTime.HasValue ? c.OutTime.Value.ToString("HH:mm") : null,
                c.WorkMinutes,
                CompOffDays = c.CompOffDays ?? 1.0m,
                c.Status,
                c.ApprovedBy,
                c.ApprovedDate,
                Reason = c.RejectionReason,
                c.CreatedAt
            })
            .ToListAsync();

        return Ok(requests);
    }

    // ==========================================
    // 3. STATISTICS & SUMMARY
    // ==========================================
    [HttpGet("statistics")]
    public async Task<IActionResult> GetCompOffStatistics([FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffView) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApply))
        {
            return Forbid();
        }

        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.CompOffRequests
            .AsNoTracking()
            .Include(c => c.Employee)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(c => c.Employee != null && c.Employee.BranchId == activeBranch.Value);
        }

        query = await _permissionService.ApplyCompOffScopeAsync(query, User, AppPermissions.Keys.CompOffView);

        var total = await query.CountAsync();
        var pending = await query.CountAsync(c => c.Status == "Pending" || c.Status == "Draft");
        var approved = await query.CountAsync(c => c.Status == "Approved");
        var rejected = await query.CountAsync(c => c.Status == "Rejected");
        var archived = await query.CountAsync(c => c.Status == "Archived" || c.Status == "Cancelled");
        var totalDaysApproved = await query.Where(c => c.Status == "Approved").SumAsync(c => c.CompOffDays ?? 0m);

        return Ok(new
        {
            total,
            pending,
            approved,
            rejected,
            archived,
            totalDaysApproved
        });
    }

    // ==========================================
    // 4. BALANCES
    // ==========================================
    [HttpGet("balances")]
    [HttpGet("balances/{employeeId}")]
    public async Task<IActionResult> GetCompOffBalances([FromRoute] int? employeeId = null, [FromQuery] int? empId = null)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId = employeeId ?? empId ?? currentEmpId;

        if (!targetEmpId.HasValue)
        {
            targetEmpId = await _db.Employees.AsNoTracking().Select(e => (int?)e.EmployeeId).FirstOrDefaultAsync();
        }

        if (!targetEmpId.HasValue)
        {
            return NotFound(new { message = "Employee not found." });
        }

        var resolvedId = targetEmpId.Value;
        bool isSelf = currentEmpId.HasValue && currentEmpId.Value == resolvedId;

        if (!isSelf)
        {
            var targetEmpQuery = _db.Employees.Where(e => e.EmployeeId == resolvedId);
            targetEmpQuery = await _permissionService.ApplyEmployeeScopeAsync(targetEmpQuery, User, AppPermissions.Keys.CompOffView);
            if (!await targetEmpQuery.AnyAsync())
            {
                return Forbid();
            }
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var balance = await _compOffService.GetValidBalanceAsync(resolvedId, today);

        var pendingDays = await _db.CompOffRequests
            .Where(c => c.EmployeeId == resolvedId && (c.Status == "Pending" || c.Status == "Draft"))
            .SumAsync(c => c.CompOffDays ?? 0m);

        var approvedDays = await _db.CompOffRequests
            .Where(c => c.EmployeeId == resolvedId && c.Status == "Approved")
            .SumAsync(c => c.CompOffDays ?? 0m);

        return Ok(new
        {
            employeeId = resolvedId,
            balance,
            pendingDays,
            approvedDays
        });
    }

    // ==========================================
    // 5. CREATE COMP-OFF REQUEST
    // ==========================================
    [HttpPost]
    [HttpPost("requests")]
    public async Task<IActionResult> CreateCompOffRequest([FromBody] CreateCompOffRequestDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApply))
        {
            return Forbid();
        }

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var applyScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffApply);

        // Check if applying for self or others
        if (applyScope == AppPermissions.Scopes.Own)
        {
            if (currentEmpId.HasValue && dto.EmployeeId != currentEmpId.Value)
            {
                return Forbid();
            }
        }
        else if (applyScope == AppPermissions.Scopes.Reporting || applyScope == "Reporting")
        {
            if (currentEmpId.HasValue && dto.EmployeeId != currentEmpId.Value)
            {
                var isReportee = await _db.Employees
                    .AnyAsync(e => e.EmployeeId == dto.EmployeeId && e.ReportingManagerId == currentEmpId.Value);
                if (!isReportee)
                {
                    return Forbid();
                }
            }
        }
        else if (applyScope == AppPermissions.Scopes.Department)
        {
            if (currentEmpId.HasValue && dto.EmployeeId != currentEmpId.Value)
            {
                var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
                var targetEmp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
                if (currentEmp?.DepartmentId == null || targetEmp?.DepartmentId != currentEmp.DepartmentId)
                {
                    return Forbid();
                }
            }
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        // Check for existing request on the same date
        var existing = await _db.CompOffRequests
            .FirstOrDefaultAsync(c => c.EmployeeId == dto.EmployeeId && c.WorkedDate == dto.WorkedDate && c.Status != "Cancelled" && c.Status != "Archived");

        if (existing != null)
        {
            return BadRequest(new { message = $"A Comp-Off request already exists for this employee on {dto.WorkedDate:dd MMM yyyy} (Status: {existing.Status})." });
        }

        TimeOnly? inTime = null;
        TimeOnly? outTime = null;
        if (!string.IsNullOrWhiteSpace(dto.InTime) && TimeOnly.TryParse(dto.InTime, out var parsedIn)) inTime = parsedIn;
        if (!string.IsNullOrWhiteSpace(dto.OutTime) && TimeOnly.TryParse(dto.OutTime, out var parsedOut)) outTime = parsedOut;

        int? workMinutes = null;
        if (inTime.HasValue && outTime.HasValue)
        {
            var inDateTime = dto.WorkedDate.ToDateTime(inTime.Value);
            var outDateTime = dto.WorkedDate.ToDateTime(outTime.Value);
            if (outTime.Value < inTime.Value) outDateTime = outDateTime.AddDays(1);
            workMinutes = (int)(outDateTime - inDateTime).TotalMinutes;
        }

        var compOffDays = dto.CompOffDays > 0 ? dto.CompOffDays : 1.0m;

        var request = new CompOffRequest
        {
            OrganizationId = employee.OrganizationId,
            EmployeeId = dto.EmployeeId,
            WorkedDate = dto.WorkedDate,
            InTime = inTime,
            OutTime = outTime,
            ShiftId = dto.ShiftId,
            WorkMinutes = workMinutes,
            CompOffDays = compOffDays,
            Status = "Pending",
            RejectionReason = dto.Reason,
            RequestDate = DateTime.Now,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.CompOffRequests.Add(request);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Comp-Off request submitted successfully.",
            id = request.Id
        });
    }

    // ==========================================
    // 6. UPDATE / EDIT COMP-OFF REQUEST
    // ==========================================
    [HttpPut("{id}")]
    [HttpPut("requests/{id}")]
    public async Task<IActionResult> UpdateCompOffRequest(int id, [FromBody] UpdateCompOffRequestDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffEdit))
        {
            return Forbid();
        }

        var request = await _db.CompOffRequests
            .Include(c => c.Employee)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        if (request.Status != "Pending" && request.Status != "Draft")
        {
            return BadRequest(new { message = $"Cannot edit a Comp-Off request with status '{request.Status}'. Only Pending requests can be edited." });
        }

        // Scope verification
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var editScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffEdit);

        if (editScope == AppPermissions.Scopes.Own)
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                return Forbid();
            }
        }
        else if (editScope == AppPermissions.Scopes.Reporting || editScope == "Reporting")
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                var isReportee = await _db.Employees
                    .AnyAsync(e => e.EmployeeId == request.EmployeeId && e.ReportingManagerId == currentEmpId.Value);
                if (!isReportee)
                {
                    return Forbid();
                }
            }
        }
        else if (editScope == AppPermissions.Scopes.Department)
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
                if (currentEmp?.DepartmentId == null || request.Employee?.DepartmentId != currentEmp.DepartmentId)
                {
                    return Forbid();
                }
            }
        }

        TimeOnly? inTime = null;
        TimeOnly? outTime = null;
        if (!string.IsNullOrWhiteSpace(dto.InTime) && TimeOnly.TryParse(dto.InTime, out var parsedIn)) inTime = parsedIn;
        if (!string.IsNullOrWhiteSpace(dto.OutTime) && TimeOnly.TryParse(dto.OutTime, out var parsedOut)) outTime = parsedOut;

        int? workMinutes = null;
        if (inTime.HasValue && outTime.HasValue)
        {
            var inDateTime = dto.WorkedDate.ToDateTime(inTime.Value);
            var outDateTime = dto.WorkedDate.ToDateTime(outTime.Value);
            if (outTime.Value < inTime.Value) outDateTime = outDateTime.AddDays(1);
            workMinutes = (int)(outDateTime - inDateTime).TotalMinutes;
        }

        request.WorkedDate = dto.WorkedDate;
        request.InTime = inTime;
        request.OutTime = outTime;
        request.ShiftId = dto.ShiftId;
        request.WorkMinutes = workMinutes;
        request.CompOffDays = dto.CompOffDays > 0 ? dto.CompOffDays : request.CompOffDays;
        if (!string.IsNullOrWhiteSpace(dto.Reason))
        {
            request.RejectionReason = dto.Reason;
        }
        request.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Comp-Off request updated successfully.",
            id = request.Id
        });
    }

    // ==========================================
    // 7. APPROVE COMP-OFF REQUEST
    // ==========================================
    [HttpPost("{id}/approve")]
    [HttpPost("requests/{id}/approve")]
    public async Task<IActionResult> ApproveCompOffRequest(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApprove))
        {
            return Forbid();
        }

        var request = await _db.CompOffRequests
            .Include(c => c.Employee)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        if (request.Status != "Pending" && request.Status != "Draft")
        {
            return BadRequest(new { message = $"Cannot approve a request with status '{request.Status}'." });
        }

        // Scope verification
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var approveScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffApprove);

        if (approveScope == AppPermissions.Scopes.Own)
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                return Forbid();
            }
        }
        else if (approveScope == AppPermissions.Scopes.Reporting || approveScope == "Reporting")
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                var isReportee = await _db.Employees
                    .AnyAsync(e => e.EmployeeId == request.EmployeeId && e.ReportingManagerId == currentEmpId.Value);
                if (!isReportee)
                {
                    return Forbid();
                }
            }
        }
        else if (approveScope == AppPermissions.Scopes.Department)
        {
            if (currentEmpId.HasValue && request.EmployeeId != currentEmpId.Value)
            {
                var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
                if (currentEmp?.DepartmentId == null || request.Employee?.DepartmentId != currentEmp.DepartmentId)
                {
                    return Forbid();
                }
            }
        }

        var approver = User.Identity?.Name ?? "Admin";
        await _compOffService.ApproveRequestAsync(id, approver);

        return Ok(new
        {
            success = true,
            message = "Comp-Off request approved and credited to balance.",
            id
        });
    }

    // ==========================================
    // 8. REJECT COMP-OFF REQUEST
    // ==========================================
    [HttpPost("{id}/reject")]
    [HttpPost("requests/{id}/reject")]
    public async Task<IActionResult> RejectCompOffRequest(int id, [FromBody] RejectCompOffDto? dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove) &&
            !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.LeavesApprove))
        {
            return Forbid();
        }

        var request = await _db.CompOffRequests
            .Include(c => c.Employee)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        if (request.Status != "Pending" && request.Status != "Draft")
        {
            return BadRequest(new { message = $"Cannot reject a request with status '{request.Status}'." });
        }

        var approver = User.Identity?.Name ?? "Admin";
        await _compOffService.RejectRequestAsync(id, approver, dto?.Reason ?? "Rejected by manager/admin");

        return Ok(new
        {
            success = true,
            message = "Comp-Off request rejected.",
            id
        });
    }

    // ==========================================
    // 9. CANCEL COMP-OFF REQUEST (Self / Manager)
    // ==========================================
    [HttpPost("{id}/cancel")]
    [HttpPost("requests/{id}/cancel")]
    public async Task<IActionResult> CancelCompOffRequest(int id, [FromBody] RejectCompOffDto? dto)
    {
        var request = await _db.CompOffRequests.FindAsync(id);
        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        if (request.Status != "Pending" && request.Status != "Draft")
        {
            return BadRequest(new { message = "Only Pending Comp-Off requests can be cancelled." });
        }

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        bool isSelf = currentEmpId.HasValue && request.EmployeeId == currentEmpId.Value;
        bool canApprove = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove);

        if (!isSelf && !canApprove)
        {
            return Forbid();
        }

        request.Status = "Cancelled";
        if (!string.IsNullOrWhiteSpace(dto?.Reason))
        {
            request.RejectionReason = $"Cancelled: {dto.Reason}";
        }
        request.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Comp-Off request cancelled.",
            id
        });
    }

    // ==========================================
    // 10. ARCHIVE & RESTORE
    // ==========================================
    [HttpPost("{id}/archive")]
    [HttpPost("requests/{id}/archive")]
    public async Task<IActionResult> ArchiveCompOffRequest(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var request = await _db.CompOffRequests.FindAsync(id);
        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        request.Status = "Archived";
        request.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Comp-Off request archived.", id });
    }

    [HttpPost("{id}/restore")]
    [HttpPost("requests/{id}/restore")]
    public async Task<IActionResult> RestoreCompOffRequest(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var request = await _db.CompOffRequests.FindAsync(id);
        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found." });
        }

        request.Status = "Pending";
        request.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Comp-Off request restored to Pending status.", id });
    }

    // ==========================================
    // 11. DELETE / ARCHIVE COMP-OFF REQUEST
    // ==========================================
    [HttpDelete("{id}")]
    [HttpDelete("requests/{id}")]
    public async Task<IActionResult> DeleteCompOffRequest(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffDelete);
        if (permanent && deleteScope != "Permanent Delete" && deleteScope != "All")
        {
            return Forbid();
        }

        var query = _db.CompOffRequests.Where(c => c.Id == id);
        query = await _permissionService.ApplyCompOffScopeAsync(query, User, AppPermissions.Keys.CompOffDelete);

        var request = await query.FirstOrDefaultAsync();
        if (request == null)
        {
            return NotFound(new { message = "Comp-Off request not found or unauthorized." });
        }

        if (permanent || request.Status == "Archived" || request.Status == "Cancelled")
        {
            _db.CompOffRequests.Remove(request);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, permanent = true, message = "Comp-Off request permanently deleted.", id });
        }
        else
        {
            request.Status = "Archived";
            request.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();

            return Ok(new { success = true, permanent = false, message = "Comp-Off request moved to archive.", id });
        }
    }

    // ==========================================
    // 12. BULK ACTIONS
    // ==========================================
    [HttpPost("bulk-approve")]
    [HttpPost("requests/bulk-approve")]
    public async Task<IActionResult> BulkApproveCompOff([FromBody] BulkCompOffActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected." });
        }

        var approver = User.Identity?.Name ?? "Admin";
        int count = 0;

        foreach (var id in idList)
        {
            try
            {
                await _compOffService.ApproveRequestAsync(id, approver);
                count++;
            }
            catch
            {
                // Continue with other items
            }
        }

        return Ok(new { success = true, message = $"Successfully approved {count} Comp-Off request(s)." });
    }

    [HttpPost("bulk-reject")]
    [HttpPost("requests/bulk-reject")]
    public async Task<IActionResult> BulkRejectCompOff([FromBody] BulkCompOffActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffApprove))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected." });
        }

        var approver = User.Identity?.Name ?? "Admin";
        int count = 0;

        foreach (var id in idList)
        {
            try
            {
                await _compOffService.RejectRequestAsync(id, approver, request?.Reason ?? "Rejected by admin");
                count++;
            }
            catch
            {
                // Continue with other items
            }
        }

        return Ok(new { success = true, message = $"Successfully rejected {count} Comp-Off request(s)." });
    }

    [HttpPost("bulk-archive")]
    [HttpPost("requests/bulk-archive")]
    public async Task<IActionResult> BulkArchiveCompOff([FromBody] BulkCompOffActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected." });
        }

        var items = await _db.CompOffRequests
            .Where(c => idList.Contains(c.Id) && c.Status != "Archived")
            .ToListAsync();

        foreach (var item in items)
        {
            item.Status = "Archived";
            item.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Successfully archived {items.Count} Comp-Off request(s)." });
    }

    [HttpPost("bulk-restore")]
    [HttpPost("requests/bulk-restore")]
    public async Task<IActionResult> BulkRestoreCompOff([FromBody] BulkCompOffActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected." });
        }

        var items = await _db.CompOffRequests
            .Where(c => idList.Contains(c.Id) && (c.Status == "Archived" || c.Status == "Cancelled"))
            .ToListAsync();

        foreach (var item in items)
        {
            item.Status = "Pending";
            item.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Successfully restored {items.Count} Comp-Off request(s)." });
    }

    [HttpPost("bulk-delete")]
    [HttpPost("requests/bulk-delete")]
    public async Task<IActionResult> BulkDeleteCompOff([FromBody] BulkCompOffActionRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.CompOffDelete))
        {
            return Forbid();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.CompOffDelete);
        if (deleteScope != "Permanent Delete" && deleteScope != "Bulk Delete" && deleteScope != "All")
        {
            return Forbid();
        }

        var idList = request?.GetIntIds() ?? new List<int>();
        if (idList.Count == 0)
        {
            return BadRequest(new { message = "No records selected." });
        }

        var items = await _db.CompOffRequests
            .Where(c => idList.Contains(c.Id))
            .ToListAsync();

        _db.CompOffRequests.RemoveRange(items);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Successfully permanently deleted {items.Count} Comp-Off request(s)." });
    }
}
