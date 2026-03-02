using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.CompOff.Requests
{
    public class IndexModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly CompOffService _compOffService;

        public IndexModel(BiometricAttendanceDbContext context, CompOffService compOffService)
        {
            _context = context;
            _compOffService = compOffService;
        }

        public IList<CompOffRequest> DraftRequests { get; set; } = default!;
        public IList<CompOffRequest> PendingRequests { get; set; } = default!;
        public IList<CompOffRequest> ProcessedRequests { get; set; } = default!;
        public IList<Employee> Employees { get; set; } = default!;

        public string? Message { get; set; }

        public async Task OnGetAsync()
        {
            await LoadRequestsAsync();
        }

        public async Task<IActionResult> OnPostApproveAsync(int id, decimal? compOffDays)
        {
            try
            {
                if (compOffDays.HasValue)
                {
                    var req = await _context.CompOffRequests.FindAsync(id);
                    if (req != null && req.Status == "Pending")
                    {
                        req.CompOffDays = compOffDays.Value;
                        await _context.SaveChangesAsync();
                    }
                }

                await _compOffService.ApproveRequestAsync(id, "Admin");
                Message = "Comp off request approved successfully";
            }
            catch (System.Exception ex)
            {
                Message = $"Error: {ex.Message}";
            }

            await LoadRequestsAsync();
            return Page();
        }

        public async Task<IActionResult> OnPostRejectAsync(int id, string reason)
        {
            try
            {
                await _compOffService.RejectRequestAsync(id, "Admin", reason ?? "Rejected by admin");
                Message = "Comp off request rejected";
            }
            catch (System.Exception ex)
            {
                Message = $"Error: {ex.Message}";
            }

            await LoadRequestsAsync();
            return Page();
        }

        public async Task<IActionResult> OnPostManualCreditAsync(int employeeId, System.DateTime workedDate, decimal days, string remarks)
        {
            try
            {
                var date = System.DateOnly.FromDateTime(workedDate);
                await _compOffService.CreateManualCreditAsync(employeeId, date, days, "Admin", remarks ?? "Manual Adjustment");
                Message = "Manual Comp-Off credit added successfully";
            }
            catch (System.Exception ex)
            {
                Message = $"Error: {ex.Message}";
            }

            await LoadRequestsAsync();
            return Page();
        }

        private async Task LoadRequestsAsync()
        {
            var allRequests = await _context.CompOffRequests
                .Include(r => r.Employee)
                .Include(r => r.Shift)
                .OrderByDescending(r => r.RequestDate)
                .ToListAsync();

            DraftRequests = allRequests.Where(r => r.Status == "Draft").ToList();
            PendingRequests = allRequests.Where(r => r.Status == "Pending").ToList();
            ProcessedRequests = allRequests.Where(r => r.Status == "Approved" || r.Status == "Rejected").ToList();

            Employees = await _context.Employees
                .Where(e => e.Status == "Active")
                .OrderBy(e => e.EmployeeName)
                .ToListAsync();
        }
    }
}
