using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Portal;

public class MyAttendanceModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly IAttendanceSummaryService _attendanceSummaryService;

    public MyAttendanceModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        IAttendanceSummaryService attendanceSummaryService)
    {
        _context = context;
        _permissionService = permissionService;
        _attendanceSummaryService = attendanceSummaryService;
    }

    public Employee? CurrentEmployee { get; set; }
    public int SelectedYear { get; set; }
    public int SelectedMonth { get; set; }
    public List<DailyAttendance> AttendanceLogs { get; set; } = new();
    public AttendanceSummaryResult Summary { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(int? year, int? month)
    {
        var empId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!empId.HasValue)
        {
            TempData["ErrorMessage"] = "No linked employee profile found.";
            return RedirectToPage("/Portal/Dashboard");
        }

        CurrentEmployee = await _context.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == empId.Value);

        var today = DateOnly.FromDateTime(DateTime.Today);
        SelectedYear = year ?? today.Year;
        SelectedMonth = month ?? today.Month;

        var startDate = new DateOnly(SelectedYear, SelectedMonth, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        AttendanceLogs = await _context.DailyAttendance
            .Include(a => a.Shift)
            .Where(a => a.EmployeeId == empId.Value && a.RecordDate >= startDate && a.RecordDate <= endDate)
            .OrderBy(a => a.RecordDate)
            .ToListAsync();

        try
        {
            Summary = await _attendanceSummaryService.GetSummaryAsync(empId.Value, SelectedYear, SelectedMonth);
        }
        catch
        {
            Summary = new AttendanceSummaryResult();
        }

        return Page();
    }
}
