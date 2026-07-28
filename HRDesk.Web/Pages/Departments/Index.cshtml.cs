using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Departments;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IReferenceDataCacheService _cache;

    public IndexModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IReferenceDataCacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public IReadOnlyList<Department> Departments { get; private set; } = Array.Empty<Department>();

    public async Task OnGetAsync()
    {
        Departments = await _db.Departments
            .AsNoTracking()
            .OrderBy(d => d.DepartmentName)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null)
        {
            return NotFound();
        }

        dept.Status = string.Equals(dept.Status, "active", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

        await _db.SaveChangesAsync();
        _cache.EvictDepartmentsCache();
        return RedirectToPage();
    }
}
