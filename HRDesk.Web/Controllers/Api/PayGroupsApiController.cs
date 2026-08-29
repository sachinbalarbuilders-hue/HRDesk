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
            .Include(g => g.Template)
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
                g.LopRounding,
                g.PfApplicable,
                g.EsiApplicable,
                g.PtApplicable,
                g.PtState,
                g.TemplateId,
                TemplateName = g.Template != null ? g.Template.Name : null,
                g.IsActive,
                archivedAt = g.ArchivedAt,
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
