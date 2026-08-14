using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Employees;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IDeviceCommunicationService _deviceService;
    private readonly IPermissionService _permissionService;
    private const int DefaultPageSize = 15;

    public IndexModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IDeviceCommunicationService deviceService, IPermissionService permissionService)
    {
        _db = db;
        _deviceService = deviceService;
        _permissionService = permissionService;
    }

    public PaginatedList<Employee> Employees { get; private set; } = default!;
    
    public bool CanCreate { get; private set; }
    public bool CanEdit { get; private set; }
    public bool CanDelete { get; private set; }

    public string? EditScope { get; private set; }
    public string? DeleteScope { get; private set; }
    public int? CurrentEmployeeId { get; private set; }
    public Employee? CurrentEmployee { get; private set; }

    public bool CanUserEdit(Employee target)
    {
        if (!CanEdit) return false;
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;
        if (string.IsNullOrEmpty(EditScope) || EditScope == HRDesk.Web.Constants.AppPermissions.Scopes.All) return true;

        if (EditScope == HRDesk.Web.Constants.AppPermissions.Scopes.Own)
        {
            return CurrentEmployeeId.HasValue && target.EmployeeId == CurrentEmployeeId.Value;
        }
        if (EditScope == HRDesk.Web.Constants.AppPermissions.Scopes.Reporting)
        {
            return CurrentEmployeeId.HasValue && (target.EmployeeId == CurrentEmployeeId.Value || target.ReportingManagerId == CurrentEmployeeId.Value);
        }
        if (EditScope == HRDesk.Web.Constants.AppPermissions.Scopes.Department)
        {
            return CurrentEmployee?.DepartmentId != null && target.DepartmentId == CurrentEmployee.DepartmentId;
        }

        return false;
    }

    public bool CanUserDelete(Employee target)
    {
        if (!CanDelete) return false;
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;
        if (string.IsNullOrEmpty(DeleteScope) || DeleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.All) return true;

        if (DeleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.Own)
        {
            return CurrentEmployeeId.HasValue && target.EmployeeId == CurrentEmployeeId.Value;
        }
        if (DeleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.Reporting)
        {
            return CurrentEmployeeId.HasValue && (target.EmployeeId == CurrentEmployeeId.Value || target.ReportingManagerId == CurrentEmployeeId.Value);
        }
        if (DeleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.Department)
        {
            return CurrentEmployee?.DepartmentId != null && target.DepartmentId == CurrentEmployee.DepartmentId;
        }

        return false;
    }

    // Search property
    [BindProperty(SupportsGet = true)]
    public string? SearchQuery { get; set; }
    
    // Status filter
    [BindProperty(SupportsGet = true)]
    public string? StatusFilter { get; set; }

    public async Task OnGetAsync(int pageNum = 1)
    {
        CanCreate = await _permissionService.HasPermissionAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesCreate);
        CanEdit = await _permissionService.HasPermissionAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesEdit);
        CanDelete = await _permissionService.HasPermissionAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesDelete);

        EditScope = await _permissionService.GetPermissionScopeAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesEdit);
        DeleteScope = await _permissionService.GetPermissionScopeAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesDelete);
        CurrentEmployeeId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        CurrentEmployee = await _permissionService.GetCurrentEmployeeAsync(User);

        if (string.IsNullOrEmpty(StatusFilter))
        {
            StatusFilter = "active";
        }
        
        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .AsQueryable();
        
        // Apply search filter
        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            var searchLower = SearchQuery.Trim().ToLower();
            query = query.Where(e => 
                (e.EmployeeName != null && e.EmployeeName.ToLower().Contains(searchLower)) ||
                e.EmployeeId.ToString().Contains(searchLower) ||
                (e.Phone != null && e.Phone.Contains(searchLower)) ||
                (e.Department != null && e.Department.DepartmentName != null && e.Department.DepartmentName.ToLower().Contains(searchLower)) ||
                (e.Designation != null && e.Designation.DesignationName != null && e.Designation.DesignationName.ToLower().Contains(searchLower))
            );
        }
        
        // Apply status filter
        if (!string.IsNullOrWhiteSpace(StatusFilter) && StatusFilter != "all")
        {
            query = query.Where(e => e.Status != null && e.Status.ToLower() == StatusFilter.ToLower());
        }
        
        // Apply permission scope (Own / Reporting / Department / All)
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User);

        var orderedQuery = query
            .OrderBy(e => e.EmployeeName)
            .ThenBy(e => e.EmployeeId);
            
        Employees = await PaginatedList<Employee>.CreateAsync(orderedQuery, pageNum, DefaultPageSize);
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesEdit))
        {
            return new JsonResult(new { success = false, message = "Unauthorized to edit employees." }) { StatusCode = 403 };
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            return new JsonResult(new { success = false, message = "Employee not found" }) { StatusCode = 404 };
        }

        bool wasActive = string.Equals(employee.Status, "active", StringComparison.OrdinalIgnoreCase);
        bool willBeActive = !wasActive;
        
        employee.Status = willBeActive ? "active" : "inactive";
        string message = willBeActive ? "Employee activated successfully." : "Employee deactivated successfully.";

        // Also enable/disable on the biometric device if user is synced
        if (employee.DeviceSynced == 1)
        {
            try
            {
                var (s, errorMessage) = await _deviceService.EnableUserAsync(employee.EmployeeId, willBeActive);
                if (!s)
                {
                    message = $"Status updated but device sync failed: {errorMessage}";
                    // Still consider operation successful as DB is updated, but with warning message
                }
                else
                {
                    message = willBeActive ? "User activated and enabled on device." : "User deactivated and disabled on device.";
                }
            }
            catch (Exception ex)
            {
                message = $"Status updated but device error: {ex.Message}";
            }
        }

        await _db.SaveChangesAsync();
        return new JsonResult(new { success = true, message = message, newStatus = employee.Status });
    }

    public async Task<IActionResult> OnPostSetNameInMachineAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            return NotFound();
        }

        try
        {
            // Use DatabaseService to keep device logic behind a service boundary.
            var dbService = new Services.DatabaseService(_deviceService);
            dbService.SetUserInMachine(employee.EmployeeId, employee.EmployeeName);
            employee.DeviceSynced = 1;
            employee.DeviceSyncError = null;
            await _db.SaveChangesAsync();
            TempData["SetNameResult"] = "Name set successfully in machine.";
        }
        catch (Exception ex)
        {
            employee.DeviceSynced = 0;
            employee.DeviceSyncError = ex.Message;
            await _db.SaveChangesAsync();
            TempData["SetNameResult"] = $"Failed: {ex.Message}";
        }

        return RedirectToPage();
    }

    public async Task<JsonResult> OnPostSetNameAjaxAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            return new JsonResult(new { success = false, message = "Employee not found" }) { StatusCode = 404 };
        }

        try
        {
            var dbService = new Services.DatabaseService(_deviceService);
            dbService.SetUserInMachine(employee.EmployeeId, employee.EmployeeName);
            employee.DeviceSynced = 1;
            employee.DeviceSyncError = null;
            await _db.SaveChangesAsync();
            return new JsonResult(new { success = true, message = "Name set successfully in machine.", deviceSynced = employee.DeviceSynced, deviceSyncError = employee.DeviceSyncError });
        }
        catch (Exception ex)
        {
            employee.DeviceSynced = 0;
            employee.DeviceSyncError = ex.Message;
            await _db.SaveChangesAsync();
            return new JsonResult(new { success = false, message = ex.Message, deviceSynced = employee.DeviceSynced, deviceSyncError = employee.DeviceSyncError });
        }
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesDelete))
        {
            return Forbid();
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            TempData["SetNameResult"] = "Employee not found.";
            return RedirectToPage();
        }

        var deleteScope = await _permissionService.GetPermissionScopeAsync(User, HRDesk.Web.Constants.AppPermissions.Keys.EmployeesDelete);
        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (deleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.Reporting && currentEmpId.HasValue)
        {
            if (employee.ReportingManagerId != currentEmpId.Value)
                return Forbid();
        }
        else if (deleteScope == HRDesk.Web.Constants.AppPermissions.Scopes.Department && currentEmpId.HasValue)
        {
            var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
            if (employee.DepartmentId != currentEmp?.DepartmentId)
                return Forbid();
        }

        string? deviceError = null;
        
        // Try to delete from device first (if synced)
        if (employee.DeviceSynced == 1)
        {
            try
            {
                var (success, errorMessage) = await _deviceService.DeleteUserAsync(employee.EmployeeId);
                if (!success)
                {
                    deviceError = errorMessage;
                }
            }
            catch (Exception ex)
            {
                deviceError = ex.Message;
            }
        }

        // Delete from database
        try
        {
            _db.Employees.Remove(employee);
            await _db.SaveChangesAsync();
            
            if (deviceError != null)
            {
                TempData["SetNameResult"] = $"Employee deleted from database, but device deletion failed: {deviceError}";
            }
            else if (employee.DeviceSynced == 1)
            {
                TempData["SetNameResult"] = "Employee deleted from database and device.";
            }
            else
            {
                TempData["SetNameResult"] = "Employee deleted from database.";
            }
        }
        catch (Exception ex)
        {
            TempData["SetNameResult"] = $"Failed to delete employee: {ex.Message}";
        }

        return RedirectToPage();
    }
}
