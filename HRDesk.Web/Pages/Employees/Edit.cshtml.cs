using System.ComponentModel.DataAnnotations;
using System.Linq;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;

namespace HRDesk.Web.Pages.Employees;

public sealed class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _configuration;

    public EditModel(BiometricAttendanceDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public string? CurrentPhotoPath { get; set; }

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList DesignationOptions { get; private set; } = default!;

    public SelectList StatusOptions { get; private set; } = default!;
 
    public SelectList WeekoffOptions { get; private set; } = default!;

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

        Input = new EmployeeForm
        {
            EmployeeName = employee.EmployeeName,
            DepartmentId = employee.DepartmentId,
            DesignationId = employee.DesignationId,
            Weekoff = employee.Weekoff ?? string.Empty,
            JoiningDate = employee.JoiningDate,
            ResignationDate = employee.ResignationDate,
            LastWorkingDate = employee.LastWorkingDate,
            DateOfBirth = employee.DateOfBirth,
            Phone = employee.Phone,
            Status = employee.Status
        };
        CurrentPhotoPath = employee.PhotoPath;

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

        // Shift change history tracking moved to Roster page

        var oldWeekoff = employee.Weekoff;

        employee.EmployeeName = Input.EmployeeName.Trim();
        employee.DepartmentId = Input.DepartmentId;
        employee.DesignationId = Input.DesignationId;
        employee.Weekoff = Input.Weekoff;
        employee.JoiningDate = Input.JoiningDate;
        employee.ResignationDate = Input.ResignationDate;
        employee.LastWorkingDate = Input.LastWorkingDate;
        employee.DateOfBirth = Input.DateOfBirth;
        employee.ProbationStart = Input.ProbationStart;
        employee.ProbationEnd = Input.ProbationEnd;
        employee.Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim();
        employee.Status = Input.Status;

        if (!string.IsNullOrEmpty(Input.CroppedPhotoBase64))
        {
            var base64Data = Input.CroppedPhotoBase64.Contains(",") 
                ? Input.CroppedPhotoBase64.Split(',')[1] 
                : Input.CroppedPhotoBase64;
                
            var bytes = Convert.FromBase64String(base64Data);
            employee.PhotoData = bytes;
            employee.PhotoContentType = "image/jpeg";
        }
        else if (Input.PhotoUpload != null && Input.PhotoUpload.Length > 0)
        {
            using (var memoryStream = new System.IO.MemoryStream())
            {
                await Input.PhotoUpload.CopyToAsync(memoryStream);
                employee.PhotoData = memoryStream.ToArray();
            }
            employee.PhotoContentType = Input.PhotoUpload.ContentType;
        }

        if (oldWeekoff != Input.Weekoff)
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var futureRosters = await _db.ShiftRosters
                .Where(r => r.EmployeeId == employee.EmployeeId && r.RosterDate >= today)
                .ToListAsync();

            foreach (var roster in futureRosters)
            {
                roster.IsWeekOff = !string.IsNullOrWhiteSpace(Input.Weekoff) && 
                    roster.RosterDate.DayOfWeek.ToString().Equals(Input.Weekoff, StringComparison.OrdinalIgnoreCase);
            }
        }

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

        DepartmentOptions = new SelectList(departments, nameof(Department.Id), nameof(Department.DepartmentName));
        DesignationOptions = new SelectList(designations, nameof(Designation.Id), nameof(Designation.DesignationName));
 
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

        [Display(Name = "Employee Photo")]
        public IFormFile? PhotoUpload { get; set; }

        public string? CroppedPhotoBase64 { get; set; }

        [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
        [StringLength(10)]
        public string? Phone { get; set; }

        [Display(Name = "Status")]
        public string? Status { get; set; }
    }
}
