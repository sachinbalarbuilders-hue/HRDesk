using System.Security.Claims;
using HRDesk.Web.Constants;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Infrastructure;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(ClaimsPrincipal user, string permissionKey);
    Task<string?> GetPermissionScopeAsync(ClaimsPrincipal user, string permissionKey);
    Task<IReadOnlyList<string>> GetUserPermissionsAsync(ClaimsPrincipal user);
    Task<Dictionary<string, string>> GetUserPermissionScopesAsync(ClaimsPrincipal user);
    
    Task<int?> GetCurrentEmployeeIdAsync(ClaimsPrincipal user);
    Task<Employee?> GetCurrentEmployeeAsync(ClaimsPrincipal user);

    Task<IQueryable<Employee>> ApplyEmployeeScopeAsync(IQueryable<Employee> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.EmployeesView);
    Task<IQueryable<DailyAttendance>> ApplyAttendanceScopeAsync(IQueryable<DailyAttendance> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.AttendanceView);
    Task<IQueryable<LeaveApplication>> ApplyLeaveScopeAsync(IQueryable<LeaveApplication> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.LeavesView);
    Task<IQueryable<AttendanceRegularization>> ApplyRegularizationScopeAsync(IQueryable<AttendanceRegularization> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.AttendanceRegularize);
    Task<IQueryable<CompOffRequest>> ApplyCompOffScopeAsync(IQueryable<CompOffRequest> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.CompOffApprove);
    Task<IQueryable<ShiftChangeRequest>> ApplyShiftChangeRequestScopeAsync(IQueryable<ShiftChangeRequest> query, ClaimsPrincipal user, string permissionKey = AppPermissions.Keys.ShiftsRequestsView);
    
    void ClearCache();
}



