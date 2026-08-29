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
[Route("api/salary-templates")]
[Authorize]
public class SalaryTemplatesApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public SalaryTemplatesApiController(
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

    // ── Salary Components master list ────────────────────────────────────────

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents([FromQuery] string archiveStatus = "active")
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
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
                c.IsActive, c.DisplayOrder, archivedAt = c.ArchivedAt
            })
            .ToListAsync();

        return Ok(comps);
    }

    [HttpDelete("components/{id:int}")]
    public async Task<IActionResult> DeleteComponent(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var result = permanent
            ? await _archive.PermanentDeleteAsync<SalaryComponent>(id)
            : await _archive.ArchiveAsync<SalaryComponent>(id);

        return FromArchive(result);
    }

    [HttpPost("components/{id:int}/restore")]
    public async Task<IActionResult> RestoreComponent(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var result = await _archive.RestoreAsync<SalaryComponent>(id);
        return FromArchive(result);
    }

    [HttpPost("components")]
    public async Task<IActionResult> UpsertComponent([FromBody] SalaryComponentDto dto)
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
            // Check code uniqueness
            var exists = await _db.SalaryComponents
                .AnyAsync(c => c.ComponentCode == dto.ComponentCode.Trim().ToUpperInvariant());
            if (exists)
                return BadRequest(new { message = $"Component code '{dto.ComponentCode}' already exists." });

            comp = new SalaryComponent { OrganizationId = _tenantProvider.TenantId };
            _db.SalaryComponents.Add(comp);
        }

        comp.ComponentName   = dto.ComponentName.Trim();
        comp.ComponentCode   = dto.ComponentCode.Trim().ToUpperInvariant();
        comp.ComponentType   = dto.ComponentType; // Earning | Deduction | Informational
        comp.Category        = dto.Category ?? "Allowance";
        comp.IsEpfApplicable = dto.IsEpfApplicable;
        comp.IsEsiApplicable = dto.IsEsiApplicable;
        comp.IsTaxable       = dto.IsTaxable;
        comp.IsActive        = dto.IsActive;
        comp.DisplayOrder    = dto.DisplayOrder;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Component saved.", id = comp.Id });
    }

    // ── Templates ────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string archiveStatus = "active")
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }

        var query = _db.SalaryStructureTemplates
            .AsNoTracking()
            .Include(t => t.Components)
                .ThenInclude(tc => tc.Component)
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(t => t.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(t => t.ArchivedAt == null);

        var templates = await query
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .Select(t => new
            {
                t.Id, t.Name, t.Description, t.IsDefault, t.IsActive,
                componentCount = t.Components.Count,
                archivedAt = t.ArchivedAt
            })
            .ToListAsync();

        return Ok(templates);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var template = await _db.SalaryStructureTemplates
            .AsNoTracking()
            .Include(t => t.Components.OrderBy(c => c.DisplayOrder))
                .ThenInclude(tc => tc.Component)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null) return NotFound(new { message = "Template not found." });

        return Ok(new
        {
            template.Id, template.Name, template.Description,
            template.IsDefault, template.IsActive,
            components = template.Components.Select(tc => new
            {
                tc.Id,
                tc.ComponentId,
                componentName = tc.Component?.ComponentName,
                componentCode = tc.Component?.ComponentCode,
                componentType = tc.Component?.ComponentType,
                tc.CalculationType,
                tc.Value,
                tc.BaseComponentCode,
                tc.DisplayOrder
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TemplateCreateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Template name is required." });

        var template = new SalaryStructureTemplate
        {
            Name           = dto.Name.Trim(),
            Description    = dto.Description?.Trim(),
            IsDefault      = false,
            IsActive       = true,
            OrganizationId = _tenantProvider.TenantId
        };
        _db.SalaryStructureTemplates.Add(template);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Template created.", id = template.Id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] TemplateCreateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var template = await _db.SalaryStructureTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template == null) return NotFound(new { message = "Template not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) template.Name = dto.Name.Trim();
        if (dto.Description != null)               template.Description = dto.Description.Trim();
        if (dto.IsActive.HasValue)                 template.IsActive = dto.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Template updated." });
    }

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// The default template can never be deleted; permanent deletion is blocked while the
    /// template is referenced by a pay group or an employee CTC.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        string? DefaultGuard(SalaryStructureTemplate t) =>
            t.IsDefault ? "Cannot delete the default template." : null;

        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<SalaryStructureTemplate>(id, DefaultGuard));

        var inUse = await _db.PayGroups.AnyAsync(g => g.TemplateId == id)
                 || await _db.EmployeeCTCs.AnyAsync(c => c.TemplateId == id);

        string? Guard(SalaryStructureTemplate t) =>
            DefaultGuard(t)
            ?? (inUse
                ? "Cannot permanently delete: this template is still in use by pay groups or employee CTCs."
                : null);

        return FromArchive(await _archive.PermanentDeleteAsync<SalaryStructureTemplate>(id, Guard,
            cascade: async _ =>
            {
                var components = await _db.TemplateComponents.Where(tc => tc.TemplateId == id).ToListAsync();
                _db.TemplateComponents.RemoveRange(components);
            }));
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        return FromArchive(await _archive.RestoreAsync<SalaryStructureTemplate>(id));
    }

    // ── Template Components CRUD ─────────────────────────────────────────────

    [HttpPost("{id:int}/components")]
    public async Task<IActionResult> SaveComponents(int id, [FromBody] List<TemplateComponentDto> dtos)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var template = await _db.SalaryStructureTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template == null) return NotFound(new { message = "Template not found." });

        // Validate: exactly one Remainder allowed
        var remainderCount = dtos.Count(d => d.CalculationType == "Remainder");
        if (remainderCount > 1)
            return BadRequest(new { message = "Only one Remainder component is allowed per template." });

        // Remove existing components and replace with the submitted list (full save)
        var existing = await _db.TemplateComponents.Where(tc => tc.TemplateId == id).ToListAsync();
        _db.TemplateComponents.RemoveRange(existing);

        foreach (var dto in dtos)
        {
            _db.TemplateComponents.Add(new TemplateComponent
            {
                TemplateId          = id,
                ComponentId         = dto.ComponentId,
                CalculationType     = dto.CalculationType,
                Value               = dto.Value,
                BaseComponentCode   = dto.BaseComponentCode?.Trim().ToUpperInvariant(),
                DisplayOrder        = dto.DisplayOrder,
                OrganizationId      = _tenantProvider.TenantId
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Saved {dtos.Count} component(s) for template." });
    }

    // ── Employee CTC endpoints ────────────────────────────────────────────────

    /// <summary>Get the current CTC record for an employee (latest active).</summary>
    [HttpGet("employee-ctc/{employeeId:int}")]
    public async Task<IActionResult> GetEmployeeCTC(int employeeId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesViewSalary))
            return Forbid();

        var records = await _db.EmployeeCTCs
            .AsNoTracking()
            .Include(ec => ec.Template)
            .Where(ec => ec.EmployeeId == employeeId)
            .OrderByDescending(ec => ec.EffectiveFrom)
            .Select(ec => new
            {
                ec.Id,
                ec.AnnualCTC,
                monthlyCTC = ec.AnnualCTC / 12,
                ec.TemplateId,
                templateName = ec.Template != null ? ec.Template.Name : null,
                ec.SalaryBasisOverride,
                ec.EffectiveFrom,
                ec.EffectiveTo,
                ec.Remarks
            })
            .ToListAsync();

        return Ok(records);
    }

    /// <summary>Assign or update CTC for an employee.</summary>
    [HttpPost("employee-ctc")]
    public async Task<IActionResult> SaveEmployeeCTC([FromBody] EmployeeCTCDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (dto.AnnualCTC <= 0)
            return BadRequest(new { message = "Annual CTC must be greater than zero." });

        // Close off any currently open record
        var active = await _db.EmployeeCTCs
            .Where(ec => ec.EmployeeId == dto.EmployeeId && ec.EffectiveTo == null)
            .ToListAsync();

        foreach (var prev in active)
            prev.EffectiveTo = dto.EffectiveFrom.AddDays(-1);

        _db.EmployeeCTCs.Add(new EmployeeCTC
        {
            EmployeeId          = dto.EmployeeId,
            AnnualCTC           = dto.AnnualCTC,
            TemplateId          = dto.TemplateId,
            SalaryBasisOverride = dto.SalaryBasisOverride,
            EffectiveFrom       = dto.EffectiveFrom,
            EffectiveTo         = null,
            Remarks             = dto.Remarks,
            OrganizationId      = _tenantProvider.TenantId
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "CTC saved successfully." });
    }

    /// <summary>
    /// Preview: given a CTC and template, compute all monthly component amounts
    /// WITHOUT saving anything.  Used by the frontend to show a live breakdown.
    /// </summary>
    [HttpPost("preview-ctc")]
    public async Task<IActionResult> PreviewCTC([FromBody] PreviewCTCDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (dto.AnnualCTC <= 0 || dto.TemplateId <= 0)
            return BadRequest(new { message = "AnnualCTC and TemplateId are required." });

        var template = await _db.SalaryStructureTemplates
            .AsNoTracking()
            .Include(t => t.Components.OrderBy(c => c.DisplayOrder))
                .ThenInclude(tc => tc.Component)
            .FirstOrDefaultAsync(t => t.Id == dto.TemplateId);

        if (template == null) return NotFound(new { message = "Template not found." });

        var breakdown = ComputeCTCBreakdown(dto.AnnualCTC, template.Components.ToList());

        return Ok(new
        {
            annualCTC  = dto.AnnualCTC,
            monthlyCTC = dto.AnnualCTC / 12,
            components = breakdown
        });
    }

    // ── CTC formula engine (used by preview and payroll service) ─────────────

    public static List<CTCComponentResult> ComputeCTCBreakdown(
        decimal annualCTC,
        List<TemplateComponent> components)
    {
        var monthly  = annualCTC / 12m;
        var results  = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var output   = new List<CTCComponentResult>();

        // Pass 1: compute everything except Remainder and Statutory
        decimal earningsTotal = 0m;
        TemplateComponent? remainderRow = null;

        foreach (var tc in components.Where(c => c.Component != null))
        {
            var code = tc.Component!.ComponentCode;

            if (tc.CalculationType == "Remainder")
            {
                remainderRow = tc;
                continue;
            }
            if (tc.CalculationType == "Statutory")
            {
                // Statutory amounts are computed later by the payroll engine.
                // Preview shows 0 as a placeholder.
                results[code] = 0m;
                output.Add(new CTCComponentResult(
                    code, tc.Component.ComponentName, tc.Component.ComponentType,
                    0m, tc.CalculationType, "Auto-computed at payroll time"));
                continue;
            }

            decimal amount = tc.CalculationType switch
            {
                "FixedAmount"        => tc.Value ?? 0m,
                "PercentOfCTC"       => Math.Round(monthly * (tc.Value ?? 0m) / 100m, 2),
                "PercentOfComponent" => results.TryGetValue(tc.BaseComponentCode ?? "", out var base_)
                                        ? Math.Round(base_ * (tc.Value ?? 0m) / 100m, 2)
                                        : 0m,
                _                    => 0m
            };

            results[code] = amount;
            if (tc.Component.ComponentType == "Earning") earningsTotal += amount;

            output.Add(new CTCComponentResult(
                code, tc.Component.ComponentName, tc.Component.ComponentType,
                amount, tc.CalculationType,
                FormatFormula(tc)));
        }

        // Pass 2: fill Remainder = monthly CTC − all other earnings
        if (remainderRow?.Component != null)
        {
            var remainder = Math.Max(0m, Math.Round(monthly - earningsTotal, 2));
            var code      = remainderRow.Component.ComponentCode;
            results[code] = remainder;
            output.Add(new CTCComponentResult(
                code, remainderRow.Component.ComponentName, "Earning",
                remainder, "Remainder",
                $"Monthly CTC ({monthly:F2}) − other earnings ({earningsTotal:F2})"));
        }

        return output.OrderBy(r => r.ComponentType == "Earning" ? 0 : 1)
                     .ToList();
    }

    private static string FormatFormula(TemplateComponent tc) => tc.CalculationType switch
    {
        "FixedAmount"        => $"Fixed ₹{tc.Value:N0}/month",
        "PercentOfCTC"       => $"{tc.Value:G29}% of Monthly CTC",
        "PercentOfComponent" => $"{tc.Value:G29}% of {tc.BaseComponentCode}",
        "Remainder"          => "Monthly CTC − other earnings",
        "Statutory"          => "Auto-computed (PF/ESI/PT)",
        _                    => ""
    };
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record SalaryComponentDto(
    int? Id,
    string ComponentName,
    string ComponentCode,
    string ComponentType,
    string? Category,
    bool IsEpfApplicable,
    bool IsEsiApplicable,
    bool IsTaxable,
    bool IsActive,
    int DisplayOrder
);

public record TemplateCreateDto(
    string? Name,
    string? Description,
    bool? IsActive
);

public record TemplateComponentDto(
    int ComponentId,
    string CalculationType,
    decimal? Value,
    string? BaseComponentCode,
    int DisplayOrder
);

public record EmployeeCTCDto(
    int EmployeeId,
    decimal AnnualCTC,
    int TemplateId,
    DateOnly EffectiveFrom,
    string? SalaryBasisOverride,
    string? Remarks
);

public record PreviewCTCDto(decimal AnnualCTC, int TemplateId);

public record CTCComponentResult(
    string ComponentCode,
    string ComponentName,
    string ComponentType,
    decimal Amount,
    string CalculationType,
    string Formula
);
