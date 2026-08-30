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
public class PayrollController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPayrollService _payrollService;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public PayrollController(
        BiometricAttendanceDbContext db,
        IPayrollService payrollService,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _db = db;
        _payrollService = payrollService;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _archive = archive;
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
                .ThenInclude(e => e.Department)
            .Include(p => p.Employee)
                .ThenInclude(e => e.Designation)
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

    [HttpPost("process")]
    public async Task<IActionResult> ProcessPayroll([FromBody] ProcessPayrollDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Month))
        {
            return BadRequest(new { message = "Month (yyyy-MM) is required." });
        }

        try
        {
            int count = 0;
            if (dto.EmployeeIds != null && dto.EmployeeIds.Count > 0)
            {
                count = await _payrollService.ProcessBulkEmployeePayrollAsync(
                    dto.EmployeeIds,
                    dto.Month,
                    new Dictionary<int, List<ManualAdjustment>>(),
                    dto.SkipLoans
                );
            }
            else
            {
                count = await _payrollService.ProcessMonthlyPayrollAsync(dto.Month, !dto.SkipLoans);
            }

            return Ok(new
            {
                message = $"Successfully processed payroll for {count} employees for {dto.Month}.",
                processedCount = count,
                month = dto.Month
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Payroll processing failed. Please try again or contact support." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePayroll(int id, [FromQuery] bool permanent = false)
    {
        if (permanent)
        {
            var result = await _archive.PermanentDeleteAsync<PayrollMaster>(id);
            if (!result.Success) return BadRequest(new { message = result.Message });
            return Ok(new { message = "Payroll record permanently deleted." });
        }
        else
        {
            var result = await _archive.ArchiveAsync<PayrollMaster>(id);
            if (!result.Success) return BadRequest(new { message = result.Message });
            return Ok(new { message = "Payroll record archived successfully." });
        }
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestorePayroll(int id)
    {
        var result = await _archive.RestoreAsync<PayrollMaster>(id);
        if (!result.Success) return BadRequest(new { message = result.Message });
        return Ok(new { message = "Payroll record restored successfully." });
    }

    [HttpGet("{id}/payslip")]
    public async Task<IActionResult> GetPayslip(int id)
    {
        var record = await _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
                .ThenInclude(e => e.Department)
            .Include(p => p.Employee)
                .ThenInclude(e => e.Designation)
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
                employeeName = record.Employee?.EmployeeName ?? "Unknown",
                department = record.Employee?.Department?.DepartmentName ?? "General",
                designation = record.Employee?.Designation?.DesignationName ?? "Staff",
                joiningDate = record.Employee?.JoiningDate?.ToString("yyyy-MM-dd"),
                phone = record.Employee?.Phone,
                bankAccount = "XXXX-XXXX-XXXX",
                bankName = "Corporate Salary Account",
                ifsc = "HDFC0001234",
                pan = "ABCDE1234F",
                uan = "100234567890"
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
                netSalaryInWords = ConvertNumberToWords((int)record.NetSalary),
                employerPF  = record.EmployerPF,
                employerESI = record.EmployerESI,
                professionalTax = record.ProfessionalTax,
                annualCTC   = record.AnnualCTC
            }
        });
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdatePayrollStatusDto dto)
    {
        var record = await _db.PayrollMasters.FirstOrDefaultAsync(p => p.Id == id);
        if (record == null) return NotFound(new { message = "Record not found." });

        record.Status = dto.Status;
        if (dto.Status == "Approved")
        {
            record.ApprovedBy  = User.Identity?.Name;
            record.ApprovedDate = DateTime.Now;
            record.LockedAt    = DateTime.Now;  // Lock on approval
        }
        else if (dto.Status == "Paid" && dto.PaymentDate.HasValue)
        {
            record.PaymentDate = dto.PaymentDate.Value;
            record.LockedAt   = DateTime.Now;   // Lock on payment
        }
        else if (dto.Status == "Processed" || dto.Status == "Draft")
        {
            // Moving back to Draft/Processed removes the lock
            record.LockedAt = null;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Payroll status updated to {dto.Status}.", isLocked = record.LockedAt != null });
    }

    /// <summary>
    /// Unlock a payroll record (Admin only).
    /// Required before re-processing an Approved/Paid payroll.
    /// </summary>
    [HttpPost("{id}/unlock")]
    public async Task<IActionResult> Unlock(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollProcess))
            return Forbid();

        // Only platform superadmin or Admin can unlock — extra safety check
        var isPlatformAdmin = string.Equals(
            User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);
        if (!isPlatformAdmin && !User.IsInRole("Admin") && !User.IsInRole("Super Admin"))
            return Forbid();

        var record = await _db.PayrollMasters.FirstOrDefaultAsync(p => p.Id == id);
        if (record == null) return NotFound(new { message = "Payroll record not found." });

        record.LockedAt = null;
        record.Status   = "Processed"; // Reset to Processed so it can be re-approved
        await _db.SaveChangesAsync();
        return Ok(new { message = "Payroll record unlocked. It can now be re-processed or re-approved." });
    }

    [HttpPost("bulk-status")]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkStatusDto dto)
    {
        if (dto.Ids == null || dto.Ids.Count == 0) return BadRequest(new { message = "No IDs provided." });

        var records = await _db.PayrollMasters.Where(p => dto.Ids.Contains(p.Id)).ToListAsync();
        foreach (var r in records)
        {
            r.Status = dto.Status;
            if (dto.Status == "Approved")
            {
                r.ApprovedBy  = User.Identity?.Name;
                r.ApprovedDate = DateTime.Now;
                r.LockedAt    = DateTime.Now;
            }
            else if (dto.Status == "Paid")
            {
                r.LockedAt = DateTime.Now;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Updated {records.Count} records to {dto.Status}." });
    }

    [HttpGet("components")]
    public async Task<IActionResult> GetSalaryComponents()
    {
        var components = await _db.SalaryComponents
            .AsNoTracking()
            .OrderBy(c => c.ComponentType)
            .ThenBy(c => c.ComponentName)
            .Select(c => new
            {
                c.Id,
                c.ComponentName,
                c.ComponentCode,
                c.ComponentType,
                c.IsActive
            })
            .ToListAsync();

        return Ok(components);
    }

    private static string ConvertNumberToWords(int number)
    {
        if (number == 0) return "Zero Rupees Only";
        if (number < 0) return "Minus " + ConvertNumberToWordsHelper(Math.Abs(number)) + " Rupees Only";

        return (ConvertNumberToWordsHelper(number) + " Rupees Only").Replace("  ", " ").Trim();
    }

    private static string ConvertNumberToWordsHelper(int number)
    {
        if (number == 0) return "";

        string words = "";

        if ((number / 10000000) > 0)
        {
            words += ConvertNumberToWordsHelper(number / 10000000) + " Crore ";
            number %= 10000000;
        }

        if ((number / 100000) > 0)
        {
            words += ConvertNumberToWordsHelper(number / 100000) + " Lakh ";
            number %= 100000;
        }

        if ((number / 1000) > 0)
        {
            words += ConvertNumberToWordsHelper(number / 1000) + " Thousand ";
            number %= 1000;
        }

        if ((number / 100) > 0)
        {
            words += ConvertNumberToWordsHelper(number / 100) + " Hundred ";
            number %= 100;
        }

        if (number > 0)
        {
            if (words != "") words += "and ";

            var unitsMap = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
            var tensMap = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

            if (number < 20)
                words += unitsMap[number];
            else
            {
                words += tensMap[number / 10];
                if ((number % 10) > 0)
                    words += " " + unitsMap[number % 10];
            }
        }

        return words.Trim();
    }
    /// <summary>
    /// Returns list of employees eligible for payroll in a given month,
    /// with warnings for missing CTC or pay group. Used by the Run Payroll wizard.
    /// </summary>
    [HttpGet("preview-run")]
    public async Task<IActionResult> PreviewPayrollRun(
        [FromQuery] string month,
        [FromQuery] int? departmentId = null,
        [FromQuery] string? employeeIds = null)
    {
        try
        {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollProcess))
            return Forbid();

        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            return BadRequest(new { message = "Invalid month format. Use yyyy-MM." });

        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Parse specific employee IDs if provided
        List<int>? filterIds = null;
        if (!string.IsNullOrWhiteSpace(employeeIds))
            filterIds = employeeIds.Split(',').Select(s => int.TryParse(s.Trim(), out var n) ? n : 0).Where(n => n > 0).ToList();

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.PayGroup)
            .Where(e => e.Status == "active" || e.Status == "Active");

        if (departmentId.HasValue && departmentId.Value > 0)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        if (filterIds != null && filterIds.Any())
            query = query.Where(e => filterIds.Contains(e.EmployeeId));

        var employees = await query
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                department = e.Department != null ? e.Department.DepartmentName : null,
                e.PayGroupId,
                payGroupName = e.PayGroup != null ? e.PayGroup.Name : null,
            })
            .ToListAsync();

        var empIds = employees.Select(e => e.EmployeeId).ToList();

        // Active CTCs for these employees — take most recent per employee
        var ctcs = await _db.EmployeeCTCs
            .AsNoTracking()
            .Where(c => empIds.Contains(c.EmployeeId)
                && c.EffectiveFrom <= monthEnd
                && (c.EffectiveTo == null || c.EffectiveTo >= monthEnd))
            .OrderByDescending(c => c.EffectiveFrom)
            .ToListAsync();
        var ctcMap = ctcs
            .GroupBy(c => c.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        // Already processed this month?
        var existing = await _db.PayrollMasters
            .Where(p => empIds.Contains(p.EmployeeId) && p.Month == month)
            .Select(p => new { p.EmployeeId, p.Status, p.LockedAt })
            .ToListAsync();
        var existingMap = existing.ToDictionary(p => p.EmployeeId);

        var result = employees.Select(e =>
        {
            ctcMap.TryGetValue(e.EmployeeId, out var ctc);
            existingMap.TryGetValue(e.EmployeeId, out var ex);

            var warnings = new List<string>();
            if (ctc == null) warnings.Add("No CTC assigned");
            if (e.PayGroupId == null) warnings.Add("No pay group assigned");
            if (ex?.LockedAt != null) warnings.Add("Payroll locked — will be skipped");

            return new
            {
                e.EmployeeId,
                e.EmployeeName,
                e.department,
                e.payGroupName,
                annualCTC       = ctc?.AnnualCTC,
                alreadyProcessed = ex != null,
                isLocked        = ex?.LockedAt != null,
                existingStatus  = ex?.Status,
                warnings,
                canProcess      = ctc != null && ex?.LockedAt == null,
            };
        }).ToList();

        return Ok(new
        {
            month,
            total       = result.Count,
            canProcess  = result.Count(r => r.canProcess),
            withWarnings = result.Count(r => r.warnings.Any()),
            employees   = result,
        });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, detail = ex.InnerException?.Message });
        }
    }

}

public record ProcessPayrollDto(string Month, List<int>? EmployeeIds, bool SkipLoans);
public record UpdatePayrollStatusDto(string Status, DateOnly? PaymentDate);
public record BulkStatusDto(List<int> Ids, string Status);
