using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Shifts;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public IReadOnlyList<Shift> Shifts { get; private set; } = Array.Empty<Shift>();

    public async Task OnGetAsync()
    {
        Shifts = await _db.Shifts
            .AsNoTracking()
            .OrderBy(s => s.ShiftName)
            .ThenBy(s => s.ShiftCode)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == id);
        if (shift is null)
        {
            return NotFound();
        }

        shift.Status = string.Equals(shift.Status, "active", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

        await _db.SaveChangesAsync();
        return RedirectToPage();
    }
}
