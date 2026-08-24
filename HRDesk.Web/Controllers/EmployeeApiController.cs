using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Services;

namespace HRDesk.Web.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class EmployeeApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly ICurrentTenantProvider _tenantProvider;

    public EmployeeApiController(BiometricAttendanceDbContext context, ICurrentTenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("check-id")]
    public async Task<IActionResult> CheckEmployeeId(int id)
    {
        var organizationId = _tenantProvider.TenantId;
        bool exists = await _context.Employees
            .AnyAsync(e => e.EmployeeId == id && e.OrganizationId == organizationId);
            
        return Ok(new { exists });
    }
}
