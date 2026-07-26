using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public IndexModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    public IList<Candidate> Candidates { get; set; } = default!;

    public async Task OnGetAsync()
    {
        Candidates = await _context.Candidates
            .Include(c => c.HiredEmployee)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }
}
