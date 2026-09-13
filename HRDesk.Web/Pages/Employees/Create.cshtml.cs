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
using Microsoft.AspNetCore.Hosting;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Employees;

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IReferenceDataCacheService _cache;

    public CreateModel(BiometricAttendanceDbContext db, IConfiguration configuration, IReferenceDataCacheService cache)
    {
        _db = db;
        _configuration = configuration;
        _cache = cache;
    }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList PayGroupOptions { get; private set; } = default!;

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
            PayGroupId = Input.PayGroupId,
            Weekoff = Input.Weekoff,
            JoiningDate = Input.JoiningDate,
            ResignationDate = Input.ResignationDate,
            DateOfBirth = Input.DateOfBirth,
            Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim(),
            Status = Input.Status,
            UanNumber = string.IsNullOrWhiteSpace(Input.UanNumber) ? null : Input.UanNumber.Trim(),
            PfNumber = string.IsNullOrWhiteSpace(Input.PfNumber) ? null : Input.PfNumber.Trim(),
            IsPfEligible = Input.IsPfEligible,
            PfWageCap = Input.PfWageCap,
            EsicNumber = string.IsNullOrWhiteSpace(Input.EsicNumber) ? null : Input.EsicNumber.Trim(),
            IsEsicEligible = Input.IsEsicEligible,
            IsPtEligible = Input.IsPtEligible,
            PanNumber = string.IsNullOrWhiteSpace(Input.PanNumber) ? null : Input.PanNumber.Trim().ToUpperInvariant()
        };

        byte[]? rawPhotoBytes = null;
        string? rawPhotoContentType = null;

        if (!string.IsNullOrEmpty(Input.CroppedPhotoBase64))
        {
            var base64Data = Input.CroppedPhotoBase64.Contains(",") 
                ? Input.CroppedPhotoBase64.Split(',')[1] 
                : Input.CroppedPhotoBase64;
                
            rawPhotoBytes = Convert.FromBase64String(base64Data);
            rawPhotoContentType = "image/jpeg";
        }
        else if (Input.PhotoUpload != null && Input.PhotoUpload.Length > 0)
        {
            using (var memoryStream = new System.IO.MemoryStream())
            {
                await Input.PhotoUpload.CopyToAsync(memoryStream);
                rawPhotoBytes = memoryStream.ToArray();
            }
            rawPhotoContentType = Input.PhotoUpload.ContentType;
        }

        if (Input.ProbationDays.HasValue && Input.ProbationDays.Value > 0 && employee.JoiningDate.HasValue)
        {
            employee.ProbationStart = employee.JoiningDate;
            employee.ProbationEnd = employee.JoiningDate.Value.AddDays(Input.ProbationDays.Value);
        }

        if (rawPhotoBytes != null)
        {
            employee.PhotoPath = DateTime.UtcNow.Ticks.ToString();
        }

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        if (rawPhotoBytes != null)
        {
            var connection = Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.GetDbConnection(_db.Database);
            bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "UPDATE employees SET PhotoData = @p, PhotoContentType = @c, PhotoPath = @path WHERE employee_id = @id AND organization_id = @org";
                
                var pParam = cmd.CreateParameter(); pParam.ParameterName = "@p"; pParam.Value = rawPhotoBytes; cmd.Parameters.Add(pParam);
                var cParam = cmd.CreateParameter(); cParam.ParameterName = "@c"; cParam.Value = rawPhotoContentType; cmd.Parameters.Add(cParam);
                var pathParam = cmd.CreateParameter(); pathParam.ParameterName = "@path"; pathParam.Value = employee.PhotoPath; cmd.Parameters.Add(pathParam);
                var idParam = cmd.CreateParameter(); idParam.ParameterName = "@id"; idParam.Value = employee.EmployeeId; cmd.Parameters.Add(idParam);
                var orgParam = cmd.CreateParameter(); orgParam.ParameterName = "@org"; orgParam.Value = employee.OrganizationId; cmd.Parameters.Add(orgParam);
                
                await cmd.ExecuteNonQueryAsync();
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

        return RedirectToPage("./Index");
    }

    private async Task LoadOptionsAsync()
    {
        var departments = await _cache.GetDepartmentsAsync();
        var designations = await _cache.GetDesignationsAsync();

        var payGroups = await _db.PayGroups
            .AsNoTracking()
            .Where(p => p.Status == "active")
            .OrderBy(p => p.Name)
            .ToListAsync();

        DepartmentOptions = new SelectList(departments, nameof(Department.Id), nameof(Department.DepartmentName));
        DesignationOptions = new SelectList(designations, nameof(Designation.Id), nameof(Designation.DesignationName));
        PayGroupOptions = new SelectList(payGroups, nameof(PayGroup.Id), nameof(PayGroup.Name));

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

        [Display(Name = "Pay Group")]
        public int? PayGroupId { get; set; }



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

        [Display(Name = "UAN (Universal Account Number)")]
        [StringLength(20)]
        public string? UanNumber { get; set; }

        [Display(Name = "PF Member ID")]
        [StringLength(50)]
        public string? PfNumber { get; set; }

        [Display(Name = "PF Eligible")]
        public bool IsPfEligible { get; set; } = true;

        [Display(Name = "PF Wage Cap (₹15,000 ceiling)")]
        public bool PfWageCap { get; set; } = true;

        [Display(Name = "ESIC Insurance No.")]
        [StringLength(20)]
        public string? EsicNumber { get; set; }

        [Display(Name = "ESIC Eligible")]
        public bool IsEsicEligible { get; set; } = true;

        [Display(Name = "Professional Tax (PT) Eligible")]
        public bool IsPtEligible { get; set; } = true;

        [Display(Name = "PAN Number")]
        [StringLength(10)]
        [RegularExpression(@"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", ErrorMessage = "Invalid PAN format (e.g. ABCDE1234F).")]
        public string? PanNumber { get; set; }
    }
}
