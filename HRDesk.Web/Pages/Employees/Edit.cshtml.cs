using System.ComponentModel.DataAnnotations;
using System.Linq;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using HRDesk.Web.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Pages.Employees;

public sealed class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IReferenceDataCacheService _cache;
    private readonly IMemoryCache _memoryCache;
    private readonly ICurrentTenantProvider _tenantProvider;

    public EditModel(BiometricAttendanceDbContext db, IConfiguration configuration, IReferenceDataCacheService cache, IMemoryCache memoryCache, ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _configuration = configuration;
        _cache = cache;
        _memoryCache = memoryCache;
        _tenantProvider = tenantProvider;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    [BindProperty]
    public EmployeeForm Input { get; set; } = new();

    public string? CurrentPhotoPath { get; set; }

    public SelectList DepartmentOptions { get; private set; } = default!;

    public SelectList PayGroupOptions { get; private set; } = default!;

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
            PayGroupId = employee.PayGroupId,
            Weekoff = employee.Weekoff ?? string.Empty,
            JoiningDate = employee.JoiningDate,
            ResignationDate = employee.ResignationDate,
            LastWorkingDate = employee.LastWorkingDate,
            DateOfBirth = employee.DateOfBirth,
            Phone = employee.Phone,
            Status = employee.Status,
            ProbationDays = employee.ProbationStart.HasValue && employee.ProbationEnd.HasValue 
                ? employee.ProbationEnd.Value.DayNumber - employee.ProbationStart.Value.DayNumber 
                : null,
            UanNumber = employee.UanNumber,
            PfNumber = employee.PfNumber,
            IsPfEligible = employee.IsPfEligible,
            PfWageCap = employee.PfWageCap,
            EsicNumber = employee.EsicNumber,
            IsEsicEligible = employee.IsEsicEligible,
            IsPtEligible = employee.IsPtEligible,
            PanNumber = employee.PanNumber
        };
        CurrentPhotoPath = employee.PhotoPath;
        if (string.IsNullOrWhiteSpace(CurrentPhotoPath))
        {
            var connection = _db.Database.GetDbConnection();
            bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT CASE WHEN PhotoData IS NOT NULL THEN 1 ELSE 0 END FROM employees WHERE employee_id = @id AND organization_id = @org";
                var idParam = cmd.CreateParameter(); idParam.ParameterName = "@id"; idParam.Value = Id; cmd.Parameters.Add(idParam);
                var orgParam = cmd.CreateParameter(); orgParam.ParameterName = "@org"; orgParam.Value = employee.OrganizationId; cmd.Parameters.Add(orgParam);
                var res = await cmd.ExecuteScalarAsync();
                if (res != null && Convert.ToInt32(res) == 1)
                {
                    CurrentPhotoPath = "1";
                }
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

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
        employee.PayGroupId = Input.PayGroupId;
        employee.Weekoff = Input.Weekoff;
        employee.JoiningDate = Input.JoiningDate;
        employee.ResignationDate = Input.ResignationDate;
        employee.LastWorkingDate = Input.LastWorkingDate;
        employee.DateOfBirth = Input.DateOfBirth;
        // Calculate Probation Dates
        if (Input.ProbationDays.HasValue && Input.ProbationDays.Value > 0 && employee.JoiningDate.HasValue)
        {
            employee.ProbationStart = employee.JoiningDate;
            employee.ProbationEnd = employee.JoiningDate.Value.AddDays(Input.ProbationDays.Value);
        }
        else
        {
            employee.ProbationStart = null;
            employee.ProbationEnd = null;
        }
        employee.Phone = string.IsNullOrWhiteSpace(Input.Phone) ? null : Input.Phone.Trim();
        employee.Status = Input.Status;
        employee.UanNumber = string.IsNullOrWhiteSpace(Input.UanNumber) ? null : Input.UanNumber.Trim();
        employee.PfNumber = string.IsNullOrWhiteSpace(Input.PfNumber) ? null : Input.PfNumber.Trim();
        employee.IsPfEligible = Input.IsPfEligible;
        employee.PfWageCap = Input.PfWageCap;
        employee.EsicNumber = string.IsNullOrWhiteSpace(Input.EsicNumber) ? null : Input.EsicNumber.Trim();
        employee.IsEsicEligible = Input.IsEsicEligible;
        employee.IsPtEligible = Input.IsPtEligible;
        employee.PanNumber = string.IsNullOrWhiteSpace(Input.PanNumber) ? null : Input.PanNumber.Trim().ToUpperInvariant();

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

        if (rawPhotoBytes != null)
        {
            employee.PhotoPath = DateTime.UtcNow.Ticks.ToString();
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

    public async Task<IActionResult> OnPostRemovePhotoAsync()
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == Id);
        if (employee is null)
        {
            return NotFound();
        }

        var oldPhotoPath = employee.PhotoPath; // capture before nulling

        employee.PhotoPath = null;
        await _db.SaveChangesAsync();

        var connection = Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.GetDbConnection(_db.Database);
        bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
        if (wasClosed) await connection.OpenAsync();
        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "UPDATE employees SET PhotoData = NULL, PhotoContentType = NULL, PhotoPath = NULL WHERE employee_id = @id AND organization_id = @org";
            var idParam = cmd.CreateParameter(); idParam.ParameterName = "@id"; idParam.Value = employee.EmployeeId; cmd.Parameters.Add(idParam);
            var orgParam = cmd.CreateParameter(); orgParam.ParameterName = "@org"; orgParam.Value = employee.OrganizationId; cmd.Parameters.Add(orgParam);
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            if (wasClosed) await connection.CloseAsync();
        }

        // Evict all cached thumbnails for this employee so the list shows initials immediately
        foreach (var size in new[] { 44, 100, 150, 200, 300, 400, 800 })
        {
            _memoryCache.Remove($"thumb_{employee.OrganizationId}_{employee.EmployeeId}_{size}_{size}_{oldPhotoPath}");
            _memoryCache.Remove($"thumb_{employee.OrganizationId}_{employee.EmployeeId}_{size}_{size}_default");
        }

        TempData["SuccessMessage"] = "Profile photo removed successfully.";
        return RedirectToPage(new { id = Id });
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

        [Display(Name = "Resignation Date")]
        public DateOnly? ResignationDate { get; set; }

        [Display(Name = "Last Working Date")]
        public DateOnly? LastWorkingDate { get; set; }

        [Display(Name = "Probation Period (Days)")]
        [Range(0, 365, ErrorMessage = "Please enter a valid number of days between 0 and 365")]
        public int? ProbationDays { get; set; }

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
