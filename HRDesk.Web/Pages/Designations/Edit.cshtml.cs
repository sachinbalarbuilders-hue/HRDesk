using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Designations;

public sealed class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public EditModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    [BindProperty]
    public FormInput Input { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        var desig = await _db.Designations.AsNoTracking().FirstOrDefaultAsync(d => d.Id == Id);
        if (desig is null)
        {
            return NotFound();
        }

        Input = new FormInput
        {
            DesignationName = desig.DesignationName,
            Status = desig.Status,
        };

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var desig = await _db.Designations.FirstOrDefaultAsync(d => d.Id == Id);
        if (desig is null)
        {
            return NotFound();
        }

        var name = Input.DesignationName.Trim();
        var exists = await _db.Designations.AnyAsync(d => d.Id != Id && d.DesignationName == name);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Designation name already exists.");
            return Page();
        }

        desig.DesignationName = name;
        desig.Status = Input.Status;

        await _db.SaveChangesAsync();
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
