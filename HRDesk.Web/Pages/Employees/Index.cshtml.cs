using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Employees;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IDeviceCommunicationService _deviceService;
    private const int DefaultPageSize = 15;

    public IndexModel(BiometricAttendanceDbContext db, HRDesk.Web.Services.IDeviceCommunicationService deviceService)
    {
        _db = db;
        _deviceService = deviceService;
    }

    public PaginatedList<Employee> Employees { get; private set; } = default!;
    public List<PayGroup> PayGroupsList { get; private set; } = new();
    
    // Search property
    [BindProperty(SupportsGet = true)]
    public string? SearchQuery { get; set; }
    
    // Status filter
    [BindProperty(SupportsGet = true)]
    public string? StatusFilter { get; set; }

    [BindProperty(SupportsGet = true)]
    public string Tab { get; set; } = "active";

    public int ActiveEmployeesCount { get; private set; }
    public int ArchivedEmployeesCount { get; private set; }

    // Pay Group filter
    [BindProperty(SupportsGet = true)]
    public int? PayGroupFilter { get; set; }

    public async Task OnGetAsync(int pageNum = 1)
    {
        if (string.IsNullOrEmpty(StatusFilter))
        {
            StatusFilter = "active";
        }
        
        PayGroupsList = await _db.PayGroups
            .AsNoTracking()
            .Where(p => p.Status == "active")
            .OrderBy(p => p.Name)
            .ToListAsync();

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.PayGroup)
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
        
        ActiveEmployeesCount = await _db.Employees.CountAsync(e => e.Status != "archived");
        ArchivedEmployeesCount = await _db.Employees.CountAsync(e => e.Status == "archived");

        if (string.Equals(Tab, "archived", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.Status == "archived");
        }
        else
        {
            query = query.Where(e => e.Status != "archived");

            // Apply status filter inside active workforce
            if (!string.IsNullOrWhiteSpace(StatusFilter) && StatusFilter != "all")
            {
                query = query.Where(e => e.Status != null && e.Status.ToLower() == StatusFilter.ToLower());
            }
        }

        // Apply pay group filter
        if (PayGroupFilter.HasValue && PayGroupFilter.Value > 0)
        {
            query = query.Where(e => e.PayGroupId == PayGroupFilter.Value);
        }
        
        var orderedQuery = query
            .OrderBy(e => e.EmployeeName)
            .ThenBy(e => e.EmployeeId);
            
        Employees = await PaginatedList<Employee>.CreateAsync(orderedQuery, pageNum, DefaultPageSize);
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

    public async Task<IActionResult> OnPostArchiveAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            TempData["SetNameResult"] = "Employee not found.";
            return RedirectToPage();
        }

        employee.Status = "archived";

        if (employee.DeviceSynced == 1)
        {
            try
            {
                await _deviceService.EnableUserAsync(employee.EmployeeId, false);
            }
            catch {}
        }

        await _db.SaveChangesAsync();
        TempData["SetNameResult"] = $"Employee '{employee.EmployeeName}' moved to Archive. Historical records preserved, device punching disabled.";
        return RedirectToPage(new { Tab = "active", PayGroupFilter, SearchQuery });
    }

    public async Task<IActionResult> OnPostRestoreAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            TempData["SetNameResult"] = "Employee not found.";
            return RedirectToPage();
        }

        employee.Status = "active";

        if (employee.DeviceSynced == 1)
        {
            try
            {
                await _deviceService.EnableUserAsync(employee.EmployeeId, true);
            }
            catch {}
        }

        await _db.SaveChangesAsync();
        TempData["SetNameResult"] = $"Employee '{employee.EmployeeName}' restored to Active.";
        return RedirectToPage(new { Tab = "archived", PayGroupFilter, SearchQuery });
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
        if (employee is null)
        {
            TempData["SetNameResult"] = "Employee not found.";
            return RedirectToPage();
        }

        // Safety check for foreign key constraints
        var hasAttendance = await _db.DailyAttendance.AnyAsync(a => a.EmployeeId == id);
        var hasPayroll = await _db.PayrollMasters.AnyAsync(p => p.EmployeeId == id);
        var hasLoans = await _db.EmployeeLoans.AnyAsync(l => l.EmployeeId == id);
        var hasLeaves = await _db.LeaveApplications.AnyAsync(la => la.EmployeeId == id);

        if (hasAttendance || hasPayroll || hasLoans || hasLeaves)
        {
            TempData["ErrorMessage"] = $"Cannot permanently delete '{employee.EmployeeName}' because historical records (attendance punches, payroll, leaves, or loans) exist in the database. Please keep this employee in Archive to maintain compliance and historical audit integrity.";
            return RedirectToPage(new { Tab = "archived" });
        }

        string? deviceError = null;
        if (employee.DeviceSynced == 1)
        {
            try
            {
                var (success, errorMessage) = await _deviceService.DeleteUserAsync(employee.EmployeeId);
                if (!success) deviceError = errorMessage;
            }
            catch (Exception ex)
            {
                deviceError = ex.Message;
            }
        }

        try
        {
            _db.Employees.Remove(employee);
            await _db.SaveChangesAsync();

            TempData["SetNameResult"] = deviceError != null 
                ? $"Employee permanently deleted from database, but device deletion failed: {deviceError}" 
                : $"Employee '{employee.EmployeeName}' permanently deleted.";
        }
        catch (Exception ex)
        {
            TempData["ErrorMessage"] = $"Failed to permanently delete employee: {ex.Message}";
        }

        return RedirectToPage(new { Tab = "archived" });
    }

    public async Task<IActionResult> OnPostUpdatePayGroupAsync(int employeeId, int? payGroupId)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (employee is null) return NotFound();

        employee.PayGroupId = (payGroupId.HasValue && payGroupId.Value > 0) ? payGroupId.Value : null;
        await _db.SaveChangesAsync();

        TempData["SetNameResult"] = $"Pay group updated for {employee.EmployeeName}.";
        return RedirectToPage(new { pageNum = Request.Query["pageNum"], SearchQuery, StatusFilter, PayGroupFilter });
    }
}
