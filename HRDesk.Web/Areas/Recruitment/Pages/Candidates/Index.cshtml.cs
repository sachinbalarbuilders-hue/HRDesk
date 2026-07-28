using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;
using HRDesk.Web.Models;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public IndexModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    public PaginatedList<Candidate> Candidates { get; set; } = default!;

    public async Task OnGetAsync(int pageNum = 1)
    {
        var query = _context.Candidates
            .Include(c => c.HiredEmployee);
            
        var count = await query.CountAsync();
            
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((pageNum - 1) * 50)
            .Take(50)
            .ToListAsync();
            
        Candidates = new PaginatedList<Candidate>(items, count, pageNum, 50);
    }
}
