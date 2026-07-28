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

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _configuration;

    public CreateModel(BiometricAttendanceDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList DesignationOptions { get; private set; } = default!;



    public SelectList WeekoffOptions { get; private set; } = default!;

    public SelectList StatusOptions { get; private set; } = default!;

    public async Task OnGetAsync()
    {
        await LoadOptionsAsync();
        Input.Status = "active";
        
        var existingIds = await _db.Employees.Select(e => e.EmployeeId).ToListAsync();
        int nextId = 1;
        while (existingIds.Contains(nextId))
        {
            nextId++;
        }
        Input.EmployeeId = nextId;
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
            Weekoff = Input.Weekoff,
            JoiningDate = Input.JoiningDate,
            ResignationDate = Input.ResignationDate,
            DateOfBirth = Input.DateOfBirth,
            Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim(),
            Status = Input.Status
        };

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

        if (Input.ProbationDays.HasValue && Input.ProbationDays.Value > 0 && employee.JoiningDate.HasValue)
        {
            employee.ProbationStart = employee.JoiningDate;
            employee.ProbationEnd = employee.JoiningDate.Value.AddDays(Input.ProbationDays.Value);
        }

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

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



        [Display(Name = "Weekoff")]
        public string? Weekoff { get; set; }

        [Required]
        [Display(Name = "Joining Date")]
        public DateOnly? JoiningDate { get; set; }

        [Display(Name = "Probation Period (Days)")]
        [Range(0, 365, ErrorMessage = "Please enter a valid number of days between 0 and 365")]
        public int? ProbationDays { get; set; } = 90;

        [Display(Name = "Resignation Date")]
        public DateOnly? ResignationDate { get; set; }

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
