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
    private readonly IArchiveService _archive;

    public LoansController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _archive = archive;
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

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

    public record LoanPrefixSettingsDto(
        string? SeriesCode,
        string? Connector,
        int PaddingDigits = 3,
        int StartSequence = 1
    );

    [HttpGet("prefix-settings")]
    public async Task<IActionResult> GetPrefixSettings([FromQuery] int? branchId = null)
    {
        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        var settings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch)
            .ToListAsync();

        string series    = settings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Series")?.SettingValue    ?? "LN";
        string connector = settings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Connector")?.SettingValue ?? "-";
        int padding      = int.TryParse(settings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Padding")?.SettingValue,    out var p)    ? p    : 3;
        int startSeq     = int.TryParse(settings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_StartSeq")?.SettingValue,   out var sSeq) ? sSeq : 1;

        var maxCount = await _db.EmployeeLoans.Where(l => l.OrganizationId == targetOrgId).CountAsync();
        var nextSeq = Math.Max(maxCount + 1, startSeq);

        var preview = $"{series}{connector}{nextSeq.ToString($"D{padding}")}";

        return Ok(new
        {
            seriesCode = series,
            connector = connector,
            paddingDigits = padding,
            startSequence = startSeq,
            nextSequence = nextSeq,
            preview = preview,
            sample1 = $"{series}{connector}{nextSeq.ToString($"D{padding}")}",
            sample2 = $"{series}{connector}{(nextSeq + 1).ToString($"D{padding}")}",
            sample3 = $"{series}{connector}{(nextSeq + 2).ToString($"D{padding}")}"
        });
    }

    [HttpPost("prefix-settings")]
    public async Task<IActionResult> SavePrefixSettings([FromBody] LoanPrefixSettingsDto dto, [FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        async Task UpsertSetting(string key, string value, string desc)
        {
            var existing = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch && s.SettingKey == key);
            if (existing != null)
            {
                existing.SettingValue = value;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = targetOrgId,
                    BranchId = targetBranch,
                    SettingKey = key,
                    SettingValue = value,
                    Description = desc,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        var series = string.IsNullOrWhiteSpace(dto.SeriesCode) ? "LN" : dto.SeriesCode.Trim().ToUpper();
        var connector = dto.Connector ?? "-";
        var padding = dto.PaddingDigits > 0 ? dto.PaddingDigits : 3;
        var startSeq = dto.StartSequence > 0 ? dto.StartSequence : 1;

        await UpsertSetting("Loan_Prefix_Series", series, "Loan Application Number Series Prefix");
        await UpsertSetting("Loan_Prefix_Connector", connector, "Loan Application Number Connector / Delimiter");
        await UpsertSetting("Loan_Prefix_Padding", padding.ToString(), "Loan Application Number Sequence Padding");
        await UpsertSetting("Loan_Prefix_StartSeq", startSeq.ToString(), "Loan Application Number Starting Sequence");

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Loan prefix settings saved successfully." });
    }

    [HttpGet]
    public async Task<IActionResult> GetLoans(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int? loanTypeId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string archiveStatus = "active")
    {
        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.EmployeeLoans
            .AsNoTracking()
            .Include(l => l.Employee)
                .ThenInclude(e => e!.Department)
            .Include(l => l.LoanType)
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(l => l.ArchivedAt != null || l.Status == "Closed" || l.Status == "Rejected");
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(l => l.ArchivedAt == null && l.Status != "Closed" && l.Status != "Rejected");

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
            if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(l => l.Status == "Pending" || l.Status == "Manager Approved" || l.Status == "Approved" || l.Status == "Disbursed");
            }
            else if (status.Equals("archived", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(l => l.Status == "Closed" || l.Status == "Rejected");
            }
            else
            {
                query = query.Where(l => l.Status == status);
            }
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
                remainingInstallments = l.RemainingInstallments,
                remainingAmount = l.RemainingAmount,
                startMonth = l.StartDate.ToString("yyyy-MM"),
                startDate = l.StartDate.ToString("yyyy-MM-dd"),
                status = l.Status,
                reason = l.Reason ?? "",
                approvedBy = l.ApprovedBy,
                approvedDate = l.ApprovedDate,
                managerApprovedBy = l.ManagerApprovedBy ?? "",
                managerApprovedDate = l.ManagerApprovedDate,
                assignedManagerId = l.AssignedManagerId,
                foreclosureRemark = l.ForeclosureRemark ?? "",
                startingPaidInstallments = l.StartingPaidInstallments,
                createdAt = l.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                archivedAt = l.ArchivedAt
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
            query = query.Where(t => t.BranchId == activeBranch.Value);
        }

        var types = await query
            .OrderBy(t => t.TypeName)
            .Select(t => new
            {
                id = t.Id,
                name = t.TypeName,
                maxAmount = t.MaxAmount,
                maxTenureMonths = t.MaxInstallments,
                branchId = t.BranchId
            })
            .ToListAsync();

        var deduplicated = types
            .GroupBy(t => t.name.ToLower().Trim())
            .Select(g => g.OrderByDescending(t => t.branchId.HasValue).First())
            .OrderBy(t => t.name)
            .ToList();

        return Ok(deduplicated);
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

            // Generate ApplicationNumber using prefix settings
            var targetOrgId = employee.OrganizationId;
            var targetBranch = employee.BranchId ?? dto.BranchId ?? _tenantProvider.BranchId;

            var prefixSettings = await _db.SystemSettings
                .AsNoTracking()
                .Where(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch)
                .ToListAsync();

            string series    = prefixSettings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Series")?.SettingValue    ?? "LN";
            string connector = prefixSettings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Connector")?.SettingValue ?? "-";
            int padding      = int.TryParse(prefixSettings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_Padding")?.SettingValue,    out var pd) ? pd : 3;
            int startSeq     = int.TryParse(prefixSettings.FirstOrDefault(s => s.SettingKey == "Loan_Prefix_StartSeq")?.SettingValue,   out var ss) ? ss : 1;

            var count = await _db.EmployeeLoans.CountAsync(l => l.OrganizationId == targetOrgId);
            var nextSeq = Math.Max(count + 1, startSeq);
            var appNo = $"{series}{connector}{nextSeq.ToString($"D{padding}")}";

            var loan = new EmployeeLoan
            {
                OrganizationId = targetOrgId,
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
                CreatedAt = DateTime.Now,
                AssignedManagerId = employee.ReportingManagerId
            };

            // Create installment schedule
            for (int i = 0; i < dto.TenureMonths; i++)
            {
                var instDate = dto.StartDate.AddMonths(i);
                loan.LoanInstallments.Add(new LoanInstallment
                {
                    OrganizationId = targetOrgId,
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
        catch (Exception)
        {
            return StatusCode(500, new { message = "Failed to create loan application. Please try again or contact support." });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveLoan(int id)
    {
        var loan = await _db.EmployeeLoans
            .Include(l => l.Employee)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (loan == null) return NotFound(new { message = "Loan not found." });

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var isAdmin = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans);

        if (loan.Status == "Pending")
        {
            // Level 1: Manager Approval
            // Check if the current user is the assigned manager (reporting manager)
            var isAssignedManager = loan.AssignedManagerId.HasValue && currentEmpId.HasValue && loan.AssignedManagerId.Value == currentEmpId.Value;

            if (!isAssignedManager && !isAdmin)
            {
                return StatusCode(403, new { message = "Only the assigned reporting manager or an admin can approve at this level." });
            }

            loan.Status = "Manager Approved";
            loan.ManagerApprovedBy = User.Identity?.Name ?? "Manager";
            loan.ManagerApprovedDate = DateTime.Now;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Loan approved by manager (Level 1). Awaiting HR/Admin approval.", id = loan.Id, level = 1 });
        }
        else if (loan.Status == "Manager Approved")
        {
            // Level 2: HR/Admin Approval
            if (!isAdmin)
            {
                return Forbid();
            }

            loan.Status = "Approved";
            loan.ApprovedBy = User.Identity?.Name ?? "Admin";
            loan.ApprovedDate = DateTime.Now;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Loan approved by HR/Admin (Level 2). Ready for disbursement.", id = loan.Id, level = 2 });
        }
        else
        {
            return BadRequest(new { message = $"Loan cannot be approved in its current status: {loan.Status}" });
        }
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

    public record ForecloseLoanDto(string? Remark, bool IncludeCurrentMonth = true);

    [HttpPost("{id}/foreclose")]
    public async Task<IActionResult> ForecloseLoan(int id, [FromBody] ForecloseLoanDto? dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var loan = await _db.EmployeeLoans
            .Include(l => l.LoanInstallments)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null) return NotFound(new { message = "Loan not found." });

        if (loan.Status != "Disbursed" && loan.Status != "Active")
        {
            return BadRequest(new { message = $"Only disbursed/active loans can be foreclosed. Current status: {loan.Status}" });
        }

        var currentMonth = DateTime.Now.ToString("yyyy-MM");
        var includeCurrentMonth = dto?.IncludeCurrentMonth ?? true;

        var pendingInstallments = loan.LoanInstallments
            .Where(i => i.Status == "Pending")
            .AsEnumerable();

        if (!includeCurrentMonth)
        {
            pendingInstallments = pendingInstallments.Where(i => i.DueMonth != currentMonth);
        }

        foreach (var inst in pendingInstallments)
        {
            inst.Status = "Settled";
            inst.PaidAmount = inst.Amount;
            inst.PaidDate = DateOnly.FromDateTime(DateTime.Now);
            inst.Remarks = "Settled via Foreclosure";
        }

        loan.RemainingAmount = 0;
        loan.RemainingInstallments = 0;
        loan.Status = "Closed";

        var foreclosedBy = User.Identity?.Name ?? "Admin";
        var remark = dto?.Remark?.Trim() ?? "No remark provided";
        loan.ForeclosureRemark = $"{remark} (By {foreclosedBy} on {DateTime.Now:dd MMM yyyy})";

        await _db.SaveChangesAsync();
        return Ok(new { message = "Loan foreclosed successfully. All pending installments settled.", id = loan.Id });
    }

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// Domain guards (disbursed loan, payroll-linked installments) apply to both paths.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLoan(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        _db.BypassArchiveFilter = true;
        var payrollLinked = await _db.LoanInstallments
            .AnyAsync(i => i.LoanId == id && i.PayrollId != null);

        string? Guard(EmployeeLoan l) =>
            l.Status == "Disbursed"
                ? "Cannot delete an active disbursed loan. Use foreclosure to close it first."
            : payrollLinked
                ? "Cannot delete loan because one or more installments are linked to processed payroll."
            : null;

        var result = permanent
            ? await _archive.PermanentDeleteAsync<EmployeeLoan>(id, Guard, cascade: async _ =>
              {
                  var installments = await _db.LoanInstallments.Where(i => i.LoanId == id).ToListAsync();
                  _db.LoanInstallments.RemoveRange(installments);
              })
            : await _archive.ArchiveAsync<EmployeeLoan>(id, Guard);

        return FromArchive(result);
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreLoan(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
            return Forbid();

        return FromArchive(await _archive.RestoreAsync<EmployeeLoan>(id));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateLoan(int id, [FromBody] LoanApplyDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageLoans))
        {
            return Forbid();
        }

        var loan = await _db.EmployeeLoans
            .Include(l => l.LoanInstallments)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null) return NotFound(new { message = "Loan not found." });

        if (loan.Status != "Pending" && loan.Status != "Manager Approved")
        {
            return BadRequest(new { message = $"Cannot edit a loan in '{loan.Status}' status. Only Pending or Manager Approved loans can be edited." });
        }

        if (loan.LoanInstallments.Any(i => i.Status == "Paid" || i.Status == "Settled" || i.PayrollId != null))
        {
            return BadRequest(new { message = "Cannot edit loan because one or more installments are already processed." });
        }

        if (dto.PrincipalAmount <= 0) return BadRequest(new { message = "Principal amount must be greater than zero." });
        if (dto.TenureMonths <= 0) return BadRequest(new { message = "Tenure must be at least 1 month." });

        var emi = Math.Round(dto.PrincipalAmount / dto.TenureMonths, 2);

        // Update loan fields
        loan.LoanTypeId = dto.LoanTypeId;
        loan.LoanAmount = dto.PrincipalAmount;
        loan.Installments = dto.TenureMonths;
        loan.InstallmentAmount = emi;
        loan.RemainingAmount = dto.PrincipalAmount;
        loan.RemainingInstallments = dto.TenureMonths;
        loan.StartDate = dto.StartDate;
        loan.Reason = dto.Reason?.Trim();

        // Rebuild installment schedule
        _db.LoanInstallments.RemoveRange(loan.LoanInstallments);

        for (int i = 0; i < dto.TenureMonths; i++)
        {
            var instDate = dto.StartDate.AddMonths(i);
            loan.LoanInstallments.Add(new LoanInstallment
            {
                OrganizationId = loan.OrganizationId,
                BranchId = loan.BranchId,
                InstallmentNumber = i + 1,
                DueMonth = instDate.ToString("yyyy-MM"),
                Amount = emi,
                PaidAmount = 0,
                Status = "Pending"
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Loan application updated successfully.", id = loan.Id });
    }

    [HttpGet("{id}/installments")]
    public async Task<IActionResult> GetLoanInstallments(int id)
    {
        var loan = await _db.EmployeeLoans
            .AsNoTracking()
            .Include(l => l.Employee)
                .ThenInclude(e => e!.Department)
            .Include(l => l.LoanType)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null) return NotFound(new { message = "Loan not found." });

        // RBAC check
        var empScopedQuery = _db.Employees.AsNoTracking().AsQueryable();
        empScopedQuery = await _permissionService.ApplyEmployeeScopeAsync(empScopedQuery, User, AppPermissions.Keys.PayrollView);
        var hasAccess = await empScopedQuery.AnyAsync(e => e.EmployeeId == loan.EmployeeId);
        if (!hasAccess) return Forbid();

        var installments = await _db.LoanInstallments
            .AsNoTracking()
            .Where(i => i.LoanId == id)
            .OrderBy(i => i.InstallmentNumber)
            .Select(i => new
            {
                id = i.Id,
                installmentNumber = i.InstallmentNumber,
                dueMonth = i.DueMonth,
                amount = i.Amount,
                paidAmount = i.PaidAmount,
                status = i.Status,
                paidDate = i.PaidDate != null ? i.PaidDate.Value.ToString("yyyy-MM-dd") : (string?)null,
                payrollId = i.PayrollId,
                remarks = i.Remarks ?? ""
            })
            .ToListAsync();

        var totalPaid = installments.Where(i => i.status == "Paid" || i.status == "Settled").Sum(i => i.paidAmount);
        var totalPending = installments.Where(i => i.status == "Pending").Sum(i => i.amount);

        return Ok(new
        {
            loan = new
            {
                id = loan.Id,
                applicationNumber = loan.ApplicationNumber ?? $"LN-{loan.Id}",
                applicationDate = loan.ApplicationDate.ToString("yyyy-MM-dd"),
                employeeId = loan.EmployeeId,
                employeeName = loan.Employee?.EmployeeName ?? "Employee",
                department = loan.Employee?.Department?.DepartmentName ?? "General",
                loanType = loan.LoanType?.TypeName ?? "Loan",
                loanTypeId = loan.LoanTypeId,
                loanAmount = loan.LoanAmount,
                installmentAmount = loan.InstallmentAmount,
                totalInstallments = loan.Installments,
                remainingInstallments = loan.RemainingInstallments,
                remainingAmount = loan.RemainingAmount,
                startDate = loan.StartDate.ToString("yyyy-MM-dd"),
                status = loan.Status,
                reason = loan.Reason ?? "",
                assignedManagerId = loan.AssignedManagerId,
                managerApprovedBy = loan.ManagerApprovedBy ?? "",
                managerApprovedDate = loan.ManagerApprovedDate?.ToString("yyyy-MM-dd HH:mm"),
                approvedBy = loan.ApprovedBy ?? "",
                approvedDate = loan.ApprovedDate?.ToString("yyyy-MM-dd HH:mm"),
                foreclosureRemark = loan.ForeclosureRemark ?? "",
                startingPaidInstallments = loan.StartingPaidInstallments,
                createdAt = loan.CreatedAt.ToString("yyyy-MM-dd HH:mm")
            },
            installments,
            summary = new
            {
                totalPaid,
                totalPending,
                paidCount = installments.Count(i => i.status == "Paid" || i.status == "Settled"),
                pendingCount = installments.Count(i => i.status == "Pending"),
                totalCount = installments.Count
            }
        });
    }
}
