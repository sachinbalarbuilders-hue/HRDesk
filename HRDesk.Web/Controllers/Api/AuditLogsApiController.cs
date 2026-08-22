using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/audit-logs")]
[Authorize]
public class AuditLogsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public AuditLogsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? entityName = null,
        [FromQuery] string? action = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var query = _db.AuditLogs
            .AsNoTracking()
            .Where(a => a.OrganizationId == orgId);

        if (!string.IsNullOrWhiteSpace(entityName) && entityName != "all")
        {
            query = query.Where(a => a.EntityName == entityName);
        }

        if (!string.IsNullOrWhiteSpace(action) && action != "all")
        {
            query = query.Where(a => a.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(a =>
                (a.UserName != null && a.UserName.Contains(s)) ||
                a.EntityName.Contains(s) ||
                (a.PrimaryKey != null && a.PrimaryKey.Contains(s)) ||
                (a.ChangedColumns != null && a.ChangedColumns.Contains(s)) ||
                (a.IpAddress != null && a.IpAddress.Contains(s)));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(a => a.Timestamp >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            var endOfDay = toDate.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(a => a.Timestamp <= endOfDay);
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.OrganizationId,
                a.UserId,
                a.UserName,
                a.Action,
                a.EntityName,
                a.PrimaryKey,
                a.OldValues,
                a.NewValues,
                a.ChangedColumns,
                a.IpAddress,
                a.Timestamp
            })
            .ToListAsync();

        var distinctEntities = await _db.AuditLogs
            .AsNoTracking()
            .Where(a => a.OrganizationId == orgId)
            .Select(a => a.EntityName)
            .Distinct()
            .OrderBy(e => e)
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            availableEntities = distinctEntities,
            availableActions = new[] { "CREATE", "UPDATE", "DELETE" }
        });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetAuditLogDetails(long id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var log = await _db.AuditLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.OrganizationId == orgId);

        if (log == null)
        {
            return NotFound(new { message = "Audit log entry not found." });
        }

        return Ok(log);
    }
}
