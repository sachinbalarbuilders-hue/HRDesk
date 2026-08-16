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
[Route("api/[controller]")]
[Authorize]
public class MastersController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;

    public MastersController(BiometricAttendanceDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    public record DepartmentDto(string DepartmentName, string? Status);
    public record DesignationDto(string DesignationName, string? Status);
    public record OrganizationDto(string Name, string? Code, string? Address, string? WhatsAppGroupId, double? Latitude, double? Longitude, double? RadiusMeters, bool IsActive);
    public record LeaveTypeDto(string Name, string Code, decimal DefaultYearlyQuota, bool IsPaid, bool ApplicableAfterProbation, bool AllowCarryForward, string Status);
    public record CompanyDto(
        string LegalName,
        string? TradeName,
        string? Code,
        string? Gstin,
        string? Cin,
        string? Pan,
        string? LogoUrl,
        string? Website,
        string? Email,
        string? Phone,
        string? HeadquartersAddress);

    [HttpGet("company")]
    public async Task<IActionResult> GetCompany()
    {
        var company = await _db.Companies.AsNoTracking().FirstOrDefaultAsync();
        if (company == null)
        {
            company = new Company
            {
                LegalName = "Sachin Balar Builders Pvt. Ltd.",
                TradeName = "Hue Builders",
                Code = "SBB",
                Gstin = "24AAAAA0000A1Z5",
                HeadquartersAddress = "Surat, Gujarat, India",
                Email = "contact@sachinbalar.com",
                Phone = "+91 98765 43210",
                IsActive = true,
                CreatedAt = DateTime.Now
            };
            _db.Companies.Add(company);
            await _db.SaveChangesAsync();
        }

        var branchCount = await _db.Organizations.CountAsync(b => b.IsActive);

        return Ok(new
        {
            id = company.Id,
            legalName = company.LegalName,
            tradeName = company.TradeName ?? company.LegalName,
            code = company.Code ?? "SBB",
            gstin = company.Gstin,
            cin = company.Cin,
            pan = company.Pan,
            logoUrl = company.LogoUrl,
            website = company.Website,
            email = company.Email,
            phone = company.Phone,
            headquartersAddress = company.HeadquartersAddress,
            isActive = company.IsActive,
            branchCount = branchCount
        });
    }

    [HttpPut("company")]
    public async Task<IActionResult> UpdateCompany([FromBody] CompanyDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
            return Forbid();

        var company = await _db.Companies.FirstOrDefaultAsync();
        if (company == null)
        {
            company = new Company();
            _db.Companies.Add(company);
        }

        company.LegalName = dto.LegalName;
        company.TradeName = dto.TradeName;
        company.Code = dto.Code;
        company.Gstin = dto.Gstin;
        company.Cin = dto.Cin;
        company.Pan = dto.Pan;
        company.LogoUrl = dto.LogoUrl;
        company.Website = dto.Website;
        company.Email = dto.Email;
        company.Phone = dto.Phone;
        company.HeadquartersAddress = dto.HeadquartersAddress;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Company profile updated successfully.", company });
    }

    public record BranchDto(
        int? OrganizationId,
        string Name,
        string? Code,
        string? Address,
        string? City,
        string? State,
        string? Pincode,
        double? Latitude,
        double? Longitude,
        double? RadiusMeters,
        string? WhatsAppGroupId,
        bool IsActive);

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var orgs = await _db.Organizations.AsNoTracking().ToListAsync();
        var branches = await _db.Branches.IgnoreQueryFilters().AsNoTracking().ToListAsync();
        var depts = await _db.Departments.AsNoTracking().ToListAsync();
        var desigs = await _db.Designations.AsNoTracking().ToListAsync();
        var leaveTypes = await _db.LeaveTypes.AsNoTracking().ToListAsync();
        var shifts = await _db.Shifts.AsNoTracking().ToListAsync();

        return Ok(new
        {
            organizations = orgs.Select(o => new
            {
                id = o.Id,
                name = o.Name,
                code = o.Code ?? (o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name),
                address = o.Address,
                whatsAppGroupId = o.WhatsAppGroupId,
                latitude = o.Latitude,
                longitude = o.Longitude,
                radiusMeters = o.RadiusMeters ?? 100,
                isActive = o.IsActive
            }),
            branches = branches.Select(b => new
            {
                id = b.Id,
                organizationId = b.OrganizationId,
                name = b.Name,
                code = b.Code ?? (b.Name.Length > 3 ? string.Concat(b.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : b.Name),
                address = b.Address,
                city = b.City,
                state = b.State,
                pincode = b.Pincode,
                latitude = b.Latitude,
                longitude = b.Longitude,
                radiusMeters = b.RadiusMeters ?? 100,
                whatsAppGroupId = b.WhatsAppGroupId,
                isActive = b.IsActive
            }),
            departments = depts.Select(d => new
            {
                id = d.Id,
                name = d.DepartmentName,
                status = d.Status ?? "active"
            }),
            designations = desigs.Select(d => new
            {
                id = d.Id,
                name = d.DesignationName,
                status = d.Status ?? "active"
            }),
            leaveTypes = leaveTypes.Select(l => new
            {
                id = l.Id,
                name = l.Name,
                code = l.Code,
                defaultDays = l.DefaultYearlyQuota,
                isPaid = l.IsPaid,
                applicableAfterProbation = l.ApplicableAfterProbation,
                allowCarryForward = l.AllowCarryForward,
                status = l.Status
            }),
            shifts = shifts.Select(s => new
            {
                id = s.Id,
                name = s.ShiftName,
                code = s.ShiftCode,
                startTime = s.StartTime.ToString("HH:mm"),
                endTime = s.EndTime.ToString("HH:mm"),
                colorCode = s.ColorCode
            })
        });
    }

    // ==========================================
    // DEPARTMENTS
    // ==========================================
    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] DepartmentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.DepartmentName)) return BadRequest(new { message = "Department name is required." });

        var orgId = 1;
        var orgClaim = User.FindFirst("OrganizationId")?.Value;
        if (int.TryParse(orgClaim, out var parsedOrg)) orgId = parsedOrg;

        var dept = new Department
        {
            DepartmentName = dto.DepartmentName.Trim(),
            Status = dto.Status ?? "active",
            OrganizationId = orgId
        };

        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Department created successfully.", id = dept.Id });
    }

    [HttpPut("departments/{id}")]
    public async Task<IActionResult> UpdateDepartment(int id, [FromBody] DepartmentDto dto)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept == null) return NotFound(new { message = "Department not found." });

        if (!string.IsNullOrWhiteSpace(dto.DepartmentName)) dept.DepartmentName = dto.DepartmentName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) dept.Status = dto.Status.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { message = "Department updated successfully.", id = dept.Id });
    }

    [HttpDelete("departments/{id}")]
    public async Task<IActionResult> DeleteDepartment(int id)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept == null) return NotFound(new { message = "Department not found." });

        _db.Departments.Remove(dept);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Department deleted successfully." });
    }

    // ==========================================
    // DESIGNATIONS
    // ==========================================
    [HttpPost("designations")]
    public async Task<IActionResult> CreateDesignation([FromBody] DesignationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.DesignationName)) return BadRequest(new { message = "Designation name is required." });

        var orgId = 1;
        var orgClaim = User.FindFirst("OrganizationId")?.Value;
        if (int.TryParse(orgClaim, out var parsedOrg)) orgId = parsedOrg;

        var desig = new Designation
        {
            DesignationName = dto.DesignationName.Trim(),
            Status = dto.Status ?? "active",
            OrganizationId = orgId
        };

        _db.Designations.Add(desig);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Designation created successfully.", id = desig.Id });
    }

    [HttpPut("designations/{id}")]
    public async Task<IActionResult> UpdateDesignation(int id, [FromBody] DesignationDto dto)
    {
        var desig = await _db.Designations.FindAsync(id);
        if (desig == null) return NotFound(new { message = "Designation not found." });

        if (!string.IsNullOrWhiteSpace(dto.DesignationName)) desig.DesignationName = dto.DesignationName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) desig.Status = dto.Status.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { message = "Designation updated successfully.", id = desig.Id });
    }

    [HttpDelete("designations/{id}")]
    public async Task<IActionResult> DeleteDesignation(int id)
    {
        var desig = await _db.Designations.FindAsync(id);
        if (desig == null) return NotFound(new { message = "Designation not found." });

        _db.Designations.Remove(desig);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Designation deleted successfully." });
    }

    // ==========================================
    // ORGANIZATIONS
    // ==========================================
    [HttpGet("organizations")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOrganizations()
    {
        var rawOrgs = await _db.Organizations
            .AsNoTracking()
            .Where(o => o.IsActive)
            .OrderBy(o => o.Id)
            .ToListAsync();

        var orgs = rawOrgs.Select(o => new
        {
            id = o.Id.ToString(),
            name = o.Name,
            code = o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name,
            address = o.Address,
            whatsAppGroupId = o.WhatsAppGroupId,
            isActive = o.IsActive
        }).ToList();

        return Ok(orgs);
    }

    [HttpPost("organizations")]
    public async Task<IActionResult> CreateOrganization([FromBody] OrganizationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Branch / Organization name is required." });

        var defaultCompany = await _db.Companies.FirstOrDefaultAsync();

        var org = new Organization
        {
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim(),
            Address = dto.Address?.Trim(),
            WhatsAppGroupId = dto.WhatsAppGroupId?.Trim(),
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            RadiusMeters = dto.RadiusMeters ?? 100,
            CompanyId = defaultCompany?.Id,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.Now
        };

        _db.Organizations.Add(org);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Branch created successfully.", id = org.Id });
    }

    [HttpPut("organizations/{id}")]
    public async Task<IActionResult> UpdateOrganization(int id, [FromBody] OrganizationDto dto)
    {
        var org = await _db.Organizations.FindAsync(id);
        if (org == null) return NotFound(new { message = "Branch not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) org.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) org.Code = dto.Code.Trim();
        org.Address = dto.Address?.Trim();
        org.WhatsAppGroupId = dto.WhatsAppGroupId?.Trim();
        org.Latitude = dto.Latitude;
        org.Longitude = dto.Longitude;
        org.RadiusMeters = dto.RadiusMeters ?? 100;
        org.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Organization updated successfully.", id = org.Id });
    }

    // ==========================================
    // BRANCHES MASTER
    // ==========================================
    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches()
    {
        var branches = await _db.Branches
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderBy(b => b.Id)
            .ToListAsync();

        return Ok(branches.Select(b => new
        {
            id = b.Id,
            organizationId = b.OrganizationId,
            name = b.Name,
            code = b.Code ?? (b.Name.Length > 3 ? string.Concat(b.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : b.Name),
            address = b.Address,
            city = b.City,
            state = b.State,
            pincode = b.Pincode,
            latitude = b.Latitude,
            longitude = b.Longitude,
            radiusMeters = b.RadiusMeters ?? 100,
            whatsAppGroupId = b.WhatsAppGroupId,
            isActive = b.IsActive,
            createdAt = b.CreatedAt
        }));
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] BranchDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Branch name is required." });

        _db.BypassTenantId = true;
        var defaultOrg = await _db.Organizations.FirstOrDefaultAsync();
        var branch = new Branch
        {
            OrganizationId = (dto.OrganizationId.HasValue && dto.OrganizationId.Value > 0)
                ? dto.OrganizationId.Value
                : (defaultOrg?.Id ?? 1),
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim(),
            Address = dto.Address?.Trim(),
            City = dto.City?.Trim(),
            State = dto.State?.Trim(),
            Pincode = dto.Pincode?.Trim(),
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            RadiusMeters = dto.RadiusMeters ?? 100,
            WhatsAppGroupId = dto.WhatsAppGroupId?.Trim(),
            IsActive = dto.IsActive,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.Branches.Add(branch);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Branch created successfully.", id = branch.Id });
    }

    [HttpPut("branches/{id}")]
    public async Task<IActionResult> UpdateBranch(int id, [FromBody] BranchDto dto)
    {
        _db.BypassTenantId = true;
        var branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == id);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        if (dto.OrganizationId.HasValue && dto.OrganizationId.Value > 0)
        {
            branch.OrganizationId = dto.OrganizationId.Value;
        }
        if (!string.IsNullOrWhiteSpace(dto.Name)) branch.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) branch.Code = dto.Code.Trim();
        branch.Address = dto.Address?.Trim();
        branch.City = dto.City?.Trim();
        branch.State = dto.State?.Trim();
        branch.Pincode = dto.Pincode?.Trim();
        branch.Latitude = dto.Latitude;
        branch.Longitude = dto.Longitude;
        branch.RadiusMeters = dto.RadiusMeters ?? 100;
        branch.WhatsAppGroupId = dto.WhatsAppGroupId?.Trim();
        branch.IsActive = dto.IsActive;
        branch.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Branch updated successfully.", id = branch.Id });
    }

    [HttpDelete("branches/{id}")]
    public async Task<IActionResult> DeleteBranch(int id)
    {
        _db.BypassTenantId = true;
        var branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == id);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        _db.Branches.Remove(branch);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Branch deleted successfully." });
    }
}
