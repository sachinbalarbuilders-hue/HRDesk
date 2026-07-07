using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Reports
{
    public class MissingPunchModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _db;

        public MissingPunchModel(BiometricAttendanceDbContext db)
        {
            _db = db;
        }

        [BindProperty(SupportsGet = true)]
        public int Month { get; set; } = DateTime.Now.Month;

        [BindProperty(SupportsGet = true)]
        public int Year { get; set; } = DateTime.Now.Year;

        [BindProperty(SupportsGet = true)]
        public bool IncludeRegularized { get; set; } = false;

        public List<DailyAttendance> Records { get; set; } = new();

        public async Task OnGetAsync()
        {
            var startDate = new DateOnly(Year, Month, 1);
            var endDate = startDate.AddMonths(1);

            var query = _db.DailyAttendance
                .Include(d => d.Employee)
                .Include(d => d.Shift)
                .Where(d => d.RecordDate >= startDate && d.RecordDate < endDate && d.Remarks != null)
                .AsQueryable();

            if (IncludeRegularized)
            {
                query = query.Where(d => d.Remarks.Contains("Single Punch") || 
                                         d.Remarks.Contains("Missing") || 
                                         d.Remarks.Contains("Missed Punch Regularized"));
            }
            else
            {
                query = query.Where(d => d.Remarks.Contains("Single Punch") || d.Remarks.Contains("Missing"));
            }

            Records = await query
                .OrderBy(d => d.Employee != null ? d.Employee.EmployeeName : "")
                .ThenBy(d => d.RecordDate)
                .ToListAsync();
        }
    }
}
