using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using HRDesk.Web.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/payroll")] // Same prefix
[Authorize]
public class PayrollReportsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public PayrollReportsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("records")]
    public async Task<IActionResult> GetPayrollRecords(
        [FromQuery] string? month = null,
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string archiveStatus = "active")
    {
        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }

        var targetMonth = !string.IsNullOrWhiteSpace(month) ? month : DateTime.Now.ToString("yyyy-MM");
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
                .ThenInclude(e => e!.Department)
            .Include(p => p.Employee)
                .ThenInclude(e => e!.Designation)
            .Where(p => p.Month == targetMonth)
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(p => p.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(p => p.ArchivedAt == null);

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(p => p.BranchId == activeBranch.Value || (p.Employee != null && p.Employee.BranchId == activeBranch.Value));
        }

        if (!string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
        {
            var empScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.PayrollView);
            var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);

            if (empScope == AppPermissions.Scopes.Own && currentEmpId.HasValue)
            {
                query = query.Where(p => p.EmployeeId == currentEmpId.Value);
            }
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(p => p.Employee != null && p.Employee.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status.ToLower() != "all")
        {
            query = query.Where(p => p.Status.ToLower() == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p => p.Employee != null && p.Employee.EmployeeName.ToLower().Contains(s));
        }

        var totalCount = await query.CountAsync();
        var allRecordsForMonth = await query.ToListAsync();

        var totalDisbursed = allRecordsForMonth.Sum(p => p.GrossSalary);
        var totalNet = allRecordsForMonth.Sum(p => p.NetSalary);
        var totalDeductions = allRecordsForMonth.Sum(p => p.TotalDeductions);

        if (pageSize <= 0) pageSize = 20;
        var pagedItems = allRecordsForMonth
            .OrderBy(p => p.Employee?.EmployeeName ?? "")
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                id = p.Id,
                employeeId = p.EmployeeId,
                employeeName = p.Employee?.EmployeeName ?? "Unknown",
                department = p.Employee?.Department?.DepartmentName ?? "General",
                designation = p.Employee?.Designation?.DesignationName ?? "Staff",
                month = p.Month,
                totalDays = p.TotalDays,
                presentDays = p.PresentDays,
                payableDays = p.PayableDays,
                lopDays = p.UnpaidLeaves,
                grossSalary = p.GrossSalary,
                totalEarnings = p.TotalEarnings,
                totalDeductions = p.TotalDeductions,
                netSalary = p.NetSalary,
                status = p.Status,
                isLocked = p.LockedAt != null,
                processedDate = p.ProcessedDate?.ToString("yyyy-MM-dd HH:mm"),
                paymentDate = p.PaymentDate?.ToString("yyyy-MM-dd"),
                archivedAt = p.ArchivedAt
            })
            .ToList();

        return Ok(new
        {
            month = targetMonth,
            metrics = new
            {
                totalEmployees = totalCount,
                totalGross = totalDisbursed,
                totalNet = totalNet,
                totalDeductions = totalDeductions,
                approvedCount = allRecordsForMonth.Count(p => p.Status == "Approved" || p.Status == "Paid"),
                draftCount = allRecordsForMonth.Count(p => p.Status == "Draft")
            },
            items = pagedItems,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("{id}/payslip")]
    public async Task<IActionResult> GetPayslip(int id)
    {
        var record = await _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
                .ThenInclude(e => e!.Department)
            .Include(p => p.Employee)
                .ThenInclude(e => e!.Designation)
            .Include(p => p.PayrollDetails)
            .Include(p => p.Organization)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (record == null)
        {
            return NotFound(new { message = "Payroll record not found." });
        }

        // Security check for Own scope
        if (!string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
        {
            var empScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.PayrollView);
            var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
            if (empScope == AppPermissions.Scopes.Own && currentEmpId.HasValue && record.EmployeeId != currentEmpId.Value)
            {
                return Forbid();
            }
        }

        string monthDisplay;
        try
        {
            monthDisplay = DateTime.ParseExact(record.Month, "yyyy-MM", null).ToString("MMMM yyyy");
        }
        catch
        {
            monthDisplay = record.Month;
        }

        var earnings = record.PayrollDetails
            .Where(d => d.ComponentType == "Earning")
            .OrderByDescending(d => d.ComponentName != null && d.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase))
            .ThenBy(d => d.ComponentName)
            .Select(d => new
            {
                componentName = d.ComponentName,
                amount = d.Amount,
                remarks = d.Remarks
            })
            .ToList();

        var deductions = record.PayrollDetails
            .Where(d => d.ComponentType == "Deduction")
            .OrderBy(d => d.ComponentName)
            .Select(d => new
            {
                componentName = d.ComponentName,
                amount = d.Amount,
                remarks = d.Remarks
            })
            .ToList();

        var org = record.Organization ?? await _db.Organizations.FirstOrDefaultAsync(o => o.Id == record.OrganizationId);

        return Ok(new
        {
            id = record.Id,
            month = record.Month,
            monthDisplay,
            status = record.Status,
            isLocked = record.LockedAt != null,
            salaryBasis = record.SalaryBasis,
            isProrated = record.IsProrated,
            proratedDays = record.ProratedDays,
            processedDate = record.ProcessedDate?.ToString("yyyy-MM-dd HH:mm"),
            paymentDate = record.PaymentDate?.ToString("yyyy-MM-dd"),
            organization = new
            {
                name = org?.Name ?? "HRDesk Builders & Developers",
                code = "HBD",
                address = org?.Address ?? "Corporate Office, Hyderabad, Telangana",
                logoUrl = ""
            },
            employee = new
            {
                employeeId = record.EmployeeId,
                employeeCode = $"EMP#{record.EmployeeId:D3}",
                employeeName = record.Employee?.EmployeeName ?? "Unknown",
                department = record.Employee?.Department?.DepartmentName ?? "General",
                designation = record.Employee?.Designation?.DesignationName ?? "Staff",
                joiningDate = record.Employee?.JoiningDate?.ToString("yyyy-MM-dd"),
                phone = record.Employee?.Phone,
                bankAccount = !string.IsNullOrWhiteSpace(record.Employee?.BankAccountNumber) ? record.Employee.BankAccountNumber : "—",
                bankName = !string.IsNullOrWhiteSpace(record.Employee?.BankName) ? record.Employee.BankName : "Corporate Salary Account",
                ifsc = !string.IsNullOrWhiteSpace(record.Employee?.BankIfscCode) ? record.Employee.BankIfscCode : "—",
                pan = !string.IsNullOrWhiteSpace(record.Employee?.PanNumber) ? record.Employee.PanNumber : "—",
                uan = !string.IsNullOrWhiteSpace(record.Employee?.UanNumber) ? record.Employee.UanNumber : "—",
                pf = !string.IsNullOrWhiteSpace(record.Employee?.PfNumber) ? record.Employee.PfNumber : "—"
            },
            attendance = new
            {
                totalDays = record.TotalDays,
                presentDays = record.PresentDays,
                absentDays = record.AbsentDays,
                paidLeaves = record.PaidLeaves,
                unpaidLeaves = record.UnpaidLeaves,
                weekoffs = record.Weekoffs,
                holidays = record.Holidays,
                halfDays = record.HalfDays,
                payableDays = record.PayableDays
            },
            earnings,
            deductions,
            totals = new
            {
                grossSalary = record.GrossSalary,
                totalEarnings = record.TotalEarnings,
                totalDeductions = record.TotalDeductions,
                netSalary = record.NetSalary,
                netSalaryInWords = NumberToWordsConverter.Convert((int)record.NetSalary),
                employerPF  = record.EmployerPF,
                employerESI = record.EmployerESI,
                professionalTax = record.ProfessionalTax,
                annualCTC   = record.AnnualCTC
            }
        });
    }
}
