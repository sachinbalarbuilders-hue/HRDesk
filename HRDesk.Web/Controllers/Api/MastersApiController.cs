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
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IReferenceDataCacheService _cacheService;
    private readonly IPlanEntitlementService _entitlementService;

    public MastersController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IReferenceDataCacheService cacheService,
        IPlanEntitlementService entitlementService)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _cacheService = cacheService;
        _entitlementService = entitlementService;
    }

    public record DepartmentDto(string DepartmentName, string? Status, int? BranchId = null);
    public record DesignationDto(string DesignationName, string? Status, int? BranchId = null);
    public record OrganizationDto(string Name, string? Code, string? Address, string? WhatsAppGroupId, double? Latitude, double? Longitude, double? RadiusMeters, bool IsActive, string? LogoUrl = null, string? PrimaryColor = null, string? CustomDomain = null);
    public record LeaveTypeDto(string Name, string Code, decimal DefaultYearlyQuota, bool IsPaid, bool ApplicableAfterProbation, bool AllowCarryForward, string GenderApplicability, string MaritalStatusApplicability, string DepartmentIds, string DesignationIds, string RoleIds, string Status, int? BranchId = null);
    public record ShiftDto(string Name, string? Code, string StartTime, string EndTime, string? LunchBreakStart, string? LunchBreakEnd, int? BreakMinutes, int? LateComingGraceMinutes, int? EarlyLeaveGraceMinutes, string? ColorCode, string? HalfTime = null, int? BranchId = null);
    public record AttendancePolicyDto(int GracePeriodMinutes, decimal HalfDayThresholdHours, decimal FullDayThresholdHours, int AutoSyncIntervalMinutes, string DefaultWeekoff, bool SandwichRuleEnabled = true, int? BranchId = null);
    public record CompanyPolicyDto(
        int OrganizationId,
        int YearStartMonth = 11,
        int YearEndMonth = 10,
        int AdvanceNoticeDays = 2,
        int MaxConsecutiveLeaves = 14,
        bool SandwichRuleEnabled = true,
        int DefaultProbationDays = 90);
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
        var userOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == userOrgId);

        var company = await _db.Companies.AsNoTracking().FirstOrDefaultAsync();
        var legalName = org != null ? org.Name : (company?.LegalName ?? "Company");
        var tradeName = org != null ? org.Name : (company?.TradeName ?? legalName);
        var code = org?.Code ?? company?.Code ?? "ORG";
        var address = org?.Address ?? company?.HeadquartersAddress ?? "";
        var logoUrl = org?.LogoUrl ?? company?.LogoUrl;
        var email = company?.Email;
        var phone = company?.Phone;
        var branchCount = await _db.Branches.CountAsync(b => b.OrganizationId == userOrgId && b.IsActive);

        return Ok(new
        {
            id = company?.Id ?? (org?.Id ?? 1),
            legalName,
            tradeName,
            code,
            gstin = company?.Gstin,
            cin = company?.Cin,
            pan = company?.Pan,
            logoUrl,
            website = company?.Website,
            email,
            phone,
            headquartersAddress = address,
            isActive = org?.IsActive ?? true,
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
        string? AllowedIPs,
        bool IsActive,
        string? OutsideAttendancePolicy = "Block");

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);
        var userOrgId = _tenantProvider.TenantId;

        var orgQuery = _db.Organizations.AsNoTracking().Where(o => o.IsActive);
        var branchQuery = _db.Branches.AsNoTracking().Where(b => b.IsActive);

        if (!isSuperAdmin && userOrgId > 0)
        {
            orgQuery = orgQuery.Where(o => o.Id == userOrgId);
            branchQuery = branchQuery.Where(b => b.OrganizationId == userOrgId);
        }

        var orgs = await orgQuery.ToListAsync();
        var branches = await branchQuery.ToListAsync();

        var deptQuery = _db.Departments.Include(d => d.Branch).AsNoTracking().AsQueryable();
        var desigQuery = _db.Designations.Include(d => d.Branch).AsNoTracking().AsQueryable();
        var leaveQuery = _db.LeaveTypes.Include(l => l.Branch).AsNoTracking().AsQueryable();
        var shiftQuery = _db.Shifts.Include(s => s.Branch).AsNoTracking().AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            deptQuery = deptQuery.Where(d => d.BranchId == activeBranch.Value);
            desigQuery = desigQuery.Where(d => d.BranchId == activeBranch.Value);
            leaveQuery = leaveQuery.Where(l => l.BranchId == activeBranch.Value);
            shiftQuery = shiftQuery.Where(s => s.BranchId == activeBranch.Value);
        }

        var depts = await deptQuery.ToListAsync();
        var desigs = await desigQuery.ToListAsync();
        var leaveTypes = await leaveQuery.ToListAsync();
        var shifts = await shiftQuery.ToListAsync();

        return Ok(new
        {
            organizations = orgs.Select(o => new
            {
                id = o.Id,
                publicId = o.PublicId,
                name = o.Name,
                code = o.Code ?? (o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name),
                address = o.Address,
                whatsAppGroupId = o.WhatsAppGroupId,
                latitude = o.Latitude,
                longitude = o.Longitude,
                radiusMeters = o.RadiusMeters ?? 100,
                logoUrl = o.LogoUrl,
                primaryColor = o.PrimaryColor ?? "#D97706",
                customDomain = o.CustomDomain,
                isActive = o.IsActive
            }),
            branches = branches.Select(b => new
            {
                id = b.Id,
                publicId = b.PublicId,
                organizationId = b.OrganizationId,
                name = b.Name,
                code = b.Code ?? "",
                address = b.Address,
                city = b.City,
                state = b.State,
                pincode = b.Pincode,
                latitude = b.Latitude,
                longitude = b.Longitude,
                radiusMeters = b.RadiusMeters ?? 100,
                whatsAppGroupId = b.WhatsAppGroupId,
                allowedIPs = b.AllowedIPs,
                outsideAttendancePolicy = b.OutsideAttendancePolicy,
                isActive = b.IsActive
            }),
            departments = depts.Select(d => new
            {
                id = d.Id,
                name = d.DepartmentName,
                status = d.Status ?? "active",
                branchId = d.BranchId,
                branchName = d.Branch != null ? d.Branch.Name : null
            }),
            designations = desigs.Select(d => new
            {
                id = d.Id,
                name = d.DesignationName,
                status = d.Status ?? "active",
                branchId = d.BranchId,
                branchName = d.Branch != null ? d.Branch.Name : null
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
                genderApplicability = l.GenderApplicability,
                maritalStatusApplicability = l.MaritalStatusApplicability,
                departmentIds = l.DepartmentIds,
                designationIds = l.DesignationIds,
                roleIds = l.RoleIds,
                status = l.Status,
                branchId = l.BranchId,
                branchName = l.Branch != null ? l.Branch.Name : null
            }),
            shifts = shifts.Select(s => new
            {
                id = s.Id,
                name = s.ShiftName,
                code = s.ShiftCode,
                startTime = s.StartTime.ToString("HH:mm"),
                endTime = s.EndTime.ToString("HH:mm"),
                lunchStart = s.LunchBreakStart.HasValue ? s.LunchBreakStart.Value.ToString("HH:mm") : null,
                lunchEnd = s.LunchBreakEnd.HasValue ? s.LunchBreakEnd.Value.ToString("HH:mm") : null,
                breakMinutes = s.LunchBreakDuration,
                lateGrace = s.LateComingGraceMinutes ?? 15,
                earlyLeaveGrace = s.EarlyLeaveGraceMinutes ?? 15,
                halfTime = s.HalfTime.HasValue ? s.HalfTime.Value.ToString("HH:mm") : null,
                workingHours = s.WorkingHours,
                colorCode = s.ColorCode ?? "#4e73df",
                branchId = s.BranchId,
                branchName = s.Branch != null ? s.Branch.Name : null
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

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var dept = new Department
        {
            DepartmentName = dto.DepartmentName.Trim(),
            Status = dto.Status ?? "active",
            OrganizationId = orgId,
            BranchId = targetBranch
        };

        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();
        _cacheService.EvictDepartmentsCache();

        return Ok(new { message = "Department created successfully.", id = dept.Id });
    }

    [HttpPut("departments/{id}")]
    public async Task<IActionResult> UpdateDepartment(int id, [FromBody] DepartmentDto dto)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept == null) return NotFound(new { message = "Department not found." });

        if (!string.IsNullOrWhiteSpace(dto.DepartmentName)) dept.DepartmentName = dto.DepartmentName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) dept.Status = dto.Status.Trim();
        if (dto.BranchId.HasValue) dept.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;

        await _db.SaveChangesAsync();
        _cacheService.EvictDepartmentsCache();
        
        return Ok(new { message = "Department updated successfully.", id = dept.Id });
    }

    [HttpDelete("departments/{id}")]
    public async Task<IActionResult> DeleteDepartment(int id)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept == null) return NotFound(new { message = "Department not found." });

        _db.Departments.Remove(dept);
        await _db.SaveChangesAsync();
        _cacheService.EvictDepartmentsCache();
        
        return Ok(new { message = "Department deleted successfully." });
    }

    // ==========================================
    // DESIGNATIONS
    // ==========================================
    [HttpPost("designations")]
    public async Task<IActionResult> CreateDesignation([FromBody] DesignationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.DesignationName)) return BadRequest(new { message = "Designation name is required." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var desig = new Designation
        {
            DesignationName = dto.DesignationName.Trim(),
            Status = dto.Status ?? "active",
            OrganizationId = orgId,
            BranchId = targetBranch
        };

        _db.Designations.Add(desig);
        await _db.SaveChangesAsync();
        _cacheService.EvictDesignationsCache();

        return Ok(new { message = "Designation created successfully.", id = desig.Id });
    }

    [HttpPut("designations/{id}")]
    public async Task<IActionResult> UpdateDesignation(int id, [FromBody] DesignationDto dto)
    {
        var desig = await _db.Designations.FindAsync(id);
        if (desig == null) return NotFound(new { message = "Designation not found." });

        if (!string.IsNullOrWhiteSpace(dto.DesignationName)) desig.DesignationName = dto.DesignationName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) desig.Status = dto.Status.Trim();
        if (dto.BranchId.HasValue) desig.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;

        await _db.SaveChangesAsync();
        _cacheService.EvictDesignationsCache();
        
        return Ok(new { message = "Designation updated successfully.", id = desig.Id });
    }

    [HttpDelete("designations/{id}")]
    public async Task<IActionResult> DeleteDesignation(int id)
    {
        var desig = await _db.Designations.FindAsync(id);
        if (desig == null) return NotFound(new { message = "Designation not found." });

        _db.Designations.Remove(desig);
        await _db.SaveChangesAsync();
        _cacheService.EvictDesignationsCache();
        
        return Ok(new { message = "Designation deleted successfully." });
    }

    // ==========================================
    // LEAVE TYPES
    // ==========================================
    [HttpPost("leave-types")]
    public async Task<IActionResult> CreateLeaveType([FromBody] LeaveTypeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Leave type name is required." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var leaveType = new LeaveType
        {
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim() ?? "LV",
            DefaultYearlyQuota = dto.DefaultYearlyQuota,
            IsPaid = dto.IsPaid,
            ApplicableAfterProbation = dto.ApplicableAfterProbation,
            AllowCarryForward = dto.AllowCarryForward,
            GenderApplicability = string.IsNullOrWhiteSpace(dto.GenderApplicability) ? "All" : dto.GenderApplicability,
            MaritalStatusApplicability = string.IsNullOrWhiteSpace(dto.MaritalStatusApplicability) ? "All" : dto.MaritalStatusApplicability,
            DepartmentIds = dto.DepartmentIds,
            DesignationIds = dto.DesignationIds,
            RoleIds = dto.RoleIds,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim(),
            OrganizationId = orgId,
            BranchId = targetBranch,
            CreatedAt = DateTime.Now
        };

        _db.LeaveTypes.Add(leaveType);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Leave type created successfully.", id = leaveType.Id });
    }

    [HttpPut("leave-types/{id}")]
    public async Task<IActionResult> UpdateLeaveType(int id, [FromBody] LeaveTypeDto dto)
    {
        var leaveType = await _db.LeaveTypes.FindAsync(id);
        if (leaveType == null) return NotFound(new { message = "Leave type not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) leaveType.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) leaveType.Code = dto.Code.Trim();
        leaveType.DefaultYearlyQuota = dto.DefaultYearlyQuota;
        leaveType.IsPaid = dto.IsPaid;
        leaveType.ApplicableAfterProbation = dto.ApplicableAfterProbation;
        leaveType.AllowCarryForward = dto.AllowCarryForward;
        leaveType.GenderApplicability = string.IsNullOrWhiteSpace(dto.GenderApplicability) ? "All" : dto.GenderApplicability;
        leaveType.MaritalStatusApplicability = string.IsNullOrWhiteSpace(dto.MaritalStatusApplicability) ? "All" : dto.MaritalStatusApplicability;
        leaveType.DepartmentIds = dto.DepartmentIds;
        leaveType.DesignationIds = dto.DesignationIds;
        leaveType.RoleIds = dto.RoleIds;
        if (!string.IsNullOrWhiteSpace(dto.Status)) leaveType.Status = dto.Status.Trim();
        if (dto.BranchId.HasValue) leaveType.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Leave type updated successfully.", id = leaveType.Id });
    }

    [HttpDelete("leave-types/{id}")]
    public async Task<IActionResult> DeleteLeaveType(int id)
    {
        var leaveType = await _db.LeaveTypes.FindAsync(id);
        if (leaveType == null) return NotFound(new { message = "Leave type not found." });

        _db.LeaveTypes.Remove(leaveType);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Leave type deleted successfully." });
    }

    // ==========================================
    // WORK SHIFTS
    // ==========================================
    [HttpPost("shifts")]
    public async Task<IActionResult> CreateShift([FromBody] ShiftDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Shift name is required." });

            var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
            var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

            TimeOnly.TryParse(dto.StartTime, out var startTime);
            TimeOnly.TryParse(dto.EndTime, out var endTime);

            var totalMinutes = (endTime.ToTimeSpan() - startTime.ToTimeSpan()).TotalMinutes;
            if (totalMinutes < 0) totalMinutes += 24 * 60;
            var breakMins = dto.BreakMinutes ?? 60;
            var workingHours = Math.Round((decimal)Math.Max(0, totalMinutes - breakMins) / 60m, 2);

            var halfMinutes = totalMinutes / 2;
            var halfTimeSpan = startTime.ToTimeSpan().Add(TimeSpan.FromMinutes(halfMinutes));
            if (halfTimeSpan.TotalHours >= 24) halfTimeSpan = halfTimeSpan.Subtract(TimeSpan.FromHours(24));

            var shift = new Shift
            {
                ShiftName = dto.Name.Trim(),
                ShiftCode = dto.Code?.Trim() ?? "SHF",
                StartTime = startTime,
                EndTime = endTime,
                LunchBreakStart = TimeOnly.TryParse(dto.LunchBreakStart, out var lbStart) ? lbStart : null,
                LunchBreakEnd = TimeOnly.TryParse(dto.LunchBreakEnd, out var lbEnd) ? lbEnd : null,
                LunchBreakDuration = breakMins,
                WorkingHours = workingHours > 0 ? workingHours : 8m,
                HalfTime = !string.IsNullOrWhiteSpace(dto.HalfTime) && TimeOnly.TryParse(dto.HalfTime, out var hTimeCustom)
                    ? hTimeCustom
                    : TimeOnly.FromTimeSpan(halfTimeSpan),
                LateComingGraceMinutes = dto.LateComingGraceMinutes ?? 15,
                EarlyLeaveGraceMinutes = dto.EarlyLeaveGraceMinutes ?? 15,
                ColorCode = dto.ColorCode ?? "#4e73df",
                Status = "Active",
                OrganizationId = orgId,
                BranchId = targetBranch
            };

            _db.Shifts.Add(shift);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Shift created successfully.", id = shift.Id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create shift. Please try again or contact support." });
        }
    }

    [HttpPut("shifts/{id}")]
    public async Task<IActionResult> UpdateShift(int id, [FromBody] ShiftDto dto)
    {
        var shift = await _db.Shifts.FindAsync(id);
        if (shift == null) return NotFound(new { message = "Shift not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) shift.ShiftName = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) shift.ShiftCode = dto.Code.Trim().ToUpper();
        if (TimeOnly.TryParse(dto.StartTime, out var startTime)) shift.StartTime = startTime;
        if (TimeOnly.TryParse(dto.EndTime, out var endTime)) shift.EndTime = endTime;
        if (TimeOnly.TryParse(dto.LunchBreakStart, out var lbStart)) shift.LunchBreakStart = lbStart;
        if (TimeOnly.TryParse(dto.LunchBreakEnd, out var lbEnd)) shift.LunchBreakEnd = lbEnd;
        if (dto.BreakMinutes.HasValue) shift.LunchBreakDuration = dto.BreakMinutes.Value;
        if (dto.LateComingGraceMinutes.HasValue) shift.LateComingGraceMinutes = dto.LateComingGraceMinutes.Value;
        if (dto.EarlyLeaveGraceMinutes.HasValue) shift.EarlyLeaveGraceMinutes = dto.EarlyLeaveGraceMinutes.Value;
        if (!string.IsNullOrWhiteSpace(dto.ColorCode)) shift.ColorCode = dto.ColorCode;
        if (dto.BranchId.HasValue) shift.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;

        var totalMinutes = (shift.EndTime.ToTimeSpan() - shift.StartTime.ToTimeSpan()).TotalMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        var breakMins = shift.LunchBreakDuration;
        var workingHours = Math.Round((decimal)Math.Max(0, totalMinutes - breakMins) / 60m, 2);
        shift.WorkingHours = workingHours > 0 ? workingHours : 8m;
        
        if (!string.IsNullOrWhiteSpace(dto.HalfTime) && TimeOnly.TryParse(dto.HalfTime, out var hTimeEdit))
        {
            shift.HalfTime = hTimeEdit;
        }
        else
        {
            var halfMinutes = totalMinutes / 2;
            var halfTimeSpan = shift.StartTime.ToTimeSpan().Add(TimeSpan.FromMinutes(halfMinutes));
            if (halfTimeSpan.TotalHours >= 24) halfTimeSpan = halfTimeSpan.Subtract(TimeSpan.FromHours(24));
            shift.HalfTime = TimeOnly.FromTimeSpan(halfTimeSpan);
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Shift updated successfully.", id = shift.Id });
    }

    [HttpDelete("shifts/{id}")]
    public async Task<IActionResult> DeleteShift(int id)
    {
        var shift = await _db.Shifts.FindAsync(id);
        if (shift == null) return NotFound(new { message = "Shift not found." });

        _db.Shifts.Remove(shift);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Shift deleted successfully." });
    }

    // ==========================================
    // ATTENDANCE POLICY
    // ==========================================
    [HttpGet("attendance-policy")]
    public async Task<IActionResult> GetAttendancePolicy([FromQuery] int? branchId = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var query = _db.SystemSettings.AsNoTracking().AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(s => s.BranchId == activeBranch.Value || s.BranchId == null);
        }
        else
        {
            query = query.Where(s => s.BranchId == null);
        }

        var settings = await query.ToListAsync();

        int grace = 15;
        decimal halfDay = 4.5m;
        decimal fullDay = 8.0m;
        int autoSync = 5;
        string weekoff = "Sunday";
        bool sandwichRule = true;

        foreach (var s in settings)
        {
            if (s.SettingKey == "GracePeriodMinutes" && int.TryParse(s.SettingValue, out var g)) grace = g;
            if (s.SettingKey == "HalfDayThresholdHours" && decimal.TryParse(s.SettingValue, out var hd)) halfDay = hd;
            if (s.SettingKey == "FullDayThresholdHours" && decimal.TryParse(s.SettingValue, out var fd)) fullDay = fd;
            if (s.SettingKey == "AutoSyncIntervalMinutes" && int.TryParse(s.SettingValue, out var asy)) autoSync = asy;
            if (s.SettingKey == "DefaultWeekoff" && !string.IsNullOrWhiteSpace(s.SettingValue)) weekoff = s.SettingValue;
            if (s.SettingKey == "SandwichRuleEnabled" && bool.TryParse(s.SettingValue, out var sr)) sandwichRule = sr;
        }

        return Ok(new
        {
            gracePeriodMinutes = grace,
            halfDayThresholdHours = halfDay,
            fullDayThresholdHours = fullDay,
            autoSyncIntervalMinutes = autoSync,
            defaultWeekoff = weekoff,
            sandwichRuleEnabled = sandwichRule,
            branchId = activeBranch
        });
    }

    [HttpPut("attendance-policy")]
    public async Task<IActionResult> UpdateAttendancePolicy([FromBody] AttendancePolicyDto dto)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        async Task UpsertSetting(string key, string value, string description)
        {
            var setting = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.SettingKey == key && s.BranchId == targetBranch);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    SettingKey = key,
                    SettingValue = value,
                    Description = description,
                    OrganizationId = orgId,
                    BranchId = targetBranch,
                    UpdatedAt = DateTime.Now
                };
                _db.SystemSettings.Add(setting);
            }
            else
            {
                setting.SettingValue = value;
                setting.UpdatedAt = DateTime.Now;
            }
        }

        await UpsertSetting("GracePeriodMinutes", dto.GracePeriodMinutes.ToString(), "Grace period in minutes for late coming");
        await UpsertSetting("HalfDayThresholdHours", dto.HalfDayThresholdHours.ToString(), "Minimum work hours required for half day");
        await UpsertSetting("FullDayThresholdHours", dto.FullDayThresholdHours.ToString(), "Minimum work hours required for full day");
        await UpsertSetting("AutoSyncIntervalMinutes", dto.AutoSyncIntervalMinutes.ToString(), "Biometric auto sync interval in minutes");
        await UpsertSetting("DefaultWeekoff", dto.DefaultWeekoff, "Default weekly off day");
        await UpsertSetting("SandwichRuleEnabled", dto.SandwichRuleEnabled.ToString(), "Whether sandwich leave rule is enforced on weekoffs between leaves");

        await _db.SaveChangesAsync();
        return Ok(new { message = "Attendance policy updated successfully." });
    }

    // ==========================================
    // COMPANY POLICY (organization-level)
    // ==========================================
    [HttpGet("company-policy")]
    public async Task<IActionResult> GetCompanyPolicy([FromQuery] int organizationId)
    {
        if (organizationId <= 0) return BadRequest(new { message = "Organization is required." });

        _db.BypassTenantId = true;
        var settings = await _db.SystemSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId && s.BranchId == null)
            .ToListAsync();

        int yearStart = 11;
        int yearEnd = 10;
        int advanceNotice = 2;
        int maxConsecutive = 14;
        bool sandwichRule = true;
        int probationDays = 90;

        foreach (var s in settings)
        {
            if (s.SettingKey == "LeaveYearStartMonth" && int.TryParse(s.SettingValue, out var ys) && ys is >= 1 and <= 12) yearStart = ys;
            if (s.SettingKey == "LeaveYearEndMonth" && int.TryParse(s.SettingValue, out var ye) && ye is >= 1 and <= 12) yearEnd = ye;
            if (s.SettingKey == "AdvanceNoticeDays" && int.TryParse(s.SettingValue, out var an)) advanceNotice = an;
            if (s.SettingKey == "MaxConsecutiveLeaves" && int.TryParse(s.SettingValue, out var mc)) maxConsecutive = mc;
            if (s.SettingKey == "SandwichRuleEnabled" && bool.TryParse(s.SettingValue, out var sr)) sandwichRule = sr;
            if (s.SettingKey == "DefaultProbationDays" && int.TryParse(s.SettingValue, out var pd)) probationDays = pd;
        }

        yearEnd = yearStart == 1 ? 12 : yearStart - 1;

        return Ok(new
        {
            organizationId,
            yearStartMonth = yearStart,
            yearEndMonth = yearEnd,
            advanceNoticeDays = advanceNotice,
            maxConsecutiveLeaves = maxConsecutive,
            sandwichRuleEnabled = sandwichRule,
            defaultProbationDays = probationDays
        });
    }

    [HttpPut("company-policy")]
    public async Task<IActionResult> UpdateCompanyPolicy([FromBody] CompanyPolicyDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
            return Forbid();

        if (dto.OrganizationId <= 0) return BadRequest(new { message = "Organization is required." });
        if (dto.YearStartMonth is < 1 or > 12) return BadRequest(new { message = "Year start month must be between 1 and 12." });
        if (dto.YearEndMonth is < 1 or > 12) return BadRequest(new { message = "Year end month must be between 1 and 12." });

        var expectedEnd = dto.YearStartMonth == 1 ? 12 : dto.YearStartMonth - 1;
        var yearEnd = dto.YearEndMonth;
        if (yearEnd != expectedEnd)
            yearEnd = expectedEnd;

        _db.BypassTenantId = true;

        async Task UpsertOrgSetting(string key, string value, string description)
        {
            var setting = await _db.SystemSettings
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.SettingKey == key && s.OrganizationId == dto.OrganizationId && s.BranchId == null);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    SettingKey = key,
                    SettingValue = value,
                    Description = description,
                    OrganizationId = dto.OrganizationId,
                    BranchId = null,
                    UpdatedAt = DateTime.Now
                };
                _db.SystemSettings.Add(setting);
            }
            else
            {
                setting.SettingValue = value;
                setting.UpdatedAt = DateTime.Now;
            }
        }

        await UpsertOrgSetting("LeaveYearStartMonth", dto.YearStartMonth.ToString(), "Company year start month (1-12)");
        await UpsertOrgSetting("LeaveYearEndMonth", yearEnd.ToString(), "Company year end month (1-12)");
        await UpsertOrgSetting("AdvanceNoticeDays", dto.AdvanceNoticeDays.ToString(), "Minimum days in advance to apply for leave");
        await UpsertOrgSetting("MaxConsecutiveLeaves", dto.MaxConsecutiveLeaves.ToString(), "Maximum consecutive leave days allowed");
        await UpsertOrgSetting("SandwichRuleEnabled", dto.SandwichRuleEnabled.ToString(), "Whether sandwich leave rule is enforced");
        await UpsertOrgSetting("DefaultProbationDays", dto.DefaultProbationDays.ToString(), "Default probation period in days for new hires");

        await _db.SaveChangesAsync();
        return Ok(new
        {
            message = "Company policy updated successfully.",
            yearStartMonth = dto.YearStartMonth,
            yearEndMonth = yearEnd
        });
    }

    // ==========================================
    // ORGANIZATIONS
    // ==========================================
    [HttpGet("organizations")]
    public async Task<IActionResult> GetOrganizations()
    {
        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);
        var userOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var query = _db.Organizations.AsNoTracking().Where(o => o.IsActive);
        if (!isSuperAdmin)
        {
            query = query.Where(o => o.Id == userOrgId);
        }

        var rawOrgs = await query
            .OrderBy(o => o.Id)
            .ToListAsync();

        var orgs = rawOrgs.Select(o => new
        {
            id = o.Id.ToString(),
            name = o.Name,
            code = o.Code ?? (o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name),
            address = o.Address,
            whatsAppGroupId = o.WhatsAppGroupId,
            logoUrl = o.LogoUrl,
            primaryColor = o.PrimaryColor ?? "#D97706",
            customDomain = o.CustomDomain,
            isActive = o.IsActive
        }).ToList();

        return Ok(orgs);
    }

    [HttpPost("organizations")]
    public async Task<IActionResult> CreateOrganization([FromBody] OrganizationDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

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
            LogoUrl = dto.LogoUrl?.Trim(),
            PrimaryColor = string.IsNullOrWhiteSpace(dto.PrimaryColor) ? "#D97706" : dto.PrimaryColor.Trim(),
            CustomDomain = dto.CustomDomain?.Trim(),
            CompanyId = defaultCompany?.Id,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.Now
        };

        _db.Organizations.Add(org);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Branch created successfully.", id = org.Id, publicId = org.PublicId });
    }

    [HttpPut("organizations/{publicId:guid}")]
    public async Task<IActionResult> UpdateOrganization(Guid publicId, [FromBody] OrganizationDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.PublicId == publicId);
        if (org == null) return NotFound(new { message = "Branch not found." });

        bool isAdminOrSuper = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("Admin");
        if (!isAdminOrSuper && org.Id != _tenantProvider.TenantId)
        {
            return Forbid();
        }

        if (!string.IsNullOrWhiteSpace(dto.Name)) org.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Code)) org.Code = dto.Code.Trim();
        org.Address = dto.Address?.Trim();
        org.WhatsAppGroupId = dto.WhatsAppGroupId?.Trim();
        org.Latitude = dto.Latitude;
        org.Longitude = dto.Longitude;
        org.RadiusMeters = dto.RadiusMeters ?? 100;
        if (dto.LogoUrl != null) org.LogoUrl = string.IsNullOrWhiteSpace(dto.LogoUrl) ? null : dto.LogoUrl.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PrimaryColor)) org.PrimaryColor = dto.PrimaryColor.Trim();
        if (dto.CustomDomain != null) org.CustomDomain = string.IsNullOrWhiteSpace(dto.CustomDomain) ? null : dto.CustomDomain.Trim();
        org.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Organization updated successfully.", id = org.Id, publicId = org.PublicId });
    }

    [HttpPost("organizations/{publicId:guid}/logo")]
    public async Task<IActionResult> UploadOrganizationLogo(Guid publicId, IFormFile file, [FromServices] IWebHostEnvironment env)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No image file uploaded." });
        }

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
        {
            return BadRequest(new { message = "Invalid file type. Only PNG, JPG, WEBP, and SVG are supported." });
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new { message = "File size cannot exceed 5MB." });
        }

        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.PublicId == publicId);
        if (org == null) return NotFound(new { message = "Organization not found." });

        bool isAdminOrSuper = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("Admin");
        if (!isAdminOrSuper && org.Id != _tenantProvider.TenantId)
        {
            return Forbid();
        }

        string webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        string logosDir = Path.Combine(webRoot, "uploads", "logos");
        if (!Directory.Exists(logosDir))
        {
            Directory.CreateDirectory(logosDir);
        }

        string ext = Path.GetExtension(file.FileName);
        string fileName = $"org_{org.Id}_{Guid.NewGuid():N}{ext}";
        string filePath = Path.Combine(logosDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        string logoUrl = $"/uploads/logos/{fileName}";
        org.LogoUrl = logoUrl;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Logo uploaded successfully.",
            logoUrl = logoUrl
        });
    }

    // ==========================================
    // BRANCHES MASTER
    // ==========================================
    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches([FromQuery] int? organizationId = null)
    {
        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);
        var userOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var query = _db.Branches.AsNoTracking().Where(b => b.IsActive);
        if (!isSuperAdmin)
        {
            query = query.Where(b => b.OrganizationId == userOrgId);
        }
        else if (organizationId.HasValue && organizationId.Value > 0)
        {
            query = query.Where(b => b.OrganizationId == organizationId.Value);
        }

        var branches = await query
            .OrderBy(b => b.Id)
            .ToListAsync();

        return Ok(branches.Select(b => new
        {
            id = b.Id,
            publicId = b.PublicId,
            organizationId = b.OrganizationId,
            name = b.Name,
            code = b.Code ?? "",
            address = b.Address,
            city = b.City,
            state = b.State,
            pincode = b.Pincode,
            latitude = b.Latitude,
            longitude = b.Longitude,
            radiusMeters = b.RadiusMeters ?? 100,
            whatsAppGroupId = b.WhatsAppGroupId,
            allowedIPs = b.AllowedIPs,
            outsideAttendancePolicy = b.OutsideAttendancePolicy,
            isActive = b.IsActive,
            createdAt = b.CreatedAt
        }));
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] BranchDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Branch name is required." });

        _db.BypassTenantId = true;
        var defaultOrg = await _db.Organizations.FirstOrDefaultAsync();
        var targetOrgId = (dto.OrganizationId.HasValue && dto.OrganizationId.Value > 0)
            ? dto.OrganizationId.Value
            : (defaultOrg?.Id ?? 1);

        // SaaS Branch Quota Enforcement
        var (canAdd, errorMsg) = await _entitlementService.CanAddBranchAsync(targetOrgId);
        if (!canAdd)
        {
            return StatusCode(402, new { error = "QUOTA_EXCEEDED", message = errorMsg });
        }

        var branch = new Branch
        {
            OrganizationId = targetOrgId,
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
            AllowedIPs = dto.AllowedIPs?.Trim(),
            OutsideAttendancePolicy = dto.OutsideAttendancePolicy ?? "Block",
            IsActive = dto.IsActive,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.Branches.Add(branch);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Branch created successfully.", id = branch.Id, publicId = branch.PublicId });
    }

    [HttpPut("branches/{publicId:guid}")]
    public async Task<IActionResult> UpdateBranch(Guid publicId, [FromBody] BranchDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        _db.BypassTenantId = true;
        var branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.PublicId == publicId);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        bool isAdminOrSuper = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("Admin");
        if (!isAdminOrSuper && branch.OrganizationId != _tenantProvider.TenantId)
        {
            return Forbid();
        }

        if (!string.IsNullOrWhiteSpace(dto.Name)) branch.Name = dto.Name.Trim();
        branch.Code = dto.Code?.Trim();
        branch.Address = dto.Address?.Trim();
        branch.City = dto.City?.Trim();
        branch.State = dto.State?.Trim();
        branch.Pincode = dto.Pincode?.Trim();
        branch.Latitude = dto.Latitude;
        branch.Longitude = dto.Longitude;
        branch.RadiusMeters = dto.RadiusMeters ?? 100;
        branch.WhatsAppGroupId = dto.WhatsAppGroupId?.Trim();
        branch.AllowedIPs = dto.AllowedIPs?.Trim();
        if (!string.IsNullOrWhiteSpace(dto.OutsideAttendancePolicy))
            branch.OutsideAttendancePolicy = dto.OutsideAttendancePolicy;
        branch.IsActive = dto.IsActive;
        branch.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Branch updated successfully.", id = branch.Id, publicId = branch.PublicId });
    }

    [HttpDelete("branches/{publicId:guid}")]
    public async Task<IActionResult> DeleteBranch(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        _db.BypassTenantId = true;
        var branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.PublicId == publicId);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        bool isAdminOrSuper = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("Admin");
        if (!isAdminOrSuper && branch.OrganizationId != _tenantProvider.TenantId)
        {
            return Forbid();
        }

        _db.Branches.Remove(branch);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Branch deleted successfully." });
    }

    [HttpPost("organization-branding")]
    public async Task<IActionResult> UpdateOrganizationBranding([FromBody] OrganizationBrandingDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        _db.BypassTenantId = true;
        var org = await _db.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return NotFound(new { message = "Organization not found." });

        if (dto.LogoUrl != null) org.LogoUrl = dto.LogoUrl.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PrimaryColor)) org.PrimaryColor = dto.PrimaryColor.Trim();
        if (dto.CustomDomain != null) org.CustomDomain = dto.CustomDomain.Trim().ToLowerInvariant();

        await _db.SaveChangesAsync();
        return Ok(new
        {
            message = "Organization branding updated successfully.",
            logoUrl = org.LogoUrl,
            primaryColor = org.PrimaryColor,
            customDomain = org.CustomDomain
        });
    }
}

public record OrganizationBrandingDto(string? LogoUrl, string? PrimaryColor, string? CustomDomain);
