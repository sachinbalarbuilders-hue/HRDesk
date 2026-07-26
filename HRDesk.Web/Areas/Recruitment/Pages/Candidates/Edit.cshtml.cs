using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IWebHostEnvironment _env;

    public EditModel(BiometricAttendanceDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [BindProperty]
    public Candidate Candidate { get; set; } = default!;

    [BindProperty]
    public IFormFile? ResumeUpload { get; set; }

    public async Task<IActionResult> OnGetAsync(int? id)
    {
        if (id == null)
        {
            return NotFound();
        }

        var candidate =  await _context.Candidates.FirstOrDefaultAsync(m => m.CandidateId == id);
        if (candidate == null)
        {
            return NotFound();
        }
        Candidate = candidate;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var existingCandidate = await _context.Candidates.FindAsync(Candidate.CandidateId);
        if (existingCandidate == null) return NotFound();

        existingCandidate.CandidateName = Candidate.CandidateName;
        existingCandidate.Email = Candidate.Email;
        existingCandidate.Phone = Candidate.Phone;
        existingCandidate.AppliedFor = Candidate.AppliedFor;
        existingCandidate.Status = Candidate.Status;
        existingCandidate.ApplicationDate = Candidate.ApplicationDate;
        existingCandidate.Notes = Candidate.Notes;
        existingCandidate.UpdatedAt = DateTime.UtcNow;

        if (ResumeUpload != null && ResumeUpload.Length > 0)
        {
            using (var memoryStream = new MemoryStream())
            {
                await ResumeUpload.CopyToAsync(memoryStream);
                existingCandidate.ResumeData = memoryStream.ToArray();
            }
            
            existingCandidate.ResumeFileName = Path.GetFileName(ResumeUpload.FileName);
            existingCandidate.ResumeContentType = ResumeUpload.ContentType;
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!CandidateExists(Candidate.CandidateId))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return RedirectToPage("./Index");
    }

    private bool CandidateExists(int id)
    {
        return _context.Candidates.Any(e => e.CandidateId == id);
    }
}
