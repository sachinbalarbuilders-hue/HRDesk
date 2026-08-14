using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Portal;

public class DashboardModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly IAttendanceSummaryService _attendanceSummaryService;

    public DashboardModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        IAttendanceSummaryService attendanceSummaryService)
    {
        _context = context;
        _permissionService = permissionService;
        _attendanceSummaryService = attendanceSummaryService;
    }

    public Employee? CurrentEmployee { get; set; }
    public DailyAttendance? TodayAttendance { get; set; }
    public Shift? TodayShift { get; set; }
    public AttendanceSummaryResult? MonthlySummary { get; set; }
    public List<LeaveAllocation> LeaveBalances { get; set; } = new();
    public List<Holiday> UpcomingHolidays { get; set; } = new();
    public List<LeaveApplication> RecentLeaves { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        var empId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!empId.HasValue)
        {
            // If logged in as admin without linked employee profile, redirect to main dashboard
            if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin"))
            {
                return RedirectToPage("/Index");
            }
            TempData["ErrorMessage"] = "No linked employee profile found for your user account. Please contact HR.";
            return Page();
        }

        CurrentEmployee = await _context.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == empId.Value);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentYear = today.Year;
        var currentMonth = today.Month;

        // Today's attendance
        TodayAttendance = await _context.DailyAttendance
            .FirstOrDefaultAsync(a => a.EmployeeId == empId.Value && a.RecordDate == today);

        // Assigned shift for today
        var rosterEntry = await _context.ShiftRosters
            .Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == empId.Value && r.RosterDate == today);

        TodayShift = rosterEntry?.Shift;

        // Monthly Summary from AttendanceSummaryService
        try
        {
            MonthlySummary = await _attendanceSummaryService.GetSummaryAsync(empId.Value, currentYear, currentMonth);
        }
        catch
        {
            MonthlySummary = new AttendanceSummaryResult();
        }

        // Leave Balances for current year
        LeaveBalances = await _context.LeaveAllocations
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == empId.Value && l.Year == currentYear)
            .ToListAsync();

        // Upcoming holidays
        UpcomingHolidays = await _context.Holidays
            .Where(h => h.StartDate >= today)
            .OrderBy(h => h.StartDate)
            .Take(3)
            .ToListAsync();

        // Recent leave applications
        RecentLeaves = await _context.LeaveApplications
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == empId.Value)
            .OrderByDescending(l => l.CreatedAt)
            .Take(5)
            .ToListAsync();

        return Page();
    }
}
