using HRDesk.Web.Areas.Recruitment.Models;
using HRDesk.Web.Data;
using HRDesk.Web.Services.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Areas.Recruitment.Pages.Interviews;

[Authorize]
public class ScheduleModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly WhatsAppNotificationService _whatsApp;

    public ScheduleModel(BiometricAttendanceDbContext db, WhatsAppNotificationService whatsApp)
    {
        _db = db;
        _whatsApp = whatsApp;
    }

    [BindProperty]
    public InterviewSchedule Interview { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public int? CandidateId { get; set; }

    public Candidate? Candidate { get; set; }

    public SelectList RoundOptions { get; set; } = default!;
    public SelectList TypeOptions { get; set; } = default!;
    public SelectList CandidateOptions { get; set; } = default!;
    public List<string> InterviewerOptions { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        await PopulateSelectListsAsync();
        if (CandidateId.HasValue)
        {
            Candidate = await _db.Candidates.FirstOrDefaultAsync(c => c.CandidateId == CandidateId);
            if (Candidate == null) return NotFound();
            Interview.CandidateId = CandidateId.Value;
        }
        
        Interview.InterviewDateTime = DateTime.Now.AddDays(1).Date.AddHours(10);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await PopulateSelectListsAsync();
        if (!ModelState.IsValid)
        {
            Candidate = await _db.Candidates.FirstOrDefaultAsync(c => c.CandidateId == Interview.CandidateId);
            return Page();
        }

        Interview.CreatedAt = DateTime.UtcNow;
        Interview.UpdatedAt = DateTime.UtcNow;
        Interview.Status = "Scheduled";

        // Auto-generate video meeting link if it's an online interview and left empty
        if (Interview.InterviewType == "Virtual" && string.IsNullOrWhiteSpace(Interview.Location))
        {
            var uniqueId = Guid.NewGuid().ToString().Substring(0, 8);
            Interview.Location = $"https://meet.jit.si/HRDesk-Interview-{uniqueId}";
        }

        _db.InterviewSchedules.Add(Interview);

        // Update candidate status to Interview
        var candidate = await _db.Candidates.FirstOrDefaultAsync(c => c.CandidateId == Interview.CandidateId);
        if (candidate != null && candidate.Status == "Sourced" || candidate?.Status == "Screening")
        {
            candidate!.Status = "Interview";
            candidate.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // Send WhatsApp reminder to candidate
        if (candidate != null && !string.IsNullOrWhiteSpace(candidate.Phone))
        {
            var dateStr = Interview.InterviewDateTime.ToString("dddd, dd MMM yyyy 'at' hh:mm tt");
            var locationLine = !string.IsNullOrEmpty(Interview.Location)
                ? $"\nâž¢ *Location/Link:* {Interview.Location}"
                : string.Empty;

            if (Interview.InterviewType == "In-Person")
            {
                var org = await _db.Organizations.FirstOrDefaultAsync();
                if (org != null)
                {
                    if (!string.IsNullOrWhiteSpace(org.Address))
                    {
                        locationLine += $"\nâž¢ *Address:* {org.Address}";
                    }
                    if (org.Latitude.HasValue && org.Longitude.HasValue)
                    {
                        var mapUrl = $"https://maps.google.com/?q={org.Latitude.Value},{org.Longitude.Value}";
                        locationLine += $"\nâž¢ *Map:* {mapUrl}";
                    }
                }
            }

            var msg = $"Hello *{candidate.CandidateName}*,\n\n" +
                      $"We are pleased to inform you that your interview for the *{candidate.AppliedFor}* position has been scheduled.\n\n" +
                      $"âž¢ *Date & Time:* {dateStr}\n" +
                      $"âž¢ *Round:* {Interview.Round}\n" +
                      $"âž¢ *Type:* {Interview.InterviewType}" +
                      locationLine +
                      $"\n\nPlease ensure you are available on time. Best of luck!";

            await _whatsApp.SendGenericAlertAsync(candidate.Phone, msg);
            Interview.ReminderSent = true;
            await _db.SaveChangesAsync();
        }

        TempData["Success"] = "Interview scheduled successfully!";
        return RedirectToPage("./Calendar");
    }

    private async Task PopulateSelectListsAsync()
    {
        RoundOptions = new SelectList(new[] { "Round 1", "Round 2", "Technical", "HR Round", "Final Round", "Other" });
        TypeOptions = new SelectList(new[] { "In-Person", "Phone", "Virtual" });
        
        var candidates = await _db.Candidates
            .Where(c => c.Status != "Hired" && c.Status != "Rejected")
            .OrderByDescending(c => c.ApplicationDate)
            .Select(c => new { c.CandidateId, DisplayText = $"{c.CandidateName} ({c.AppliedFor})" })
            .ToListAsync();
            
        CandidateOptions = new SelectList(candidates, "CandidateId", "DisplayText");
        
        InterviewerOptions = await _db.Employees
            .Where(e => e.Status == "Active")
            .OrderBy(e => e.EmployeeName)
            .Select(e => e.EmployeeName)
            .ToListAsync();
    }
}
