using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Portal;

public class MyLeavesModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly ISequenceService _sequenceService;

    public MyLeavesModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        ISequenceService sequenceService)
    {
        _context = context;
        _permissionService = permissionService;
        _sequenceService = sequenceService;
    }

    public Employee? CurrentEmployee { get; set; }
    public List<LeaveAllocation> Allocations { get; set; } = new();
    public List<LeaveApplication> Applications { get; set; } = new();
    public List<LeaveType> AvailableLeaveTypes { get; set; } = new();

    [BindProperty]
    public ApplyLeaveInput Input { get; set; } = new();

    public class ApplyLeaveInput
    {
        [Required(ErrorMessage = "Please select a leave type.")]
        public int LeaveTypeId { get; set; }

        [Required(ErrorMessage = "Start date is required.")]
        public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

        [Required(ErrorMessage = "End date is required.")]
        public DateOnly EndDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

        [Required(ErrorMessage = "Please provide a reason for the leave.")]
        [StringLength(500, ErrorMessage = "Reason cannot exceed 500 characters.")]
        public string Reason { get; set; } = string.Empty;
    }

    public async Task<IActionResult> OnGetAsync()
    {
        var empId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!empId.HasValue)
        {
            TempData["ErrorMessage"] = "No linked employee profile found.";
            return RedirectToPage("/Portal/Dashboard");
        }

        await LoadDataAsync(empId.Value);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var empId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        if (!empId.HasValue)
        {
            TempData["ErrorMessage"] = "No linked employee profile found.";
            return RedirectToPage("/Portal/Dashboard");
        }

        if (Input.EndDate < Input.StartDate)
        {
            ModelState.AddModelError("Input.EndDate", "End date cannot be earlier than start date.");
        }

        if (!ModelState.IsValid)
        {
            await LoadDataAsync(empId.Value);
            return Page();
        }

        var orgId = _context.Employees.Where(e => e.EmployeeId == empId.Value).Select(e => e.OrganizationId).FirstOrDefault();
        int days = Input.EndDate.DayNumber - Input.StartDate.DayNumber + 1;

        var applicationNumber = await _sequenceService.GenerateApplicationNumberAsync(Input.StartDate);

        var leaveApp = new LeaveApplication
        {
            EmployeeId = empId.Value,
            LeaveTypeId = Input.LeaveTypeId,
            StartDate = Input.StartDate,
            EndDate = Input.EndDate,
            TotalDays = days,
            Reason = Input.Reason.Trim(),
            Status = "Pending",
            ApplicationNumber = applicationNumber,
            CreatedAt = DateTime.Now,
            OrganizationId = orgId
        };

        _context.LeaveApplications.Add(leaveApp);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Your leave application for {days} day(s) has been submitted for approval.";
        return RedirectToPage();
    }

    private async Task LoadDataAsync(int empId)
    {
        CurrentEmployee = await _context.Employees
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == empId);

        var currentYear = DateTime.Today.Year;

        Allocations = await _context.LeaveAllocations
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == empId && l.Year == currentYear)
            .ToListAsync();

        Applications = await _context.LeaveApplications
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == empId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        AvailableLeaveTypes = await _context.LeaveTypes
            .Where(lt => lt.Status == "Active")
            .ToListAsync();
    }
}
