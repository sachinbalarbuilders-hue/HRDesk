using System.ComponentModel.DataAnnotations;
using System.Linq;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Employees;

public sealed class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public EditModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList DesignationOptions { get; private set; } = default!;

    public SelectList ShiftOptions { get; private set; } = default!;

    public SelectList WeekoffOptions { get; private set; } = default!;

    public SelectList StatusOptions { get; private set; } = default!;

    public List<EmployeeShiftAssignment> ShiftHistory { get; private set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        await LoadOptionsAsync();

        var employee = await _db.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeId == Id);

        if (employee is null)
        {
            return NotFound();
        }

        ShiftHistory = await _db.EmployeeShiftAssignments
            .Include(a => a.Shift)
            .Where(a => a.EmployeeId == Id)
            .OrderByDescending(a => a.FromDate)
            .ToListAsync();

        Input = new EmployeeForm
        {
            EmployeeName = employee.EmployeeName,
            DepartmentId = employee.DepartmentId,
            DesignationId = employee.DesignationId,
            ShiftId = employee.ShiftId,
            Weekoff = employee.Weekoff ?? string.Empty,
            JoiningDate = employee.JoiningDate,
            ResignationDate = employee.ResignationDate,
            LastWorkingDate = employee.LastWorkingDate,
            DateOfBirth = employee.DateOfBirth,
            Phone = employee.Phone,
            Status = employee.Status
        };

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await LoadOptionsAsync();

        if (string.Equals(Input.Status, "inactive", StringComparison.OrdinalIgnoreCase) && Input.LastWorkingDate == null)
        {
            ModelState.AddModelError("Input.LastWorkingDate", "Last Working Date is required when status is set to Inactive.");
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == Id);
        if (employee is null)
        {
            return NotFound();
        }

        // Detect shift change for history
        if (employee.ShiftId != Input.ShiftId && Input.ShiftId.HasValue)
        {
            var effectiveDate = Input.ShiftEffectiveDate;

            // 1. Close current assignment (set to day before effective date)
            var currentAssignment = await _db.EmployeeShiftAssignments
                .Where(a => a.EmployeeId == Id && a.ToDate == null)
                .OrderByDescending(a => a.FromDate)
                .FirstOrDefaultAsync();

            if (currentAssignment != null)
            {
                currentAssignment.ToDate = effectiveDate.AddDays(-1);
            }

            // 2. Open new assignment (from effective date)
            _db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
            {
                EmployeeId = Id,
                ShiftId = Input.ShiftId.Value,
                FromDate = effectiveDate,
                ToDate = null
            });
        }

        employee.EmployeeName = Input.EmployeeName.Trim();
        employee.DepartmentId = Input.DepartmentId;
        employee.DesignationId = Input.DesignationId;
        employee.ShiftId = Input.ShiftId;
        employee.Weekoff = Input.Weekoff;
        employee.JoiningDate = Input.JoiningDate;
        employee.ResignationDate = Input.ResignationDate;
        employee.LastWorkingDate = Input.LastWorkingDate;
        employee.DateOfBirth = Input.DateOfBirth;
        employee.ProbationStart = Input.ProbationStart;
        employee.ProbationEnd = Input.ProbationEnd;
        employee.Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim();
        employee.Status = Input.Status;

        await _db.SaveChangesAsync();
        return RedirectToPage("./Index");
    }

    public async Task<IActionResult> OnPostToggleStatusAsync()
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == Id);
        if (employee is null)
        {
            return NotFound();
        }

        bool isCurrentlyActive = string.Equals(employee.Status, "active", StringComparison.OrdinalIgnoreCase);

        if (isCurrentlyActive && employee.LastWorkingDate == null)
        {
            TempData["ErrorMessage"] = "Cannot deactivate employee without a Last Working Date. Please set it in the form below.";
            return RedirectToPage(new { id = Id });
        }

        employee.Status = isCurrentlyActive ? "inactive" : "active";
        await _db.SaveChangesAsync();
        return RedirectToPage(new { id = Id });
    }

    private async Task LoadOptionsAsync()
    {
        var departments = await _db.Departments
            .AsNoTracking()
            .OrderBy(d => d.DepartmentName)
            .ToListAsync();

        var designations = await _db.Designations
            .AsNoTracking()
            .OrderBy(d => d.DesignationName)
            .ToListAsync();

        var shifts = await _db.Shifts
            .AsNoTracking()
            .Where(s => s.Status == "active")
            .OrderBy(s => s.ShiftName)
            .ThenBy(s => s.ShiftCode)
            .ToListAsync();

        DepartmentOptions = new SelectList(departments, nameof(Department.Id), nameof(Department.DepartmentName));
        DesignationOptions = new SelectList(designations, nameof(Designation.Id), nameof(Designation.DesignationName));
        ShiftOptions = new SelectList(shifts.Select(s => new
        {
            s.Id,
            DisplayName = $"{s.ShiftName} ({s.StartTime:hh:mm tt} - {s.EndTime:hh:mm tt})"
        }), "Id", "DisplayName");

        var weekoffDays = new[]
        {
            "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
        };
        WeekoffOptions = new SelectList(weekoffDays);

        var statuses = new[] { "active", "inactive", "suspended" };
        StatusOptions = new SelectList(statuses);
    }

    public sealed class EmployeeForm
    {
        [Required]
        [StringLength(255)]
        [Display(Name = "Employee Name")]
        public string EmployeeName { get; set; } = "";

        [Display(Name = "Department")]
        public int? DepartmentId { get; set; }

        [Display(Name = "Designation")]
        public int? DesignationId { get; set; }

        [Required]
        [Display(Name = "Shift")]
        public int? ShiftId { get; set; }

        [Display(Name = "Weekoff")]
        public string? Weekoff { get; set; }

        [Required]
        [Display(Name = "Joining Date")]
        public DateOnly? JoiningDate { get; set; }

        [Display(Name = "Resignation Date")]
        public DateOnly? ResignationDate { get; set; }

        [Display(Name = "Last Working Date")]
        public DateOnly? LastWorkingDate { get; set; }

        // Probation is always 90 days from joining date
        public DateOnly? ProbationStart => JoiningDate;
        public DateOnly? ProbationEnd => JoiningDate.HasValue ? JoiningDate.Value.AddDays(90) : null;

        [Display(Name = "Date of Birth")]
        public DateOnly? DateOfBirth { get; set; }

        [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
        [StringLength(10)]
        public string? Phone { get; set; }

        [Display(Name = "Shift Effective Date")]
        public DateOnly ShiftEffectiveDate { get; set; } = DateOnly.FromDateTime(DateTime.Now);

        [Display(Name = "Status")]
        public string? Status { get; set; }
    }
}
