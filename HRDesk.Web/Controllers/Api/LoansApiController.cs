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
public class LoansController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public LoansController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    public record LoanApplyDto(
        int EmployeeId,
        int LoanTypeId,
        decimal PrincipalAmount,
        int TenureMonths,
        DateOnly StartDate,
        string? Reason,
        int? BranchId = null
    );

    public record LoanStatusDto(string? Remarks);

    [HttpGet]
    public async Task<IActionResult> GetLoans(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int? loanTypeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.EmployeeLoans
            .AsNoTracking()
            .Include(l => l.Employee)
                .ThenInclude(e => e.Department)
            .Include(l => l.LoanType)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(l => (l.BranchId != null ? l.BranchId == activeBranch.Value : (l.Employee != null && l.Employee.BranchId == activeBranch.Value)));
        }

        // RBAC Scoping
        var empScopedQuery = _db.Employees.AsNoTracking().AsQueryable();
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            empScopedQuery = empScopedQuery.Where(e => e.BranchId == activeBranch.Value);
        }
        empScopedQuery = await _permissionService.ApplyEmployeeScopeAsync(empScopedQuery, User, AppPermissions.Keys.PayrollView);
        var allowedEmpIds = await empScopedQuery.Select(e => e.EmployeeId).ToListAsync();

        query = query.Where(l => allowedEmpIds.Contains(l.EmployeeId));

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Status == status);
        }

        if (loanTypeId.HasValue && loanTypeId.Value > 0)
        {
            query = query.Where(l => l.LoanTypeId == loanTypeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(l =>
                (l.Employee != null && l.Employee.EmployeeName.ToLower().Contains(s)) ||
                (l.ApplicationNumber != null && l.ApplicationNumber.ToLower().Contains(s)) ||
                (l.Reason != null && l.Reason.ToLower().Contains(s))
            );
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                id = l.Id,
                appNumber = l.ApplicationNumber ?? $"LN-{l.Id}",
                applicationNumber = l.ApplicationNumber ?? $"LN-{l.Id}",
                appDate = l.ApplicationDate.ToString("yyyy-MM-dd"),
                applicationDate = l.ApplicationDate.ToString("yyyy-MM-dd"),
                employeeId = l.EmployeeId,
                employeeName = l.Employee != null ? l.Employee.EmployeeName : "Employee",
                department = l.Employee != null && l.Employee.Department != null ? l.Employee.Department.DepartmentName : "General",
                loanType = l.LoanType != null ? l.LoanType.TypeName : "Loan",
                loanTypeId = l.LoanTypeId,
                loanTypeName = l.LoanType != null ? l.LoanType.TypeName : "Loan",
                principalAmount = l.LoanAmount,
                monthlyEmi = l.InstallmentAmount,
                tenureMonths = l.Installments,
                paidMonths = l.Installments - l.RemainingInstallments,
                remainingAmount = l.RemainingAmount,
                startMonth = l.StartDate.ToString("yyyy-MM"),
                status = l.Status,
                reason = l.Reason ?? "",
                approvedBy = l.ApprovedBy,
                approvedDate = l.ApprovedDate
            })
            .ToListAsync();

        // Calculate Aggregate Stats scoped to active branch and allowed employees
        var statsQuery = _db.EmployeeLoans
            .AsNoTracking()
            .Where(l => allowedEmpIds.Contains(l.EmployeeId));

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            statsQuery = statsQuery.Where(l => (l.BranchId != null ? l.BranchId == activeBranch.Value : (l.Employee != null && l.Employee.BranchId == activeBranch.Value)));
        }

        var allLoans = await statsQuery.ToListAsync();

        var totalPrincipal = allLoans.Where(l => l.Status == "Disbursed" || l.Status == "Approved").Sum(l => l.LoanAmount);
        var totalOutstanding = allLoans.Where(l => l.Status == "Disbursed" || l.Status == "Approved").Sum(l => l.RemainingAmount);
        var activeCount = allLoans.Count(l => l.Status == "Disbursed" || l.Status == "Approved");
        var pendingCount = allLoans.Count(l => l.Status == "Pending");

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            stats = new
            {
                totalDisbursed = totalPrincipal,
                totalOutstanding,
                totalRecovered = totalPrincipal - totalOutstanding,
                activeLoansCount = activeCount,
                pendingRequestsCount = pendingCount
            }
        });
    }

    [HttpGet("types")]
    public async Task<IActionResult> GetLoanTypes([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var query = _db.LoanTypes
            .AsNoTracking()
            .Where(t => t.IsActive);

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(t => t.BranchId == activeBranch.Value || t.BranchId == null);
        }

        var types = await query
            .OrderBy(t => t.TypeName)
            .Select(t => new
            {
                id = t.Id,
                name = t.TypeName,
                maxAmount = t.MaxAmount,
                maxTenureMonths = t.MaxInstallments
            })
            .ToListAsync();

        return Ok(types);
    }

    [HttpPost]
    public async Task<IActionResult> CreateLoan([FromBody] LoanApplyDto dto)
    {
        try
        {
            var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
            if (employee == null) return NotFound(new { message = "Employee not found." });

            if (dto.PrincipalAmount <= 0) return BadRequest(new { message = "Principal amount must be greater than zero." });
            if (dto.TenureMonths <= 0) return BadRequest(new { message = "Tenure must be at least 1 month." });

            var emi = Math.Round(dto.PrincipalAmount / dto.TenureMonths, 2);
            var count = await _db.EmployeeLoans.CountAsync(l => l.OrganizationId == employee.OrganizationId);
            var appNo = $"LN-{dto.StartDate:yyyyMM}-{(count + 1):D3}";

            var targetBranch = employee.BranchId ?? dto.BranchId ?? _tenantProvider.BranchId;

            var loan = new EmployeeLoan
            {
                OrganizationId = employee.OrganizationId,
                BranchId = targetBranch,
                EmployeeId = dto.EmployeeId,
                LoanTypeId = dto.LoanTypeId,
                ApplicationNumber = appNo,
                LoanAmount = dto.PrincipalAmount,
                Installments = dto.TenureMonths,
                InstallmentAmount = emi,
                RemainingAmount = dto.PrincipalAmount,
                RemainingInstallments = dto.TenureMonths,
                StartDate = dto.StartDate,
                ApplicationDate = DateOnly.FromDateTime(DateTime.Today),
                Reason = dto.Reason?.Trim(),
                Status = "Pending",
                CreatedAt = DateTime.Now
            };

            // Create installment schedule
            for (int i = 0; i < dto.TenureMonths; i++)
            {
                var instDate = dto.StartDate.AddMonths(i);
                loan.LoanInstallments.Add(new LoanInstallment
                {
                    OrganizationId = employee.OrganizationId,
                    BranchId = targetBranch,
                    InstallmentNumber = i + 1,
                    DueMonth = instDate.ToString("yyyy-MM"),
                    Amount = emi,
                    PaidAmount = 0,
                    Status = "Pending"
                });
            }

            _db.EmployeeLoans.Add(loan);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Loan application submitted successfully.", id = loan.Id, applicationNumber = appNo });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to create loan application: {ex.Message}" });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveLoan(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var loan = await _db.EmployeeLoans.FindAsync(id);
        if (loan == null) return NotFound(new { message = "Loan not found." });

        loan.Status = "Approved";
        loan.ApprovedBy = User.Identity?.Name ?? "Admin";
        loan.ApprovedDate = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Loan application approved.", id = loan.Id });
    }

    [HttpPost("{id}/disburse")]
    public async Task<IActionResult> DisburseLoan(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var loan = await _db.EmployeeLoans.FindAsync(id);
        if (loan == null) return NotFound(new { message = "Loan not found." });

        loan.Status = "Disbursed";
        await _db.SaveChangesAsync();
        return Ok(new { message = "Loan marked as disbursed.", id = loan.Id });
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectLoan(int id, [FromBody] LoanStatusDto? dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var loan = await _db.EmployeeLoans.FindAsync(id);
        if (loan == null) return NotFound(new { message = "Loan not found." });

        loan.Status = "Rejected";
        loan.ApprovedBy = User.Identity?.Name ?? "Admin";
        loan.ApprovedDate = DateTime.Now;
        if (!string.IsNullOrWhiteSpace(dto?.Remarks))
        {
            loan.ForeclosureRemark = dto.Remarks;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Loan application rejected.", id = loan.Id });
    }
}
