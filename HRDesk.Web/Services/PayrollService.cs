using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services;

public class PayrollService : IPayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILoanService _loanService;
    private readonly IAttendanceSummaryService _attendanceSummaryService;
    private readonly ILogger<PayrollService> _logger;

    public PayrollService(
        BiometricAttendanceDbContext db, 
        ILoanService loanService, 
        IAttendanceSummaryService attendanceSummaryService,
        ILogger<PayrollService> logger)
    {
        _db = db;
        _loanService = loanService;
        _attendanceSummaryService = attendanceSummaryService;
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
                .Include(i => i.Loan).ThenInclude(l => l.LoanType)
                .Where(i => i.Status == "Pending" && employeeIds.Contains(i.Loan!.EmployeeId) && i.InstallmentDate <= monthEnd)
                .ToListAsync();
        }
        
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
                var empPendingInstallments = allPendingInstallments.Where(i => i.Loan!.EmployeeId == employeeId).OrderBy(i => i.InstallmentDate).ToList();
                
                var loansProcessed = new System.Collections.Generic.List<LoanInstallment>();

                foreach (var inst in empPendingInstallments)
                {
                    loanDeduction += inst.Amount;
                    totalDeductions += inst.Amount;
                    currentDeductionDetails.Add(new PayrollDetail
                    {
                        ComponentType = "Deduction",
                        ComponentName = inst.Loan!.LoanType?.Name ?? "Advance",
                        Amount = inst.Amount,
                        Remarks = $"Monthly {(inst.Loan.LoanType?.Name ?? "advance").ToLower()} installment"
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
                    inst.PaidDate = DateTime.Now;
                    inst.PayrollMaster = payroll; 
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
}


