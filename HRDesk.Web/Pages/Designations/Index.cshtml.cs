using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Designations;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IReferenceDataCacheService _cache;

    public IndexModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IReferenceDataCacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public IReadOnlyList<Designation> Designations { get; private set; } = Array.Empty<Designation>();

    public async Task OnGetAsync()
    {
        Designations = await _db.Designations
            .AsNoTracking()
            .OrderBy(d => d.DesignationName)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        var desig = await _db.Designations.FirstOrDefaultAsync(d => d.Id == id);
        if (desig is null)
        {
            return NotFound();
        }

        desig.Status = string.Equals(desig.Status, "active", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

        await _db.SaveChangesAsync();
        _cache.EvictDesignationsCache();
        return RedirectToPage();
    }
}
