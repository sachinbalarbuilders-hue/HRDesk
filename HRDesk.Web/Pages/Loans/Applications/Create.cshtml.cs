using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Loans.Applications
{
    public class CreateModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly ILoanService _loanService;

        public CreateModel(BiometricAttendanceDbContext context, ILoanService loanService)
        {
            _context = context;
            _loanService = loanService;
        }

        [BindProperty]
        public EmployeeLoan LoanApplication { get; set; } = default!;

        [BindProperty]
        public string StartMonth { get; set; } = DateTime.Today.ToString("yyyy-MM");

        public async Task<IActionResult> OnGetAsync()
        {
            ViewData["EmployeeId"] = new SelectList(await _context.Employees.Where(e => e.Status == "active").ToListAsync(), "EmployeeId", "EmployeeName");
            ViewData["LoanTypeId"] = new SelectList(await _context.LoanTypes.Where(lt => lt.IsActive).ToListAsync(), "Id", "TypeName");
            return Page();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (DateOnly.TryParseExact(StartMonth + "-01", "yyyy-MM-dd", out var parsedDate))
            {
                LoanApplication.StartDate = parsedDate;
                ModelState.Remove("LoanApplication.StartDate");
            }

            if (!ModelState.IsValid)
            {
                ViewData["EmployeeId"] = new SelectList(await _context.Employees.Where(e => e.Status == "active").ToListAsync(), "EmployeeId", "EmployeeName");
                ViewData["LoanTypeId"] = new SelectList(await _context.LoanTypes.Where(lt => lt.IsActive).ToListAsync(), "Id", "TypeName");
                return Page();
            }

            // Calculate installments from EMI (Monthly Payment)
            LoanApplication.Installments = _loanService.CalculateInstallmentCount(
                LoanApplication.LoanAmount, 
                LoanApplication.InstallmentAmount);

            if (LoanApplication.Installments == 0)
            {
                ModelState.AddModelError("LoanApplication.InstallmentAmount", "EMI must be greater than zero.");
                ViewData["EmployeeId"] = new SelectList(await _context.Employees.Where(e => e.Status == "active").ToListAsync(), "EmployeeId", "EmployeeName");
                ViewData["LoanTypeId"] = new SelectList(await _context.LoanTypes.Where(lt => lt.IsActive).ToListAsync(), "Id", "TypeName");
                return Page();
            }

            if (LoanApplication.StartingPaidInstallments > LoanApplication.Installments)
            {
                ModelState.AddModelError("LoanApplication.StartingPaidInstallments", $"Already paid installments cannot exceed total installments ({LoanApplication.Installments}).");
                ViewData["EmployeeId"] = new SelectList(await _context.Employees.Where(e => e.Status == "active").ToListAsync(), "EmployeeId", "EmployeeName");
                ViewData["LoanTypeId"] = new SelectList(await _context.LoanTypes.Where(lt => lt.IsActive).ToListAsync(), "Id", "TypeName");
                return Page();
            }

            LoanApplication.RemainingAmount = LoanApplication.LoanAmount - (LoanApplication.InstallmentAmount * LoanApplication.StartingPaidInstallments);
            LoanApplication.RemainingInstallments = LoanApplication.Installments - LoanApplication.StartingPaidInstallments;
            
            // Adjust final month remainder if needed for remaining amount
            if (LoanApplication.RemainingInstallments == 0 && LoanApplication.RemainingAmount != 0)
            {
                // This case should ideally not happen with proper EMI, but let's be safe
                LoanApplication.RemainingAmount = 0;
            }
            LoanApplication.Status = "Pending";
            LoanApplication.CreatedAt = DateTime.Now;

            _context.EmployeeLoans.Add(LoanApplication);
            await _context.SaveChangesAsync();

            return RedirectToPage("./Index");
        }
    }
}
