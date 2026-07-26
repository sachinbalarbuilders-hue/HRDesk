using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

public class DetailsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public DetailsModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public Candidate Candidate { get; set; } = default!;
    
    public List<InterviewSchedule> Interviews { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var candidate = await _db.Candidates.FirstOrDefaultAsync(c => c.CandidateId == id);
        if (candidate == null)
        {
            return NotFound();
        }

        Candidate = candidate;

        Interviews = await _db.InterviewSchedules
            .Where(i => i.CandidateId == id)
            .OrderByDescending(i => i.InterviewDateTime)
            .ToListAsync();

        return Page();
    }
}
