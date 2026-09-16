using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using HRDesk.Web.Services.Payroll;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/form16")]
[Authorize]
public class Form16ApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly Form16Service _form16Service;

    public Form16ApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        Form16Service form16Service)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _form16Service = form16Service;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst("EmployeeId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return int.TryParse(claim?.Value, out var id) ? id : 0;
    }

    // ── GET /api/form16/{employeeId} ──────────────────────────────────────────
    [HttpGet("{employeeId:int}")]
    public async Task<IActionResult> GetForm16PartB(int employeeId, [FromQuery] string? financialYear)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var currentEmpId = GetCurrentUserId();

        // RBAC enforcement: Employees can always view their own Form 16; other employees require scoped permission
        if (currentEmpId != employeeId)
        {
            var empQuery = _db.Employees.AsNoTracking().Where(e => e.EmployeeId == employeeId);
            empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.PayrollView);
            var isAuthorized = await empQuery.AnyAsync();
            if (!isAuthorized)
            {
                return Forbid();
            }
        }

        var data = await _form16Service.GeneratePartBAsync(employeeId, orgId, financialYear);
        if (data == null)
        {
            return NotFound(new { message = "Employee or tax record not found for Form 16 generation." });
        }

        return Ok(data);
    }

    // ── GET /api/form16/my-form16 ─────────────────────────────────────────────
    [HttpGet("my-form16")]
    public async Task<IActionResult> GetMyForm16([FromQuery] string? financialYear)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var currentEmpId = GetCurrentUserId();
        if (currentEmpId <= 0)
        {
            return BadRequest(new { message = "Logged-in user is not associated with an employee profile." });
        }

        var data = await _form16Service.GeneratePartBAsync(currentEmpId, orgId, financialYear);
        if (data == null)
        {
            return NotFound(new { message = "Form 16 data not available." });
        }

        return Ok(data);
    }
}
