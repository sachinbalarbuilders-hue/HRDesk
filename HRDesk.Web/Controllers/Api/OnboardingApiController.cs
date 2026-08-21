using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/public/onboarding")]
[AllowAnonymous]
public class OnboardingApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IWebHostEnvironment _env;

    [ActivatorUtilitiesConstructor]
    public OnboardingApiController(BiometricAttendanceDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> GetOnboardingDetails(Guid token)
    {
        var employee = await _db.Employees
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .FirstOrDefaultAsync(e => e.VerificationId == token);

        if (employee == null)
            return NotFound(new { message = "Invalid or expired onboarding link." });

        if (employee.Status != "Onboarding")
            return BadRequest(new { message = "Onboarding is already completed or invalid for this employee." });

        return Ok(new
        {
            employee.EmployeeName,
            employee.WorkEmail,
            Department = employee.Department?.DepartmentName,
            Designation = employee.Designation?.DesignationName,
            Branch = employee.Branch?.Name
        });
    }

    [HttpPost("{token}")]
    public async Task<IActionResult> SubmitOnboardingDetails(Guid token, [FromBody] OnboardingSubmitDto dto)
    {
        var employee = await _db.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.VerificationId == token);

        if (employee == null)
            return NotFound(new { message = "Invalid or expired onboarding link." });

        if (employee.Status != "Onboarding")
            return BadRequest(new { message = "Onboarding is already completed." });

        // Update details
        employee.DateOfBirth = dto.DateOfBirth;
        employee.Gender = dto.Gender;
        employee.BloodGroup = dto.BloodGroup;
        employee.MaritalStatus = dto.MaritalStatus;
        employee.Phone = dto.Phone;
        employee.PersonalEmail = dto.PersonalEmail;
        employee.CurrentAddress = dto.CurrentAddress;
        employee.PermanentAddress = dto.PermanentAddress;
        
        // Mark as Pending HR Review or Active based on company policy.
        // As per standard practice, let's make it Active (since they asked for without recruitment direct onboarding),
        // or Pending if they want HR review. We will make it "active" so they appear in employee list.
        employee.Status = "Pending Review";
        employee.JoiningDate = DateOnly.FromDateTime(DateTime.Today);

        await _db.SaveChangesAsync();

        return Ok(new { message = "Onboarding details submitted successfully!" });
    }

    [HttpPost("{token}/photo")]
    public async Task<IActionResult> UploadPhoto(Guid token, IFormFile photo)
    {
        var employee = await _db.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.VerificationId == token);

        if (employee == null)
            return NotFound(new { message = "Invalid or expired onboarding link." });

        if (employee.Status != "Onboarding")
            return BadRequest(new { message = "Onboarding is already completed." });

        if (photo == null || photo.Length == 0)
            return BadRequest(new { message = "No photo provided." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg", "image/webp" };
        if (!allowedTypes.Contains(photo.ContentType))
            return BadRequest(new { message = "Only JPG, PNG, and WebP images are allowed." });

        if (photo.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "Photo exceeds 5MB size limit." });

        byte[] photoBytes;
        using (var ms = new MemoryStream())
        {
            await photo.CopyToAsync(ms);
            photoBytes = ms.ToArray();
        }

        using (var connection = new SqlConnection(_db.Database.GetDbConnection().ConnectionString))
        {
            await connection.OpenAsync();
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "UPDATE employees SET PhotoData = @p, PhotoContentType = @c, PhotoPath = @path WHERE VerificationId = @vid";
            
            var pParam = cmd.CreateParameter(); pParam.ParameterName = "@p"; pParam.Value = photoBytes; cmd.Parameters.Add(pParam);
            var cParam = cmd.CreateParameter(); cParam.ParameterName = "@c"; cParam.Value = photo.ContentType; cmd.Parameters.Add(cParam);
            var pathParam = cmd.CreateParameter(); pathParam.ParameterName = "@path"; pathParam.Value = $"/api/Thumbnail?employeeId={employee.EmployeeId}"; cmd.Parameters.Add(pathParam);
            var vidParam = cmd.CreateParameter(); vidParam.ParameterName = "@vid"; vidParam.Value = token; cmd.Parameters.Add(vidParam);
            
            await cmd.ExecuteNonQueryAsync();
        }

        return Ok(new { success = true, photoPath = $"/api/Thumbnail?employeeId={employee.EmployeeId}", message = "Profile picture uploaded." });
    }

    [HttpPost("{token}/documents")]
    public async Task<IActionResult> UploadDocument(Guid token, [FromForm] string documentType, IFormFile file)
    {
        var employee = await _db.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.VerificationId == token);

        if (employee == null)
            return NotFound(new { message = "Invalid or expired onboarding link." });

        if (employee.Status != "Onboarding")
            return BadRequest(new { message = "Onboarding is already completed." });

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (string.IsNullOrWhiteSpace(documentType))
            return BadRequest(new { message = "Document type is required." });

        string uploadDir = Path.Combine(_env.ContentRootPath, "App_Data", "EmployeeDocuments");
        if (!Directory.Exists(uploadDir))
            Directory.CreateDirectory(uploadDir);

        string uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
        string filePath = Path.Combine(uploadDir, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var doc = new EmployeeDocument
        {
            OrganizationId = employee.OrganizationId,
            EmployeeId = employee.EmployeeId,
            DocumentType = documentType.Trim(),
            FileName = file.FileName,
            FilePath = uniqueFileName,
            ContentType = file.ContentType,
            UploadedAt = DateTime.UtcNow
        };

        _db.EmployeeDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Document uploaded successfully." });
    }

    public record OnboardingSubmitDto(
        DateOnly? DateOfBirth,
        string? Gender,
        string? BloodGroup,
        string? MaritalStatus,
        string? Phone,
        string? PersonalEmail,
        string? CurrentAddress,
        string? PermanentAddress
    );
}
