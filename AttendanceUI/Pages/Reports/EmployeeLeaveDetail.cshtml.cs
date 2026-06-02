using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;

namespace AttendanceUI.Pages.Reports;

public class EmployeeLeaveDetailModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public EmployeeLeaveDetailModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    public Employee Employee { get; set; } = null!;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<LeaveApplication> LeaveApplications { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(int id, DateOnly startDate, DateOnly endDate)
    {
        Employee = await _context.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.EmployeeId == id);

        if (Employee == null)
        {
            return NotFound();
        }

        StartDate = startDate;
        EndDate = endDate;

        LeaveApplications = await _context.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == id &&
                         (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate <= endDate && la.EndDate >= startDate)
            .OrderBy(la => la.StartDate)
            .ToListAsync();

        return Page();
    }
}
