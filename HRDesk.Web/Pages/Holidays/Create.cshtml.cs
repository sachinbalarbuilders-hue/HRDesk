using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Holidays;

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILeaveAdjustmentService _adjustmentService;

    public CreateModel(BiometricAttendanceDbContext db, ILeaveAdjustmentService adjustmentService)
    {
        _db = db;
        _adjustmentService = adjustmentService;
    }

    [BindProperty]
    public FormInput Input { get; set; } = new();

    public List<Employee> Employees { get; set; } = new();

    public async Task OnGetAsync()
    {
        Employees = await _db.Employees.Where(e => e.Status == "active").OrderBy(e => e.EmployeeName).ToListAsync();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            Employees = await _db.Employees.Where(e => e.Status == "active").OrderBy(e => e.EmployeeName).ToListAsync();
            return Page();
        }

        var startDate = Input.StartDate!.Value;
        var endDate = Input.EndDate ?? startDate;

        var holiday = new Holiday
        {
            HolidayName = Input.HolidayName.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            Description = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim(),
            IsGlobal = Input.IsGlobal
        };

        _db.Holidays.Add(holiday);

        if (!Input.IsGlobal && Input.EmployeeIds != null && Input.EmployeeIds.Any())
        {
            foreach (var empId in Input.EmployeeIds)
            {
                _db.HolidayEmployees.Add(new HolidayEmployee
                {
                    Holiday = holiday,
                    EmployeeId = empId
                });
            }
        }

        await _db.SaveChangesAsync();

        // RECONCILE: Adjust leave balances for applications overlapping with this new holiday
        await _adjustmentService.ReconcileLeavesForHolidayAsync(startDate, endDate, !Input.IsGlobal ? Input.EmployeeIds : null);

        return RedirectToPage("./Index");
    }

    public sealed class FormInput
    {
        [Required]
        [StringLength(255)]
        [Display(Name = "Holiday Name")]
        public string HolidayName { get; set; } = "";

        [Required]
        [Display(Name = "From Date")]
        public DateOnly? StartDate { get; set; }

        [Display(Name = "To Date")]
        public DateOnly? EndDate { get; set; }

        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Display(Name = "Applicable to All Employees")]
        public bool IsGlobal { get; set; } = true;

        public List<int>? EmployeeIds { get; set; }
    }
}
