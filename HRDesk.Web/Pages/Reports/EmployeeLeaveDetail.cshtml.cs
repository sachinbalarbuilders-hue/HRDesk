using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Pages.Reports;

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
    public PaginatedList<LeaveApplication> LeaveApplications { get; set; } = default!;

    public async Task<IActionResult> OnGetAsync(int id, DateOnly startDate, DateOnly endDate, int pageNum = 1)
    {
        var employee = await _context.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.EmployeeId == id);

        if (employee == null)
        {
            return NotFound();
        }
        
        Employee = employee;

        StartDate = startDate;
        EndDate = endDate;

        var query = _context.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == id &&
                         (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate <= endDate && la.EndDate >= startDate);

        var count = await query.CountAsync();

        var items = await query
            .OrderBy(la => la.StartDate)
            .Skip((pageNum - 1) * 50)
            .Take(50)
            .ToListAsync();

        LeaveApplications = new PaginatedList<LeaveApplication>(items, count, pageNum, 50);

        return Page();
    }
}
