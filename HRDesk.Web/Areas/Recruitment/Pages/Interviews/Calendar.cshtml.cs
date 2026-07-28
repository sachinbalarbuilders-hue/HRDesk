using HRDesk.Web.Areas.Recruitment.Models;
using HRDesk.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Models;

namespace HRDesk.Web.Areas.Recruitment.Pages.Interviews;

[Authorize]
public class CalendarModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public CalendarModel(BiometricAttendanceDbContext db) => _db = db;

    public PaginatedList<InterviewSchedule> Upcoming { get; set; } = default!;
    public PaginatedList<InterviewSchedule> Past { get; set; } = default!;

    [TempData]
    public string? Success { get; set; }

    [BindProperty(SupportsGet = true)]
    public string ActiveTab { get; set; } = "upcoming";

    public async Task OnGetAsync(int pageNum = 1)
    {
        var now = DateTime.UtcNow;
        var query = _db.InterviewSchedules
            .Include(i => i.Candidate);

        var upcomingQuery = query.Where(i => i.InterviewDateTime >= now && i.Status == "Scheduled");
        var upcomingCount = await upcomingQuery.CountAsync();
        var upcomingItems = await upcomingQuery
            .OrderBy(i => i.InterviewDateTime)
            .Skip((pageNum - 1) * 50)
            .Take(50)
            .ToListAsync();
        Upcoming = new PaginatedList<InterviewSchedule>(upcomingItems, upcomingCount, pageNum, 50);

        var pastQuery = query.Where(i => i.InterviewDateTime < now || i.Status != "Scheduled");
        var pastCount = await pastQuery.CountAsync();
        var pastItems = await pastQuery
            .OrderByDescending(i => i.InterviewDateTime)
            .Skip((pageNum - 1) * 50)
            .Take(50)
            .ToListAsync();
        Past = new PaginatedList<InterviewSchedule>(pastItems, pastCount, pageNum, 50);
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
