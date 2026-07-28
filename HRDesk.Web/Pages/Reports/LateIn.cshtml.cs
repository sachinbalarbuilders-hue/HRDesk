using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Reports
{
    public class LateInModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _db;

        public LateInModel(BiometricAttendanceDbContext db)
        {
            _db = db;
        }

        [BindProperty(SupportsGet = true)]
        public int Month { get; set; } = DateTime.Now.Month;

        [BindProperty(SupportsGet = true)]
        public int Year { get; set; } = DateTime.Now.Year;

        public PaginatedList<DailyAttendance> Records { get; set; } = default!;

        public async Task OnGetAsync(int pageNum = 1)
        {
            var startDate = new DateOnly(Year, Month, 1);
            var endDate = startDate.AddMonths(1);

            var query = _db.DailyAttendance
                .Include(d => d.Employee)
                .Include(d => d.Shift)
                .Where(d => d.RecordDate >= startDate && d.RecordDate < endDate && 
                       d.InTime.HasValue && d.Employee != null && 
                       d.LateMinutes > 0);

            var count = await query.CountAsync();

            var items = await query
                .OrderBy(d => d.Employee != null ? d.Employee.EmployeeName : "")
                .ThenBy(d => d.RecordDate)
                .Skip((pageNum - 1) * 50)
                .Take(50)
                .ToListAsync();

            Records = new PaginatedList<DailyAttendance>(items, count, pageNum, 50);
        }
    }
}
