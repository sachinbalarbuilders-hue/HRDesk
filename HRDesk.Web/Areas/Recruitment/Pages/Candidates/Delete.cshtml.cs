using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class DeleteModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IWebHostEnvironment _env;

    public DeleteModel(BiometricAttendanceDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [BindProperty]
    public Candidate Candidate { get; set; } = default!;

    public async Task<IActionResult> OnGetAsync(int? id)
    {
        if (id == null)
        {
            return NotFound();
        }

        var candidate = await _context.Candidates.FirstOrDefaultAsync(m => m.CandidateId == id);

        if (candidate == null)
        {
            return NotFound();
        }
        
        Candidate = candidate;
        
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(int? id)
    {
        if (id == null)
        {
            return NotFound();
        }

        var candidate = await _context.Candidates.FindAsync(id);
        if (candidate != null)
        {
            _context.Candidates.Remove(candidate);
            await _context.SaveChangesAsync();
        }

        return RedirectToPage("./Index");
    }
}
