using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

using HRDesk.Web.Services.Payroll;

namespace HRDesk.Web.Services;

public class PayrollService : IPayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILoanService _loanService;
    private readonly IAttendanceSummaryService _attendanceSummaryService;
    private readonly IStatutoryService _statutoryService;
    private readonly ILogger<PayrollService> _logger;

    public PayrollService(
        BiometricAttendanceDbContext db, 
        ILoanService loanService, 
        IAttendanceSummaryService attendanceSummaryService,
        IStatutoryService statutoryService,
        ILogger<PayrollService> logger)
    {
        _db = db;
        _loanService = loanService;
        _attendanceSummaryService = attendanceSummaryService;
        _statutoryService = statutoryService;
        _logger = logger;
    }

    /// <summary>
    /// Get attendance summary for an employee for a specific month.
    /// Delegates to AttendanceSummaryService â€” the single source of truth shared with MonthlyAttendanceSheet.
    /// </summary>
    public async Task<AttendanceSummaryResult> GetAttendanceSummaryAsync(int employeeId, string month)
    {
        // Safe parsing: Expected "yyyy-MM" (e.g., "2026-04")
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var parsedDate))
        {
            throw new ArgumentException($"Invalid month format: '{month}'. Expected 'yyyy-MM'.");
        }

        // Use the shared service â€” guaranteed to match MonthlyAttendanceSheet calculations
        return await _attendanceSummaryService.GetSummaryAsync(employeeId, parsedDate.Year, parsedDate.Month);
    }

    /// <summary>
    /// Calculate gross salary for an employee
    /// </summary>
    public async Task<decimal> GetGrossSalaryAsync(int employeeId, string month)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            return 0;
            
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId &&
                       s.EffectiveFrom <= monthEnd && 
                       (s.EffectiveTo == null || s.EffectiveTo >= monthEnd) &&
                       s.SalaryComponent!.ComponentType == "Earning")
            .ToListAsync();

        return salaryStructure.Sum(s => s.Amount);
    }

    /// <summary>
    /// Calculate gross salaries for a batch of employees (fixes N+1 queries)
    /// </summary>
    public async Task<System.Collections.Generic.Dictionary<int, decimal>> GetGrossSalariesBatchAsync(System.Collections.Generic.List<int> employeeIds, string month)
    {
        var result = new System.Collections.Generic.Dictionary<int, decimal>();
        if (!employeeIds.Any()) return result;

        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            return result;
            
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var salaryStructures = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => employeeIds.Contains(s.EmployeeId) &&
                       s.EffectiveFrom <= monthEnd && 
                       (s.EffectiveTo == null || s.EffectiveTo >= monthEnd) &&
                       s.SalaryComponent!.ComponentType == "Earning")
            .ToListAsync();

        var grouped = salaryStructures.GroupBy(s => s.EmployeeId);
        foreach (var group in grouped)
        {
            result[group.Key] = group.Sum(s => s.Amount);
        }

        return result;
    }

    /// <summary>
    /// Process payroll for a single employee for a specific month
    /// </summary>
    public async Task<PayrollMaster> ProcessEmployeePayrollAsync(int employeeId, string month, 
        System.Collections.Generic.List<ManualAdjustment>? manualAdjustments = null, bool skipLoans = false)
    {
        // Check if payroll already exists
        var existing = await _db.PayrollMasters
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.Month == month);

        if (existing != null)
        {
            // 1. Remove existing payroll details
            var existingDetails = await _db.PayrollDetails
                .Where(d => d.PayrollId == existing.Id)
                .ToListAsync();
            _db.PayrollDetails.RemoveRange(existingDetails);

            // 2. REVERT any loan installments linked to this payroll
            // We do this BEFORE the calculation below so that GetPendingInstallmentForMonthAsync sees them as Pending
            var linkedInstallments = await _db.LoanInstallments
                .Where(i => i.PayrollId == existing.Id)
                .ToListAsync();
            foreach (var inst in linkedInstallments)
            {
                inst.Status = "Pending";
                inst.PaidAmount = 0;
                inst.PaidDate = null;
                inst.PayrollId = null;
                inst.Remarks = "Reverted for re-processing";
            }
            await _db.SaveChangesAsync();
        }

        var attendance = await GetAttendanceSummaryAsync(employeeId, month);
        var grossSalary = await GetGrossSalaryAsync(employeeId, month);
        decimal loanDeduction = 0;

        // Skip if no salary structure
        if (grossSalary == 0)
        {
            throw new InvalidOperationException("Employee has no salary structure defined");
        }

        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            throw new ArgumentException($"Invalid month format: '{month}'");
            
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Get salary structure active at the end of the processed month
        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId && 
                       s.EffectiveFrom <= monthEnd && 
                       (s.EffectiveTo == null || s.EffectiveTo >= monthEnd))
            .ToListAsync();

        // Calculate earnings
        decimal totalEarnings = 0;
        var earningDetails = new System.Collections.Generic.List<PayrollDetail>();

        // Filter earning components
        var earningComponents = salaryStructure
            .Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Earning")
            .ToList();

        // Calculate payable days once
        var payableDays = attendance.PresentCount + attendance.LeaveCount + attendance.WeekoffCount + attendance.HolidayCount;
        payableDays = Math.Min(payableDays, attendance.TotalDays);

        foreach (var component in earningComponents)
        {
            var netAmount = component.Amount; // Show full amount

            totalEarnings += netAmount;
            earningDetails.Add(new PayrollDetail
            {
                ComponentId = component.ComponentId,
                ComponentType = "Earning",
                ComponentName = component.SalaryComponent!.ComponentName,
                Amount = netAmount,
                Remarks = "Full earning component"
            });
        }

        // Add ad-hoc manual adjustments
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Allowance"))
            {
                totalEarnings += adj.Amount;
                earningDetails.Add(new PayrollDetail
                {
                    ComponentType = "Earning",
                    ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Allowance",
                    Amount = adj.Amount,
                    Remarks = "Manual adjustment"
                });
            }
        }

        // Calculate deductions
        decimal totalDeductions = 0;
        var deductionDetails = new System.Collections.Generic.List<PayrollDetail>();

        // 1. Loss Without Pay (LWP) Deduction
        var lopDays = (decimal)attendance.TotalDays - payableDays;
        if (lopDays > 0)
        {
            var lopAmount = (grossSalary / attendance.TotalDays) * lopDays;
            totalDeductions += lopAmount;
            
            var lopRemark = $"Loss Without Pay: {lopDays:0.0} days";
            var lopList = attendance.LopBreakdown
                .OrderBy(kvp => kvp.Key)
                .Select(kvp => $"{kvp.Key:dd-MMM}{(kvp.Value == 0.5m ? " (0.5)" : "")}")
                .ToList();

            if (lopList.Any())
            {
                lopRemark += $" ({string.Join(", ", lopList)})";
            }

            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "Loss Without Pay",
                Amount = lopAmount,
                Remarks = lopRemark
            });
        }

        // 2. Fixed Deduction components from structure (PF, Tax etc.)
        var deductionComponents = salaryStructure
            .Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Deduction")
            .ToList();

        foreach (var component in deductionComponents)
        {
            totalDeductions += component.Amount;
            deductionDetails.Add(new PayrollDetail
            {
                ComponentId = component.ComponentId,
                ComponentType = "Deduction",
                ComponentName = component.SalaryComponent!.ComponentName,
                Amount = component.Amount,
                Remarks = "Fixed deduction"
            });
        }

        await _db.SaveChangesAsync();

        // 3. Loan/Advance installment deduction
        if (!skipLoans)
        {
            var pendingInstallments = await _loanService.GetPendingInstallmentsWithDetailsAsync(employeeId, month);
            foreach (var inst in pendingInstallments)
            {
                loanDeduction += inst.Amount;
                totalDeductions += inst.Amount;
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = inst.TypeName, // Shows "Salary Advance", "Medical Loan" etc.
                    Amount = inst.Amount,
                    Remarks = $"Monthly {inst.TypeName.ToLower()} installment"
                });
            }
        }

        // 4. Ad-hoc deductions (Manual adjustments)
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Deduction"))
            {
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Deduction",
                    Amount = adj.Amount,
                    Remarks = "Manual adjustment"
                });
            }
        }

        // Finalize totals from details to ensure absolute sync
        totalEarnings = earningDetails.Sum(e => e.Amount);
        totalDeductions = deductionDetails.Sum(d => d.Amount);

        // Create or update payroll master
        var payroll = existing ?? new PayrollMaster
        {
            EmployeeId = employeeId,
            Month = month
        };

        payroll.TotalDays = attendance.TotalDays;
        payroll.PresentDays = attendance.PresentCount;
        payroll.AbsentDays = attendance.AbsentCount;
        payroll.PaidLeaves = attendance.LeaveCount;
        payroll.UnpaidLeaves = attendance.UnpaidLeaveCount;
        payroll.HalfDays = attendance.HalfDayCount;
        payroll.Weekoffs = attendance.WeekoffCount;
        payroll.Holidays = attendance.HolidayCount;
        payroll.PayableDays = payableDays;
        payroll.GrossSalary = grossSalary;
        payroll.TotalEarnings = totalEarnings;
        payroll.TotalDeductions = totalDeductions;
        payroll.NetSalary = totalEarnings - totalDeductions;
        payroll.Status = "Processed";
        payroll.ProcessedDate = DateTime.Now;
        
        // Serialize Leave Breakdown
        if (attendance.LeaveTypeCounts.Any())
        {
            payroll.LeaveBreakdown = System.Text.Json.JsonSerializer.Serialize(attendance.LeaveTypeCounts);
        }
        else
        {
            payroll.LeaveBreakdown = null;
        }

        if (existing == null)
        {
            _db.PayrollMasters.Add(payroll);
        }

        await _db.SaveChangesAsync();

        // Add payroll details
        foreach (var detail in earningDetails.Concat(deductionDetails))
        {
            detail.PayrollId = payroll.Id;
            _db.PayrollDetails.Add(detail);
        }

        await _db.SaveChangesAsync();

        // Process loan installment payment
        if (loanDeduction > 0)
        {
            // Re-fetch to ensure we have the latest status (might have changed during process)
            var relevantLoans = await _db.EmployeeLoans
                .Where(l => l.EmployeeId == employeeId && (l.Status == "Active" || l.Status == "Completed" || l.Status == "Approved"))
                .ToListAsync();

            foreach (var loan in relevantLoans)
            {
                await _loanService.ProcessInstallmentPaymentAsync(loan.Id, month, payroll.Id);
            }
        }

        return payroll;
    }

    public async Task<int> ProcessBulkEmployeePayrollAsync(System.Collections.Generic.List<int> employeeIds, string month, System.Collections.Generic.Dictionary<int, System.Collections.Generic.List<ManualAdjustment>> adjustments, bool skipLoans = false)
    {
        if (!employeeIds.Any()) return 0;
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var monthStart))
            throw new ArgumentException($"Invalid month format: '{month}'");
            
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Check if any cohort in this batch is locked (Approved or Paid)
        var payGroupIds = await _db.Employees
            .Where(e => employeeIds.Contains(e.EmployeeId) && e.PayGroupId != null)
            .Select(e => e.PayGroupId!.Value)
            .Distinct()
            .ToListAsync();

        foreach (var pgId in payGroupIds)
        {
            var run = await _db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.PayGroupId == pgId && r.Month == month);
            if (run != null && (run.Status == "Approved" || run.Status == "Paid"))
            {
                var grp = await _db.PayGroups.FindAsync(pgId);
                throw new InvalidOperationException($"Cannot process: Payroll for Pay Group '{grp?.Name ?? "Cohort"}' ({month}) is {run.Status} and locked. Please unlock the run to re-process.");
            }
        }

        // 1. Bulk read existing records
        var existingMasters = await _db.PayrollMasters
            .Where(p => employeeIds.Contains(p.EmployeeId) && p.Month == month)
            .ToDictionaryAsync(p => p.EmployeeId);
            
        var masterIds = existingMasters.Values.Select(m => m.Id).ToList();

        var existingDetails = new System.Collections.Generic.List<PayrollDetail>();
        var linkedInstallments = new System.Collections.Generic.List<LoanInstallment>();

        if (masterIds.Any())
        {
            existingDetails = await _db.PayrollDetails
                .Where(d => masterIds.Contains(d.PayrollId))
                .ToListAsync();
                
            linkedInstallments = await _db.LoanInstallments
                .Where(i => i.PayrollId.HasValue && masterIds.Contains(i.PayrollId.Value))
                .ToListAsync();
        }

        // Revert linked installments
        foreach (var inst in linkedInstallments)
        {
            inst.Status = "Pending";
            inst.PaidAmount = 0;
            inst.PaidDate = null;
            inst.PayrollId = null;
            inst.Remarks = "Reverted for re-processing";
        }
        _db.PayrollDetails.RemoveRange(existingDetails);

        // 2. Bulk read attendance and leave
        var allLogs = await _db.DailyAttendance
            .Where(a => employeeIds.Contains(a.EmployeeId) && a.RecordDate >= monthStart && a.RecordDate <= monthEnd)
            .ToListAsync();
            
        var allLeaveApps = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => employeeIds.Contains(la.EmployeeId) && (la.Status == "Approved" || la.Status == "Adjusted") && la.StartDate <= monthEnd && la.EndDate >= monthStart)
            .ToListAsync();

        // 3. Bulk read salary structures
        var allSalaryStructures = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => employeeIds.Contains(s.EmployeeId) && s.EffectiveFrom <= monthEnd && (s.EffectiveTo == null || s.EffectiveTo >= monthEnd))
            .ToListAsync();

        // 4. Bulk read pending loan installments
        var allPendingInstallments = new System.Collections.Generic.List<LoanInstallment>();
        if (!skipLoans)
        {
            allPendingInstallments = await _db.LoanInstallments
                .Include(i => i.EmployeeLoan).ThenInclude(l => l!.LoanType)
                .Where(i => i.Status == "Pending" && employeeIds.Contains(i.EmployeeLoan!.EmployeeId) && i.DueMonth == month)
                .ToListAsync();
        }
        
        var allEmployees = await _db.Employees
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.EmployeeId))
            .ToDictionaryAsync(e => e.EmployeeId);

        var newDetails = new System.Collections.Generic.List<PayrollDetail>();
        int processedCount = 0;

        foreach (var employeeId in employeeIds)
        {
            try
            {
                var empLogs = allLogs.Where(l => l.EmployeeId == employeeId).ToList();
                var empLeaves = allLeaveApps.Where(l => l.EmployeeId == employeeId).ToList();
                
                var attendance = _attendanceSummaryService.ComputeSummary(employeeId, monthStart.Year, monthStart.Month, empLogs, empLeaves);
                var salaryStructure = allSalaryStructures.Where(s => s.EmployeeId == employeeId).ToList();
                var grossSalary = salaryStructure.Where(s => s.SalaryComponent!.ComponentType == "Earning").Sum(s => s.Amount);

                if (grossSalary == 0)
                {
                    _logger.LogWarning("Employee {Id} has no salary structure defined", employeeId);
                    continue;
                }

                var payableDays = attendance.PresentCount + attendance.LeaveCount + attendance.WeekoffCount + attendance.HolidayCount;
                payableDays = Math.Min(payableDays, attendance.TotalDays);

                decimal totalEarnings = 0;
                var earningComponents = salaryStructure.Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Earning").ToList();
                var currentEarningDetails = new System.Collections.Generic.List<PayrollDetail>();

                foreach (var component in earningComponents)
                {
                    totalEarnings += component.Amount;
                    currentEarningDetails.Add(new PayrollDetail
                    {
                        ComponentId = component.ComponentId,
                        ComponentType = "Earning",
                        ComponentName = component.SalaryComponent!.ComponentName,
                        Amount = component.Amount,
                        Remarks = "Full earning component"
                    });
                }

                var empAdjustments = adjustments != null && adjustments.ContainsKey(employeeId) ? adjustments[employeeId] : null;
                if (empAdjustments != null)
                {
                    foreach (var adj in empAdjustments.Where(a => a.Type == "Allowance"))
                    {
                        totalEarnings += adj.Amount;
                        currentEarningDetails.Add(new PayrollDetail
                        {
                            ComponentType = "Earning",
                            ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Allowance",
                            Amount = adj.Amount,
                            Remarks = "Manual adjustment"
                        });
                    }
                }

                decimal totalDeductions = 0;
                var currentDeductionDetails = new System.Collections.Generic.List<PayrollDetail>();

                var lopDays = (decimal)attendance.TotalDays - payableDays;
                if (lopDays > 0)
                {
                    var lopAmount = (grossSalary / attendance.TotalDays) * lopDays;
                    totalDeductions += lopAmount;
                    var lopRemark = $"Loss Without Pay: {lopDays:0.0} days";
                    var lopList = attendance.LopBreakdown.OrderBy(kvp => kvp.Key).Select(kvp => $"{kvp.Key:dd-MMM}{(kvp.Value == 0.5m ? " (0.5)" : "")}").ToList();
                    if (lopList.Any()) lopRemark += $" ({string.Join(", ", lopList)})";

                    currentDeductionDetails.Add(new PayrollDetail
                    {
                        ComponentType = "Deduction",
                        ComponentName = "Loss Without Pay",
                        Amount = lopAmount,
                        Remarks = lopRemark
                    });
                }

                var deductionComponents = salaryStructure.Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Deduction").ToList();
                foreach (var component in deductionComponents)
                {
                    totalDeductions += component.Amount;
                    currentDeductionDetails.Add(new PayrollDetail
                    {
                        ComponentId = component.ComponentId,
                        ComponentType = "Deduction",
                        ComponentName = component.SalaryComponent!.ComponentName,
                        Amount = component.Amount,
                        Remarks = "Fixed deduction"
                    });
                }

                decimal loanDeduction = 0;
                var empPendingInstallments = allPendingInstallments.Where(i => i.EmployeeLoan!.EmployeeId == employeeId).OrderBy(i => i.DueMonth).ToList();
                
                var loansProcessed = new System.Collections.Generic.List<LoanInstallment>();

                foreach (var inst in empPendingInstallments)
                {
                    loanDeduction += inst.Amount;
                    totalDeductions += inst.Amount;
                    currentDeductionDetails.Add(new PayrollDetail
                    {
                        ComponentType = "Deduction",
                        ComponentName = inst.EmployeeLoan!.LoanType?.TypeName ?? "Advance",
                        Amount = inst.Amount,
                        Remarks = $"Monthly {(inst.EmployeeLoan.LoanType?.TypeName ?? "advance").ToLower()} installment"
                    });
                    
                    loansProcessed.Add(inst);
                }

                if (empAdjustments != null)
                {
                    foreach (var adj in empAdjustments.Where(a => a.Type == "Deduction"))
                    {
                        totalDeductions += adj.Amount;
                        currentDeductionDetails.Add(new PayrollDetail
                        {
                            ComponentType = "Deduction",
                            ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Deduction",
                            Amount = adj.Amount,
                            Remarks = "Manual adjustment"
                        });
                    }
                }

                // Statutory Deductions (PF, ESIC, Professional Tax)
                PfCalculationResult pfResult = new(0, 0, 0, 0, 0, 0);
                EsicCalculationResult esicResult = new(0, 0, 0, false);
                PtCalculationResult ptResult = new(0, 0);

                if (allEmployees.TryGetValue(employeeId, out var emp))
                {
                    decimal lopDeduction = currentDeductionDetails.FirstOrDefault(d => d.ComponentName == "Loss Without Pay")?.Amount ?? 0m;
                    decimal earnedGross = Math.Max(0m, grossSalary - lopDeduction);

                    var basicComponent = salaryStructure.FirstOrDefault(s => s.SalaryComponent != null && s.SalaryComponent.ComponentCode == "BASIC");
                    decimal monthlyBasic = basicComponent?.Amount ?? 0m;
                    decimal earnedBasic = attendance.TotalDays > 0 ? (monthlyBasic / attendance.TotalDays) * payableDays : 0m;

                    // 1. Provident Fund (PF)
                    bool hasExplicitPf = deductionComponents.Any(d => d.SalaryComponent?.ComponentCode == "PF" && d.Amount > 0);
                    if (!hasExplicitPf)
                    {
                        pfResult = _statutoryService.CalculatePf(emp, earnedBasic);
                        if (pfResult.EmployeePf > 0)
                        {
                            currentDeductionDetails.Add(new PayrollDetail
                            {
                                ComponentType = "Deduction",
                                ComponentName = "Provident Fund (PF)",
                                Amount = pfResult.EmployeePf,
                                Remarks = $"PF Employee 12% on ₹{pfResult.PfWages:0}"
                            });
                        }
                    }
                    else
                    {
                        var explicitPf = deductionComponents.First(d => d.SalaryComponent?.ComponentCode == "PF").Amount;
                        pfResult = new PfCalculationResult(earnedBasic, explicitPf, Math.Min(1250m, Math.Round(Math.Min(earnedBasic, 15000m) * 0.0833m)), Math.Max(0, explicitPf - Math.Min(1250m, Math.Round(Math.Min(earnedBasic, 15000m) * 0.0833m))), 0, 0);
                    }

                    // 2. ESIC
                    bool hasExplicitEsic = deductionComponents.Any(d => d.SalaryComponent?.ComponentCode == "ESIC" && d.Amount > 0);
                    if (!hasExplicitEsic)
                    {
                        esicResult = _statutoryService.CalculateEsic(emp, earnedGross, grossSalary);
                        if (esicResult.EmployeeEsic > 0)
                        {
                            currentDeductionDetails.Add(new PayrollDetail
                            {
                                ComponentType = "Deduction",
                                ComponentName = "ESIC",
                                Amount = esicResult.EmployeeEsic,
                                Remarks = $"ESIC Employee 0.75% on ₹{esicResult.EsicWages:0}"
                            });
                        }
                    }
                    else
                    {
                        var explicitEsic = deductionComponents.First(d => d.SalaryComponent?.ComponentCode == "ESIC").Amount;
                        esicResult = new EsicCalculationResult(earnedGross, explicitEsic, Math.Ceiling(earnedGross * 0.0325m), true);
                    }

                    // 3. Professional Tax (PT)
                    bool hasExplicitPt = deductionComponents.Any(d => d.SalaryComponent?.ComponentCode == "PT" && d.Amount > 0);
                    if (!hasExplicitPt)
                    {
                        ptResult = _statutoryService.CalculatePt(emp, earnedGross);
                        if (ptResult.PtAmount > 0)
                        {
                            currentDeductionDetails.Add(new PayrollDetail
                            {
                                ComponentType = "Deduction",
                                ComponentName = "Professional Tax (PT)",
                                Amount = ptResult.PtAmount,
                                Remarks = $"Gujarat PT on ₹{earnedGross:0} earned gross"
                            });
                        }
                    }
                    else
                    {
                        var explicitPt = deductionComponents.First(d => d.SalaryComponent?.ComponentCode == "PT").Amount;
                        ptResult = new PtCalculationResult(earnedGross, explicitPt);
                    }
                }

                totalEarnings = currentEarningDetails.Sum(e => e.Amount);
                totalDeductions = currentDeductionDetails.Sum(d => d.Amount);

                existingMasters.TryGetValue(employeeId, out var payroll);
                bool isNew = payroll == null;
                
                if (isNew)
                {
                    payroll = new PayrollMaster
                    {
                        EmployeeId = employeeId,
                        Month = month
                    };
                }

                payroll!.TotalDays = attendance.TotalDays;
                payroll.PresentDays = attendance.PresentCount;
                payroll.AbsentDays = attendance.AbsentCount;
                payroll.PaidLeaves = attendance.LeaveCount;
                payroll.UnpaidLeaves = attendance.UnpaidLeaveCount;
                payroll.HalfDays = attendance.HalfDayCount;
                payroll.Weekoffs = attendance.WeekoffCount;
                payroll.Holidays = attendance.HolidayCount;
                payroll.PayableDays = payableDays;
                payroll.GrossSalary = grossSalary;
                payroll.TotalEarnings = totalEarnings;
                payroll.TotalDeductions = totalDeductions;
                payroll.NetSalary = totalEarnings - totalDeductions;
                payroll.Status = "Processed";
                payroll.ProcessedDate = DateTime.Now;
                payroll.LeaveBreakdown = attendance.LeaveTypeCounts.Any() ? System.Text.Json.JsonSerializer.Serialize(attendance.LeaveTypeCounts) : null;

                // Statutory audit values
                payroll.PfWages = pfResult.PfWages;
                payroll.EmployeePf = pfResult.EmployeePf;
                payroll.EmployerEps = pfResult.EmployerEps;
                payroll.EmployerEpf = pfResult.EmployerEpf;
                payroll.EsicWages = esicResult.EsicWages;
                payroll.EmployeeEsic = esicResult.EmployeeEsic;
                payroll.EmployerEsic = esicResult.EmployerEsic;
                payroll.ProfessionalTax = ptResult.PtAmount;

                if (isNew)
                {
                    _db.PayrollMasters.Add(payroll);
                }
                
                // Keep details in memory to link after SaveChanges
                payroll.PayrollDetails = currentEarningDetails.Concat(currentDeductionDetails).ToList();

                foreach (var inst in loansProcessed)
                {
                    inst.Status = "Paid";
                    inst.PaidAmount = inst.Amount;
                    inst.PaidDate = DateOnly.FromDateTime(DateTime.Now);
                    inst.PayrollId = payroll.Id; 
                    inst.Remarks = $"Deducted in {month} payroll";
                }

                processedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process payroll for Employee {Id} in bulk run", employeeId);
            }
        }

        await _db.SaveChangesAsync();

        foreach (var pgId in payGroupIds)
        {
            await SyncPayrollRunTotalsAsync(pgId, month);
        }

        return processedCount;
    }

    /// <summary>
    /// Process payroll for all employees for a specific month
    /// </summary>
    public async Task<int> ProcessMonthlyPayrollAsync(string month, bool includeLoans = true)
    {
        var employeeIds = await _db.Employees
            .Where(e => e.Status == "Active")
            .Select(e => e.EmployeeId)
            .ToListAsync();

        return await ProcessBulkEmployeePayrollAsync(employeeIds, month, new System.Collections.Generic.Dictionary<int, System.Collections.Generic.List<ManualAdjustment>>(), !includeLoans);
    }

    public async Task<bool> IsCohortLockedAsync(int payGroupId, string month)
    {
        var run = await _db.PayrollRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.PayGroupId == payGroupId && r.Month == month);

        return run != null && (run.Status == "Approved" || run.Status == "Paid");
    }

    public async Task<PayrollRun> GetOrCreatePayrollRunAsync(int payGroupId, string month)
    {
        var run = await _db.PayrollRuns
            .Include(r => r.PayGroup)
            .FirstOrDefaultAsync(r => r.PayGroupId == payGroupId && r.Month == month);

        if (run == null)
        {
            run = new PayrollRun
            {
                PayGroupId = payGroupId,
                Month = month,
                Status = "Draft",
                CreatedAt = DateTime.UtcNow
            };
            _db.PayrollRuns.Add(run);
            await _db.SaveChangesAsync();
            await _db.Entry(run).Reference(r => r.PayGroup).LoadAsync();
        }

        return run;
    }

    public async Task<PayrollRun> SyncPayrollRunTotalsAsync(int payGroupId, string month)
    {
        var run = await GetOrCreatePayrollRunAsync(payGroupId, month);

        int targetYear = int.Parse(month.Substring(0, 4));
        int targetMonth = int.Parse(month.Substring(5, 2));
        var lastDayOfMonth = new DateOnly(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));

        var totalStaff = await _db.Employees
            .AsNoTracking()
            .CountAsync(e => e.PayGroupId == payGroupId &&
                             (e.Status == "Active" || e.Status == "active") &&
                             (e.JoiningDate == null || e.JoiningDate <= lastDayOfMonth));

        var masters = await _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.Employee != null && p.Employee.PayGroupId == payGroupId)
            .Select(p => new { p.GrossSalary, p.TotalEarnings, p.TotalDeductions, p.NetSalary })
            .ToListAsync();

        run.TotalEmployees = totalStaff;
        run.ProcessedEmployees = masters.Count;
        run.GrossPayout = masters.Sum(m => m.GrossSalary);
        run.TotalDeductions = masters.Sum(m => m.TotalDeductions);
        run.NetPayout = masters.Sum(m => m.NetSalary);

        await _db.SaveChangesAsync();
        return run;
    }

    public async Task<PayrollRun> SubmitPayrollRunAsync(int payGroupId, string month, string submittedBy, string? notes = null)
    {
        var run = await SyncPayrollRunTotalsAsync(payGroupId, month);
        if (run.Status == "Approved" || run.Status == "Paid")
        {
            throw new InvalidOperationException($"Cannot submit: Payroll run is already {run.Status}.");
        }

        run.Status = "Review";
        run.SubmittedAt = DateTime.UtcNow;
        run.SubmittedBy = submittedBy;
        if (!string.IsNullOrWhiteSpace(notes)) run.Notes = notes;

        await _db.SaveChangesAsync();
        return run;
    }

    public async Task<PayrollRun> ApprovePayrollRunAsync(int payGroupId, string month, string approvedBy, string? notes = null)
    {
        var run = await SyncPayrollRunTotalsAsync(payGroupId, month);
        if (run.Status == "Paid")
        {
            throw new InvalidOperationException("Payroll run is already marked as Paid.");
        }

        run.Status = "Approved";
        run.ApprovedAt = DateTime.UtcNow;
        run.ApprovedBy = approvedBy;
        if (!string.IsNullOrWhiteSpace(notes)) run.Notes = notes;

        // Also update individual payroll master records to Approved
        var masters = await _db.PayrollMasters
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.Employee != null && p.Employee.PayGroupId == payGroupId)
            .ToListAsync();

        foreach (var m in masters)
        {
            m.Status = "Approved";
            m.ApprovedBy = approvedBy;
            m.ApprovedDate = DateTime.Now;
        }

        await _db.SaveChangesAsync();
        return run;
    }

    public async Task<PayrollRun> MarkPayrollRunPaidAsync(int payGroupId, string month, string paidBy, string paymentMethod, string? reference, DateOnly? paymentDate = null, string? notes = null)
    {
        var run = await SyncPayrollRunTotalsAsync(payGroupId, month);

        run.Status = "Paid";
        run.PaidAt = DateTime.UtcNow;
        run.PaidBy = paidBy;
        run.PaymentDate = paymentDate ?? DateOnly.FromDateTime(DateTime.Now);
        run.PaymentMethod = paymentMethod;
        run.PaymentReference = reference;
        if (!string.IsNullOrWhiteSpace(notes)) run.Notes = notes;

        // Update individual payroll master records to Paid
        var masters = await _db.PayrollMasters
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.Employee != null && p.Employee.PayGroupId == payGroupId)
            .ToListAsync();

        foreach (var m in masters)
        {
            m.Status = "Paid";
            m.PaymentDate = run.PaymentDate;
        }

        await _db.SaveChangesAsync();
        return run;
    }

    public async Task<PayrollRun> UnlockPayrollRunAsync(int payGroupId, string month, string unlockedBy, string reason)
    {
        var run = await GetOrCreatePayrollRunAsync(payGroupId, month);

        run.Status = "Draft";
        run.Notes = $"[Unlocked by {unlockedBy} on {DateTime.Now:yyyy-MM-dd HH:mm}: {reason}]" + (string.IsNullOrWhiteSpace(run.Notes) ? "" : " | " + run.Notes);
        run.ApprovedAt = null;
        run.ApprovedBy = null;
        run.PaidAt = null;
        run.PaidBy = null;
        run.PaymentDate = null;
        run.PaymentReference = null;

        var masters = await _db.PayrollMasters
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.Employee != null && p.Employee.PayGroupId == payGroupId)
            .ToListAsync();

        foreach (var m in masters)
        {
            m.Status = "Draft";
        }

        await _db.SaveChangesAsync();
        return run;
    }
}


