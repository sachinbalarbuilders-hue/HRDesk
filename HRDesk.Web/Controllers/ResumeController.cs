using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using HRDesk.Web.Data;

namespace HRDesk.Web.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class ResumeController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _context;

    public ResumeController(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetResume(int id)
    {
        var candidate = await _context.Candidates.FindAsync(id);
        
        if (candidate == null || candidate.ResumeData == null)
        {
            return NotFound("Resume not found.");
        }

        var contentType = candidate.ResumeContentType ?? "application/octet-stream";
        // By omitting the third parameter (fileName), ASP.NET sets Content-Disposition to "inline"
        // which tells the browser to view the PDF/image instead of downloading it.
        return File(candidate.ResumeData, contentType);
    }
}
