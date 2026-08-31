using HRDesk.Web.Constants;
using HRDesk.Web.Data;
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
    private readonly IArchiveService _archive;

    private static bool _contractColumnsEnsured = false;
    private static readonly object _columnLock = new();

    public EmployeesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ICurrentTenantProvider tenantProvider,
        IPlanEntitlementService entitlementService,
        IMemoryCache memoryCache,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _tenantProvider = tenantProvider;
        _entitlementService = entitlementService;
        _memoryCache = memoryCache;
        _archive = archive;
        EnsureContractColumns();
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

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

        _db.BypassArchiveFilter = true;
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
            if (status.Equals("inactive", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.ArchivedAt != null || (e.Status != null && e.Status.ToLower() == "inactive"));
            }
            else if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.ArchivedAt == null && (e.Status == null || e.Status.ToLower() == "active"));
            }
            else
            {
                query = query.Where(e => e.Status != null && e.Status.ToLower() == status.ToLower() && e.ArchivedAt == null);
            }
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
                e.PhotoPath,
                e.ArchivedAt
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
                Status = e.ArchivedAt != null ? "Archived" : e.Status,
                e.Weekoff,
                e.PhotoPath,
                archivedAt = e.ArchivedAt
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
            // Bank account
            employee.BankName,
            employee.BankAccountNumber,
            employee.BankIfscCode,
            employee.BankAccountHolderName,
            employee.BankAccountType,
            // Statutory
            employee.PanNumber,
            employee.AadhaarNumber,
            employee.UanNumber,
            employee.PfNumber,
            employee.EsiNumber,
            // Emergency contact
            employee.EmergencyContactName,
            employee.EmergencyContactRelation,
            employee.EmergencyContactPhone,
            employee.EmergencyContacts,
            // Additional
            employee.FatherOrSpouseName,
            employee.PassportNumber,
            employee.NoticePeriodDays,
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


    // ── GET salary overview (for Payroll > Employee Salaries tab) ────────────

    [HttpGet("salary-overview")]
    public async Task<IActionResult> GetSalaryOverview(
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? payGroupId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
            return Forbid();

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.PayGroup)
            .Where(e => e.Status == "active");

        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.PayrollManageSalary);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(e => e.EmployeeName.Contains(search) || e.EmployeeId.ToString().Contains(search));

        if (departmentId.HasValue)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        if (payGroupId.HasValue && payGroupId.Value == 0)
            query = query.Where(e => e.PayGroupId == null);        // unassigned only
        else if (payGroupId.HasValue)
            query = query.Where(e => e.PayGroupId == payGroupId.Value);

        var employees = await query
            .OrderBy(e => e.EmployeeName)
            .Select(e => new
            {
                e.EmployeeId,
                e.PublicId,
                e.EmployeeName,
                employeeCode = (string?)null,
                department = e.Department != null ? e.Department.DepartmentName : null,
                designation = e.Designation != null ? e.Designation.DesignationName : null,
                e.PayGroupId,
                payGroupName = e.PayGroup != null ? e.PayGroup.Name : null,
                payGroupBasis = e.PayGroup != null ? e.PayGroup.SalaryBasis : null,
            })
            .ToListAsync();

        // Fetch active CTC for all employees in one query
        var empIds = employees.Select(e => e.EmployeeId).ToList();
        var ctcRecords = await _db.EmployeeCTCs
            .AsNoTracking()
            .Include(c => c.Template)
            .Where(c => empIds.Contains(c.EmployeeId) && c.EffectiveTo == null)
            .Select(c => new
            {
                c.EmployeeId,
                c.AnnualCTC,
                c.TemplateId,
                templateName = c.Template != null ? c.Template.Name : null,
                effectiveFrom = c.EffectiveFrom.ToString("yyyy-MM-dd"),
            })
            .ToListAsync();

        var ctcMap = ctcRecords.ToDictionary(c => c.EmployeeId);

        var result = employees.Select(e =>
        {
            ctcMap.TryGetValue(e.EmployeeId, out var ctc);
            return new
            {
                e.EmployeeId,
                e.PublicId,
                e.EmployeeName,
                employeeCode     = $"EMP#{e.EmployeeId:D3}",
                e.department,
                e.designation,
                e.PayGroupId,
                e.payGroupName,
                e.payGroupBasis,
                annualCTC        = ctc?.AnnualCTC,
                monthlyCTC       = ctc != null ? (decimal?)(ctc.AnnualCTC / 12) : null,
                templateId       = ctc?.TemplateId,
                templateName     = ctc?.templateName,
                ctcEffectiveFrom = ctc?.effectiveFrom,
            };
        });

        return Ok(result);
    }

    [HttpGet("lookups")]
    public async Task<IActionResult> GetLookups()
    {
        var departments = await _cache.GetDepartmentsAsync();
        var designations = await _cache.GetDesignationsAsync();
        var shifts = await _cache.GetShiftsAsync();

        var createScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesCreate);
        var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("SuperAdmin");

        if (!isSuperAdmin)
        {
            if ((createScope == AppPermissions.Scopes.Department || createScope == "Own Department" || createScope == "Department" || createScope == AppPermissions.Scopes.Reporting || createScope == "Reporting To" || createScope == "Reporting") && currentEmp?.DepartmentId != null)
            {
                departments = departments.Where(d => d.Id == currentEmp.DepartmentId.Value).ToList();
            }
            else if (createScope == AppPermissions.Scopes.OwnBranch && currentEmp?.BranchId != null)
            {
                departments = departments.Where(d => d.BranchId == null || d.BranchId == currentEmp.BranchId).ToList();
            }
        }

        var managersQuery = _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active");

        if (!isSuperAdmin)
        {
            if (createScope == AppPermissions.Scopes.Reporting || createScope == "Reporting To" || createScope == "Reporting")
            {
                if (currentEmpId.HasValue)
                {
                    managersQuery = managersQuery.Where(e => e.EmployeeId == currentEmpId.Value);
                }
            }
            else if ((createScope == AppPermissions.Scopes.Department || createScope == "Own Department" || createScope == "Department") && currentEmp?.DepartmentId != null)
            {
                managersQuery = managersQuery.Where(e => e.DepartmentId == currentEmp.DepartmentId.Value);
            }
            else if (createScope == AppPermissions.Scopes.OwnBranch && currentEmp?.BranchId != null)
            {
                managersQuery = managersQuery.Where(e => e.BranchId == currentEmp.BranchId);
            }
        }

        var managers = await managersQuery
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
            roles,
            userDepartmentId = currentEmp?.DepartmentId,
            userEmployeeId = currentEmpId,
            createScope = createScope
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
        var targetDeptId = dto.DepartmentId;
        var targetManagerId = dto.ReportingManagerId;

        // Scoping enforcement based on caller's Employees.Create permission scope
        var createScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesCreate);
        var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("SuperAdmin");

        if (!isSuperAdmin)
        {
            if (createScope == AppPermissions.Scopes.Department || createScope == "Own Department" || createScope == "Department" || createScope == AppPermissions.Scopes.Reporting || createScope == "Reporting To" || createScope == "Reporting")
            {
                if (currentEmp?.DepartmentId != null)
                {
                    if (dto.DepartmentId.HasValue && dto.DepartmentId.Value != currentEmp.DepartmentId.Value)
                    {
                        return BadRequest(new { message = "You are only authorized to add employees to your own department." });
                    }
                    targetDeptId = currentEmp.DepartmentId.Value;
                }
            }
            
            if (createScope == AppPermissions.Scopes.Reporting || createScope == "Reporting To" || createScope == "Reporting")
            {
                if (currentEmpId.HasValue)
                {
                    if (dto.ReportingManagerId.HasValue && dto.ReportingManagerId.Value != currentEmpId.Value)
                    {
                        return BadRequest(new { message = "You are only authorized to add employees who report directly to you." });
                    }
                    targetManagerId = currentEmpId.Value;
                }
            }
            else if (createScope == AppPermissions.Scopes.OwnBranch && currentEmp?.BranchId != null)
            {
                if (dto.BranchId.HasValue && dto.BranchId.Value != currentEmp.BranchId.Value)
                {
                    return BadRequest(new { message = "You are only authorized to add employees to your own branch." });
                }
                targetBranchId = currentEmp.BranchId.Value;
            }
        }

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
            DepartmentId = targetDeptId,
            DesignationId = dto.DesignationId,
            ReportingManagerId = targetManagerId,
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
            ContractEndDate = dto.ContractEndDate,
            // Bank account
            BankName = dto.BankName?.Trim(),
            BankAccountNumber = dto.BankAccountNumber?.Trim(),
            BankIfscCode = dto.BankIfscCode?.Trim()?.ToUpperInvariant(),
            BankAccountHolderName = dto.BankAccountHolderName?.Trim(),
            BankAccountType = dto.BankAccountType?.Trim(),
            // Statutory
            PanNumber = dto.PanNumber?.Trim()?.ToUpperInvariant(),
            AadhaarNumber = dto.AadhaarNumber?.Trim(),
            UanNumber = dto.UanNumber?.Trim(),
            PfNumber = dto.PfNumber?.Trim(),
            EsiNumber = dto.EsiNumber?.Trim(),
            // Emergency contact
            EmergencyContactName = dto.EmergencyContactName?.Trim(),
            EmergencyContactRelation = dto.EmergencyContactRelation?.Trim(),
            EmergencyContactPhone = dto.EmergencyContactPhone?.Trim(),
            EmergencyContacts = dto.EmergencyContacts?.Trim(),
            // Additional
            FatherOrSpouseName = dto.FatherOrSpouseName?.Trim(),
            PassportNumber = dto.PassportNumber?.Trim()?.ToUpperInvariant(),
            NoticePeriodDays = dto.NoticePeriodDays,
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

        bool canEditBasic = true;
        bool canEditJobDetails = isSuperOrAdmin 
            || string.IsNullOrEmpty(editScope)
            || editScope != AppPermissions.Scopes.EditBasicInfo;

        bool canEditLifecycle = canEditJobDetails;

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

            // Bank account
            if (dto.BankName != null) employee.BankName = dto.BankName.Trim();
            if (dto.BankAccountNumber != null) employee.BankAccountNumber = dto.BankAccountNumber.Trim();
            if (dto.BankIfscCode != null) employee.BankIfscCode = dto.BankIfscCode.Trim().ToUpperInvariant();
            if (dto.BankAccountHolderName != null) employee.BankAccountHolderName = dto.BankAccountHolderName.Trim();
            if (dto.BankAccountType != null) employee.BankAccountType = dto.BankAccountType.Trim();

            // Statutory
            if (dto.PanNumber != null) employee.PanNumber = dto.PanNumber.Trim().ToUpperInvariant();
            if (dto.AadhaarNumber != null) employee.AadhaarNumber = dto.AadhaarNumber.Trim();
            if (dto.UanNumber != null) employee.UanNumber = dto.UanNumber.Trim();
            if (dto.PfNumber != null) employee.PfNumber = dto.PfNumber.Trim();
            if (dto.EsiNumber != null) employee.EsiNumber = dto.EsiNumber.Trim();

            // Emergency contact
            if (dto.EmergencyContactName != null) employee.EmergencyContactName = dto.EmergencyContactName.Trim();
            if (dto.EmergencyContactRelation != null) employee.EmergencyContactRelation = dto.EmergencyContactRelation.Trim();
            if (dto.EmergencyContactPhone != null) employee.EmergencyContactPhone = dto.EmergencyContactPhone.Trim();
            if (dto.EmergencyContacts != null) employee.EmergencyContacts = dto.EmergencyContacts.Trim();

            // Additional
            if (dto.FatherOrSpouseName != null) employee.FatherOrSpouseName = dto.FatherOrSpouseName.Trim();
            if (dto.PassportNumber != null) employee.PassportNumber = dto.PassportNumber.Trim().ToUpperInvariant();
            employee.NoticePeriodDays = dto.NoticePeriodDays;
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

    /// <summary>
    /// "Delete" from the main employee list → archive (reversible).
    /// "Delete" from the Archive view → ?permanent=true, which wipes the employee and every
    /// dependent row. Payroll history and live loans block the permanent path.
    /// </summary>
    [HttpDelete("{publicId:guid}")]
    public async Task<IActionResult> DeleteEmployee(Guid publicId, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesDelete))
        {
            return Forbid();
        }

        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("SuperAdmin");
        if (!isSuperAdmin)
        {
            var deleteScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesDelete);
            if (permanent && deleteScope != "Permanent Delete")
            {
                return StatusCode(403, new { message = "You do not have permission to permanently delete employee records." });
            }
        }

        _db.BypassArchiveFilter = true;
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.PublicId == publicId);
        if (employee == null) return NotFound(new { message = "Employee not found." });

        var id = employee.EmployeeId;
        var name = employee.EmployeeName;

        if (!permanent)
        {
            var archived = await _archive.ArchiveAsync<Employee>(id);
            if (archived.Success)
            {
                // Keep the legacy Status field in step so existing screens/reports stay correct.
                employee.Status = "inactive";
                await _db.SaveChangesAsync();
                _permissionService.ClearCache();
            }
            return FromArchive(archived);
        }

        var hasPayroll = await _db.PayrollMasters.AnyAsync(p => p.EmployeeId == id);
        var hasLiveLoans = await _db.EmployeeLoans
            .AnyAsync(l => l.EmployeeId == id && (l.Status == "Disbursed" || l.Status == "Active"));
        var managesEmployees = await _db.Employees.AnyAsync(e => e.ReportingManagerId == id);

        string? Guard(Employee _) =>
            managesEmployees
                ? "Cannot delete a manager. Please re-assign their direct reports first."
            : hasPayroll
                ? "Cannot delete employee with processed payroll records. Remove payroll history first."
            : hasLiveLoans
                ? "Cannot delete employee with active/disbursed loans. Close or foreclose the loans first."
            : null;

        var result = await _archive.PermanentDeleteAsync<Employee>(id, Guard, cascade: async _ =>
        {
            // FKs are Restrict-only across the model, so every dependent row must go first.
            _db.LeaveApplications.RemoveRange(
                await _db.LeaveApplications.Where(l => l.EmployeeId == id).ToListAsync());

            _db.DailyAttendance.RemoveRange(
                await _db.DailyAttendance.Where(a => a.EmployeeId == id).ToListAsync());

            _db.EmployeeDocuments.RemoveRange(
                await _db.EmployeeDocuments.Where(d => d.EmployeeId == id).ToListAsync());

            var loans = await _db.EmployeeLoans
                .Include(l => l.LoanInstallments)
                .Where(l => l.EmployeeId == id)
                .ToListAsync();
            foreach (var loan in loans)
                _db.LoanInstallments.RemoveRange(loan.LoanInstallments);
            _db.EmployeeLoans.RemoveRange(loans);

            _db.EmployeeShiftAssignments.RemoveRange(
                await _db.EmployeeShiftAssignments.Where(s => s.EmployeeId == id).ToListAsync());
                
            _db.ShiftRosters.RemoveRange(
                await _db.ShiftRosters.Where(s => s.EmployeeId == id).ToListAsync());
                
            _db.AttendanceRegularizations.RemoveRange(
                await _db.AttendanceRegularizations.Where(a => a.EmployeeId == id).ToListAsync());
                
            _db.GateActivityLogs.RemoveRange(
                await _db.GateActivityLogs.Where(g => g.EmployeeId == id).ToListAsync());
                
            _db.HolidayEmployees.RemoveRange(
                await _db.HolidayEmployees.Where(h => h.EmployeeId == id).ToListAsync());

            var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == id);
            if (user != null) _db.Users.Remove(user);
        });

        if (result.Success)
        {
            _permissionService.ClearCache();
            return Ok(new
            {
                success = true,
                message = $"Employee '{name}' permanently deleted along with all related records."
            });
        }

        return FromArchive(result);
    }

    [HttpPost("{publicId:guid}/restore")]
    public async Task<IActionResult> RestoreEmployee(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        _db.BypassArchiveFilter = true;
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.PublicId == publicId);
        if (employee == null) return NotFound(new { message = "Employee not found." });

        var result = await _archive.RestoreAsync<Employee>(employee.EmployeeId);
        if (result.Success)
        {
            employee.Status = "active";
            await _db.SaveChangesAsync();
            _permissionService.ClearCache();
        }
        return FromArchive(result);
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
        int? RoleId = null,
        // Bank account
        string? BankName = null,
        string? BankAccountNumber = null,
        string? BankIfscCode = null,
        string? BankAccountHolderName = null,
        string? BankAccountType = null,
        // Statutory
        string? PanNumber = null,
        string? AadhaarNumber = null,
        string? UanNumber = null,
        string? PfNumber = null,
        string? EsiNumber = null,
        // Emergency contact
        string? EmergencyContactName = null,
        string? EmergencyContactRelation = null,
        string? EmergencyContactPhone = null,
        string? EmergencyContacts = null,
        // Additional
        string? FatherOrSpouseName = null,
        string? PassportNumber = null,
        int? NoticePeriodDays = null
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
        int? RoleId = null,
        // Bank account
        string? BankName = null,
        string? BankAccountNumber = null,
        string? BankIfscCode = null,
        string? BankAccountHolderName = null,
        string? BankAccountType = null,
        // Statutory
        string? PanNumber = null,
        string? AadhaarNumber = null,
        string? UanNumber = null,
        string? PfNumber = null,
        string? EsiNumber = null,
        // Emergency contact
        string? EmergencyContactName = null,
        string? EmergencyContactRelation = null,
        string? EmergencyContactPhone = null,
        string? EmergencyContacts = null,
        // Additional
        string? FatherOrSpouseName = null,
        string? PassportNumber = null,
        int? NoticePeriodDays = null
    );
}
