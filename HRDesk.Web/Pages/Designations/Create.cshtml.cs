using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Designations;

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

        var name = Input.DesignationName.Trim();
        var exists = await _db.Designations.AnyAsync(d => d.DesignationName == name);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Designation name already exists.");
            return Page();
        }

        _db.Designations.Add(new Designation
        {
            DesignationName = name,
            Status = Input.Status,
        });

        await _db.SaveChangesAsync();
        _cache.EvictDesignationsCache();
        return RedirectToPage("./Index");
    }

    public sealed class FormInput
    {
        [Required]
        [StringLength(100)]
        [Display(Name = "Designation Name")]
        public string DesignationName { get; set; } = "";

        [Display(Name = "Status")]
        public string? Status { get; set; }
    }
}
