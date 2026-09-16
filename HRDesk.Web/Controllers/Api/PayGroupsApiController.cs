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
[Route("api/pay-groups")]
[Authorize]
public class PayGroupsApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public PayGroupsApiController(
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

    // ── GET all ──────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string archiveStatus = "active")
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }

        var query = _db.PayGroups
            .AsNoTracking()
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(g => g.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(g => g.ArchivedAt == null);

        var groups = await query
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.Description,
                g.SalaryBasis,
                g.PfApplicable,
                g.CapEmployeePf,
                g.CapEmployerPf,
                g.PfWageCeiling,
                g.EsiApplicable,
                g.PtApplicable,
                g.PtState,
                TemplateId = (int?)null,
                TemplateName = (string?)null,
                g.IsActive,
                archivedAt = g.ArchivedAt,
                employeeCount = _db.Employees.Count(e => e.PayGroupId == g.Id),
                componentCount = g.Components.Count,
                components = g.Components.OrderBy(c => c.DisplayOrder).Select(c => new
                {
                    c.Id,
                    c.ComponentId,
                    componentName = c.Component != null ? c.Component.ComponentName : "",
                    componentCode = c.Component != null ? c.Component.ComponentCode : "",
                    componentType = c.Component != null ? c.Component.ComponentType : "",
                    c.CalculationType,
                    c.Value,
                    c.BaseComponentCode,
                    c.DisplayOrder
                }).ToList()
            })
            .ToListAsync();

        return Ok(groups);
    }

    // ── GET single ───────────────────────────────────────────────────────────

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var g = await _db.PayGroups
            .AsNoTracking()
            .Include(pg => pg.Components.OrderBy(c => c.DisplayOrder))
                .ThenInclude(c => c.Component)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (g == null) return NotFound(new { message = "Pay group not found." });

        return Ok(new
        {
            g.Id, g.Name, g.Description, g.SalaryBasis, g.LopRounding,
            g.PfApplicable, g.CapEmployeePf, g.CapEmployerPf, g.PfWageCeiling, g.EsiApplicable, g.PtApplicable, g.PtState,
            TemplateId = (int?)null, TemplateName = (string?)null,
            g.IsActive,
            components = g.Components.Select(c => new
            {
                c.Id,
                c.ComponentId,
                componentName = c.Component?.ComponentName ?? "",
                componentCode = c.Component?.ComponentCode ?? "",
                componentType = c.Component?.ComponentType ?? "",
                c.CalculationType,
                c.Value,
                c.BaseComponentCode,
                c.DisplayOrder
            }).ToList()
        });
    }

    // ── POST create ──────────────────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PayGroupDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Name is required." });

        var group = new PayGroup
        {
            Name            = dto.Name.Trim(),
            Description     = dto.Description?.Trim(),
            SalaryBasis     = dto.SalaryBasis ?? "CalendarDays",
            LopRounding     = dto.LopRounding ?? "None",
            PfApplicable    = dto.PfApplicable,
            CapEmployeePf   = dto.CapEmployeePf,
            CapEmployerPf   = dto.CapEmployerPf,
            PfWageCeiling   = dto.PfWageCeiling ?? 15000m,
            EsiApplicable   = dto.EsiApplicable,
            PtApplicable    = dto.PtApplicable,
            PtState         = dto.PtState?.Trim(),
            IsActive        = true,
            OrganizationId  = _tenantProvider.TenantId
        };

        if (dto.Components != null && dto.Components.Any())
        {
            var componentIds = dto.Components.Select(c => c.ComponentId).Distinct().ToList();
            var salaryComponents = await _db.SalaryComponents
                .Where(sc => componentIds.Contains(sc.Id))
                .ToDictionaryAsync(sc => sc.Id);

            int order = 1;
            foreach (var item in dto.Components)
            {
                if (!salaryComponents.TryGetValue(item.ComponentId, out var sc))
                    continue;

                group.Components.Add(new PayGroupComponent
                {
                    ComponentId = item.ComponentId,
                    CalculationType = !string.IsNullOrWhiteSpace(item.CalculationType) ? item.CalculationType : sc.CalculationType ?? "FixedAmount",
                    Value = item.Value ?? sc.DefaultValue,
                    BaseComponentCode = item.BaseComponentCode ?? sc.BaseComponentCode,
                    DisplayOrder = item.DisplayOrder > 0 ? item.DisplayOrder : order++,
                    OrganizationId = _tenantProvider.TenantId
                });
            }

            var codes = salaryComponents.Values.Select(sc => sc.ComponentCode.ToUpper()).ToHashSet();
            group.PfApplicable = codes.Any(c => c.Contains("PF"));
            group.EsiApplicable = codes.Any(c => c.Contains("ESI"));
            group.PtApplicable = codes.Any(c => c == "PT" || c.Contains("PROFESSIONAL_TAX"));
        }

        _db.PayGroups.Add(group);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Pay group created.", id = group.Id });
    }

    // ── PUT update ───────────────────────────────────────────────────────────

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] PayGroupDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var group = await _db.PayGroups
            .Include(g => g.Components)
            .FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { message = "Pay group not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name))     group.Name         = dto.Name.Trim();
        if (dto.Description != null)                 group.Description  = dto.Description.Trim();
        group.SalaryBasis = dto.SalaryBasis ?? "CalendarDays";
        group.LopRounding = dto.LopRounding ?? "None";
        group.PfApplicable = dto.PfApplicable;
        group.CapEmployeePf = dto.CapEmployeePf;
        group.CapEmployerPf = dto.CapEmployerPf;
        if (dto.PfWageCeiling.HasValue) group.PfWageCeiling = dto.PfWageCeiling.Value;
        group.EsiApplicable = dto.EsiApplicable;
        group.PtApplicable = dto.PtApplicable;
        if (dto.PtState != null) group.PtState = dto.PtState.Trim();
        if (dto.IsActive.HasValue) group.IsActive = dto.IsActive.Value;

        if (dto.Components != null)
        {
            _db.PayGroupComponents.RemoveRange(group.Components);
            group.Components.Clear();

            var componentIds = dto.Components.Select(c => c.ComponentId).Distinct().ToList();
            var salaryComponents = await _db.SalaryComponents
                .Where(sc => componentIds.Contains(sc.Id))
                .ToDictionaryAsync(sc => sc.Id);

            int order = 1;
            foreach (var item in dto.Components)
            {
                if (!salaryComponents.TryGetValue(item.ComponentId, out var sc))
                    continue;

                group.Components.Add(new PayGroupComponent
                {
                    PayGroupId = group.Id,
                    ComponentId = item.ComponentId,
                    CalculationType = !string.IsNullOrWhiteSpace(item.CalculationType) ? item.CalculationType : sc.CalculationType ?? "FixedAmount",
                    Value = item.Value ?? sc.DefaultValue,
                    BaseComponentCode = item.BaseComponentCode ?? sc.BaseComponentCode,
                    DisplayOrder = item.DisplayOrder > 0 ? item.DisplayOrder : order++,
                    OrganizationId = _tenantProvider.TenantId
                });
            }

            var codes = salaryComponents.Values.Select(sc => sc.ComponentCode.ToUpper()).ToHashSet();
            group.PfApplicable = codes.Any(c => c.Contains("PF"));
            group.EsiApplicable = codes.Any(c => c.Contains("ESI"));
            group.PtApplicable = codes.Any(c => c == "PT" || c.Contains("PROFESSIONAL_TAX"));
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Pay group updated." });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// Archiving is always allowed; permanent deletion is blocked while employees are assigned.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<PayGroup>(id));

        var assignedCount = await _db.Employees.CountAsync(e => e.PayGroupId == id);
        string? Guard(PayGroup _) => assignedCount > 0
            ? $"Cannot permanently delete: {assignedCount} employee(s) are still assigned to this pay group."
            : null;

        return FromArchive(await _archive.PermanentDeleteAsync<PayGroup>(id, Guard));
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        return FromArchive(await _archive.RestoreAsync<PayGroup>(id));
    }

    // ── GET employees in this group ──────────────────────────────────────────

    [HttpGet("{id:int}/employees")]
    public async Task<IActionResult> GetEmployees(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var employees = await _db.Employees
            .AsNoTracking()
            .Where(e => e.PayGroupId == id)
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                department = e.Department != null ? e.Department.DepartmentName : null,
                designation = e.Designation != null ? e.Designation.DesignationName : null,
                photoPath = e.PhotoPath
            })
            .ToListAsync();

        return Ok(employees);
    }

    // ── POST assign employee to group ─────────────────────────────────────────

    [HttpPost("{id:int}/assign")]
    public async Task<IActionResult> AssignEmployees(int id, [FromBody] AssignEmployeesDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (dto.EmployeeIds == null || !dto.EmployeeIds.Any())
            return BadRequest(new { message = "No employee IDs provided." });

        var employees = await _db.Employees
            .Where(e => dto.EmployeeIds.Contains(e.EmployeeId))
            .ToListAsync();

        foreach (var emp in employees)
            emp.PayGroupId = id;

        await _db.SaveChangesAsync();
        return Ok(new { message = $"{employees.Count} employee(s) assigned to pay group." });
    }

    // ── POST unassign employees ───────────────────────────────────────────────

    [HttpPost("unassign")]
    public async Task<IActionResult> UnassignEmployees([FromBody] AssignEmployeesDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (dto.EmployeeIds == null || !dto.EmployeeIds.Any())
            return BadRequest(new { message = "No employee IDs provided." });

        var employees = await _db.Employees
            .Where(e => dto.EmployeeIds.Contains(e.EmployeeId))
            .ToListAsync();

        foreach (var emp in employees)
            emp.PayGroupId = null;

        await _db.SaveChangesAsync();
        return Ok(new { message = $"{employees.Count} employee(s) removed from pay group." });
    }

    // ── GET PT slabs ──────────────────────────────────────────────────────────

    [HttpGet("pt-slabs")]
    public async Task<IActionResult> GetPtSlabs([FromQuery] string? state = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var query = _db.ProfessionalTaxSlabs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(state))
            query = query.Where(s => s.State == state);

        var slabs = await query
            .OrderBy(s => s.State)
            .ThenBy(s => s.MinGross)
            .Select(s => new
            {
                s.Id, s.State, s.MinGross, s.MaxGross,
                s.MonthlyPt, s.IsFebruary, s.EffectiveFrom, s.EffectiveTo
            })
            .ToListAsync();

        return Ok(slabs);
    }

    // ── POST upsert PT slab ───────────────────────────────────────────────────

    [HttpPost("pt-slabs")]
    public async Task<IActionResult> UpsertPtSlab([FromBody] PtSlabDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        ProfessionalTaxSlab slab;
        if (dto.Id.HasValue && dto.Id.Value > 0)
        {
            slab = await _db.ProfessionalTaxSlabs.FirstOrDefaultAsync(s => s.Id == dto.Id.Value)
                   ?? new ProfessionalTaxSlab { OrganizationId = _tenantProvider.TenantId };
        }
        else
        {
            slab = new ProfessionalTaxSlab { OrganizationId = _tenantProvider.TenantId };
            _db.ProfessionalTaxSlabs.Add(slab);
        }

        slab.State         = dto.State.Trim();
        slab.MinGross      = dto.MinGross;
        slab.MaxGross      = dto.MaxGross;
        slab.MonthlyPt     = dto.MonthlyPt;
        slab.IsFebruary    = dto.IsFebruary;
        slab.EffectiveFrom = dto.EffectiveFrom;
        slab.EffectiveTo   = dto.EffectiveTo;

        await _db.SaveChangesAsync();
        return Ok(new { message = "PT slab saved.", id = slab.Id });
    }

    [HttpPost("pt-slabs/{id:int}/restore")]
    public async Task<IActionResult> RestorePtSlab(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        return FromArchive(await _archive.RestoreAsync<ProfessionalTaxSlab>(id));
    }

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// </summary>
    [HttpDelete("pt-slabs/{id:int}")]
    public async Task<IActionResult> DeletePtSlab(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var result = permanent
            ? await _archive.PermanentDeleteAsync<ProfessionalTaxSlab>(id)
            : await _archive.ArchiveAsync<ProfessionalTaxSlab>(id);

        return FromArchive(result);
    }

    // ── Employee CTC Assignments ─────────────────────────────────────────────

    [HttpGet("employee-ctc/{employeeId:int}")]
    public async Task<IActionResult> GetEmployeeCTC(int employeeId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesViewSalary))
            return Forbid();

        var emp = await _db.Employees
            .AsNoTracking()
            .Include(e => e.PayGroup)
            .FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

        var records = await _db.EmployeeCTCs
            .AsNoTracking()
            .Include(ec => ec.PayGroup)
            .Where(ec => ec.EmployeeId == employeeId)
            .OrderByDescending(ec => ec.EffectiveFrom)
            .Select(ec => new
            {
                ec.Id,
                ec.AnnualCTC,
                monthlyCTC = ec.AnnualCTC / 12,
                payGroupId = ec.PayGroupId,
                payGroupName = ec.PayGroup != null ? ec.PayGroup.Name : null,
                ec.SalaryBasisOverride,
                ec.EffectiveFrom,
                ec.EffectiveTo,
                ec.Remarks
            })
            .ToListAsync();

        return Ok(new
        {
            assignedPayGroupId = emp?.PayGroupId,
            assignedPayGroupName = emp?.PayGroup?.Name,
            records
        });
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
            PayGroupId          = dto.PayGroupId,
            SalaryBasisOverride = dto.SalaryBasisOverride,
            EffectiveFrom       = dto.EffectiveFrom,
            EffectiveTo         = null,
            Remarks             = dto.Remarks,
            OrganizationId      = _tenantProvider.TenantId
        });

        // Ensure employees.pay_group_id stays synchronized
        var emp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == dto.EmployeeId);
        if (emp != null)
        {
            emp.PayGroupId = dto.PayGroupId;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "CTC saved successfully." });
    }

    /// <summary>
    /// Preview: given a CTC and pay group, compute all monthly component amounts
    /// WITHOUT saving anything. Used by the frontend to show a live breakdown.
    /// </summary>
    [HttpPost("preview-ctc")]
    public async Task<IActionResult> PreviewCTC([FromBody] PreviewCTCDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        if (dto.AnnualCTC <= 0 || dto.PayGroupId <= 0)
            return BadRequest(new { message = "AnnualCTC and PayGroupId are required." });

        var payGroup = await _db.PayGroups
            .AsNoTracking()
            .Include(t => t.Components.OrderBy(c => c.DisplayOrder))
                .ThenInclude(tc => tc.Component)
            .FirstOrDefaultAsync(t => t.Id == dto.PayGroupId);

        if (payGroup == null) return NotFound(new { message = "Pay group not found." });

        var breakdown = ComputeCTCBreakdown(dto.AnnualCTC, payGroup.Components.ToList());

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
        List<PayGroupComponent> components)
    {
        var monthly  = annualCTC / 12m;
        var results  = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var output   = new List<CTCComponentResult>();

        // Pass 1: compute everything except Remainder and Statutory
        decimal earningsTotal = 0m;
        PayGroupComponent? remainderRow = null;

        foreach (var tc in components.Where(c => c.Component != null))
        {
            var code = tc.Component!.ComponentCode;
            var calcType = !string.IsNullOrWhiteSpace(tc.Component.CalculationType) ? tc.Component.CalculationType : tc.CalculationType;
            var val = tc.Component.DefaultValue ?? tc.Value ?? 0m;
            var baseCode = !string.IsNullOrWhiteSpace(tc.Component.BaseComponentCode) ? tc.Component.BaseComponentCode : tc.BaseComponentCode;

            if (calcType == "Remainder")
            {
                remainderRow = tc;
                continue;
            }
            if (calcType == "Statutory")
            {
                // Statutory amounts are computed later by the payroll engine.
                // Preview shows 0 as a placeholder.
                results[code] = 0m;
                output.Add(new CTCComponentResult(
                    code, tc.Component.ComponentName, tc.Component.ComponentType,
                    0m, calcType, "Auto-computed at payroll time"));
                continue;
            }

            decimal amount = calcType switch
            {
                "FixedAmount"        => val,
                "PercentOfCTC"       => Math.Round(monthly * val / 100m, 2),
                "PercentOfComponent" => results.TryGetValue(baseCode ?? "", out var base_)
                                        ? Math.Round(base_ * val / 100m, 2)
                                        : 0m,
                _                    => 0m
            };

            results[code] = amount;
            if (tc.Component.ComponentType == "Earning") earningsTotal += amount;

            output.Add(new CTCComponentResult(
                code, tc.Component.ComponentName, tc.Component.ComponentType,
                amount, calcType,
                FormatFormula(calcType, val, baseCode)));
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

    private static string FormatFormula(string calcType, decimal val, string? baseCode) => calcType switch
    {
        "FixedAmount"        => $"Fixed \u20b9{val:N0}/month",
        "PercentOfCTC"       => $"{val:G29}% of Monthly CTC",
        "PercentOfComponent" => $"{val:G29}% of {baseCode}",
        "Remainder"          => "Monthly CTC − other earnings",
        "Statutory"          => "Auto-computed (PF/ESI/PT)",
        _                    => ""
    };
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record PayGroupComponentItemDto(
    int ComponentId,
    string? CalculationType,
    decimal? Value,
    string? BaseComponentCode,
    int DisplayOrder
);

public record PayGroupDto(
    string? Name,
    string? Description,
    string? SalaryBasis,
    string? LopRounding,
    bool PfApplicable = true,
    bool CapEmployeePf = true,
    bool CapEmployerPf = true,
    decimal? PfWageCeiling = 15000m,
    bool EsiApplicable = true,
    bool PtApplicable = true,
    string? PtState = null,
    int? TemplateId = null,
    bool? IsActive = null,
    List<PayGroupComponentItemDto>? Components = null
);

public record AssignEmployeesDto(List<int> EmployeeIds);

public record PtSlabDto(
    int? Id,
    string State,
    decimal MinGross,
    decimal? MaxGross,
    decimal MonthlyPt,
    bool IsFebruary,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo
);

public record EmployeeCTCDto(
    int EmployeeId,
    decimal AnnualCTC,
    int PayGroupId,
    string? SalaryBasisOverride,
    DateOnly EffectiveFrom,
    string? Remarks
);

public record PreviewCTCDto(decimal AnnualCTC, int PayGroupId);

public record CTCComponentResult(
    string ComponentCode,
    string ComponentName,
    string ComponentType,
    decimal Amount,
    string CalculationType,
    string Formula
);

