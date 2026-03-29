using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.Loans.Applications
{
    public class DetailsModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly LoanService _loanService;

        public DetailsModel(BiometricAttendanceDbContext context, LoanService loanService)
        {
            _context = context;
            _loanService = loanService;
        }

        public EmployeeLoan LoanApplication { get; set; } = default!;
        public IList<LoanInstallment> Installments { get; set; } = default!;

        [BindProperty]
        public string? ForeclosureRemark { get; set; }

        [BindProperty]
        public bool IncludeCurrentMonth { get; set; } = true;

        public bool HasCurrentMonthPending { get; set; }
        public decimal CurrentMonthAmount { get; set; }
        public decimal TotalPendingAmount { get; set; }
        public int PendingInstallmentsCount { get; set; }
        public string CurrentMonthName { get; set; } = "";

        public async Task<IActionResult> OnGetAsync(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var loan = await _context.EmployeeLoans
                .Include(l => l.Employee)
                .Include(l => l.LoanType)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (loan == null)
            {
                return NotFound();
            }

            LoanApplication = loan;

            // Load installments if loan is approved/active
            if (loan.Status == "Active" || loan.Status == "Completed")
            {
                Installments = await _context.LoanInstallments
                    .Where(i => i.LoanId == id)
                    .OrderBy(i => i.InstallmentNumber)
                    .ToListAsync();
                
                var currentMonthStr = System.DateTime.Now.ToString("yyyy-MM");
                CurrentMonthName = System.DateTime.Now.ToString("MMMM yyyy");
                var pendingInsts = Installments.Where(i => i.Status == "Pending").ToList();
                HasCurrentMonthPending = pendingInsts.Any(i => i.DueMonth == currentMonthStr);
                CurrentMonthAmount = pendingInsts.FirstOrDefault(i => i.DueMonth == currentMonthStr)?.Amount ?? 0;
                TotalPendingAmount = pendingInsts.Sum(i => i.Amount);
                PendingInstallmentsCount = pendingInsts.Count;
            }
            else
            {
                Installments = new List<LoanInstallment>();
                CurrentMonthName = System.DateTime.Now.ToString("MMMM yyyy");
            }

            return Page();
        }

        public async Task<IActionResult> OnPostApproveAsync(int id)
        {
            var loan = await _context.EmployeeLoans.FindAsync(id);
            if (loan == null || loan.Status != "Pending")
            {
                return RedirectToPage();
            }

            await _loanService.ApproveLoanAsync(id, User.Identity?.Name ?? "Admin");

            return RedirectToPage(new { id });
        }

        public async Task<IActionResult> OnPostRejectAsync(int id)
        {
            var loan = await _context.EmployeeLoans.FindAsync(id);
            if (loan == null || loan.Status != "Pending")
            {
                return RedirectToPage();
            }

            loan.Status = "Rejected";
            loan.ApprovedBy = User.Identity?.Name ?? "Admin";
            loan.ApprovedDate = System.DateTime.Now;
            await _context.SaveChangesAsync();

            return RedirectToPage(new { id });
        }

        public async Task<IActionResult> OnPostDeleteAsync(int id)
        {
            try
            {
                await _loanService.DeleteLoanAsync(id);
                return RedirectToPage("./Index");
            }
            catch (System.Exception)
            {
                return RedirectToPage(new { id });
            }
        }
        public async Task<IActionResult> OnPostForecloseAsync(int id)
        {
            try
            {
                var remark = ForeclosureRemark ?? "No remark provided";
                await _loanService.ForecloseLoanAsync(id, User.Identity?.Name ?? "Admin", remark, IncludeCurrentMonth);
                return RedirectToPage(new { id });
            }
            catch (System.Exception ex)
            {
                ModelState.AddModelError("", ex.Message);
                return await OnGetAsync(id);
            }
        }
    }
}
