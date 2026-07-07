using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Loans.Applications
{
    public class IndexModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly LoanService _loanService;

        public IndexModel(BiometricAttendanceDbContext context, LoanService loanService)
        {
            _context = context;
            _loanService = loanService;
        }

        public IList<EmployeeLoan> LoanApplications { get; set; } = default!;

        public string? Message { get; set; }

        public async Task OnGetAsync()
        {
            LoanApplications = await _context.EmployeeLoans
                .Include(l => l.Employee)
                .Include(l => l.LoanType)
                .OrderByDescending(l => l.ApplicationDate)
                .ToListAsync();
        }

        public async Task<IActionResult> OnPostDeleteAsync(int id)
        {
            try
            {
                await _loanService.DeleteLoanAsync(id);
                Message = "Loan application deleted successfully";
            }
            catch (System.Exception ex)
            {
                Message = "Error: " + ex.Message;
            }

            await OnGetAsync();
            return Page();
        }
    }
}
