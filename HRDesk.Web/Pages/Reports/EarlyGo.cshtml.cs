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

        public PaginatedList<DailyAttendance> Records { get; set; } = default!;

        public async Task OnGetAsync(int pageNum = 1)
        {
            var startDate = new DateOnly(Year, Month, 1);
            var endDate = startDate.AddMonths(1);

            var baseQuery = _db.DailyAttendance
                .AsNoTracking()
                .Where(d => d.RecordDate >= startDate && d.RecordDate < endDate && 
                       d.OutTime.HasValue && d.Shift != null && 
                       d.OutTime.Value < d.Shift.EndTime);

            var count = await baseQuery.CountAsync();

            var pagedIds = await baseQuery
                .OrderBy(d => d.Employee != null ? d.Employee.EmployeeName : "")
                .ThenBy(d => d.RecordDate)
                .Select(d => d.Id)
                .Skip((pageNum - 1) * 50)
                .Take(50)
                .ToListAsync();

            var items = await _db.DailyAttendance
                .AsNoTracking()
                .Where(d => pagedIds.Contains(d.Id))
                .Include(d => d.Employee)
                .Include(d => d.Shift)
                .OrderBy(d => d.Employee != null ? d.Employee.EmployeeName : "")
                .ThenBy(d => d.RecordDate)
                .ToListAsync();

            Records = new PaginatedList<DailyAttendance>(items, count, pageNum, 50);
        }
    }
}
