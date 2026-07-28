using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Departments;

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IReferenceDataCacheService _cache;

    public CreateModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IReferenceDataCacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    [BindProperty]
    public FormInput Input { get; set; } = new();

    public void OnGet()
    {
        Input.Status = "active";
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var name = Input.DepartmentName.Trim();
        var exists = await _db.Departments.AnyAsync(d => d.DepartmentName == name);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Department name already exists.");
            return Page();
        }

        _db.Departments.Add(new Department
        {
            DepartmentName = name,
            Status = Input.Status,
        });

        await _db.SaveChangesAsync();
        _cache.EvictDepartmentsCache();
        return RedirectToPage("./Index");
    }

    public sealed class FormInput
    {
        [Required]
        [StringLength(100)]
        [Display(Name = "Department Name")]
        public string DepartmentName { get; set; } = "";

        [Display(Name = "Status")]
        public string? Status { get; set; }
    }
}
