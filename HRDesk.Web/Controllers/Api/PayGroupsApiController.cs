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

    public PayGroupsApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    // ── GET all ──────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var groups = await _db.PayGroups
            .AsNoTracking()
            .Include(g => g.Template)
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.Description,
                g.SalaryBasis,
                g.LopRounding,
                g.PfApplicable,
                g.EsiApplicable,
                g.PtApplicable,
                g.PtState,
                g.TemplateId,
                TemplateName = g.Template != null ? g.Template.Name : null,
                g.IsActive,
                employeeCount = _db.Employees.Count(e => e.PayGroupId == g.Id)
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
            .Include(g => g.Template)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (g == null) return NotFound(new { message = "Pay group not found." });

        return Ok(new
        {
            g.Id, g.Name, g.Description, g.SalaryBasis, g.LopRounding,
            g.PfApplicable, g.EsiApplicable, g.PtApplicable, g.PtState,
            g.TemplateId, TemplateName = g.Template?.Name,
            g.IsActive
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
            EsiApplicable   = dto.EsiApplicable,
            PtApplicable    = dto.PtApplicable,
            PtState         = dto.PtState?.Trim(),
            TemplateId      = dto.TemplateId,
            IsActive        = true,
            OrganizationId  = _tenantProvider.TenantId
        };

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

        var group = await _db.PayGroups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { message = "Pay group not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name))     group.Name         = dto.Name.Trim();
        if (dto.Description != null)                   group.Description  = dto.Description.Trim();
        if (!string.IsNullOrWhiteSpace(dto.SalaryBasis)) group.SalaryBasis = dto.SalaryBasis;
        if (!string.IsNullOrWhiteSpace(dto.LopRounding)) group.LopRounding = dto.LopRounding;
        group.PfApplicable  = dto.PfApplicable;
        group.EsiApplicable = dto.EsiApplicable;
        group.PtApplicable  = dto.PtApplicable;
        if (dto.PtState != null) group.PtState = dto.PtState.Trim();
        if (dto.TemplateId.HasValue) group.TemplateId = dto.TemplateId;
        if (dto.IsActive.HasValue) group.IsActive = dto.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Pay group updated." });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var group = await _db.PayGroups.FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound(new { message = "Pay group not found." });

        // Don't hard-delete if employees are assigned — deactivate instead
        var hasEmployees = await _db.Employees.AnyAsync(e => e.PayGroupId == id);
        if (hasEmployees)
        {
            group.IsActive = false;
            await _db.SaveChangesAsync();
            return Ok(new { message = "Pay group deactivated (employees still assigned)." });
        }

        _db.PayGroups.Remove(group);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Pay group deleted." });
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
                designation = e.Designation != null ? e.Designation.DesignationName : null
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

    [HttpDelete("pt-slabs/{id:int}")]
    public async Task<IActionResult> DeletePtSlab(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var slab = await _db.ProfessionalTaxSlabs.FirstOrDefaultAsync(s => s.Id == id);
        if (slab == null) return NotFound();
        _db.ProfessionalTaxSlabs.Remove(slab);
        await _db.SaveChangesAsync();
        return Ok(new { message = "PT slab deleted." });
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record PayGroupDto(
    string? Name,
    string? Description,
    string? SalaryBasis,
    string? LopRounding,
    bool PfApplicable = true,
    bool EsiApplicable = true,
    bool PtApplicable = true,
    string? PtState = null,
    int? TemplateId = null,
    bool? IsActive = null
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
