using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Controllers.Api;

/// <summary>
/// Core employee CRUD: list, get, create, update, toggle-status, delete, lookups, photo.
/// Leave data   → EmployeeLeaveController
/// Prefix settings → EmployeePrefixController
/// Onboarding / verification → EmployeeOnboardingController
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IPlanEntitlementService _entitlementService;
    private readonly IMemoryCache _memoryCache;

    private static bool _contractColumnsEnsured = false;
    private static readonly object _columnLock = new();

    public EmployeesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ICurrentTenantProvider tenantProvider,
        IPlanEntitlementService entitlementService,
        IMemoryCache memoryCache)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _tenantProvider = tenantProvider;
        _entitlementService = entitlementService;
        _memoryCache = memoryCache;
        EnsureContractColumns();
    }

    private void EnsureContractColumns()
    {
        if (_contractColumnsEnsured) return;
        lock (_columnLock)
        {
            if (_contractColumnsEnsured) return;
            try
            {
                var sql = @"
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('employees') AND name = 'ContractDurationMonths')
BEGIN
    ALTER TABLE employees ADD ContractDurationMonths INT NULL;
END;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('employees') AND name = 'ContractEndDate')
BEGIN
    ALTER TABLE employees ADD ContractEndDate DATETIME2 NULL;
END;";
                _db.Database.ExecuteSqlRaw(sql);
                _contractColumnsEnsured = true;
            }
            catch
            {
                // Ignored
            }
        }
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
            var s = search.Trim();
            var sLower = s.ToLower();

            // Extract numeric digits if searching by code (e.g. "EMP#007" -> 7, "007" -> 7, "123" -> 123)
            int? parsedId = null;
            var digitMatch = System.Text.RegularExpressions.Regex.Match(s, @"\d+");
            if (digitMatch.Success && int.TryParse(digitMatch.Value, out int extractedNum))
            {
                parsedId = extractedNum;
            }

            query = query.Where(e =>
                e.EmployeeName.ToLower().Contains(sLower) ||
                (e.Phone != null && e.Phone.Contains(sLower)) ||
                (e.WorkEmail != null && e.WorkEmail.ToLower().Contains(sLower)) ||
                (e.PersonalEmail != null && e.PersonalEmail.ToLower().Contains(sLower)) ||
                e.EmployeeId.ToString().Contains(sLower) ||
                (parsedId.HasValue && e.EmployeeId == parsedId.Value));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(e => e.Status != null && e.Status.ToLower() == status.ToLower());
        }

        var totalCount = await query.CountAsync();

        if (pageSize <= 0) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        // Load prefix settings for employee code formatting
        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var prefixBranch = _tenantProvider.BranchId;
        var prefixSettings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == targetOrgId && s.SettingKey.StartsWith("Employee_Prefix_") && (s.BranchId == prefixBranch || s.BranchId == null))
            .ToListAsync();

        string prefixSeries = prefixSettings.FirstOrDefault(s => s.BranchId == prefixBranch && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? prefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? "EMP";
        string prefixConnector = prefixSettings.FirstOrDefault(s => s.BranchId == prefixBranch && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? prefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? "#";
        int prefixPadding = int.TryParse(
            prefixSettings.FirstOrDefault(s => s.BranchId == prefixBranch && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue
            ?? prefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue, out var pp) ? pp : 3;

        var rawItems = await query
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.EmployeeId,
                e.PublicId,
                e.EmployeeName,
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

        var items = rawItems.Select(e =>
        {
            var code = prefixSeries.EndsWith('#') || prefixSeries.EndsWith('-') || prefixSeries.EndsWith('_') || prefixSeries.EndsWith('/')
                ? $"{prefixSeries}{e.EmployeeId.ToString($"D{prefixPadding}")}"
                : $"{prefixSeries}{prefixConnector}{e.EmployeeId.ToString($"D{prefixPadding}")}";
            return new
            {
                e.EmployeeId,
                e.PublicId,
                e.EmployeeName,
                employeeCode = code,
                e.Phone,
                e.Department,
                e.DepartmentId,
                e.Designation,
                e.DesignationId,
                e.ReportingManager,
                e.ReportingManagerId,
                e.BranchId,
                e.Branch,
                e.BranchCode,
                e.JoiningDate,
                e.Status,
                e.Weekoff,
                e.PhotoPath
            };
        }).ToList();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("{publicId:guid}")]
    public async Task<IActionResult> GetEmployeeByGuid(Guid publicId)
    {
        return await FetchEmployeeDetail(e => e.PublicId == publicId);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile([FromQuery] int? employeeId = null)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var targetEmpId = employeeId ?? currentEmpId;
        if (!targetEmpId.HasValue)
        {
            targetEmpId = await _db.Employees.AsNoTracking().Select(e => (int?)e.EmployeeId).FirstOrDefaultAsync();
        }

        if (!targetEmpId.HasValue)
        {
            return NotFound(new { message = "No employee found." });
        }

        return await FetchEmployeeDetail(e => e.EmployeeId == targetEmpId.Value, bypassPermission: true);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetEmployeeById(int id)
    {
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        // Allow self-lookup without broad EmployeesView permission
        if (!currentEmpId.HasValue || currentEmpId.Value == id)
        {
            return await FetchEmployeeDetail(e => e.EmployeeId == id, bypassPermission: true);
        }

        return await FetchEmployeeDetail(e => e.EmployeeId == id);
    }

    private async Task<IActionResult> FetchEmployeeDetail(
        System.Linq.Expressions.Expression<Func<HRDesk.Web.Models.Employee, bool>> predicate,
        bool bypassPermission = false)
    {
        if (!bypassPermission && !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
                .ThenInclude(b => b!.Organization)
            .Include(e => e.Organization)
            .Include(e => e.ReportingManager)
            .Where(predicate);

        if (!bypassPermission)
        {
            query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);
        }

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or access restricted." });
        }

        var orgName = employee.Organization?.Name ?? employee.Branch?.Organization?.Name;
        var orgAddress = employee.Organization?.Address ?? employee.Branch?.Organization?.Address;

        var today = DateOnly.FromDateTime(DateTime.Today);
        var shiftRoster = await _db.ShiftRosters
            .AsNoTracking()
            .Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == employee.EmployeeId && r.RosterDate == today);

        Shift? shift = shiftRoster?.Shift;
        if (shift == null)
        {
            var assignment = await _db.EmployeeShiftAssignments
                .AsNoTracking()
                .Include(a => a.Shift)
                .FirstOrDefaultAsync(a => a.EmployeeId == employee.EmployeeId && a.FromDate <= today && (a.ToDate == null || a.ToDate >= today));
            shift = assignment?.Shift;
        }

        if (shift == null)
        {
            shift = await _db.Shifts
                .AsNoTracking()
                .FirstOrDefaultAsync(s => (s.BranchId == employee.BranchId || s.BranchId == null) && s.OrganizationId == employee.OrganizationId);
            shift ??= await _db.Shifts.AsNoTracking().FirstOrDefaultAsync();
        }

        var shiftName = shift?.ShiftName ?? "General Day Shift";
        var shiftStart = shift != null ? shift.StartTime.ToString(@"hh\:mm") : "09:30";
        var shiftEnd = shift != null ? shift.EndTime.ToString(@"hh\:mm") : "18:30";

        var user = await _db.Users
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.EmployeeId == employee.EmployeeId && u.OrganizationId == employee.OrganizationId);

        var activeRoleId = user?.RoleId?.ToString() ?? (user != null && user.Role == "SuperAdmin" ? "1" : (user != null && user.Role == "DepartmentManager" ? "2" : (user != null ? "3" : "")));

        // Format employee code from prefix settings
        var detailOrgId = employee.OrganizationId;
        var detailBranchId = employee.BranchId;
        var detailPrefixSettings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == detailOrgId && s.SettingKey.StartsWith("Employee_Prefix_") && (s.BranchId == detailBranchId || s.BranchId == null))
            .ToListAsync();

        string detailSeries = detailPrefixSettings.FirstOrDefault(s => s.BranchId == detailBranchId && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? detailPrefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? "EMP";
        string detailConnector = detailPrefixSettings.FirstOrDefault(s => s.BranchId == detailBranchId && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? detailPrefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? "#";
        int detailPadding = int.TryParse(
            detailPrefixSettings.FirstOrDefault(s => s.BranchId == detailBranchId && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue
            ?? detailPrefixSettings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue, out var dp) ? dp : 3;

        var detailEmployeeCode = detailSeries.EndsWith('#') || detailSeries.EndsWith('-') || detailSeries.EndsWith('_') || detailSeries.EndsWith('/')
            ? $"{detailSeries}{employee.EmployeeId.ToString($"D{detailPadding}")}"
            : $"{detailSeries}{detailConnector}{employee.EmployeeId.ToString($"D{detailPadding}")}";

        return Ok(new
        {
            employee.EmployeeId,
            employee.PublicId,
            employee.VerificationId,
            employee.EmployeeName,
            employeeCode = detailEmployeeCode,
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
            BranchAddress = employee.Branch?.Address,
            OrganizationName = orgName,
            OrganizationAddress = orgAddress,
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
            employee.CurrentAddress,
            employee.PermanentAddress,
            employee.HasProbation,
            employee.ProbationDays,
            employee.ContractDurationMonths,
            employee.ContractEndDate,
            shiftName,
            shiftStart,
            shiftEnd,
            shiftTiming = $"{shiftStart} - {shiftEnd}",
            roleId = activeRoleId,
            hasLoginAccess = user != null && user.IsActive,
            isFaceEnrolled = !string.IsNullOrEmpty(employee.FaceId),
            faceId = employee.FaceId
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

        // SaaS Seat Quota Enforcement
        var (canAdd, errorMsg) = await _entitlementService.CanAddEmployeeAsync(targetOrgId);
        if (!canAdd)
        {
            return BadRequest(new { message = errorMsg });
        }

        // Generate next employee ID safely
        int targetEmpId;
        if (dto.EmployeeId.HasValue && dto.EmployeeId.Value > 0)
        {
            var exists = await _db.Employees.IgnoreQueryFilters().AnyAsync(e => e.OrganizationId == targetOrgId && e.EmployeeId == dto.EmployeeId.Value);
            if (exists)
            {
                return BadRequest(new { message = $"Employee ID {dto.EmployeeId.Value} already exists in this organization." });
            }
            targetEmpId = dto.EmployeeId.Value;
        }
        else
        {
            var startSeqStr = await _db.SystemSettings
                .Where(s => s.OrganizationId == targetOrgId && (s.BranchId == targetBranchId || s.BranchId == null) && s.SettingKey == "Employee_Prefix_StartSeq")
                .Select(s => s.SettingValue)
                .FirstOrDefaultAsync();

            int startSeq = int.TryParse(startSeqStr, out var s) ? s : 1;

            var maxId = await _db.Employees.IgnoreQueryFilters()
                .Where(e => e.OrganizationId == targetOrgId && (targetBranchId == null || e.BranchId == targetBranchId) && e.EmployeeId < 10000)
                .Select(e => (int?)e.EmployeeId)
                .MaxAsync() ?? 0;

            targetEmpId = Math.Max(maxId + 1, startSeq);

            // Safety net: ensure targetEmpId is globally unique within the tenant
            while (await _db.Employees.IgnoreQueryFilters().AnyAsync(e => e.OrganizationId == targetOrgId && e.EmployeeId == targetEmpId))
            {
                targetEmpId++;
            }
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
            CurrentAddress = dto.CurrentAddress?.Trim(),
        ContractDurationMonths = dto.ContractDurationMonths,
            ContractEndDate = dto.ContractEndDate
        };

        if (dto.RoleId.HasValue && dto.RoleId.Value > 0)
        {
            var username = !string.IsNullOrWhiteSpace(dto.WorkEmail) 
                ? dto.WorkEmail.Trim() 
                : (!string.IsNullOrWhiteSpace(dto.PersonalEmail) ? dto.PersonalEmail.Trim() : $"emp{targetEmpId}");

            var roleObj = await _db.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId.Value);
            var roleName = roleObj?.Name ?? "Employee";
            if (roleName.Equals("Administrator", StringComparison.OrdinalIgnoreCase) || roleName.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || roleName.Equals("Super Admin", StringComparison.OrdinalIgnoreCase))
            {
                roleName = "Admin";
            }

            var user = new User
            {
                Username = username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123", 12),
                FullName = dto.EmployeeName.Trim(),
                RoleId = dto.RoleId.Value,
                Role = roleName,
                IsActive = true,
                BranchId = targetBranchId,
                OrganizationId = targetOrgId,
                EmployeeId = targetEmpId
            };
            _db.Users.Add(user);
        }

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return CreatedAtAction(nameof(GetEmployeeByGuid), new { publicId = employee.PublicId }, new { employee.EmployeeId, employee.PublicId, message = "Employee created successfully." });
    }

    [HttpPut("{publicId:guid}")]
    public async Task<IActionResult> UpdateEmployee(Guid publicId, [FromBody] EmployeeUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.PublicId == publicId);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesEdit);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or unauthorized to edit." });
        }

        var editScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesEdit);
        var isSuperOrAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("Admin") || User.IsInRole("Administrator");

        bool canEditBasic = isSuperOrAdmin 
            || string.IsNullOrEmpty(editScope) 
            || editScope == AppPermissions.Scopes.EditBasicInfo 
            || editScope == AppPermissions.Scopes.EditAllDetails 
            || editScope == AppPermissions.Scopes.All 
            || editScope == AppPermissions.Scopes.OwnBranch 
            || editScope == AppPermissions.Scopes.Department;

        bool canEditJobDetails = isSuperOrAdmin 
            || string.IsNullOrEmpty(editScope)
            || editScope == AppPermissions.Scopes.EditAllDetails 
            || editScope == AppPermissions.Scopes.All 
            || editScope == AppPermissions.Scopes.OwnBranch 
            || editScope == AppPermissions.Scopes.Department 
            || (editScope != AppPermissions.Scopes.EditBasicInfo && editScope != AppPermissions.Scopes.EditStatusChanges && editScope != AppPermissions.Scopes.EditCompensation);

        bool canEditLifecycle = isSuperOrAdmin 
            || string.IsNullOrEmpty(editScope)
            || editScope == AppPermissions.Scopes.EditStatusChanges 
            || editScope == AppPermissions.Scopes.EditAllDetails 
            || editScope == AppPermissions.Scopes.All 
            || editScope == AppPermissions.Scopes.OwnBranch 
            || editScope == AppPermissions.Scopes.Department;

        // 1. Personal / Basic Details
        if (canEditBasic)
        {
            if (!string.IsNullOrWhiteSpace(dto.EmployeeName)) employee.EmployeeName = dto.EmployeeName.Trim();
            employee.Phone = dto.Phone?.Trim();
            employee.DateOfBirth = dto.DateOfBirth;
            employee.BloodGroup = dto.BloodGroup;
            employee.Gender = dto.Gender;
            employee.MaritalStatus = dto.MaritalStatus;
            employee.Nationality = dto.Nationality;
            if (dto.PersonalEmail != null) employee.PersonalEmail = dto.PersonalEmail.Trim();
            if (dto.CurrentAddress != null) employee.CurrentAddress = dto.CurrentAddress.Trim();
            if (dto.PermanentAddress != null) employee.PermanentAddress = dto.PermanentAddress.Trim();
        }

        // 2. Job Structure, Corporate Work Email, Department, Designation, Manager, Role, Attendance Type
        if (canEditJobDetails)
        {
            if (dto.WorkEmail != null) employee.WorkEmail = dto.WorkEmail.Trim();
            employee.DepartmentId = dto.DepartmentId;
            employee.DesignationId = dto.DesignationId;
            employee.ReportingManagerId = dto.ReportingManagerId;
            if (dto.BranchId.HasValue) employee.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;
            employee.EmploymentType = dto.EmploymentType;
            if (!string.IsNullOrWhiteSpace(dto.Weekoff)) employee.Weekoff = dto.Weekoff;
            if (!string.IsNullOrWhiteSpace(dto.AttendanceType)) employee.AttendanceType = dto.AttendanceType.Trim();
            if (dto.JoiningDate.HasValue) employee.JoiningDate = dto.JoiningDate.Value;

            // Auto-provision or update user account & role
            if (dto.RoleId.HasValue)
            {
                var user = await _db.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.EmployeeId == employee.EmployeeId && u.OrganizationId == employee.OrganizationId);

                if (dto.RoleId.Value > 0)
                {
                    var roleObj = await _db.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId.Value);
                    var roleName = roleObj?.Name ?? "Employee";
                    if (roleName.Equals("Administrator", StringComparison.OrdinalIgnoreCase) || roleName.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || roleName.Equals("Super Admin", StringComparison.OrdinalIgnoreCase))
                    {
                        roleName = "Admin";
                    }

                    if (user != null)
                    {
                        user.RoleId = dto.RoleId.Value;
                        if (user.Role != "SuperAdmin")
                        {
                            user.Role = roleName;
                        }
                        user.FullName = employee.EmployeeName;
                        if (!string.IsNullOrWhiteSpace(employee.WorkEmail))
                        {
                            user.Username = employee.WorkEmail;
                        }
                        user.IsActive = true;
                    }
                    else
                    {
                        var username = !string.IsNullOrWhiteSpace(employee.WorkEmail)
                            ? employee.WorkEmail
                            : (!string.IsNullOrWhiteSpace(employee.PersonalEmail) ? employee.PersonalEmail : $"emp{employee.EmployeeId}");

                        user = new User
                        {
                            Username = username,
                            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123", 12),
                            FullName = employee.EmployeeName,
                            RoleId = dto.RoleId.Value,
                            Role = roleName,
                            IsActive = true,
                            BranchId = employee.BranchId,
                            OrganizationId = employee.OrganizationId,
                            EmployeeId = employee.EmployeeId
                        };
                        _db.Users.Add(user);
                    }
                }
                else if (dto.RoleId.Value == 0 && user != null)
                {
                    user.IsActive = false;
                }
            }
        }

        // 3. Status & Lifecycle changes
        if (canEditLifecycle)
        {
            employee.LastWorkingDate = dto.LastWorkingDate;
            employee.ResignationDate = dto.ResignationDate;
            employee.ProbationStart = dto.ProbationStart;
            employee.ProbationEnd = dto.ProbationEnd;
            employee.HasProbation = dto.HasProbation;
            employee.ProbationDays = dto.ProbationDays;
            employee.ContractDurationMonths = dto.ContractDurationMonths;
            employee.ContractEndDate = dto.ContractEndDate;
        }

        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { message = "Employee updated successfully." });
    }

    [HttpPost("{publicId:guid}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.PublicId == publicId);
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

    [HttpDelete("{publicId:guid}")]
    public async Task<IActionResult> DeleteEmployee(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.PublicId == publicId);
        if (employee == null) return NotFound(new { message = "Employee not found." });

        var id = employee.EmployeeId;

        if (employee.Status?.ToLower() == "active")
        {
            return BadRequest(new { message = "Cannot permanently delete an active employee. Archive them first by setting status to inactive." });
        }

        // Check if employee has related records that block deletion
        var hasAttendance = await _db.DailyAttendance.AnyAsync(a => a.EmployeeId == id);
        var hasPayroll = await _db.PayrollMasters.AnyAsync(p => p.EmployeeId == id);
        var hasLoans = await _db.EmployeeLoans.AnyAsync(l => l.EmployeeId == id && (l.Status == "Disbursed" || l.Status == "Active"));

        if (hasPayroll)
        {
            return BadRequest(new { message = "Cannot delete employee with processed payroll records. Remove payroll history first." });
        }

        if (hasLoans)
        {
            return BadRequest(new { message = "Cannot delete employee with active/disbursed loans. Close or foreclose the loans first." });
        }

        // Remove related records
        var leaves = await _db.LeaveApplications.Where(l => l.EmployeeId == id).ToListAsync();
        _db.LeaveApplications.RemoveRange(leaves);

        var attendance = await _db.DailyAttendance.Where(a => a.EmployeeId == id).ToListAsync();
        _db.DailyAttendance.RemoveRange(attendance);

        var documents = await _db.EmployeeDocuments.Where(d => d.EmployeeId == id).ToListAsync();
        _db.EmployeeDocuments.RemoveRange(documents);

        var loans = await _db.EmployeeLoans.Include(l => l.LoanInstallments).Where(l => l.EmployeeId == id).ToListAsync();
        foreach (var loan in loans)
        {
            _db.LoanInstallments.RemoveRange(loan.LoanInstallments);
        }
        _db.EmployeeLoans.RemoveRange(loans);

        var shiftAssignments = await _db.EmployeeShiftAssignments.Where(s => s.EmployeeId == id).ToListAsync();
        _db.EmployeeShiftAssignments.RemoveRange(shiftAssignments);

        // Remove the user account if linked
        var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == id);
        if (user != null)
        {
            _db.Users.Remove(user);
        }

        _db.Employees.Remove(employee);
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { message = $"Employee '{employee.EmployeeName}' permanently deleted along with all related records." });
    }

    [HttpPost("{id}/photo")]
    public async Task<IActionResult> UploadPhoto(int id, IFormFile photo)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        if (photo == null || photo.Length == 0)
        {
            return BadRequest(new { message = "No file uploaded." });
        }

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(photo.ContentType))
        {
            return BadRequest(new { message = "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed." });
        }

        if (photo.Length > 5 * 1024 * 1024) // 5MB limit
        {
            return BadRequest(new { message = "File size cannot exceed 5MB." });
        }

        byte[] photoBytes;
        using (var ms = new MemoryStream())
        {
            await photo.CopyToAsync(ms);
            photoBytes = ms.ToArray();
        }

        var organizationId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var employee = await _db.Employees
            .FirstOrDefaultAsync(e => e.EmployeeId == id && e.OrganizationId == organizationId);

        if (employee == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        // Update using ADO.NET because PhotoData is [NotMapped] in EF Core to prevent hangs
        var connection = Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.GetDbConnection(_db.Database);
        bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
        if (wasClosed) await connection.OpenAsync();

        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "UPDATE employees SET PhotoData = @p, PhotoContentType = @c, PhotoPath = @path WHERE employee_id = @id AND organization_id = @org";
            
            var pParam = cmd.CreateParameter(); pParam.ParameterName = "@p"; pParam.Value = photoBytes; cmd.Parameters.Add(pParam);
            var cParam = cmd.CreateParameter(); cParam.ParameterName = "@c"; cParam.Value = photo.ContentType; cmd.Parameters.Add(cParam);
            var idParam = cmd.CreateParameter(); idParam.ParameterName = "@id"; idParam.Value = id; cmd.Parameters.Add(idParam);
            var orgParam = cmd.CreateParameter(); orgParam.ParameterName = "@org"; orgParam.Value = organizationId; cmd.Parameters.Add(orgParam);
            
            // Also set a dummy PhotoPath so the frontend knows there's a photo
            var pathParam = cmd.CreateParameter(); pathParam.ParameterName = "@path"; pathParam.Value = $"/api/Thumbnail?employeeId={id}"; cmd.Parameters.Add(pathParam);
            
            await cmd.ExecuteNonQueryAsync();
            
            // Invalidate server-side thumbnail cache for all sizes so the new photo is served immediately
            var orgId = organizationId;
            foreach (var size in new[] { 150, 40, 60, 80, 100, 200 })
            {
                _memoryCache.Remove($"thumb_{orgId}_{id}_{size}_{size}");
            }
        }
        finally
        {
            if (wasClosed) await connection.CloseAsync();
        }

        // Include a version token in the path so the browser never serves a stale cached image
        var versionedPath = $"/api/Thumbnail?employeeId={id}&v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        // Persist the versioned path in the DB so all subsequent loads get a fresh URL
        var empToUpdate = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id && e.OrganizationId == organizationId);
        if (empToUpdate != null)
        {
            empToUpdate.PhotoPath = versionedPath;
            await _db.SaveChangesAsync();
        }

        return Ok(new { success = true, photoPath = versionedPath, message = "Profile picture updated successfully." });
    }

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
        string? CurrentAddress = null,
        string? PermanentAddress = null,
        bool HasProbation = false,
        int? ProbationDays = null,
        int? ContractDurationMonths = null,
        DateTime? ContractEndDate = null,
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
        string? CurrentAddress = null,
        string? PermanentAddress = null,
        bool HasProbation = false,
        int? ProbationDays = null,
        int? ContractDurationMonths = null,
        DateTime? ContractEndDate = null,
        int? RoleId = null
    );
}
