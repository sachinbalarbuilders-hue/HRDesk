using HRDesk.Web.Areas.Recruitment.Models;
using HRDesk.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Areas.Recruitment.Pages.Interviews;

[Authorize]
public class CalendarModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public CalendarModel(BiometricAttendanceDbContext db) => _db = db;

    public List<InterviewSchedule> Upcoming { get; set; } = new();
    public List<InterviewSchedule> Past { get; set; } = new();

    [TempData]
    public string? Success { get; set; }

    public async Task OnGetAsync()
    {
        var now = DateTime.UtcNow;
        var all = await _db.InterviewSchedules
            .Include(i => i.Candidate)
            .OrderBy(i => i.InterviewDateTime)
            .ToListAsync();

        Upcoming = all.Where(i => i.InterviewDateTime >= now && i.Status == "Scheduled").ToList();
        Past     = all.Where(i => i.InterviewDateTime < now || i.Status != "Scheduled")
                      .OrderByDescending(i => i.InterviewDateTime)
                      .ToList();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var interview = await _db.InterviewSchedules.FindAsync(id);
        if (interview != null)
        {
            _db.InterviewSchedules.Remove(interview);
            await _db.SaveChangesAsync();
        }
        TempData["Success"] = "Interview removed.";
        return RedirectToPage();
    }
}
