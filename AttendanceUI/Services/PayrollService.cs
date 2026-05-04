using System;
using System.Linq;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AttendanceUI.Services;

public class PayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly LoanService _loanService;
    private readonly AttendanceSummaryService _attendanceSummaryService;
    private readonly ILogger<PayrollService> _logger;

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

    /// <summary>
    /// Get attendance summary for an employee for a specific month.
    /// Delegates to AttendanceSummaryService — the single source of truth shared with MonthlyAttendanceSheet.
    /// </summary>
    public async Task<AttendanceSummaryResult> GetAttendanceSummaryAsync(int employeeId, string month)
    {
        // Safe parsing: Expected "yyyy-MM" (e.g., "2026-04")
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var parsedDate))
        {
            throw new ArgumentException($"Invalid month format: '{month}'. Expected 'yyyy-MM'.");
        }

        // Use the shared service — guaranteed to match MonthlyAttendanceSheet calculations
        return await _attendanceSummaryService.GetSummaryAsync(employeeId, parsedDate.Year, parsedDate.Month);
    }

    /// <summary>
    /// Calculate gross salary for an employee
    /// </summary>
    public async Task<decimal> GetGrossSalaryAsync(int employeeId, string month)
    {
        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId &&
                       s.IsActive &&
                       s.SalaryComponent!.ComponentType == "Earning")
            .ToListAsync();

        return salaryStructure.Sum(s => s.Amount);
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

        // Get salary structure
        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId && s.IsActive)
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

    /// <summary>
    /// Process payroll for all employees for a specific month
    /// </summary>
    public async Task<int> ProcessMonthlyPayrollAsync(string month, bool includeLoans = true)
    {
        var employees = await _db.Employees
            .Where(e => e.Status == "Active")
            .ToListAsync();

        int processedCount = 0;

        foreach (var employee in employees)
        {
            try
            {
                await ProcessEmployeePayrollAsync(employee.EmployeeId, month, null, !includeLoans);
                processedCount++;
            }
            catch (Exception ex)
            {
                // Point 3 Fix: Log the error so it's not swallowed silently
                _logger.LogError(ex, "Failed to process payroll for Employee {Name} (ID: {Id}) for month {Month}", 
                    employee.EmployeeName, employee.EmployeeId, month);
                continue;
            }
        }

        return processedCount;
    }
}


