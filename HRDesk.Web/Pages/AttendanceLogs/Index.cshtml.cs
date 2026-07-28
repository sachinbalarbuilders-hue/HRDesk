using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.AttendanceLogs;

public sealed class IndexModel : PageModel
{
    private const int DefaultPageSize = 100;
    private const int MaxPageSize = 500;

    private readonly BiometricAttendanceDbContext _db;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public PaginatedList<AttendanceLog> Logs { get; private set; } = default!;

    [BindProperty(SupportsGet = true)]
    public int PageSize { get; set; } = DefaultPageSize;

    [BindProperty(SupportsGet = true)]
    public DateTime? StartDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public DateTime? EndDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? EmployeeIdFilter { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? EmployeeNameFilter { get; set; }

    public async Task OnGetAsync(int pageNum = 1)
    {
        if (pageNum < 1) pageNum = 1;
        if (PageSize < 1) PageSize = DefaultPageSize;
        if (PageSize > MaxPageSize) PageSize = MaxPageSize;

        var query = _db.AttendanceLogs
            .AsNoTracking()
            .Include(x => x.Employee)
            .AsQueryable();

        if (StartDate.HasValue)
        {
            query = query.Where(x => x.PunchTime >= StartDate.Value.Date);
        }

        if (EndDate.HasValue)
        {
            // End date should be inclusive, so we take < EndDate + 1 day
            var nextDate = EndDate.Value.Date.AddDays(1);
            query = query.Where(x => x.PunchTime < nextDate);
        }

        if (!string.IsNullOrWhiteSpace(EmployeeIdFilter))
        {
            if (int.TryParse(EmployeeIdFilter, out int empId))
            {
                query = query.Where(x => x.EmployeeId == empId);
            }
        }

        if (!string.IsNullOrWhiteSpace(EmployeeNameFilter))
        {
            var name = EmployeeNameFilter.Trim().ToLower();
            query = query.Where(x => x.Employee != null && x.Employee.EmployeeName != null && x.Employee.EmployeeName.ToLower().Contains(name));
        }

        query = query.OrderByDescending(x => x.PunchTime)
                     .ThenByDescending(x => x.Id);

        Logs = await PaginatedList<AttendanceLog>.CreateAsync(query, pageNum, PageSize);
    }
}
