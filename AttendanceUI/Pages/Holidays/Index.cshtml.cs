using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.Holidays;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly LeaveAdjustmentService _adjustmentService;

    public IndexModel(BiometricAttendanceDbContext db, LeaveAdjustmentService adjustmentService)
    {
        _db = db;
        _adjustmentService = adjustmentService;
    }

    public IReadOnlyList<Holiday> Holidays { get; private set; } = Array.Empty<Holiday>();

    public async Task OnGetAsync()
    {
        Holidays = await _db.Holidays
            .AsNoTracking()
            .OrderByDescending(h => h.StartDate)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var holiday = await _db.Holidays.Include(h => h.EligibleEmployees).FirstOrDefaultAsync(h => h.Id == id);
        if (holiday is null)
        {
            return NotFound();
        }

        // Store range and eligibility for reconciliation BEFORE deleting
        var startDate = holiday.StartDate;
        var endDate = holiday.EndDate;
        var employeeIds = holiday.EligibleEmployees?.Select(e => e.EmployeeId).ToList();
        var isGlobal = holiday.IsGlobal;

        if (holiday.EligibleEmployees != null)
        {
            _db.HolidayEmployees.RemoveRange(holiday.EligibleEmployees);
        }

        _db.Holidays.Remove(holiday);
        await _db.SaveChangesAsync();

        // RECONCILE: Adjust leave balances (effectively re-deducting since the holiday is gone)
        await _adjustmentService.ReconcileLeavesForHolidayAsync(startDate, endDate, !isGlobal ? employeeIds : null);

        return RedirectToPage();
    }
}
