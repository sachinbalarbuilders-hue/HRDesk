using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HRDesk.Web.Pages.Employees;

public sealed class DetailsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public DetailsModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    public Employee? EmployeeData { get; set; }
    
    // Sidebar list
    public List<EmployeeSidebarDto> AllEmployees { get; set; } = new();

    // Leave Data
    public List<LeaveAllocation> LeaveAllocations { get; set; } = new();
    public List<LeaveApplication> LeaveHistory { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        EmployeeData = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeId == Id);

        if (EmployeeData is null)
        {
            return NotFound();
        }

        // Use same leave year cycle as the rest of the app: Novâ€“Oct
        // e.g. July 2026 â†’ Leave Year 2025; November 2026 â†’ Leave Year 2026
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

        // Fetch Sidebar Employees List
        AllEmployees = await _db.Employees
            .Include(e => e.Designation)
            .Where(e => e.Status == "active") // or fetch all, but active is better for quick nav
            .OrderBy(e => e.EmployeeName)
            .Select(e => new EmployeeSidebarDto
            {
                EmployeeId = e.EmployeeId,
                EmployeeName = e.EmployeeName,
                PhotoPath = e.PhotoPath,
                PhotoData = e.PhotoData,
                DesignationName = e.Designation != null ? e.Designation.DesignationName : ""
            })
            .AsNoTracking()
            .ToListAsync();

        return Page();
    }
}

public class EmployeeSidebarDto
{
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = "";
    public string? PhotoPath { get; set; }
    public byte[]? PhotoData { get; set; }
    public string? DesignationName { get; set; }
}
