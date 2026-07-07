using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Organizations
{
    [Authorize(Roles = "SuperAdmin")]
    public class IndexModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public IndexModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        public IList<Organization> Organizations { get; set; } = default!;

        public async Task OnGetAsync()
        {
            Organizations = await _context.Organizations.ToListAsync();
        }
    }
}
