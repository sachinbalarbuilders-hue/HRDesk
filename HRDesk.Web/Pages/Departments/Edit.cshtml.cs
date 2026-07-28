using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Departments;

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
        var dept = await _db.Departments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == Id);
        if (dept is null)
        {
            return NotFound();
        }

        Input = new FormInput
        {
            DepartmentName = dept.DepartmentName,
            Status = dept.Status,
        };

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == Id);
        if (dept is null)
        {
            return NotFound();
        }

        var name = Input.DepartmentName.Trim();
        var exists = await _db.Departments.AnyAsync(d => d.Id != Id && d.DepartmentName == name);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Department name already exists.");
            return Page();
        }

        dept.DepartmentName = name;
        dept.Status = Input.Status;

        await _db.SaveChangesAsync();
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
