using HRDesk.Web.Areas.Recruitment.Models;
using HRDesk.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Areas.Recruitment.Pages.Interviews;

[Authorize]
public class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public EditModel(BiometricAttendanceDbContext db) => _db = db;

    [BindProperty]
    public InterviewSchedule Interview { get; set; } = default!;

    public Candidate? Candidate { get; set; }
    public SelectList RoundOptions { get; set; } = default!;
    public SelectList TypeOptions { get; set; } = default!;
    public SelectList StatusOptions { get; set; } = default!;
    public SelectList ResultOptions { get; set; } = default!;
    public List<string> InterviewerOptions { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(int id)
    {
        Interview = await _db.InterviewSchedules
            .Include(i => i.Candidate)
            .FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new InvalidOperationException();

        if (Interview == null) return NotFound();
        Candidate = Interview.Candidate;
        await PopulateSelectListsAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await PopulateSelectListsAsync();
        if (!ModelState.IsValid) return Page();

        var existing = await _db.InterviewSchedules.FindAsync(Interview.Id);
        if (existing == null) return NotFound();

        existing.InterviewDateTime = Interview.InterviewDateTime;
        existing.Round = Interview.Round;
        existing.InterviewType = Interview.InterviewType;
        existing.InterviewerName = Interview.InterviewerName;
        existing.InterviewerPhone = Interview.InterviewerPhone;
        existing.Location = Interview.Location;
        existing.Status = Interview.Status;
        existing.Result = Interview.Result;
        existing.Feedback = Interview.Feedback;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        TempData["Success"] = "Interview updated.";
        return RedirectToPage("./Calendar");
    }

    private async Task PopulateSelectListsAsync()
    {
        RoundOptions = new SelectList(new[] { "Round 1", "Round 2", "Technical", "HR Round", "Final Round", "Other" });
        TypeOptions = new SelectList(new[] { "In-Person", "Phone", "Virtual" });
        StatusOptions = new SelectList(new[] { "Scheduled", "Completed", "Cancelled", "No Show" });
        ResultOptions = new SelectList(new[] { "", "Pass", "Fail", "Hold" });
        
        InterviewerOptions = await _db.Employees
            .Where(e => e.Status == "Active")
            .OrderBy(e => e.EmployeeName)
            .Select(e => e.EmployeeName)
            .ToListAsync();
    }
}
