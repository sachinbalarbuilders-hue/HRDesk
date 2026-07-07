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

    public IReadOnlyList<AttendanceLog> Logs { get; private set; } = Array.Empty<AttendanceLog>();

    [BindProperty(SupportsGet = true)]
    public int PageNumber { get; set; } = 1;

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

    public bool HasNextPage { get; private set; }

    public async Task OnGetAsync()
    {
        if (PageNumber < 1) PageNumber = 1;
        if (PageSize < 1) PageSize = DefaultPageSize;
        if (PageSize > MaxPageSize) PageSize = MaxPageSize;

        var skip = (PageNumber - 1) * PageSize;

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

        var pagePlusOne = await query
            .Skip(skip)
            .Take(PageSize + 1)
            .ToListAsync();

        HasNextPage = pagePlusOne.Count > PageSize;
        Logs = pagePlusOne.Take(PageSize).ToList();
    }
}
