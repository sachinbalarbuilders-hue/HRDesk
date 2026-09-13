using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Shifts;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IReferenceDataCacheService _cache;

    public IndexModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IReferenceDataCacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    [BindProperty(SupportsGet = true)]
    public string Tab { get; set; } = "active";

    public IReadOnlyList<Shift> ActiveShifts { get; private set; } = Array.Empty<Shift>();
    public IReadOnlyList<Shift> ArchivedShifts { get; private set; } = Array.Empty<Shift>();

    public async Task OnGetAsync()
    {
        var all = await _db.Shifts
            .AsNoTracking()
            .OrderBy(s => s.ShiftName)
            .ThenBy(s => s.ShiftCode)
            .ToListAsync();

        ActiveShifts = all
            .Where(s => !string.Equals(s.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();

        ArchivedShifts = all
            .Where(s => string.Equals(s.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public async Task<IActionResult> OnPostArchiveAsync(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift is null)
        {
            return NotFound();
        }

        shift.Status = "archived";
        await _db.SaveChangesAsync();
        _cache.EvictShiftsCache();

        TempData["SuccessMessage"] = $"Shift '{shift.ShiftName}' moved to Archive.";
        return RedirectToPage(new { Tab = "active" });
    }

    public async Task<IActionResult> OnPostRestoreAsync(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift is null)
        {
            return NotFound();
        }

        shift.Status = "active";
        await _db.SaveChangesAsync();
        _cache.EvictShiftsCache();

        TempData["SuccessMessage"] = $"Shift '{shift.ShiftName}' restored successfully.";
        return RedirectToPage(new { Tab = "archived" });
    }

    public async Task<IActionResult> OnPostPermanentDeleteAsync(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift is null)
        {
            return NotFound();
        }

        var rostersCount = await _db.ShiftRosters.CountAsync(r => r.ShiftId == id);
        var assignmentsCount = await _db.EmployeeShiftAssignments.CountAsync(a => a.ShiftId == id);

        if (rostersCount > 0 || assignmentsCount > 0)
        {
            TempData["ErrorMessage"] = $"Cannot permanently delete shift '{shift.ShiftName}' because historical roster schedules ({rostersCount}) or employee assignments ({assignmentsCount}) exist. Please keep it archived.";
            return RedirectToPage(new { Tab = "archived" });
        }

        _db.Shifts.Remove(shift);
        await _db.SaveChangesAsync();
        _cache.EvictShiftsCache();

        TempData["SuccessMessage"] = $"Shift '{shift.ShiftName}' permanently deleted.";
        return RedirectToPage(new { Tab = "archived" });
    }
}
