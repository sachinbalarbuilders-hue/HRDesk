using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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
[Route("api/payroll")] // Same prefix
[Authorize]
public class PayrollProcessingController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.PayrollService _payrollService;
    private readonly IPermissionService _permissionService;
    private readonly IArchiveService _archive;

    public PayrollProcessingController(
        BiometricAttendanceDbContext db,
        HRDesk.Web.Services.PayrollService payrollService,
        IPermissionService permissionService,
        IArchiveService archive)
    {
        _db = db;
        _payrollService = payrollService;
        _permissionService = permissionService;
        _archive = archive;
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
        catch (Exception)
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
