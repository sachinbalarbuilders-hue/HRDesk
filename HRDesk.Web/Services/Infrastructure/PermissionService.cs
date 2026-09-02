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
    private static readonly Dictionary<string, string[]> LegacyToGranularMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Masters.Organizations", new[] { "Masters.Organizations.View", "Masters.Organizations.Create", "Masters.Organizations.Edit", "Masters.Organizations.Delete" } },
        { "Masters.Departments", new[] { "Masters.Departments.View", "Masters.Departments.Create", "Masters.Departments.Edit", "Masters.Departments.Delete" } },
        { "Masters.Designations", new[] { "Masters.Designations.View", "Masters.Designations.Create", "Masters.Designations.Edit", "Masters.Designations.Delete" } },
        { "Leaves.ManageTypes", new[] { "Leaves.Types.View", "Leaves.Types.Create", "Leaves.Types.Edit", "Leaves.Types.Delete" } },
        { "Attendance.Roster", new[] { "Shifts.Roster.View", "Shifts.Roster.Assign" } },
        { "Shifts.Manage", new[] { "Shifts.View", "Shifts.Create", "Shifts.Edit", "Shifts.Delete", "Shifts.Roster.View", "Shifts.Roster.Assign", "Attendance.Roster", "Shifts.Requests.View", "Shifts.Requests.Apply", "Shifts.Requests.Approve", "Shifts.Requests.Delete" } },
        { "Shifts.Requests.Manage", new[] { "Shifts.Requests.View", "Shifts.Requests.Apply", "Shifts.Requests.Approve", "Shifts.Requests.Delete" } },
        { "Holidays.Manage", new[] { "Holidays.View", "Holidays.Create", "Holidays.Edit", "Holidays.Delete" } },
        { "Announcements.Manage", new[] { "Announcements.View", "Announcements.Create", "Announcements.Edit", "Announcements.Delete" } },
        { "System.Settings", new[] { "System.Settings.View", "System.Settings.Edit" } },
        { "System.Roles", new[] { "System.Roles.View", "System.Roles.Edit" } },
        { "System.Logs", new[] { "System.Logs.View" } },
    };

    public async Task<bool> HasPermissionAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return false;

        // Only SuperAdmin has universal bypass
        if (IsPlatformSuperAdmin(user))
            return true;

        var permissions = await GetUserPermissionEntriesAsync(user);
        var userKeys = new HashSet<string>(permissions.Select(p => p.PermissionKey), StringComparer.OrdinalIgnoreCase);

        // 1. Direct match (e.g. user has Masters.Departments.View and we asked for Masters.Departments.View)
        if (userKeys.Contains(permissionKey))
            return true;

        // 2. Legacy parent key check (e.g. user has legacy Masters.Departments which grants Masters.Departments.View)
        // ONLY applies if the role does not have any granular keys configured for that module
        foreach (var (legacyKey, granularChildren) in LegacyToGranularMap)
        {
            if (userKeys.Contains(legacyKey) && granularChildren.Contains(permissionKey, StringComparer.OrdinalIgnoreCase))
            {
                bool hasGranularConfigured = granularChildren.Any(gc => userKeys.Contains(gc));
                if (!hasGranularConfigured)
                {
                    return true;
                }
            }
        }

        return false;
    }

    public async Task<string?> GetPermissionScopeAsync(ClaimsPrincipal user, string permissionKey)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return null;

        if (IsPlatformSuperAdmin(user))
            return AppPermissions.Scopes.All;

        var permissions = await GetUserPermissionEntriesAsync(user);
        
        // 1. Direct match
        var directMatch = permissions.FirstOrDefault(p => string.Equals(p.PermissionKey, permissionKey, StringComparison.OrdinalIgnoreCase));
        if (directMatch != null) return directMatch.Scope;

        // 2. Legacy parent key check
        foreach (var (legacyKey, granularChildren) in LegacyToGranularMap)
        {
            if (granularChildren.Contains(permissionKey, StringComparer.OrdinalIgnoreCase))
            {
                var legacyMatch = permissions.FirstOrDefault(p => string.Equals(p.PermissionKey, legacyKey, StringComparison.OrdinalIgnoreCase));
                if (legacyMatch != null) return legacyMatch.Scope;
            }
        }

        return null;
    }

    public async Task<IReadOnlyList<string>> GetUserPermissionsAsync(ClaimsPrincipal user)
    {
        if (user.Identity == null || !user.Identity.IsAuthenticated)
            return Array.Empty<string>();

        if (IsPlatformSuperAdmin(user))
            return AppPermissions.All.Select(p => p.Key).Distinct().ToList();

        var permissions = await GetUserPermissionEntriesAsync(user);
        var keys = new HashSet<string>(permissions.Select(p => p.PermissionKey), StringComparer.OrdinalIgnoreCase);

        // If user has a legacy umbrella key, ONLY expand it if the role has NO granular keys for that module
        var expandedKeys = new HashSet<string>(keys, StringComparer.OrdinalIgnoreCase);
        foreach (var (legacyKey, granularChildren) in LegacyToGranularMap)
        {
            if (keys.Contains(legacyKey))
            {
                bool hasGranularConfigured = granularChildren.Any(gc => keys.Contains(gc));
                if (!hasGranularConfigured)
                {
                    foreach (var child in granularChildren)
                    {
                        expandedKeys.Add(child);
                    }
                }
                else
                {
                    // Clean up the obsolete legacy key from the returned active permission list
                    expandedKeys.Remove(legacyKey);
                }
            }
        }

        return expandedKeys.ToList();
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
            .IgnoreQueryFilters()
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

        // Fast-path: All scope doesn't need a linked employee record
        if (scope == AppPermissions.Scopes.All || scope.Equals("All", StringComparison.OrdinalIgnoreCase))
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        var currentEmp = await GetCurrentEmployeeAsync(user);
        var s = (scope ?? "").Trim();

        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            if (!currentEmpId.HasValue) return query.Where(_ => false);
            return query.Where(e => e.EmployeeId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            if (!currentEmpId.HasValue) return query.Where(_ => false);
            return query.Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
            {
                if (currentEmpId.HasValue)
                    return query.Where(e => e.EmployeeId == currentEmpId.Value);
                return query.Where(_ => false);
            }

            return query.Where(e => (currentEmpId.HasValue && e.EmployeeId == currentEmpId.Value) || e.DepartmentId == currentEmp.DepartmentId);
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.BranchId != null)
                return query.Where(e => e.BranchId == currentEmp.BranchId);
            if (_tenantProvider.BranchId.HasValue && _tenantProvider.BranchId.Value > 0)
                return query.Where(e => e.BranchId == _tenantProvider.BranchId.Value);
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

        // Fast-path: All scope doesn't need a linked employee record
        if (scope == AppPermissions.Scopes.All)
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);

        var s = (scope ?? "").Trim();

        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(a => a.EmployeeId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => reporteeIds.Contains(a.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(a => a.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(a => deptEmpIds.Contains(a.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
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

        if (s.Equals(AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase) || s.Equals("All", StringComparison.OrdinalIgnoreCase))
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

        // Fast-path: All scope doesn't need a linked employee record
        if (scope == AppPermissions.Scopes.All || scope.Equals("All", StringComparison.OrdinalIgnoreCase))
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);
        var s = (scope ?? "").Trim();

        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(l => l.EmployeeId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(l => reporteeIds.Contains(l.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(l => l.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(l => deptEmpIds.Contains(l.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
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

        if (s.Equals(AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase) || s.Equals("All", StringComparison.OrdinalIgnoreCase))
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

        // Fast-path: All scope doesn't need a linked employee record
        if (scope == AppPermissions.Scopes.All || scope.Equals("All", StringComparison.OrdinalIgnoreCase))
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);
        var s = (scope ?? "").Trim();

        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(r => r.EmployeeId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => reporteeIds.Contains(r.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(r => r.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => deptEmpIds.Contains(r.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
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

        if (s.Equals(AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase) || s.Equals("All", StringComparison.OrdinalIgnoreCase))
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

        // Fast-path: All scope doesn't need a linked employee record
        if (scope == AppPermissions.Scopes.All || scope.Equals("All", StringComparison.OrdinalIgnoreCase))
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue)
            return query.Where(_ => false);

        var currentEmp = await GetCurrentEmployeeAsync(user);
        var s = (scope ?? "").Trim();

        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(c => c.EmployeeId == currentEmpId.Value);
        }

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(c => reporteeIds.Contains(c.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(c => c.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(c => deptEmpIds.Contains(c.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
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

        if (s.Equals(AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase) || s.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            return query;
        }

        return query;
    }

    public async Task<IQueryable<ShiftChangeRequest>> ApplyShiftChangeRequestScopeAsync(
        IQueryable<ShiftChangeRequest> query, 
        ClaimsPrincipal user, 
        string permissionKey = AppPermissions.Keys.ShiftsRequestsView)
    {
        if (IsPlatformSuperAdmin(user))
            return query;

        var currentEmpId = await GetCurrentEmployeeIdAsync(user);
        if (!currentEmpId.HasValue || currentEmpId.Value <= 0)
        {
            if (user.IsInRole("SuperAdmin")) return query;
            return query.Where(r => false);
        }

        var scope = await GetPermissionScopeAsync(user, permissionKey);
        if (string.IsNullOrEmpty(scope))
        {
            var fallbackHas = await HasPermissionAsync(user, permissionKey);
            if (fallbackHas) return query;
            return query.Where(r => r.EmployeeId == currentEmpId.Value);
        }

        var s = scope.Trim();
        if (s.Equals(AppPermissions.Scopes.Own, StringComparison.OrdinalIgnoreCase) || s.Equals("Own", StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(r => r.EmployeeId == currentEmpId.Value);
        }

        var currentEmp = await GetCurrentEmployeeAsync(user);

        if (s.Equals(AppPermissions.Scopes.Reporting, StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting", StringComparison.OrdinalIgnoreCase) || s.Equals("Reporting To", StringComparison.OrdinalIgnoreCase))
        {
            var reporteeIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.ReportingManagerId == currentEmpId.Value)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => reporteeIds.Contains(r.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.Department, StringComparison.OrdinalIgnoreCase) || s.Equals("Department", StringComparison.OrdinalIgnoreCase))
        {
            if (currentEmp?.DepartmentId == null)
                return query.Where(r => r.EmployeeId == currentEmpId.Value);

            var deptEmpIds = await _context.Employees
                .Where(e => e.EmployeeId == currentEmpId.Value || e.DepartmentId == currentEmp.DepartmentId)
                .Select(e => e.EmployeeId)
                .ToListAsync();

            return query.Where(r => deptEmpIds.Contains(r.EmployeeId));
        }

        if (s.Equals(AppPermissions.Scopes.OwnBranch, StringComparison.OrdinalIgnoreCase) || s.Equals("Own Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("Branch", StringComparison.OrdinalIgnoreCase) || s.Equals("OwnBranch", StringComparison.OrdinalIgnoreCase))
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

        if (s.Equals(AppPermissions.Scopes.All, StringComparison.OrdinalIgnoreCase) || s.Equals("All", StringComparison.OrdinalIgnoreCase))
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
            .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

        if (dbUser?.RoleId != null && dbUser.RoleId > 0)
        {
            var perms = await _context.RolePermissions
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.RoleId == dbUser.RoleId.Value)
                .ToListAsync();

            if (perms.Any())
            {
                _cache.Set(cacheKey, perms, TimeSpan.FromMinutes(5));
                return perms;
            }
        }
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
                    AppPermissions.Keys.CompOffView,
                    AppPermissions.Keys.CompOffApply,
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
    }
}
