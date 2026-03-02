using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Employees;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private const int DefaultPageSize = 15;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public IReadOnlyList<Employee> Employees { get; private set; } = Array.Empty<Employee>();
    
    // Pagination properties
    public int CurrentPage { get; private set; } = 1;
    public int TotalPages { get; private set; } = 1;
    public int TotalCount { get; private set; } = 0;
    public int PageSize { get; private set; } = DefaultPageSize;
    
    // Search property
    [BindProperty(SupportsGet = true)]
    public string? SearchQuery { get; set; }
    
    // Status filter
    [BindProperty(SupportsGet = true)]
    public string? StatusFilter { get; set; }

    public async Task OnGetAsync(int pageNum = 1)
    {
        if (string.IsNullOrEmpty(StatusFilter))
        {
            StatusFilter = "active";
        }
        
        CurrentPage = pageNum < 1 ? 1 : pageNum;
        
        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Shift)
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
        
        TotalCount = await query.CountAsync();
        TotalPages = (int)Math.Ceiling(TotalCount / (double)PageSize);
        
        if (CurrentPage > TotalPages && TotalPages > 0)
        {
            CurrentPage = TotalPages;
        }
        
        Employees = await query
            .OrderBy(e => e.EmployeeName)
            .ThenBy(e => e.EmployeeId)
            .Skip((CurrentPage - 1) * PageSize)
            .Take(PageSize)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            return new JsonResult(new { success = false, message = "Employee not found" }) { StatusCode = 404 };
        }

        bool wasActive = string.Equals(employee.Status, "active", StringComparison.OrdinalIgnoreCase);
        bool willBeActive = !wasActive;
        
        employee.Status = willBeActive ? "active" : "inactive";
        string message = willBeActive ? "Employee activated successfully." : "Employee deactivated successfully.";
        bool success = true;

        // Also enable/disable on the biometric device if user is synced
        if (employee.DeviceSynced == 1)
        {
            try
            {
                var (s, errorMessage) = await Services.WindowsServiceClient.EnableUserAsync(employee.EmployeeId, willBeActive);
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
            var dbService = new Services.DatabaseService();
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
            var dbService = new Services.DatabaseService();
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
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            TempData["SetNameResult"] = "Employee not found.";
            return RedirectToPage();
        }

        string deviceError = null;
        
        // Try to delete from device first (if synced)
        if (employee.DeviceSynced == 1)
        {
            try
            {
                var (success, errorMessage) = await Services.WindowsServiceClient.DeleteUserAsync(employee.EmployeeId);
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
