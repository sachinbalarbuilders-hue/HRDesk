using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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

    [BindProperty(SupportsGet = true)]
    public string Tab { get; set; } = "active";

    public IReadOnlyList<Designation> ActiveDesignations { get; private set; } = Array.Empty<Designation>();
    public IReadOnlyList<Designation> ArchivedDesignations { get; private set; } = Array.Empty<Designation>();

    public async Task OnGetAsync()
    {
        var all = await _db.Designations
            .AsNoTracking()
            .OrderBy(d => d.DesignationName)
            .ToListAsync();

        ActiveDesignations = all
            .Where(d => !string.Equals(d.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();

        ArchivedDesignations = all
            .Where(d => string.Equals(d.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public async Task<IActionResult> OnPostArchiveAsync(int id)
    {
        var desig = await _db.Designations.FirstOrDefaultAsync(d => d.Id == id);
        if (desig is null)
        {
            return NotFound();
        }

        desig.Status = "archived";
        await _db.SaveChangesAsync();
        _cache.EvictDesignationsCache();

        TempData["SuccessMessage"] = $"Designation '{desig.DesignationName}' moved to Archive.";
        return RedirectToPage(new { Tab = "active" });
    }

    public async Task<IActionResult> OnPostRestoreAsync(int id)
    {
        var desig = await _db.Designations.FirstOrDefaultAsync(d => d.Id == id);
        if (desig is null)
        {
            return NotFound();
        }

        desig.Status = "active";
        await _db.SaveChangesAsync();
        _cache.EvictDesignationsCache();

        TempData["SuccessMessage"] = $"Designation '{desig.DesignationName}' restored successfully.";
        return RedirectToPage(new { Tab = "archived" });
    }

    public async Task<IActionResult> OnPostPermanentDeleteAsync(int id)
    {
        var desig = await _db.Designations.FirstOrDefaultAsync(d => d.Id == id);
        if (desig is null)
        {
            return NotFound();
        }

        var assignedEmployeesCount = await _db.Employees.CountAsync(e => e.DesignationId == id);
        if (assignedEmployeesCount > 0)
        {
            TempData["ErrorMessage"] = $"Cannot permanently delete '{desig.DesignationName}' because {assignedEmployeesCount} employee(s) are assigned to it. Please reassign them first.";
            return RedirectToPage(new { Tab = "archived" });
        }

        _db.Designations.Remove(desig);
        await _db.SaveChangesAsync();
        _cache.EvictDesignationsCache();

        TempData["SuccessMessage"] = $"Designation '{desig.DesignationName}' permanently deleted.";
        return RedirectToPage(new { Tab = "archived" });
    }
}
