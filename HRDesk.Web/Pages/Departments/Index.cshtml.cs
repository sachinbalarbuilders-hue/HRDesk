using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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

    [BindProperty(SupportsGet = true)]
    public string Tab { get; set; } = "active";

    public IReadOnlyList<Department> ActiveDepartments { get; private set; } = Array.Empty<Department>();
    public IReadOnlyList<Department> ArchivedDepartments { get; private set; } = Array.Empty<Department>();

    public async Task OnGetAsync()
    {
        var all = await _db.Departments
            .AsNoTracking()
            .OrderBy(d => d.DepartmentName)
            .ToListAsync();

        ActiveDepartments = all
            .Where(d => !string.Equals(d.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();

        ArchivedDepartments = all
            .Where(d => string.Equals(d.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public async Task<IActionResult> OnPostArchiveAsync(int id)
    {
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null)
        {
            return NotFound();
        }

        dept.Status = "archived";
        await _db.SaveChangesAsync();
        _cache.EvictDepartmentsCache();

        TempData["SuccessMessage"] = $"Department '{dept.DepartmentName}' moved to Archive.";
        return RedirectToPage(new { Tab = "active" });
    }

    public async Task<IActionResult> OnPostRestoreAsync(int id)
    {
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null)
        {
            return NotFound();
        }

        dept.Status = "active";
        await _db.SaveChangesAsync();
        _cache.EvictDepartmentsCache();

        TempData["SuccessMessage"] = $"Department '{dept.DepartmentName}' restored successfully.";
        return RedirectToPage(new { Tab = "archived" });
    }

    public async Task<IActionResult> OnPostPermanentDeleteAsync(int id)
    {
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (dept is null)
        {
            return NotFound();
        }

        var assignedEmployeesCount = await _db.Employees.CountAsync(e => e.DepartmentId == id);
        if (assignedEmployeesCount > 0)
        {
            TempData["ErrorMessage"] = $"Cannot permanently delete '{dept.DepartmentName}' because {assignedEmployeesCount} employee(s) are assigned to it. Please reassign them first.";
            return RedirectToPage(new { Tab = "archived" });
        }

        _db.Departments.Remove(dept);
        await _db.SaveChangesAsync();
        _cache.EvictDepartmentsCache();

        TempData["SuccessMessage"] = $"Department '{dept.DepartmentName}' permanently deleted.";
        return RedirectToPage(new { Tab = "archived" });
    }
}
