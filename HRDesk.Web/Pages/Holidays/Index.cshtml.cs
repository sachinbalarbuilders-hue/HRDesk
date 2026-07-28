using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Holidays;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILeaveAdjustmentService _adjustmentService;

    public IndexModel(BiometricAttendanceDbContext db, ILeaveAdjustmentService adjustmentService)
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
