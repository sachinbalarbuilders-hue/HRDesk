using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IWebHostEnvironment _env;

    public CreateModel(BiometricAttendanceDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    public IActionResult OnGet()
    {
        Candidate = new Candidate 
        { 
            ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow) 
        };
        return Page();
    }

    [BindProperty]
    public Candidate Candidate { get; set; } = default!;

    [BindProperty]
    public IFormFile? ResumeUpload { get; set; }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        if (ResumeUpload != null && ResumeUpload.Length > 0)
        {
            using (var memoryStream = new MemoryStream())
            {
                await ResumeUpload.CopyToAsync(memoryStream);
                Candidate.ResumeData = memoryStream.ToArray();
            }
            
            Candidate.ResumeFileName = Path.GetFileName(ResumeUpload.FileName);
            Candidate.ResumeContentType = ResumeUpload.ContentType;
        }

        _context.Candidates.Add(Candidate);
        await _context.SaveChangesAsync();

        return RedirectToPage("./Index");
    }
}
