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

    public SalaryTemplatesApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    // ── Salary Components master list ────────────────────────────────────────

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var comps = await _db.SalaryComponents
            .AsNoTracking()
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.ComponentName)
            .Select(c => new
            {
                c.Id, c.ComponentName, c.ComponentCode, c.ComponentType,
                c.Category, c.IsEpfApplicable, c.IsEsiApplicable, c.IsTaxable,
                c.IsActive, c.DisplayOrder
            })
            .ToListAsync();

        return Ok(comps);
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
    public async Task<IActionResult> GetAll()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var templates = await _db.SalaryStructureTemplates
            .AsNoTracking()
            .Include(t => t.Components)
                .ThenInclude(tc => tc.Component)
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .Select(t => new
            {
                t.Id, t.Name, t.Description, t.IsDefault, t.IsActive,
                componentCount = t.Components.Count
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

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var template = await _db.SalaryStructureTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template == null) return NotFound();

        if (template.IsDefault)
            return BadRequest(new { message = "Cannot delete the default template." });

        // Deactivate if in use
        var inUse = await _db.PayGroups.AnyAsync(g => g.TemplateId == id)
                 || await _db.EmployeeCTCs.AnyAsync(c => c.TemplateId == id);
        if (inUse)
        {
            template.IsActive = false;
            await _db.SaveChangesAsync();
            return Ok(new { message = "Template deactivated (in use by pay groups or employees)." });
        }

        _db.SalaryStructureTemplates.Remove(template);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Template deleted." });
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
        "PercentOfCTC"       => $"{tc.Value}% of Monthly CTC",
        "PercentOfComponent" => $"{tc.Value}% of {tc.BaseComponentCode}",
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
