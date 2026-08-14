using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HRDesk.Web.Pages.Employees;

public sealed class DetailsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;

    public DetailsModel(BiometricAttendanceDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    public Employee? EmployeeData { get; set; }
    
    // Sidebar list
    public List<EmployeeSidebarDto> AllEmployees { get; set; } = new();

    // Permissions
    public bool CanEditThisEmployee { get; set; }

    // Leave Data
    public List<LeaveAllocation> LeaveAllocations { get; set; } = new();
    public List<LeaveApplication> LeaveHistory { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        if (!await IsEmployeeInViewScopeAsync(Id))
        {
            return Forbid();
        }

        EmployeeData = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeId == Id);

        if (EmployeeData is null)
        {
            return NotFound();
        }

        // Check if user has permission to edit this specific employee
        bool canEditModule = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit);
        CanEditThisEmployee = canEditModule && await IsEmployeeInEditScopeAsync(Id);

        // Use same leave year cycle as the rest of the app: Nov–Oct
        var today = DateOnly.FromDateTime(System.DateTime.Today);
        int currentLeaveYear = today.Month >= 11 ? today.Year : today.Year - 1;

        // Fetch Leave Allocations
        LeaveAllocations = await _db.LeaveAllocations
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == Id && la.Year == currentLeaveYear)
            .AsNoTracking()
            .ToListAsync();

        // Fetch Leave History (Order by most recent first)
        LeaveHistory = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == Id)
            .OrderByDescending(la => la.StartDate)
            .AsNoTracking()
            .ToListAsync();

        // Fetch Sidebar Employees List (Filtered by logged-in user's view scope)
        var sidebarQuery = _db.Employees
            .Include(e => e.Designation)
            .Where(e => e.Status == "active")
            .AsQueryable();

        sidebarQuery = await _permissionService.ApplyEmployeeScopeAsync(sidebarQuery, User);

        AllEmployees = await sidebarQuery
            .OrderBy(e => e.EmployeeName)
            .Select(e => new EmployeeSidebarDto
            {
                EmployeeId = e.EmployeeId,
                EmployeeName = e.EmployeeName,
                PhotoPath = e.PhotoPath,
                DesignationName = e.Designation != null ? e.Designation.DesignationName : ""
            })
            .AsNoTracking()
            .ToListAsync();

        return Page();
    }

    private async Task<bool> IsEmployeeInViewScopeAsync(int employeeId)
    {
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var scope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesView);
        if (string.IsNullOrEmpty(scope) || scope == AppPermissions.Scopes.All) return true;

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!currentEmpId.HasValue) return false;

        var targetEmp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (targetEmp == null) return false;

        if (scope == AppPermissions.Scopes.Own)
        {
            return targetEmp.EmployeeId == currentEmpId.Value;
        }
        if (scope == AppPermissions.Scopes.Reporting)
        {
            return targetEmp.EmployeeId == currentEmpId.Value || targetEmp.ReportingManagerId == currentEmpId.Value;
        }
        if (scope == AppPermissions.Scopes.Department)
        {
            var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
            return currentEmp?.DepartmentId != null && targetEmp.DepartmentId == currentEmp.DepartmentId;
        }

        return false;
    }

    private async Task<bool> IsEmployeeInEditScopeAsync(int employeeId)
    {
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var scope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesEdit);
        if (string.IsNullOrEmpty(scope) || scope == AppPermissions.Scopes.All) return true;

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!currentEmpId.HasValue) return false;

        var targetEmp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (targetEmp == null) return false;

        if (scope == AppPermissions.Scopes.Own)
        {
            return targetEmp.EmployeeId == currentEmpId.Value;
        }
        if (scope == AppPermissions.Scopes.Reporting)
        {
            return targetEmp.EmployeeId == currentEmpId.Value || targetEmp.ReportingManagerId == currentEmpId.Value;
        }
        if (scope == AppPermissions.Scopes.Department)
        {
            var currentEmp = await _permissionService.GetCurrentEmployeeAsync(User);
            return currentEmp?.DepartmentId != null && targetEmp.DepartmentId == currentEmp.DepartmentId;
        }

        return false;
    }
}


public class EmployeeSidebarDto
{
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = "";
    public string? PhotoPath { get; set; }
    public string? DesignationName { get; set; }
}
