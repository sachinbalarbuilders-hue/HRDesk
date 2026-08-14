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

    public PermissionService(
        BiometricAttendanceDbContext context,
        ICurrentTenantProvider tenantProvider,
        IMemoryCache cache)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _cache = cache;
    }

    public async Task<bool> HasPermissionAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return false;

        // Admin and SuperAdmin have bypass access to everything
        if (user.IsInRole("SuperAdmin") || user.IsInRole("Admin"))
            return true;

        var permissions = await GetUserPermissionEntriesAsync(user);
        return permissions.Any(p => p.PermissionKey == permissionKey);
    }

    public async Task<string?> GetPermissionScopeAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return null;

        if (user.IsInRole("SuperAdmin") || user.IsInRole("Admin"))
            return AppPermissions.Scopes.All;

        var permissions = await GetUserPermissionEntriesAsync(user);
        var match = permissions.FirstOrDefault(p => p.PermissionKey == permissionKey);
        return match?.Scope;
    }

    public async Task<IReadOnlyList<string>> GetUserPermissionsAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return Array.Empty<string>();

        if (user.IsInRole("SuperAdmin") || user.IsInRole("Admin"))
            return AppPermissions.All.Select(p => p.Key).ToList();

        var permissions = await GetUserPermissionEntriesAsync(user);
        return permissions.Select(p => p.PermissionKey).Distinct().ToList();
    }

    public async Task<int?> GetCurrentEmployeeIdAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return null;

        var username = user.Identity.Name;
        if (!string.IsNullOrEmpty(username))
        {
            var dbUser = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

            if (dbUser != null)
                return dbUser.EmployeeId;
        }

        // Fallback to Claim
        var empIdClaim = user.FindFirst("EmployeeId")?.Value;
        if (!string.IsNullOrEmpty(empIdClaim) && int.TryParse(empIdClaim, out int claimEmpId))
            return claimEmpId;

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
            .FirstOrDefaultAsync(e => e.EmployeeId == empId.Value);
    }

    public async Task<IQueryable<Employee>> ApplyEmployeeScopeAsync(
        IQueryable<Employee> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.EmployeesView)
    {
        if (user.IsInRole("SuperAdmin"))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            // Fallback: If user has role "Employee", default to Own scope
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.All;
            else return query.Where(_ => false); // Denied
        }

        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(e => e.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting)
        {
            return query.Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            var currentEmp = await GetCurrentEmployeeAsync(user);
            if (currentEmp?.DepartmentId == null)
                return query.Where(e => e.EmployeeId == currentEmpId.Value);

            return query.Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId);
        }

        return query;
    }

    public async Task<IQueryable<DailyAttendance>> ApplyAttendanceScopeAsync(
        IQueryable<DailyAttendance> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.AttendanceView)
    {
        if (user.IsInRole("SuperAdmin"))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.All;
            else return query.Where(_ => false);
        }

        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(a => a.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting)
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => reporteeIds.Contains(a.EmployeeId));
        }

        if (scope == AppPermissions.Scopes.Department)
        {
            var currentEmp = await GetCurrentEmployeeAsync(user);
            if (currentEmp?.DepartmentId == null)
                return query.Where(a => a.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => deptEmpIds.Contains(a.EmployeeId));
        }

        return query;
    }

    public async Task<IQueryable<LeaveApplication>> ApplyLeaveScopeAsync(
        IQueryable<LeaveApplication> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.LeavesView)
    {
        if (user.IsInRole("SuperAdmin"))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.All;
            else return query.Where(_ => false);
        }

        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(l => l.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting)
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(l => reporteeIds.Contains(l.EmployeeId));
        }

        return query;
    }

    public async Task<IQueryable<AttendanceRegularization>> ApplyRegularizationScopeAsync(
        IQueryable<AttendanceRegularization> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.AttendanceRegularize)
    {
        if (user.IsInRole("SuperAdmin"))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.All;
            else return query.Where(_ => false);
        }

        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(r => r.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting)
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => reporteeIds.Contains(r.EmployeeId));
        }

        return query;
    }

    public async Task<IQueryable<CompOffRequest>> ApplyCompOffScopeAsync(
        IQueryable<CompOffRequest> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.CompOffApprove)
    {
        if (user.IsInRole("SuperAdmin"))
            return query;

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            if (user.IsInRole("Employee")) scope = AppPermissions.Scopes.Own;
            else if (user.IsInRole("Manager")) scope = AppPermissions.Scopes.Reporting;
            else if (user.IsInRole("Admin")) scope = AppPermissions.Scopes.All;
            else return query.Where(_ => false);
        }

        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        if (scope == AppPermissions.Scopes.Own)
        {
            return query.Where(c => c.EmployeeId == currentEmpId.Value);
        }

        if (scope == AppPermissions.Scopes.Reporting)
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(c => reporteeIds.Contains(c.EmployeeId));
        }

        return query;
    }

    private static long _cacheVersion = 0;

    public void ClearCache()
    {
        Interlocked.Increment(ref _cacheVersion);
    }

    private async Task<List<RolePermission>> GetUserPermissionEntriesAsync(ClaimsPrincipal user)
    {
        var username = user.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return new List<RolePermission>();

        string cacheKey = $"user_permissions_{_tenantProvider.TenantId}_{username}_v{_cacheVersion}";
        if (_cache.TryGetValue(cacheKey, out List<RolePermission>? cached) && cached != null)
        {
            return cached;
        }

        var dbUser = await _context.Users
            .AsNoTracking()
            .Include(u => u.CustomRole)
                .ThenInclude(r => r!.Permissions)
            .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

        if (dbUser?.CustomRole == null)
        {
            // Default fallback based on legacy Role string
            var fallbackPermissions = new List<RolePermission>();
            if (dbUser?.Role == "Admin" || dbUser?.Role == "SuperAdmin")
            {
                fallbackPermissions = AppPermissions.All.Select(p => new RolePermission
                {
                    PermissionKey = p.Key,
                    Scope = AppPermissions.Scopes.All
                }).ToList();
            }
            else if (dbUser?.Role == "Manager")
            {
                fallbackPermissions = AppPermissions.All.Select(p => new RolePermission
                {
                    PermissionKey = p.Key,
                    Scope = p.SupportsScope ? AppPermissions.Scopes.Reporting : AppPermissions.Scopes.All
                }).ToList();
            }
            else
            {
                // Standard Employee
                fallbackPermissions = AppPermissions.All
                    .Where(p => p.Module == AppPermissions.Modules.SelfService)
                    .Select(p => new RolePermission
                    {
                        PermissionKey = p.Key,
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

