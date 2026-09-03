using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Controllers.Api;          // ComputeCTCBreakdown helper
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services;

/// <summary>
/// Phase 1 payroll engine.
///
/// Calculation priority per employee:
///   1. If EmployeeCTC record exists → CTC-based formula engine (new path)
///   2. Otherwise → EmployeeSalaryStructure flat amounts (legacy fallback)
///
/// PF / ESI / PT are auto-computed from the PayGroup settings.
/// Salary basis (CalendarDays / Fixed26 / Fixed30 / ActualWorkingDays / PerDay)
/// is read from the PayGroup and used to compute the per-day rate for LOP and proration.
///
/// Payroll locking: refuses to re-process when PayrollMaster.LockedAt is set.
/// Unlock is done by setting LockedAt = null via the API (admin only).
/// </summary>
public class PayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly LoanService _loanService;
    private readonly AttendanceSummaryService _attendanceSummaryService;
    private readonly ILogger<PayrollService> _logger;

    // Statutory constants (India 2024-25)
    private const decimal PfCeilingWage   = 15_000m;   // PF computed only on Basic+DA up to ₹15,000
    private const decimal PfEmployeeRate  = 0.12m;     // 12%
    private const decimal PfEmployerRate  = 0.12m;     // 12% (3.67% EPS + 8.33% EPF)
    private const decimal EsiEmployeeRate = 0.0075m;   // 0.75%
    private const decimal EsiEmployerRate = 0.0325m;   // 3.25%
    private const decimal EsiGrossCeiling = 21_000m;   // ESI not applicable above ₹21,000 gross

    public PayrollService(
        BiometricAttendanceDbContext db,
        LoanService loanService,
        AttendanceSummaryService attendanceSummaryService,
        ILogger<PayrollService> logger)
    {
        _db = db;
        _loanService = loanService;
        _attendanceSummaryService = attendanceSummaryService;
        _logger = logger;
    }

    // =========================================================================
    // Public interface methods
    // =========================================================================

    public async Task<AttendanceSummaryResult> GetAttendanceSummaryAsync(int employeeId, string month)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var d))
            throw new ArgumentException($"Invalid month format '{month}'.");
        return await _attendanceSummaryService.GetSummaryAsync(employeeId, d.Year, d.Month);
    }

    public async Task<decimal> GetGrossSalaryAsync(int employeeId, string month)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart)) return 0;
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        return await ResolveGrossSalaryAsync(employeeId, monthEnd);
    }

    public async Task<Dictionary<int, decimal>> GetGrossSalariesBatchAsync(List<int> employeeIds, string month)
    {
        var result = new Dictionary<int, decimal>();
        if (!employeeIds.Any()) return result;
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart)) return result;
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        foreach (var id in employeeIds)
            result[id] = await ResolveGrossSalaryAsync(id, monthEnd);
        return result;
    }

    public async Task<PayrollMaster> ProcessEmployeePayrollAsync(
        int employeeId, string month,
        List<ManualAdjustment>? manualAdjustments = null,
        bool skipLoans = false)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            throw new ArgumentException($"Invalid month format '{month}'.");
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Lock check
        var existing = await _db.PayrollMasters
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.Month == month);
        if (existing?.LockedAt != null)
            throw new InvalidOperationException(
                $"Payroll for employee {employeeId} in {month} is locked (status={existing.Status}). " +
                "Unlock it first via Settings → Payroll → Unlock.");

        // Revert existing details + loan installments
        await RevertExistingAsync(existing);

        var employee = await _db.Employees
            .Include(e => e.PayGroup)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

        if (employee == null) throw new InvalidOperationException($"Employee {employeeId} not found.");

        var attendance = await GetAttendanceSummaryAsync(employeeId, month);
        var result = await BuildPayrollAsync(employee, monthStart, monthEnd, attendance,
                                            manualAdjustments, skipLoans, existing);
        await _db.SaveChangesAsync();
        return result;
    }

    public async Task<int> ProcessBulkEmployeePayrollAsync(
        List<int> employeeIds, string month,
        Dictionary<int, List<ManualAdjustment>> adjustments,
        bool skipLoans = false)
    {
        if (!employeeIds.Any()) return 0;
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            throw new ArgumentException($"Invalid month format '{month}'.");
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Bulk pre-load
        var existingMasters = await _db.PayrollMasters
            .Where(p => employeeIds.Contains(p.EmployeeId) && p.Month == month)
            .ToDictionaryAsync(p => p.EmployeeId);

        var masterIds = existingMasters.Values.Select(m => m.Id).ToList();

        // Revert details + installments for unlocked records
        if (masterIds.Any())
        {
            var locked = existingMasters.Values.Where(m => m.LockedAt != null).ToList();
            if (locked.Any())
                _logger.LogWarning("[Payroll] Skipping {n} locked records in bulk run for {month}.",
                    locked.Count, month);

            var unlocked = existingMasters.Values.Where(m => m.LockedAt == null).Select(m => m.Id).ToList();
            if (unlocked.Any())
            {
                var details = await _db.PayrollDetails.Where(d => unlocked.Contains(d.PayrollId)).ToListAsync();
                _db.PayrollDetails.RemoveRange(details);

                var installs = await _db.LoanInstallments
                    .Where(i => i.PayrollId.HasValue && unlocked.Contains(i.PayrollId!.Value))
                    .ToListAsync();
                foreach (var inst in installs)
                {
                    inst.Status = "Pending"; inst.PaidAmount = 0;
                    inst.PaidDate = null;   inst.PayrollId = null;
                    inst.Remarks = "Reverted for re-processing";
                }
                await _db.SaveChangesAsync();
            }
        }

        // Bulk load attendance data
        var allLogs = await _db.DailyAttendance
            .Where(a => employeeIds.Contains(a.EmployeeId) && a.RecordDate >= monthStart && a.RecordDate <= monthEnd)
            .ToListAsync();

        var allLeaves = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => employeeIds.Contains(la.EmployeeId)
                && (la.Status == "Approved" || la.Status == "Adjusted")
                && la.StartDate <= monthEnd && la.EndDate >= monthStart)
            .ToListAsync();

        var allEmployees = await _db.Employees
            .Include(e => e.PayGroup)
            .Where(e => employeeIds.Contains(e.EmployeeId))
            .ToListAsync();

        // Bulk load CTC + salary structure data
        var allCTCs = await _db.EmployeeCTCs
            .Include(c => c.Template)
                .ThenInclude(t => t!.Components)
                    .ThenInclude(tc => tc.Component)
            .Where(c => employeeIds.Contains(c.EmployeeId)
                && c.EffectiveFrom <= monthEnd
                && (c.EffectiveTo == null || c.EffectiveTo >= monthEnd))
            .ToListAsync();

        var allStructures = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => employeeIds.Contains(s.EmployeeId)
                && s.EffectiveFrom <= monthEnd
                && (s.EffectiveTo == null || s.EffectiveTo >= monthEnd))
            .ToListAsync();

        var allPending = skipLoans ? new List<LoanInstallment>()
            : await _db.LoanInstallments
                .Include(i => i.EmployeeLoan).ThenInclude(l => l!.LoanType)
                .Where(i => i.Status == "Pending"
                    && employeeIds.Contains(i.EmployeeLoan!.EmployeeId)
                    && i.DueMonth == month)
                .ToListAsync();

        // Load all PT slabs once
        var ptSlabs = await _db.ProfessionalTaxSlabs
            .Where(s => s.EffectiveTo == null || s.EffectiveTo >= monthEnd)
            .ToListAsync();

        int processedCount = 0;

        foreach (var employeeId in employeeIds)
        {
            try
            {
                existingMasters.TryGetValue(employeeId, out var existing2);
                if (existing2?.LockedAt != null)
                {
                    _logger.LogInformation("[Payroll] Skipping locked payroll emp={Id} month={Month}", employeeId, month);
                    continue;
                }

                var employee = allEmployees.FirstOrDefault(e => e.EmployeeId == employeeId);
                if (employee == null) continue;

                var empLogs   = allLogs.Where(l => l.EmployeeId == employeeId).ToList();
                var empLeaves = allLeaves.Where(l => l.EmployeeId == employeeId).ToList();
                var attendance = _attendanceSummaryService.ComputeSummary(
                    employeeId, monthStart.Year, monthStart.Month, empLogs, empLeaves);

                var empCTC       = allCTCs.FirstOrDefault(c => c.EmployeeId == employeeId);
                var empStructure = allStructures.Where(s => s.EmployeeId == employeeId).ToList();
                var empLoans     = allPending.Where(i => i.EmployeeLoan!.EmployeeId == employeeId).ToList();

                var payGroup = employee.PayGroup;
                var adj      = adjustments?.GetValueOrDefault(employeeId);

                await BuildPayrollInternalAsync(
                    employee, empCTC, empStructure,
                    monthStart, monthEnd, attendance,
                    adj, empLoans, ptSlabs,
                    existing2, isNew: existing2 == null);

                processedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Payroll] Failed to process emp={Id} month={Month}", employeeId, month);
            }
        }

        await _db.SaveChangesAsync();
        return processedCount;
    }

    public async Task<int> ProcessMonthlyPayrollAsync(string month, bool includeLoans = true)
    {
        var ids = await _db.Employees
            .Where(e => e.Status == "Active" || e.Status == "active")
            .Select(e => e.EmployeeId)
            .ToListAsync();

        return await ProcessBulkEmployeePayrollAsync(
            ids, month,
            new Dictionary<int, List<ManualAdjustment>>(),
            !includeLoans);
    }

    // =========================================================================
    // Core single-employee builder (used by ProcessEmployeePayrollAsync)
    // =========================================================================

    private async Task<PayrollMaster> BuildPayrollAsync(
        Employee employee,
        DateOnly monthStart, DateOnly monthEnd,
        AttendanceSummaryResult attendance,
        List<ManualAdjustment>? manualAdjustments,
        bool skipLoans,
        PayrollMaster? existing)
    {
        var ctcRecord   = await GetActiveCTCAsync(employee.EmployeeId, monthEnd);
        var oldStructure = await GetOldStructureAsync(employee.EmployeeId, monthEnd);
        var ptSlabs      = await _db.ProfessionalTaxSlabs
            .Where(s => s.EffectiveTo == null || s.EffectiveTo >= monthEnd)
            .ToListAsync();

        var loanInstallments = skipLoans
            ? new List<LoanInstallment>()
            : (await _loanService.GetPendingInstallmentsWithDetailsAsync(employee.EmployeeId, monthStart.ToString("yyyy-MM")))
               .Select(i => new LoanInstallment
               {
                   Amount     = i.Amount,
                   EmployeeLoan = new EmployeeLoan
                   {
                       LoanType = new LoanType { TypeName = i.TypeName }
                   }
               }).ToList();

        return await BuildPayrollInternalAsync(
            employee, ctcRecord, oldStructure,
            monthStart, monthEnd, attendance,
            manualAdjustments, loanInstallments, ptSlabs,
            existing, isNew: existing == null);
    }

    // =========================================================================
    // Internal calculation engine — shared by single and bulk paths
    // =========================================================================

    private async Task<PayrollMaster> BuildPayrollInternalAsync(
        Employee employee,
        EmployeeCTC? ctcRecord,
        List<EmployeeSalaryStructure> oldStructure,
        DateOnly monthStart, DateOnly monthEnd,
        AttendanceSummaryResult attendance,
        List<ManualAdjustment>? manualAdjustments,
        List<LoanInstallment> loanInstallments,
        List<ProfessionalTaxSlab> allPtSlabs,
        PayrollMaster? existing,
        bool isNew)
    {
        var payGroup = employee.PayGroup;
        int daysInMonth = DateTime.DaysInMonth(monthStart.Year, monthStart.Month);

        // ── Step 1: Resolve component amounts ─────────────────────────────────
        decimal grossSalary; // Full monthly CTC before any deduction
        var earningDetails    = new List<PayrollDetail>();
        var deductionDetails  = new List<PayrollDetail>();
        decimal basicAmount   = 0m;

        if (ctcRecord?.Template?.Components?.Any() == true)
        {
            // === CTC FORMULA PATH ============================================
            var breakdown = SalaryTemplatesApiController.ComputeCTCBreakdown(
                ctcRecord.AnnualCTC,
                ctcRecord.Template.Components.ToList());

            grossSalary = breakdown
                .Where(b => b.ComponentType == "Earning" && b.CalculationType != "Statutory")
                .Sum(b => b.Amount);

            foreach (var item in breakdown.Where(b =>
                b.ComponentType == "Earning" && b.CalculationType != "Statutory"))
            {
                earningDetails.Add(new PayrollDetail
                {
                    ComponentType = "Earning",
                    ComponentName = item.ComponentName,
                    Amount        = item.Amount,
                    Remarks       = item.Formula
                });
                if (item.ComponentCode == "BASIC") basicAmount = item.Amount;
            }
        }
        else if (oldStructure.Any())
        {
            // === LEGACY FLAT PATH =============================================
            grossSalary = oldStructure
                .Where(s => s.SalaryComponent?.ComponentType == "Earning")
                .Sum(s => s.Amount);

            foreach (var comp in oldStructure.Where(s => s.SalaryComponent?.ComponentType == "Earning"))
            {
                earningDetails.Add(new PayrollDetail
                {
                    ComponentId   = comp.ComponentId,
                    ComponentType = "Earning",
                    ComponentName = comp.SalaryComponent!.ComponentName,
                    Amount        = comp.Amount,
                    Remarks       = "Fixed earning component"
                });
                if (comp.SalaryComponent.ComponentCode == "BASIC") basicAmount = comp.Amount;
            }
        }
        else
        {
            throw new InvalidOperationException(
                $"Employee {employee.EmployeeId} has no CTC record or salary structure defined.");
        }

        if (grossSalary <= 0)
            throw new InvalidOperationException(
                $"Computed gross salary is ₹0 for employee {employee.EmployeeId}.");

        // ── Step 2: Proration for mid-month joiners / exits ───────────────────
        bool isProrated   = false;
        int  proratedDays = daysInMonth;

        var joinDate = employee.JoiningDate;
        var exitDate = employee.LastWorkingDate;

        DateOnly firstDay = monthStart;
        DateOnly lastDay  = monthEnd;

        if (joinDate.HasValue && joinDate.Value > monthStart && joinDate.Value <= monthEnd)
            firstDay = joinDate.Value;
        if (exitDate.HasValue && exitDate.Value >= monthStart && exitDate.Value < monthEnd)
            lastDay = exitDate.Value;

        if (firstDay > monthStart || lastDay < monthEnd)
        {
            isProrated   = true;
            proratedDays = lastDay.DayNumber - firstDay.DayNumber + 1;

            // Scale all earnings
            decimal factor = (decimal)proratedDays / daysInMonth;
            foreach (var d in earningDetails)
            {
                d.Amount  = Math.Round(d.Amount * factor, 2);
                d.Remarks = (d.Remarks ?? "") + $" (prorated {proratedDays}/{daysInMonth} days)";
            }
            grossSalary = earningDetails.Sum(e => e.Amount);
            basicAmount = Math.Round(basicAmount * factor, 2);
        }

        decimal totalEarnings = grossSalary;

        // ── Step 3: Manual ad-hoc allowances ─────────────────────────────────
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Allowance"))
            {
                totalEarnings += adj.Amount;
                earningDetails.Add(new PayrollDetail
                {
                    ComponentType = "Earning",
                    ComponentName = string.IsNullOrWhiteSpace(adj.Name) ? "Ad-hoc Allowance" : adj.Name,
                    Amount        = adj.Amount,
                    Remarks       = "Manual adjustment"
                });
            }
        }

        totalEarnings = earningDetails.Sum(e => e.Amount);

        // ── Step 4: Per-day rate & LOP ─────────────────────────────────────────
        string salaryBasis = ctcRecord?.SalaryBasisOverride
                          ?? payGroup?.SalaryBasis
                          ?? "CalendarDays";

        int actualWorkingDays = attendance.TotalDays
            - (int)attendance.WeekoffCount
            - (int)attendance.HolidayCount;

        decimal perDayDenominator = salaryBasis switch
        {
            "Fixed26"          => 26m,
            "Fixed30"          => 30m,
            "ActualWorkingDays"=> actualWorkingDays > 0 ? actualWorkingDays : daysInMonth,
            "PerDay"           => 0m,   // PerDay employees are handled separately
            _                  => daysInMonth    // CalendarDays (default)
        };

        decimal payableDays = attendance.PresentCount
                             + attendance.LeaveCount
                             + attendance.WeekoffCount
                             + attendance.HolidayCount;
        payableDays = Math.Min(payableDays, attendance.TotalDays);

        decimal lopDays = (decimal)attendance.TotalDays - payableDays;

        // Apply LOP rounding per PayGroup setting
        string lopRounding = payGroup?.LopRounding ?? "None";
        lopDays = lopRounding switch
        {
            "HalfDay" => Math.Round(lopDays * 2) / 2m,
            "FullDay" => Math.Ceiling(lopDays),
            _         => lopDays
        };

        decimal totalDeductions = 0m;

        if (lopDays > 0 && perDayDenominator > 0)
        {
            decimal perDay   = totalEarnings / perDayDenominator;
            decimal lopAmt   = Math.Round(perDay * lopDays, 2);
            totalDeductions += lopAmt;

            var lopRemark = BuildLopRemark(lopDays, attendance);
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "Loss Without Pay",
                Amount        = lopAmt,
                Remarks       = lopRemark
            });
        }

        // ── Step 5: Fixed deductions from legacy structure ────────────────────
        // (for employees still on the old flat structure with explicit deduction components)
        if (ctcRecord == null && oldStructure.Any())
        {
            foreach (var comp in oldStructure.Where(s => s.SalaryComponent?.ComponentType == "Deduction"))
            {
                totalDeductions += comp.Amount;
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentId   = comp.ComponentId,
                    ComponentType = "Deduction",
                    ComponentName = comp.SalaryComponent!.ComponentName,
                    Amount        = comp.Amount,
                    Remarks       = "Fixed deduction"
                });
            }
        }

        // ── Step 6: Statutory auto-computation ────────────────────────────────
        decimal employerPf  = 0m;
        decimal employerEsi = 0m;
        decimal ptAmount    = 0m;
        decimal pfEmployee  = 0m;
        decimal esiEmployee = 0m;

        bool pfApplicable  = payGroup?.PfApplicable  ?? true;
        bool esiApplicable = payGroup?.EsiApplicable ?? true;
        bool ptApplicable  = payGroup?.PtApplicable  ?? true;
        string? ptState    = payGroup?.PtState;

        // Gross for PF = sum of all EPF-applicable components (approx: basic)
        decimal pfWage = Math.Min(basicAmount, PfCeilingWage);

        if (pfApplicable && pfWage > 0)
        {
            pfEmployee  = Math.Round(pfWage * PfEmployeeRate, 2);
            employerPf  = Math.Round(pfWage * PfEmployerRate, 2);
            totalDeductions += pfEmployee;
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "Provident Fund (Employee 12%)",
                Amount        = pfEmployee,
                Remarks       = $"12% of ₹{pfWage:N0} (Basic, capped at ₹15,000)"
            });
            // Employer PF — informational only, not deducted from employee
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Informational",
                ComponentName = "Provident Fund (Employer 12%)",
                Amount        = employerPf,
                Remarks       = $"Employer contribution 12% of ₹{pfWage:N0}"
            });
        }

        decimal esiGross = totalEarnings;   // ESI gross = total earnings before deductions
        if (esiApplicable && esiGross <= EsiGrossCeiling)
        {
            esiEmployee  = Math.Round(esiGross * EsiEmployeeRate, 2);
            employerEsi  = Math.Round(esiGross * EsiEmployerRate, 2);
            totalDeductions += esiEmployee;
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "ESI (Employee 0.75%)",
                Amount        = esiEmployee,
                Remarks       = $"0.75% of gross ₹{esiGross:N0}"
            });
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Informational",
                ComponentName = "ESI (Employer 3.25%)",
                Amount        = employerEsi,
                Remarks       = $"Employer contribution 3.25% of ₹{esiGross:N0}"
            });
        }

        if (ptApplicable && !string.IsNullOrWhiteSpace(ptState))
        {
            bool isFebruary = monthStart.Month == 2;
            ptAmount = LookupPT(esiGross, ptState, isFebruary, allPtSlabs);
            if (ptAmount > 0)
            {
                totalDeductions += ptAmount;
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = "Professional Tax",
                    Amount        = ptAmount,
                    Remarks       = $"{ptState} PT slab"
                });
            }
        }

        // ── Step 7: Loan / advance EMI deductions ─────────────────────────────
        decimal loanDeduction = 0m;
        var paidInstallments  = new List<LoanInstallment>();

        foreach (var inst in loanInstallments)
        {
            loanDeduction   += inst.Amount;
            totalDeductions += inst.Amount;
            paidInstallments.Add(inst);
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = inst.EmployeeLoan?.LoanType?.TypeName ?? "Loan Installment",
                Amount        = inst.Amount,
                Remarks       = "Monthly installment"
            });
        }

        // ── Step 8: Manual ad-hoc deductions ─────────────────────────────────
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Deduction"))
            {
                totalDeductions += adj.Amount;
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = string.IsNullOrWhiteSpace(adj.Name) ? "Ad-hoc Deduction" : adj.Name,
                    Amount        = adj.Amount,
                    Remarks       = "Manual adjustment"
                });
            }
        }

        // Ensure totals match detail sum exactly
        totalEarnings   = earningDetails.Where(e => e.ComponentType == "Earning").Sum(e => e.Amount);
        totalDeductions = deductionDetails.Where(d => d.ComponentType == "Deduction").Sum(d => d.Amount);

        // ── Step 9: Write PayrollMaster ───────────────────────────────────────
        var payroll = isNew ? new PayrollMaster { EmployeeId = employee.EmployeeId, Month = monthStart.ToString("yyyy-MM") }
                            : existing!;

        payroll.TotalDays       = attendance.TotalDays;
        payroll.PresentDays     = attendance.PresentCount;
        payroll.AbsentDays      = attendance.AbsentCount;
        payroll.PaidLeaves      = attendance.LeaveCount;
        payroll.UnpaidLeaves    = attendance.UnpaidLeaveCount;
        payroll.HalfDays        = attendance.HalfDayCount;
        payroll.Weekoffs        = attendance.WeekoffCount;
        payroll.Holidays        = attendance.HolidayCount;
        payroll.PayableDays     = payableDays;
        payroll.GrossSalary     = grossSalary;
        payroll.TotalEarnings   = totalEarnings;
        payroll.TotalDeductions = totalDeductions;
        payroll.NetSalary       = totalEarnings - totalDeductions;
        payroll.Status          = "Processed";
        payroll.ProcessedDate   = DateTime.Now;
        payroll.LeaveBreakdown  = attendance.LeaveTypeCounts.Any()
            ? System.Text.Json.JsonSerializer.Serialize(attendance.LeaveTypeCounts) : null;

        // New fields
        payroll.AnnualCTC       = ctcRecord?.AnnualCTC;
        payroll.EmployerPF      = employerPf;
        payroll.EmployerESI     = employerEsi;
        payroll.ProfessionalTax = ptAmount;
        payroll.IsProrated      = isProrated;
        payroll.ProratedDays    = isProrated ? proratedDays : null;
        payroll.SalaryBasis     = salaryBasis;

        if (isNew)
        {
            payroll.OrganizationId = employee.OrganizationId;
            payroll.BranchId       = employee.BranchId;
            _db.PayrollMasters.Add(payroll);
            await _db.SaveChangesAsync(); // get the Id
        }
        else
        {
            await _db.SaveChangesAsync();
        }

        // ── Step 10: Write PayrollDetails ─────────────────────────────────────
        foreach (var detail in earningDetails.Concat(deductionDetails))
        {
            detail.PayrollId       = payroll.Id;
            detail.OrganizationId  = employee.OrganizationId;
            _db.PayrollDetails.Add(detail);
        }
        await _db.SaveChangesAsync();

        // ── Step 11: Mark loan installments paid ──────────────────────────────
        if (loanDeduction > 0)
        {
            var loanRecs = await _db.EmployeeLoans
                .Where(l => l.EmployeeId == employee.EmployeeId
                    && (l.Status == "Active" || l.Status == "Approved"))
                .ToListAsync();
            foreach (var loan in loanRecs)
                await _loanService.ProcessInstallmentPaymentAsync(
                    loan.Id, monthStart.ToString("yyyy-MM"), payroll.Id);
        }

        return payroll;
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private async Task<EmployeeCTC?> GetActiveCTCAsync(int employeeId, DateOnly monthEnd)
        => await _db.EmployeeCTCs
            .Include(c => c.Template)
                .ThenInclude(t => t!.Components.OrderBy(tc => tc.DisplayOrder))
                    .ThenInclude(tc => tc.Component)
            .Where(c => c.EmployeeId == employeeId
                && c.EffectiveFrom <= monthEnd
                && (c.EffectiveTo == null || c.EffectiveTo >= monthEnd))
            .OrderByDescending(c => c.EffectiveFrom)
            .FirstOrDefaultAsync();

    private async Task<List<EmployeeSalaryStructure>> GetOldStructureAsync(int employeeId, DateOnly monthEnd)
        => await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId
                && s.EffectiveFrom <= monthEnd
                && (s.EffectiveTo == null || s.EffectiveTo >= monthEnd))
            .ToListAsync();

    private async Task<decimal> ResolveGrossSalaryAsync(int employeeId, DateOnly monthEnd)
    {
        var ctc = await GetActiveCTCAsync(employeeId, monthEnd);
        if (ctc?.Template?.Components?.Any() == true)
        {
            var breakdown = SalaryTemplatesApiController.ComputeCTCBreakdown(
                ctc.AnnualCTC, ctc.Template.Components.ToList());
            return breakdown.Where(b => b.ComponentType == "Earning" && b.CalculationType != "Statutory")
                            .Sum(b => b.Amount);
        }
        var old = await GetOldStructureAsync(employeeId, monthEnd);
        return old.Where(s => s.SalaryComponent?.ComponentType == "Earning").Sum(s => s.Amount);
    }

    private async Task RevertExistingAsync(PayrollMaster? existing)
    {
        if (existing == null) return;
        var details = await _db.PayrollDetails.Where(d => d.PayrollId == existing.Id).ToListAsync();
        _db.PayrollDetails.RemoveRange(details);
        var installs = await _db.LoanInstallments
            .Where(i => i.PayrollId == existing.Id).ToListAsync();
        foreach (var inst in installs)
        {
            inst.Status = "Pending"; inst.PaidAmount = 0;
            inst.PaidDate = null;   inst.PayrollId = null;
            inst.Remarks = "Reverted for re-processing";
        }
        await _db.SaveChangesAsync();
    }

    private static decimal LookupPT(
        decimal gross, string state, bool isFebruary,
        List<ProfessionalTaxSlab> slabs)
    {
        var applicable = slabs
            .Where(s => s.State == state
                && s.EffectiveFrom <= DateOnly.FromDateTime(DateTime.Today)
                && (s.EffectiveTo == null || s.EffectiveTo >= DateOnly.FromDateTime(DateTime.Today))
                && s.IsFebruary == isFebruary
                && gross >= s.MinGross
                && (s.MaxGross == null || gross <= s.MaxGross))
            .OrderByDescending(s => s.MinGross)
            .FirstOrDefault();

        if (applicable != null) return applicable.MonthlyPt;

        // If no February-specific slab found, fall back to the standard slab
        if (isFebruary)
            return LookupPT(gross, state, false, slabs);

        return 0m;
    }

    private static string BuildLopRemark(decimal lopDays, AttendanceSummaryResult attendance)
    {
        var remark = $"Loss Without Pay: {lopDays:0.0} days";
        var dates  = attendance.LopBreakdown
            .OrderBy(kvp => kvp.Key)
            .Select(kvp => $"{kvp.Key:dd-MMM}{(kvp.Value == 0.5m ? " (0.5)" : "")}")
            .ToList();
        if (dates.Any())
            remark += $" ({string.Join(", ", dates)})";
        return remark;
    }
}
