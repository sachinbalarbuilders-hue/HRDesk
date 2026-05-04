using System.ComponentModel.DataAnnotations;
using System.Linq;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Employees;

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public CreateModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList DesignationOptions { get; private set; } = default!;

    public SelectList ShiftOptions { get; private set; } = default!;

    public SelectList WeekoffOptions { get; private set; } = default!;

    public SelectList StatusOptions { get; private set; } = default!;

    public async Task OnGetAsync()
    {
        await LoadOptionsAsync();
        Input.Status = "active";
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await LoadOptionsAsync();

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var exists = await _db.Employees.AnyAsync(e => e.EmployeeId == Input.EmployeeId);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Employee ID already exists.");
            return Page();
        }

        var employee = new Employee
        {
            EmployeeId = Input.EmployeeId,
            EmployeeName = Input.EmployeeName.Trim(),
            DepartmentId = Input.DepartmentId,
            DesignationId = Input.DesignationId,
            ShiftId = Input.ShiftId,
            Weekoff = Input.Weekoff,
            JoiningDate = Input.JoiningDate,
            ResignationDate = Input.ResignationDate,
            DateOfBirth = Input.DateOfBirth,
            ProbationStart = Input.ProbationStart,
            ProbationEnd = Input.ProbationEnd,
            Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim(),
            Status = Input.Status
        };

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        // Create initial shift assignment
        if (employee.ShiftId.HasValue && employee.JoiningDate.HasValue)
        {
            _db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
            {
                EmployeeId = employee.EmployeeId,
                ShiftId = employee.ShiftId.Value,
                FromDate = employee.JoiningDate.Value,
                ToDate = null
            });
            await _db.SaveChangesAsync();
        }

        return RedirectToPage("./Index");
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
        [Display(Name = "Employee ID")]
        public int EmployeeId { get; set; }

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

        // Probation is always 90 days from joining date
        public DateOnly? ProbationStart => JoiningDate;
        public DateOnly? ProbationEnd => JoiningDate.HasValue ? JoiningDate.Value.AddDays(90) : null;

        [Display(Name = "Resignation Date")]
        public DateOnly? ResignationDate { get; set; }

        [Display(Name = "Date of Birth")]
        public DateOnly? DateOfBirth { get; set; }

        [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
        [StringLength(10)]
        public string? Phone { get; set; }

        [Display(Name = "Status")]
        public string? Status { get; set; }
    }
}
