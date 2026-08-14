using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Portal;

public class MyPayslipsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;

    public MyPayslipsModel(BiometricAttendanceDbContext context, IPermissionService permissionService)
    {
        _context = context;
        _permissionService = permissionService;
    }

    public Employee? CurrentEmployee { get; set; }
    public List<PayrollMaster> Payslips { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        var empId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!empId.HasValue)
        {
            TempData["ErrorMessage"] = "No linked employee profile found.";
            return RedirectToPage("/Portal/Dashboard");
        }

        CurrentEmployee = await _context.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == empId.Value);

        Payslips = await _context.PayrollMasters
            .Where(p => p.EmployeeId == empId.Value)
            .OrderByDescending(p => p.Month)
            .ToListAsync();

        return Page();
    }
}
