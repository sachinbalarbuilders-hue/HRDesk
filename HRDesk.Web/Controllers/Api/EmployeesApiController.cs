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
public class EmployeesController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly ICurrentTenantProvider _tenantProvider;

    public EmployeesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _tenantProvider = tenantProvider;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .Include(e => e.ReportingManager)
            .AsQueryable();

        // Branch Scoping Filter
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(e => e.BranchId == activeBranch.Value);
        }

        // Apply Scope (All, Reporting, Department, Own)
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(e => e.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e =>
                e.EmployeeName.ToLower().Contains(s) ||
                (e.Phone != null && e.Phone.Contains(s)) ||
                e.EmployeeId.ToString().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(e => e.Status != null && e.Status.ToLower() == status.ToLower());
        }

        var totalCount = await query.CountAsync();

        if (pageSize <= 0) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var items = await query
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                employeeCode = (e.Branch != null && !string.IsNullOrEmpty(e.Branch.Code) ? e.Branch.Code : "EMP#") + e.EmployeeId.ToString("D3"),
                e.Phone,
                Department = e.Department != null ? e.Department.DepartmentName : null,
                DepartmentId = e.DepartmentId,
                Designation = e.Designation != null ? e.Designation.DesignationName : null,
                DesignationId = e.DesignationId,
                ReportingManager = e.ReportingManager != null ? e.ReportingManager.EmployeeName : null,
                e.ReportingManagerId,
                e.BranchId,
                Branch = e.Branch != null ? e.Branch.Name : null,
                BranchCode = e.Branch != null ? e.Branch.Code : null,
                e.JoiningDate,
                e.Status,
                e.Weekoff,
                e.PhotoPath
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetEmployeeById(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .Include(e => e.ReportingManager)
            .Where(e => e.EmployeeId == id);

        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or access restricted." });
        }

        return Ok(new
        {
            employee.EmployeeId,
            employee.EmployeeName,
            employeeCode = (employee.Branch != null && !string.IsNullOrEmpty(employee.Branch.Code) ? employee.Branch.Code : "EMP#") + employee.EmployeeId.ToString("D3"),
            employee.Phone,
            employee.DateOfBirth,
            employee.JoiningDate,
            employee.ResignationDate,
            employee.LastWorkingDate,
            employee.ProbationStart,
            employee.ProbationEnd,
            employee.Status,
            employee.Weekoff,
            employee.PhotoPath,
            employee.BranchId,
            Branch = employee.Branch != null ? employee.Branch.Name : null,
            BranchCode = employee.Branch != null ? employee.Branch.Code : null,
            Department = employee.Department != null ? employee.Department.DepartmentName : null,
            employee.DepartmentId,
            Designation = employee.Designation != null ? employee.Designation.DesignationName : null,
            employee.DesignationId,
            ReportingManager = employee.ReportingManager != null ? employee.ReportingManager.EmployeeName : null,
            employee.ReportingManagerId,
            employee.EmploymentType,
            employee.BloodGroup,
            employee.Gender,
            employee.AttendanceType,
            employee.MaritalStatus,
            employee.Nationality,
            employee.WorkEmail,
            employee.PersonalEmail,
            employee.HasProbation,
            employee.ProbationDays
        });
    }

    [HttpGet("lookups")]
    public async Task<IActionResult> GetLookups()
    {
        var departments = await _cache.GetDepartmentsAsync();
        var designations = await _cache.GetDesignationsAsync();
        var shifts = await _cache.GetShiftsAsync();

        var managers = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active")
            .OrderBy(e => e.EmployeeName)
            .Select(e => new { e.EmployeeId, e.EmployeeName, Department = e.Department != null ? e.Department.DepartmentName : null, e.BranchId })
            .ToListAsync();

        var roles = await _db.Roles
            .AsNoTracking()
            .Select(r => new { r.Id, r.Name })
            .ToListAsync();

        return Ok(new
        {
            departments = departments.Select(d => new { DepartmentId = d.Id, d.DepartmentName, d.BranchId }),
            designations = designations.Select(d => new { DesignationId = d.Id, d.DesignationName, d.BranchId }),
            shifts = shifts.Select(s => new { ShiftId = s.Id, s.ShiftName, s.StartTime, s.EndTime }),
            managers,
            roles
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateEmployee([FromBody] EmployeeCreateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesCreate))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.EmployeeName))
        {
            return BadRequest(new { message = "Employee name is required." });
        }

        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranchId = dto.BranchId ?? _tenantProvider.BranchId;

        int targetEmpId;
        if (dto.EmployeeId.HasValue && dto.EmployeeId.Value > 0)
        {
            var exists = await _db.Employees.AnyAsync(e => e.OrganizationId == targetOrgId && e.EmployeeId == dto.EmployeeId.Value);
            if (exists)
            {
                return BadRequest(new { message = $"Employee ID #{dto.EmployeeId.Value} already exists in this organization." });
            }
            targetEmpId = dto.EmployeeId.Value;
        }
        else
        {
            var maxId = await _db.Employees
                .Where(e => e.OrganizationId == targetOrgId)
                .Select(e => (int?)e.EmployeeId)
                .MaxAsync() ?? 0;
            targetEmpId = maxId + 1;
        }

        var employee = new Employee
        {
            EmployeeId = targetEmpId,
            EmployeeName = dto.EmployeeName.Trim(),
            Phone = dto.Phone?.Trim(),
            DateOfBirth = dto.DateOfBirth,
            JoiningDate = dto.JoiningDate ?? DateOnly.FromDateTime(DateTime.Today),
            DepartmentId = dto.DepartmentId,
            DesignationId = dto.DesignationId,
            ReportingManagerId = dto.ReportingManagerId,
            Weekoff = dto.Weekoff ?? "Sunday",
            BranchId = targetBranchId,
            Status = "active",
            OrganizationId = targetOrgId,
            EmploymentType = dto.EmploymentType,
            BloodGroup = dto.BloodGroup,
            Gender = dto.Gender,
            AttendanceType = dto.AttendanceType,
            MaritalStatus = dto.MaritalStatus,
            Nationality = dto.Nationality,
            WorkEmail = dto.WorkEmail?.Trim(),
            PersonalEmail = dto.PersonalEmail?.Trim(),
            HasProbation = dto.HasProbation,
            ProbationDays = dto.ProbationDays
        };

        if (dto.RoleId.HasValue && dto.RoleId.Value > 0)
        {
            var user = new User
            {
                Username = dto.WorkEmail ?? dto.PersonalEmail ?? $"{dto.EmployeeName.Replace(" ", "").ToLower()}{targetEmpId}",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123", 12),
                FullName = dto.EmployeeName.Trim(),
                RoleId = dto.RoleId,
                Role = "Employee",
                IsActive = true,
                BranchId = targetBranchId,
                OrganizationId = targetOrgId,
                Employee = employee
            };
            _db.Users.Add(user);
        }

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return CreatedAtAction(nameof(GetEmployeeById), new { id = employee.EmployeeId }, new { employee.EmployeeId, message = "Employee created successfully." });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEmployee(int id, [FromBody] EmployeeUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.EmployeeId == id);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesEdit);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or unauthorized to edit." });
        }

        if (!string.IsNullOrWhiteSpace(dto.EmployeeName)) employee.EmployeeName = dto.EmployeeName.Trim();
        employee.Phone = dto.Phone?.Trim();
        employee.DateOfBirth = dto.DateOfBirth;
        if (dto.JoiningDate.HasValue) employee.JoiningDate = dto.JoiningDate.Value;
        employee.LastWorkingDate = dto.LastWorkingDate;
        employee.ResignationDate = dto.ResignationDate;
        employee.ProbationStart = dto.ProbationStart;
        employee.ProbationEnd = dto.ProbationEnd;
        employee.DepartmentId = dto.DepartmentId;
        employee.DesignationId = dto.DesignationId;
        employee.ReportingManagerId = dto.ReportingManagerId;
        if (dto.BranchId.HasValue) employee.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;
        if (!string.IsNullOrWhiteSpace(dto.Weekoff)) employee.Weekoff = dto.Weekoff;
        
        employee.EmploymentType = dto.EmploymentType;
        employee.BloodGroup = dto.BloodGroup;
        employee.Gender = dto.Gender;
        employee.AttendanceType = dto.AttendanceType;
        employee.MaritalStatus = dto.MaritalStatus;
        employee.Nationality = dto.Nationality;
        if (dto.WorkEmail != null) employee.WorkEmail = dto.WorkEmail.Trim();
        if (dto.PersonalEmail != null) employee.PersonalEmail = dto.PersonalEmail.Trim();
        employee.HasProbation = dto.HasProbation;
        employee.ProbationDays = dto.ProbationDays;

        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { message = "Employee updated successfully." });
    }

    [HttpPost("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.EmployeeId == id);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesEdit);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or unauthorized." });
        }

        var currentStatus = employee.Status?.ToLower() ?? "active";
        employee.Status = currentStatus == "active" ? "inactive" : "active";
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { status = employee.Status, message = $"Employee status set to {employee.Status}." });
    }

    [HttpGet("prefix-settings")]
    public async Task<IActionResult> GetPrefixSettings([FromQuery] int? branchId = null)
    {
        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        var settings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == targetOrgId && (s.BranchId == targetBranch || s.BranchId == null))
            .ToListAsync();

        string series = settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? "EMP";

        string connector = settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? "#";

        int padding = int.TryParse(settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue, out var p) ? p : 3;

        int startSeq = int.TryParse(settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_StartSeq")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_StartSeq")?.SettingValue, out var sSeq) ? sSeq : 1;

        var maxId = await _db.Employees.Where(e => e.OrganizationId == targetOrgId).Select(e => (int?)e.EmployeeId).MaxAsync() ?? 0;
        var nextSeq = Math.Max(maxId + 1, startSeq);

        var preview = $"{series}{connector}{nextSeq.ToString($"D{padding}")}";

        return Ok(new
        {
            seriesCode = series,
            connector = connector,
            paddingDigits = padding,
            startSequence = startSeq,
            nextSequence = nextSeq,
            preview = preview,
            sample1 = $"{series}{connector}{(nextSeq).ToString($"D{padding}")}",
            sample2 = $"{series}{connector}{(nextSeq + 1).ToString($"D{padding}")}",
            sample3 = $"{series}{connector}{(nextSeq + 2).ToString($"D{padding}")}"
        });
    }

    [HttpPost("prefix-settings")]
    public async Task<IActionResult> SavePrefixSettings([FromBody] PrefixSettingsDto dto, [FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        async Task UpsertSetting(string key, string value, string desc)
        {
            var existing = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch && s.SettingKey == key);
            if (existing != null)
            {
                existing.SettingValue = value;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = targetOrgId,
                    BranchId = targetBranch,
                    SettingKey = key,
                    SettingValue = value,
                    Description = desc,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        var series = string.IsNullOrWhiteSpace(dto.SeriesCode) ? "EMP" : dto.SeriesCode.Trim();
        var connector = dto.Connector ?? "";
        var padding = dto.PaddingDigits > 0 ? dto.PaddingDigits : 3;
        var startSeq = dto.StartSequence > 0 ? dto.StartSequence : 1;

        await UpsertSetting("Employee_Prefix_Series", series, "Employee Code Series Prefix");
        await UpsertSetting("Employee_Prefix_Connector", connector, "Employee Code Connector / Delimiter");
        await UpsertSetting("Employee_Prefix_Padding", padding.ToString(), "Employee Code Sequence Padding Length");
        await UpsertSetting("Employee_Prefix_StartSeq", startSeq.ToString(), "Employee Code Starting Sequence");

        if (targetBranch.HasValue && targetBranch.Value > 0)
        {
            var b = await _db.Branches.FirstOrDefaultAsync(br => br.Id == targetBranch.Value);
            if (b != null)
            {
                b.Code = $"{series}{connector}";
            }
        }

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return Ok(new { message = "Employee Code Series & Prefix setup saved successfully." });
    }

    public record PrefixSettingsDto(
        string SeriesCode,
        string Connector,
        int PaddingDigits = 3,
        int StartSequence = 1
    );

    public record EmployeeCreateDto(
        string EmployeeName,
        string? Phone,
        DateOnly? DateOfBirth,
        DateOnly? JoiningDate,
        int? DepartmentId,
        int? DesignationId,
        int? ReportingManagerId,
        string? Weekoff,
        int? EmployeeId = null,
        int? BranchId = null,
        string? EmploymentType = null,
        string? BloodGroup = null,
        string? Gender = null,
        string? AttendanceType = null,
        string? MaritalStatus = null,
        string? Nationality = null,
        string? WorkEmail = null,
        string? PersonalEmail = null,
        bool HasProbation = false,
        int? ProbationDays = null,
        int? RoleId = null
    );

    public record EmployeeUpdateDto(
        string? EmployeeName,
        string? Phone,
        DateOnly? DateOfBirth,
        DateOnly? JoiningDate,
        DateOnly? ResignationDate,
        DateOnly? LastWorkingDate,
        DateOnly? ProbationStart,
        DateOnly? ProbationEnd,
        int? DepartmentId,
        int? DesignationId,
        int? ReportingManagerId,
        string? Weekoff,
        int? BranchId = null,
        string? EmploymentType = null,
        string? BloodGroup = null,
        string? Gender = null,
        string? AttendanceType = null,
        string? MaritalStatus = null,
        string? Nationality = null,
        string? WorkEmail = null,
        string? PersonalEmail = null,
        bool HasProbation = false,
        int? ProbationDays = null,
        int? RoleId = null
    );
}
