using System.Security.Claims;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Services.Infrastructure;

public sealed class PermissionService : IPermissionService
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IMemoryCache _cache;
    private static long _cacheVersion = 0;

    public PermissionService(
        BiometricAttendanceDbContext context,
        ICurrentTenantProvider tenantProvider,
        IMemoryCache cache)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _cache = cache;
    }

    public void ClearCache()
    {
        Interlocked.Increment(ref _cacheVersion);
    }

    private static string? GetUsername(ClaimsPrincipal user)
    {
        if (user.Identity?.IsAuthenticated != true) return null;
        return user.Identity?.Name 
            ?? user.FindFirst(ClaimTypes.Name)?.Value 
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("unique_name")?.Value
            ?? user.FindFirst("name")?.Value
            ?? user.FindFirst(ClaimTypes.Email)?.Value;
    }

    /// <summary>
    /// Checks if the authenticated user is a Platform Super Admin.
    /// Authority comes from the server-signed IsPlatformUser JWT claim — cannot be forged.
    /// </summary>
    private static bool IsPlatformSuperAdmin(ClaimsPrincipal user)
    {
        return string.Equals(user.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<bool> HasPermissionAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return false;

        // Only SuperAdmin has universal bypass
        if (IsPlatformSuperAdmin(user))
            return true;

        var permissions = await GetUserPermissionEntriesAsync(user);
        return permissions.Any(p => p.PermissionKey == permissionKey);
    }

    public async Task<string?> GetPermissionScopeAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return null;

        if (IsPlatformSuperAdmin(user))
            return AppPermissions.Scopes.All;

        var permissions = await GetUserPermissionEntriesAsync(user);
        var match = permissions.FirstOrDefault(p => p.PermissionKey == permissionKey);
        return match?.Scope;
    }

    public async Task<IReadOnlyList<string>> GetUserPermissionsAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return Array.Empty<string>();

        if (IsPlatformSuperAdmin(user))
            return AppPermissions.All.Select(p => p.Key).ToList();

        var permissions = await GetUserPermissionEntriesAsync(user);
        return permissions.Select(p => p.PermissionKey).Distinct().ToList();
    }

    public async Task<Dictionary<string, string>> GetUserPermissionScopesAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return new Dictionary<string, string>();

        if (IsPlatformSuperAdmin(user))
            return AppPermissions.All.ToDictionary(p => p.Key, _ => AppPermissions.Scopes.All);

        var permissions = await GetUserPermissionEntriesAsync(user);
        return permissions
            .GroupBy(p => p.PermissionKey)
            .ToDictionary(g => g.Key, g => g.First().Scope);
    }

    public async Task<int?> GetCurrentEmployeeIdAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return null;

        // 1. Direct EmployeeId claim
        var empIdClaim = user.FindFirst("EmployeeId")?.Value 
            ?? user.FindFirst("employee_id")?.Value;
        if (!string.IsNullOrEmpty(empIdClaim) && int.TryParse(empIdClaim, out int claimEmpId) && claimEmpId > 0)
            return claimEmpId;

        // 2. Lookup DB User by username / email
        var username = GetUsername(user);
        if (!string.IsNullOrEmpty(username))
        {
            var dbUser = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

            if (dbUser?.EmployeeId != null && dbUser.EmployeeId.Value > 0)
                return dbUser.EmployeeId.Value;

            // 3. Match Employee table directly by email
            var matchingEmp = await _context.Employees
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.WorkEmail == username || e.PersonalEmail == username);

            if (matchingEmp != null)
                return matchingEmp.EmployeeId;
        }

        return null;
    }

    public async Task<Employee?> GetCurrentEmployeeAsync(ClaimsPrincipal user)
    {
        var empId = await GetCurrentEmployeeIdAsync(user);
        if (!empId.HasValue) return null;

        return await _context.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .FirstOrDefaultAsync(e => e.EmployeeId == empId.Value);
    }

    public async Task<IQueryable<Employee>> ApplyEmployeeScopeAsync(
        IQueryable<Employee> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.EmployeesView)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.OwnBranch;
            else return query.Where(_ => false);
        }

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(e => e.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting || scope == "Reporting")
        {
            return query.Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(e => e.EmployeeId == currentEmpId.Value);

            return query.Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId);
        }

        if (scope == AppPermissions.Scopes.OwnBranch)
        {
            if (currentEmp?.BranchId != null)
                return query.Where(e => e.BranchId == currentEmp.BranchId);
        }

        if (scope == AppPermissions.Scopes.All)
        {
            return query;
        }

        return query;
    }

    public async Task<IQueryable<DailyAttendance>> ApplyAttendanceScopeAsync(
        IQueryable<DailyAttendance> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.AttendanceView)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.OwnBranch;
            else return query.Where(_ => false);
        }

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(a => a.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting || scope == "Reporting")
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => reporteeIds.Contains(a.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(a => a.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => deptEmpIds.Contains(a.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.OwnBranch)
        {
            if (currentEmp?.BranchId != null)
            {
                var branchEmpIds = await _context.Employees
                    .Where(e => e.BranchId == currentEmp.BranchId)
                    .Select(e => e.EmployeeId)
                    .ToListAsync();

                return query.Where(a => branchEmpIds.Contains(a.EmployeeId));
            }
        }

        if (scope == AppPermissions.Scopes.All)
        {
            return query;
        }

        return query;
    }

    public async Task<IQueryable<LeaveApplication>> ApplyLeaveScopeAsync(
        IQueryable<LeaveApplication> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.LeavesView)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.OwnBranch;
            else return query.Where(_ => false);
        }

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(l => l.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting || scope == "Reporting")
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(l => reporteeIds.Contains(l.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(l => l.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(l => deptEmpIds.Contains(l.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.OwnBranch)
        {
            if (currentEmp?.BranchId != null)
            {
                var branchEmpIds = await _context.Employees
                    .Where(e => e.BranchId == currentEmp.BranchId)
                    .Select(e => e.EmployeeId)
                    .ToListAsync();

                return query.Where(l => branchEmpIds.Contains(l.EmployeeId));
            }
        }

        if (scope == AppPermissions.Scopes.All)
        {
            return query;
        }

        return query;
    }

    public async Task<IQueryable<AttendanceRegularization>> ApplyRegularizationScopeAsync(
        IQueryable<AttendanceRegularization> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.AttendanceRegularize)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.OwnBranch;
            else return query.Where(_ => false);
        }

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(r => r.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting || scope == "Reporting")
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => reporteeIds.Contains(r.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(r => r.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => deptEmpIds.Contains(r.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.OwnBranch)
        {
            if (currentEmp?.BranchId != null)
            {
                var branchEmpIds = await _context.Employees
                    .Where(e => e.BranchId == currentEmp.BranchId)
                    .Select(e => e.EmployeeId)
                    .ToListAsync();

                return query.Where(r => branchEmpIds.Contains(r.EmployeeId));
            }
        }

        if (scope == AppPermissions.Scopes.All)
        {
            return query;
        }

        return query;
    }

    public async Task<IQueryable<CompOffRequest>> ApplyCompOffScopeAsync(
        IQueryable<CompOffRequest> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.CompOffApprove)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.OwnBranch;
            else return query.Where(_ => false);
        }

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(c => c.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting || scope == "Reporting")
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(c => reporteeIds.Contains(c.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(c => c.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(c => deptEmpIds.Contains(c.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.OwnBranch)
        {
            if (currentEmp?.BranchId != null)
            {
                var branchEmpIds = await _context.Employees
                    .Where(e => e.BranchId == currentEmp.BranchId)
                    .Select(e => e.EmployeeId)
                    .ToListAsync();

                return query.Where(c => branchEmpIds.Contains(c.EmployeeId));
            }
        }

        if (scope == AppPermissions.Scopes.All)
        {
            return query;
        }

        return query;
    }

    private async Task<List<RolePermission>> GetUserPermissionEntriesAsync(ClaimsPrincipal user)
    {
        var username = GetUsername(user);
        if (string.IsNullOrEmpty(username))
            return new List<RolePermission>();

        string cacheKey = $"user_permissions_{_tenantProvider.TenantId}_{username}_v{_cacheVersion}";
        if (_cache.TryGetValue(cacheKey, out List<RolePermission>? cached) && cached != null)
        {
            return cached;
        }

        var dbUser = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(u => u.CustomRole)
                .ThenInclude(r => r!.Permissions)
            .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

        if (dbUser?.CustomRole == null)
        {
            // Default fallback based on legacy Role string
            var fallbackPermissions = new List<RolePermission>();
            if (dbUser?.Role == "SuperAdmin")
            {
                fallbackPermissions = AppPermissions.All.Select(p => new RolePermission
                {
                    PermissionKey = p.Key,
                    Scope = AppPermissions.Scopes.All
                }).ToList();
            }
            else if (dbUser?.Role == "Admin")
            {
                fallbackPermissions = AppPermissions.All.Select(p => new RolePermission
                {
                    PermissionKey = p.Key,
                    Scope = AppPermissions.Scopes.OwnBranch
                }).ToList();
            }
            else if (dbUser?.Role == "Manager")
            {
                fallbackPermissions = AppPermissions.All.Select(p => new RolePermission
                {
                    PermissionKey = p.Key,
                    Scope = p.SupportsScope ? AppPermissions.Scopes.Reporting : AppPermissions.Scopes.OwnBranch
                }).ToList();
            }
            else
            {
                // Standard Employee default access (Own records only)
                var employeePermKeys = new[]
                {
                    AppPermissions.Keys.EmployeesView,
                    AppPermissions.Keys.AttendanceView,
                    AppPermissions.Keys.AttendanceRegularize,
                    AppPermissions.Keys.LeavesView,
                    AppPermissions.Keys.LeavesApply,
                    AppPermissions.Keys.PayrollView,
                    AppPermissions.Keys.AttendanceRoster
                };

                fallbackPermissions = employeePermKeys
                    .Select(key => new RolePermission
                    {
                        PermissionKey = key,
                        Scope = AppPermissions.Scopes.Own
                    }).ToList();
            }

            _cache.Set(cacheKey, fallbackPermissions, TimeSpan.FromMinutes(5));
            return fallbackPermissions;
        }

        var list = dbUser.CustomRole.Permissions.ToList();
        _cache.Set(cacheKey, list, TimeSpan.FromMinutes(5));
        return list;
    }
}
