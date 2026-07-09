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
            ProbationStart = Input.ProbationStart,
            ProbationEnd = Input.ProbationEnd,
            Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim(),
            Status = Input.Status
        };

        if (!string.IsNullOrEmpty(Input.CroppedPhotoBase64))
        {
            var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
            if (!string.IsNullOrEmpty(photoDir))
            {
                if (!System.IO.Directory.Exists(photoDir))
                    System.IO.Directory.CreateDirectory(photoDir);
                
                var base64Data = Input.CroppedPhotoBase64.Contains(",") 
                    ? Input.CroppedPhotoBase64.Split(',')[1] 
                    : Input.CroppedPhotoBase64;
                    
                var bytes = Convert.FromBase64String(base64Data);
                var fileName = $"{employee.EmployeeId}_{Guid.NewGuid()}.jpg";
                var filePath = System.IO.Path.Combine(photoDir, fileName);
                
                await System.IO.File.WriteAllBytesAsync(filePath, bytes);
                employee.PhotoPath = fileName;
            }
        }
        else if (Input.PhotoUpload != null && Input.PhotoUpload.Length > 0)
        {
            var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
            if (!string.IsNullOrEmpty(photoDir))
            {
                if (!System.IO.Directory.Exists(photoDir))
                    System.IO.Directory.CreateDirectory(photoDir);
                
                var ext = System.IO.Path.GetExtension(Input.PhotoUpload.FileName);
                var fileName = $"{employee.EmployeeId}_{Guid.NewGuid()}{ext}";
                var filePath = System.IO.Path.Combine(photoDir, fileName);
                
                using (var stream = new System.IO.FileStream(filePath, System.IO.FileMode.Create))
                {
                    await Input.PhotoUpload.CopyToAsync(stream);
                }
                
                employee.PhotoPath = fileName;
            }
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

        // Probation is always 90 days from joining date
        public DateOnly? ProbationStart => JoiningDate;
        public DateOnly? ProbationEnd => JoiningDate.HasValue ? JoiningDate.Value.AddDays(90) : null;

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
