using System;
using System.Linq;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

public class PayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly LoanService _loanService;
    private readonly AttendanceSummaryService _attendanceSummaryService;

    public PayrollService(BiometricAttendanceDbContext db, LoanService loanService, AttendanceSummaryService attendanceSummaryService)
    {
        _db = db;
        _loanService = loanService;
        _attendanceSummaryService = attendanceSummaryService;
    }

    /// <summary>
    /// Get attendance summary for an employee for a specific month.
    /// Delegates to AttendanceSummaryService — the single source of truth shared with MonthlyAttendanceSheet.
    /// </summary>
    public async Task<AttendanceSummary> GetAttendanceSummaryAsync(int employeeId, string month)
    {
        var year = int.Parse(month.Substring(0, 4));
        var monthNum = int.Parse(month.Substring(5, 2));

        // Use the shared service — guaranteed to match MonthlyAttendanceSheet calculations
        var counts = await _attendanceSummaryService.GetSummaryAsync(employeeId, year, monthNum);

        return new AttendanceSummary
        {
            TotalDays      = counts.TotalDays,
            PresentDays    = counts.PresentCount,
            AbsentDays     = counts.AbsentCount,
            PaidLeaves     = counts.LeaveCount,
            UnpaidLeaves   = counts.UnpaidLeaveCount,
            HalfDays       = counts.HalfDayCount,
            Weekoffs       = counts.WeekoffCount,
            Holidays       = counts.HolidayCount,
            LeaveTypeCounts = new System.Collections.Generic.Dictionary<string, decimal>(),
            LopDetails     = counts.LopBreakdown
                .OrderBy(kvp => kvp.Key)
                .Select(kvp => $"{kvp.Key:dd-MMM}{(kvp.Value == 0.5m ? " (0.5)" : "")}")
                .ToList()
        };
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
        var payableDays = attendance.PresentDays + attendance.PaidLeaves + attendance.Weekoffs + attendance.Holidays;
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
            if (attendance.LopDetails.Any())
            {
                lopRemark += $" ({string.Join(", ", attendance.LopDetails)})";
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

        // 3. Loan installment deduction
        if (!skipLoans)
        {
            loanDeduction = await _loanService.GetPendingInstallmentForMonthAsync(employeeId, month);
            if (loanDeduction > 0)
            {
                totalDeductions += loanDeduction;
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = "Loan Installment",
                    Amount = loanDeduction,
                    Remarks = "Monthly loan installment"
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
        payroll.PresentDays = attendance.PresentDays;
        payroll.AbsentDays = attendance.AbsentDays;
        payroll.PaidLeaves = attendance.PaidLeaves;
        payroll.UnpaidLeaves = attendance.UnpaidLeaves;
        payroll.HalfDays = attendance.HalfDays;
        payroll.Weekoffs = attendance.Weekoffs;
        payroll.Holidays = attendance.Holidays;
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
            catch (Exception)
            {
                // Skip employees with errors and continue
                continue;
            }
        }

        return processedCount;
    }
}

public class AttendanceSummary
{
    public int TotalDays { get; set; }
    public decimal PresentDays { get; set; }
    public decimal AbsentDays { get; set; }
    public decimal PaidLeaves { get; set; }
    public decimal UnpaidLeaves { get; set; }
    public decimal HalfDays { get; set; }
    public decimal Weekoffs { get; set; }
    public decimal Holidays { get; set; }
    public System.Collections.Generic.Dictionary<string, decimal> LeaveTypeCounts { get; set; } = new();
    public System.Collections.Generic.List<string> LopDetails { get; set; } = new();
}
