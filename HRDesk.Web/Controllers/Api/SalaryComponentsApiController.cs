using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[Authorize]
[ApiController]
[Route("api/salary-components")]
public class SalaryComponentsApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public SalaryComponentsApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _archive = archive;
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

    [HttpGet]
    public async Task<IActionResult> GetComponents([FromQuery] string archiveStatus = "active")
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase)
            || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }

        var query = _db.SalaryComponents
            .AsNoTracking()
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.ArchivedAt == null);

        var comps = await query
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.ComponentName)
            .Select(c => new
            {
                c.Id, c.ComponentName, c.ComponentCode, c.ComponentType,
                c.Category, c.IsEpfApplicable, c.IsEsiApplicable, c.IsTaxable,
                c.IsActive, c.DisplayOrder, archivedAt = c.ArchivedAt,
                c.CalculationType, c.DefaultValue, c.BaseComponentCode
            })
            .ToListAsync();

        return Ok(comps);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteComponent(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var result = permanent
            ? await _archive.PermanentDeleteAsync<SalaryComponent>(id)
            : await _archive.ArchiveAsync<SalaryComponent>(id);

        return FromArchive(result);
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> RestoreComponent(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var result = await _archive.RestoreAsync<SalaryComponent>(id);
        return FromArchive(result);
    }

    [HttpPost]
    public async Task<IActionResult> UpsertComponent([FromBody] SalaryComponentUpsertDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        SalaryComponent comp;
        if (dto.Id.HasValue && dto.Id.Value > 0)
        {
            comp = await _db.SalaryComponents.FirstOrDefaultAsync(c => c.Id == dto.Id.Value)
                   ?? new SalaryComponent { OrganizationId = _tenantProvider.TenantId };
        }
        else
        {
            var exists = await _db.SalaryComponents
                .AnyAsync(c => c.ComponentCode == dto.ComponentCode.Trim().ToUpperInvariant());
            if (exists)
                return BadRequest(new { message = $"Component code '{dto.ComponentCode}' already exists." });

            comp = new SalaryComponent { OrganizationId = _tenantProvider.TenantId };
            _db.SalaryComponents.Add(comp);
        }

        comp.ComponentName     = dto.ComponentName.Trim();
        comp.ComponentCode     = dto.ComponentCode.Trim().ToUpperInvariant();
        comp.ComponentType     = dto.ComponentType;
        comp.Category          = dto.Category ?? "Allowance";
        comp.IsEpfApplicable   = dto.IsEpfApplicable;
        comp.IsEsiApplicable   = dto.IsEsiApplicable;
        comp.IsTaxable         = dto.IsTaxable;
        comp.IsActive          = dto.IsActive;
        comp.DisplayOrder      = dto.DisplayOrder;
        comp.CalculationType   = !string.IsNullOrWhiteSpace(dto.CalculationType) ? dto.CalculationType : "PercentOfCTC";
        comp.DefaultValue      = dto.DefaultValue;
        comp.BaseComponentCode = !string.IsNullOrWhiteSpace(dto.BaseComponentCode) ? dto.BaseComponentCode.Trim().ToUpperInvariant() : null;

        await _db.SaveChangesAsync();

        // Also synchronize any pay_group_components that reference this component so their calculation rules stay up-to-date
        var linkedPgc = await _db.PayGroupComponents
            .Where(pgc => pgc.ComponentId == comp.Id)
            .ToListAsync();
        foreach (var pgc in linkedPgc)
        {
            pgc.CalculationType   = comp.CalculationType;
            pgc.Value             = comp.DefaultValue;
            pgc.BaseComponentCode = comp.BaseComponentCode;
        }
        if (linkedPgc.Any())
        {
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = "Component saved.", id = comp.Id });
    }
}

public record SalaryComponentUpsertDto(
    int? Id,
    string ComponentName,
    string ComponentCode,
    string ComponentType,
    string? Category,
    bool IsEpfApplicable,
    bool IsEsiApplicable,
    bool IsTaxable,
    bool IsActive,
    int DisplayOrder,
    string? CalculationType = null,
    decimal? DefaultValue = null,
    string? BaseComponentCode = null
);
