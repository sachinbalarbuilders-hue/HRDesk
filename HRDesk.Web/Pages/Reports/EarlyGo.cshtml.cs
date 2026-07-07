using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Reports
{
    public class EarlyGoModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _db;

        public EarlyGoModel(BiometricAttendanceDbContext db)
        {
            _db = db;
        }

        [BindProperty(SupportsGet = true)]
        public int Month { get; set; } = DateTime.Now.Month;

        [BindProperty(SupportsGet = true)]
        public int Year { get; set; } = DateTime.Now.Year;

        public List<DailyAttendance> Records { get; set; } = new();

        public async Task OnGetAsync()
        {
            var startDate = new DateOnly(Year, Month, 1);
            var endDate = startDate.AddMonths(1);

            Records = await _db.DailyAttendance
                .Include(d => d.Employee)
                .Include(d => d.Shift)
                .Where(d => d.RecordDate >= startDate && d.RecordDate < endDate && 
                       d.OutTime.HasValue && d.Shift != null && 
                       d.OutTime.Value < d.Shift.EndTime)
                .OrderBy(d => d.Employee != null ? d.Employee.EmployeeName : "")
                .ThenBy(d => d.RecordDate)
                .ToListAsync();
        }
    }
}
