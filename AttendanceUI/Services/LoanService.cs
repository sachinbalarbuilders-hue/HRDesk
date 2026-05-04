using System;
using System.Linq;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

public class LoanService
{
    private readonly BiometricAttendanceDbContext _db;

    public LoanService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }


    /// <summary>
    /// Calculate number of installments required for a given EMI
    /// </summary>
    public int CalculateInstallmentCount(decimal loanAmount, decimal emiAmount)
    {
        if (emiAmount <= 0) return 0;
        return (int)Math.Ceiling(loanAmount / emiAmount);
    }

    /// <summary>
    /// Generate installment schedule for approved loan (handles fixed EMI + remainder)
    /// </summary>
    public async Task GenerateInstallmentScheduleAsync(int loanId)
    {
        var loan = await _db.EmployeeLoans.FindAsync(loanId);
        if (loan == null)
            throw new ArgumentException("Loan not found");

        if (loan.Status != "Approved")
            throw new InvalidOperationException("Only approved loans can have installment schedules");

        // Clear existing installments
        var existingInstallments = await _db.LoanInstallments
            .Where(i => i.LoanId == loanId)
            .ToListAsync();
        _db.LoanInstallments.RemoveRange(existingInstallments);

        var startMonth = new DateTime(loan.StartDate.Year, loan.StartDate.Month, 1);
        decimal totalAllocated = 0;
        
        for (int i = 1; i <= loan.Installments; i++)
        {
            var dueMonth = startMonth.AddMonths(i - 1);
            var isPaid = i <= loan.StartingPaidInstallments;
            
            // Calculate this month's amount (EMI or remaining balance)
            decimal amountForThisMonth = loan.InstallmentAmount;
            if (i == loan.Installments)
            {
                amountForThisMonth = loan.LoanAmount - totalAllocated;
            }
            totalAllocated += amountForThisMonth;

            var installment = new LoanInstallment
            {
                LoanId = loanId,
                InstallmentNumber = i,
                DueMonth = dueMonth.ToString("yyyy-MM"),
                Amount = amountForThisMonth,
                Status = isPaid ? "Paid" : "Pending",
                PaidAmount = isPaid ? amountForThisMonth : 0,
                PaidDate = isPaid ? DateOnly.FromDateTime(dueMonth) : null,
                Remarks = isPaid ? "Opening balance / Previous Records" : null
            };
            _db.LoanInstallments.Add(installment);
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Process loan installment payment (called from payroll)
    /// </summary>
    public async Task<decimal> ProcessInstallmentPaymentAsync(int loanId, string month, int? payrollId = null)
    {
        var installment = await _db.LoanInstallments
            .FirstOrDefaultAsync(i => i.LoanId == loanId && i.DueMonth == month);

        if (installment == null)
            return 0;

        // Update installment details
        installment.PaidAmount = installment.Amount;
        installment.Status = "Paid";
        installment.PaidDate = installment.PaidDate ?? DateOnly.FromDateTime(DateTime.Now);
        installment.PayrollId = payrollId;

        // Update loan remaining amount and installments based on actual database state
        var loan = await _db.EmployeeLoans
            .Include(l => l.LoanInstallments)
            .FirstOrDefaultAsync(l => l.Id == loanId);

        if (loan != null)
        {
            var paidInstallments = loan.LoanInstallments.Where(i => i.Status == "Paid").ToList();
            
            loan.RemainingAmount = loan.LoanAmount - paidInstallments.Sum(i => i.PaidAmount);
            loan.RemainingInstallments = loan.Installments - paidInstallments.Count;

            // Mark loan as completed only if all planned installments are paid
            if (loan.RemainingInstallments <= 0)
            {
                loan.RemainingInstallments = 0;
                loan.RemainingAmount = 0;
                loan.Status = "Completed";
            }
            else
            {
                loan.Status = "Active";
            }
        }

        await _db.SaveChangesAsync();
        return installment.Amount;
    }

    /// <summary>
    /// Get pending installment amount for employee in a specific month
    /// </summary>
    public async Task<System.Collections.Generic.List<(decimal Amount, string TypeName)>> GetPendingInstallmentsWithDetailsAsync(int employeeId, string month)
    {
        var installments = await _db.LoanInstallments
            .Include(i => i.EmployeeLoan)
            .ThenInclude(l => l!.LoanType)
            .Where(i => i.EmployeeLoan!.EmployeeId == employeeId &&
                       (i.EmployeeLoan.Status == "Active" || i.EmployeeLoan.Status == "Completed") &&
                       i.DueMonth == month &&
                       i.Status == "Pending")
            .ToListAsync();

        return installments.Select(i => (i.Amount, i.EmployeeLoan!.LoanType!.TypeName)).ToList();
    }

    /// <summary>
    /// Approve loan and generate application number
    /// </summary>
    public async Task ApproveLoanAsync(int loanId, string approvedBy)
    {
        var loan = await _db.EmployeeLoans.FindAsync(loanId);
        if (loan == null)
            throw new ArgumentException("Loan not found");

        if (loan.Status != "Pending")
            throw new InvalidOperationException("Only pending loans can be approved");

        // Generate simple sequential application number (LOAN 1, LOAN 2, etc.)
        var maxLoanNumber = await _db.EmployeeLoans
            .Where(l => l.ApplicationNumber != null)
            .Select(l => l.ApplicationNumber)
            .ToListAsync();
        
        int nextNumber = 1;
        if (maxLoanNumber.Any())
        {
            // Extract numbers from existing application numbers
            var numbers = maxLoanNumber
                .Select(n => {
                    var parts = n!.Split(' ');
                    return parts.Length == 2 && int.TryParse(parts[1], out int num) ? num : 0;
                })
                .Where(n => n > 0);
            
            if (numbers.Any())
                nextNumber = numbers.Max() + 1;
        }
        
        var appNumber = $"LOAN {nextNumber}";
        
        loan.ApplicationNumber = appNumber;
        loan.Status = "Approved";
        loan.ApprovedBy = approvedBy;
        loan.ApprovedDate = DateTime.Now;
        
        // Adjustments for migration are now handled during creation
        // loan.RemainingAmount and loan.RemainingInstallments are trusted from the Saved record.

        await _db.SaveChangesAsync();

        // Generate installment schedule
        await GenerateInstallmentScheduleAsync(loanId);

        // Change status to Active after schedule is generated
        loan.Status = "Active";
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Safely delete a loan and its installments
    /// </summary>
    public async Task DeleteLoanAsync(int loanId)
    {
        var loan = await _db.EmployeeLoans
            .Include(l => l.LoanInstallments)
            .FirstOrDefaultAsync(l => l.Id == loanId);

        if (loan == null)
            throw new ArgumentException("Loan not found");

        // Safety check: Don't delete if any installment is paid or linked to payroll
        if (loan.LoanInstallments.Any(i => i.Status == "Paid" || i.PayrollId != null))
        {
            throw new InvalidOperationException("Cannot delete loan because one or more installments are already paid or processed in payroll.");
        }

        // Remove installments first (though EF cascade should handle it if configured, explicit is safer)
        _db.LoanInstallments.RemoveRange(loan.LoanInstallments);
        
        // Remove the loan
        _db.EmployeeLoans.Remove(loan);

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Foreclose an active loan by paying off all remaining installments
    /// </summary>
    public async Task ForecloseLoanAsync(int loanId, string foreclosedBy, string remark, bool includeCurrentMonth = true)
    {
        var loan = await _db.EmployeeLoans
            .Include(l => l.LoanInstallments)
            .FirstOrDefaultAsync(l => l.Id == loanId);

        if (loan == null)
            throw new ArgumentException("Loan not found");

        if (loan.Status != "Active")
            throw new InvalidOperationException("Only active loans can be foreclosed.");

        var currentMonth = DateTime.Now.ToString("yyyy-MM");

        // Mark pending installments as Paid
        var pendingInstallments = loan.LoanInstallments
            .Where(i => i.Status == "Pending");

        if (!includeCurrentMonth)
        {
            pendingInstallments = pendingInstallments.Where(i => i.DueMonth != currentMonth);
        }

        foreach (var inst in pendingInstallments)
        {
            inst.Status = "Settled";
            inst.PaidAmount = inst.Amount;
            inst.PaidDate = DateOnly.FromDateTime(DateTime.Now);
            inst.Remarks = "Settle via Foreclosure";
        }

        // Finalize loan state
        loan.RemainingAmount = 0;
        loan.RemainingInstallments = 0;
        loan.Status = "Completed";
        
        loan.ForeclosureRemark = $"{remark.Trim()} (By {foreclosedBy} on {DateTime.Now:dd MMM yyyy})";

        await _db.SaveChangesAsync();
    }
}
