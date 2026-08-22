using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeeOnboardingController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IPlanEntitlementService _entitlementService;

    public EmployeeOnboardingController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IPlanEntitlementService entitlementService)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _entitlementService = entitlementService;
    }

    [AllowAnonymous]
    [HttpGet("{identifier}/public-verify")]
    public async Task<IActionResult> PublicVerifyEmployee(string identifier, [FromQuery] int? branchId = null, [FromQuery] int? organizationId = null)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return BadRequest(new { message = "Identifier is required." });

        var cleanInput = identifier.Trim();
        bool isGuid = Guid.TryParse(cleanInput, out var guid);

        // Security check: If anonymous and NOT a cryptographic GUID token, require authentication
        if (!isGuid && (User.Identity == null || !User.Identity.IsAuthenticated))
        {
            return Unauthorized(new { message = "Manual badge search requires an authorized security guard session." });
        }

        var query = _db.Employees
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
                .ThenInclude(b => b!.Organization)
            .Include(e => e.Organization)
            .AsQueryable();

        // Strict Tenant Isolation
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Super Admin"))
        {
            if (organizationId.HasValue && organizationId.Value > 0)
            {
                query = query.Where(e => e.OrganizationId == organizationId.Value);
            }
        }
        else
        {
            int targetTenantId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 0;
            if (targetTenantId > 0)
            {
                query = query.Where(e => e.OrganizationId == targetTenantId);
            }
        }

        Employee? employee = null;

        // 1. Physical Badge QR Scan (Cryptographic GUID Match)
        if (isGuid)
        {
            employee = await query.FirstOrDefaultAsync(e => e.VerificationId == guid || e.PublicId == guid);
        }

        // 2. Parse Prefix and Numeric ID (e.g. "VF#001", "EMP#213", "SD-005", "SI#010")
        if (employee == null)
        {
            var match = System.Text.RegularExpressions.Regex.Match(cleanInput, @"^(?<prefix>[A-Za-z0-9#\-_/\s]+?)(?<id>\d+)$");
            if (match.Success)
            {
                var rawPrefix = match.Groups["prefix"].Value.Trim();
                int id = int.Parse(match.Groups["id"].Value);

                var normPrefix = rawPrefix.TrimEnd('#', '-', '_', '/', ' ');

                var candidates = await query
                    .Where(e => e.EmployeeId == id)
                    .ToListAsync();

                employee = candidates.FirstOrDefault(e =>
                {
                    var bCode = e.Branch?.Code ?? "EMP";
                    var bCodeNorm = bCode.TrimEnd('#', '-', '_', '/', ' ');
                    return bCode.Equals(rawPrefix, StringComparison.OrdinalIgnoreCase) ||
                           bCodeNorm.Equals(normPrefix, StringComparison.OrdinalIgnoreCase) ||
                           bCode.StartsWith(normPrefix, StringComparison.OrdinalIgnoreCase) ||
                           rawPrefix.StartsWith(bCodeNorm, StringComparison.OrdinalIgnoreCase);
                });

                if (employee == null && normPrefix.Equals("EMP", StringComparison.OrdinalIgnoreCase))
                {
                    employee = candidates.FirstOrDefault(e => e.Branch == null || string.IsNullOrEmpty(e.Branch.Code));
                }
            }
        }

        // 3. Raw numeric ID without prefix (e.g. "213" or "1")
        if (employee == null && int.TryParse(cleanInput, out int directId))
        {
            var candidates = await query
                .Where(e => e.EmployeeId == directId)
                .ToListAsync();

            if (branchId.HasValue && branchId.Value > 0)
            {
                employee = candidates.FirstOrDefault(e => e.BranchId == branchId.Value);
            }
            else if (candidates.Count == 1)
            {
                employee = candidates[0];
            }
            else if (candidates.Count > 1)
            {
                var branchCodes = string.Join(", ", candidates.Select(c => $"[{c.Organization?.Name ?? "Org"}] " + (c.Branch?.Code ?? "EMP#") + c.EmployeeId.ToString("D3")));
                return BadRequest(new
                {
                    message = $"Multiple employees found with ID #{directId} across different branches/companies ({branchCodes}). Please include the branch prefix."
                });
            }
        }

        // 4. Exact Employee Name Match (case-insensitive)
        if (employee == null)
        {
            var candidates = await query
                .Where(e => e.EmployeeName.ToLower() == cleanInput.ToLower())
                .ToListAsync();

            if (branchId.HasValue && branchId.Value > 0)
            {
                employee = candidates.FirstOrDefault(e => e.BranchId == branchId.Value);
            }
            else
            {
                employee = candidates.FirstOrDefault();
            }
        }

        if (employee == null)
        {
            // Log Denied scan to database
            try
            {
                var failOrgId = organizationId ?? (_tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1);
                _db.GateActivityLogs.Add(new GateActivityLog
                {
                    OrganizationId = failOrgId,
                    BranchId = branchId ?? _tenantProvider.BranchId,
                    EmployeeCode = cleanInput,
                    EmployeeName = "Unknown",
                    ScanStatus = "Denied",
                    ScanMode = isGuid ? "Camera_QR" : "Manual_Search",
                    Reason = $"Employee \"{identifier}\" not found in active directory.",
                    ScannedAt = DateTime.UtcNow,
                    ScannedBy = User.Identity?.Name ?? "Gate Terminal"
                });
                await _db.SaveChangesAsync();
            }
            catch {}

            return NotFound(new { message = $"Employee \"{identifier}\" not found in active directory." });
        }

        var employeeCode = $"EMP#{employee.EmployeeId:D3}";
        var isActive = employee.ResignationDate == null && employee.LastWorkingDate == null;
        var orgName = employee.Branch?.Organization?.Name ?? employee.Organization?.Name ?? "Setu Developers";

        // Automatically log scan event to SQL Server
        try
        {
            _db.GateActivityLogs.Add(new GateActivityLog
            {
                OrganizationId = employee.OrganizationId,
                BranchId = employee.BranchId,
                EmployeeId = employee.EmployeeId,
                EmployeeCode = employeeCode,
                EmployeeName = employee.EmployeeName,
                DepartmentName = employee.Department?.DepartmentName,
                DesignationName = employee.Designation?.DesignationName,
                ScanStatus = isActive ? "Granted" : "Denied",
                ScanMode = isGuid ? "Camera_QR" : "Manual_Search",
                Reason = isActive ? "Verified Employee" : "Inactive / Suspended Employee",
                ScannedAt = DateTime.UtcNow,
                ScannedBy = User.Identity?.Name ?? "Gate Terminal"
            });
            await _db.SaveChangesAsync();
        }
        catch {}

        return Ok(new
        {
            employeeId = employee.EmployeeId,
            employeeCode,
            employeeName = employee.EmployeeName,
            designation = employee.Designation?.DesignationName,
            department = employee.Department?.DepartmentName,
            branch = employee.Branch?.Name,
            organizationName = orgName,
            isActive = isActive,
            photoPath = $"/api/employees/{employee.EmployeeId}/public-photo"
        });
    }

    [AllowAnonymous]
    [HttpGet("{identifier}/public-photo")]
    public async Task<IActionResult> PublicVerifyPhoto(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier)) return NotFound();

        var cleanInput = identifier.Trim();
        int? targetEmpId = null;
        Guid? targetGuid = null;

        if (Guid.TryParse(cleanInput, out var guid))
        {
            targetGuid = guid;
        }
        else if (int.TryParse(cleanInput, out var empId))
        {
            targetEmpId = empId;
        }
        else
        {
            var digitsOnly = new string(cleanInput.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(digitsOnly) && int.TryParse(digitsOnly, out int extractedId))
            {
                targetEmpId = extractedId;
            }
        }

        var connection = _db.Database.GetDbConnection();
        bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
        if (wasClosed) await connection.OpenAsync();

        try
        {
            using var cmd = connection.CreateCommand();
            if (targetGuid.HasValue)
            {
                cmd.CommandText = "SELECT PhotoData, PhotoContentType, PhotoPath FROM employees WHERE VerificationId = @id OR PublicId = @id";
                var idParam = cmd.CreateParameter();
                idParam.ParameterName = "@id";
                idParam.Value = targetGuid.Value;
                cmd.Parameters.Add(idParam);
            }
            else if (targetEmpId.HasValue)
            {
                cmd.CommandText = "SELECT PhotoData, PhotoContentType, PhotoPath FROM employees WHERE employee_id = @id";
                var idParam = cmd.CreateParameter();
                idParam.ParameterName = "@id";
                idParam.Value = targetEmpId.Value;
                cmd.Parameters.Add(idParam);
            }
            else
            {
                return NotFound();
            }

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                if (!reader.IsDBNull(0))
                {
                    var photoBytes = (byte[])reader.GetValue(0);
                    var contentType = !reader.IsDBNull(1) ? reader.GetString(1) : "image/jpeg";
                    return File(photoBytes, contentType);
                }
                else if (!reader.IsDBNull(2))
                {
                    var diskPath = reader.GetString(2);
                    if (!string.IsNullOrWhiteSpace(diskPath) && System.IO.File.Exists(diskPath))
                    {
                        var bytes = await System.IO.File.ReadAllBytesAsync(diskPath);
                        return File(bytes, "image/jpeg");
                    }
                }
            }
            return NotFound();
        }
        finally
        {
            if (wasClosed) await connection.CloseAsync();
        }
    }

    [HttpPost("generate-onboarding")]
    public async Task<IActionResult> GenerateOnboarding([FromBody] GenerateOnboardingDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesCreate))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.EmployeeName))
        {
            return BadRequest(new { message = "Employee name is required." });
        }

        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranchId = dto.BranchId ?? _tenantProvider.BranchId;

        // SaaS Seat Quota Enforcement
        var (canAdd, errorMsg) = await _entitlementService.CanAddEmployeeAsync(targetOrgId);
        if (!canAdd)
        {
            return StatusCode(402, new { error = "QUOTA_EXCEEDED", message = errorMsg });
        }

        var maxId = await _db.Employees
            .Where(e => e.OrganizationId == targetOrgId)
            .Select(e => (int?)e.EmployeeId)
            .MaxAsync() ?? 0;
        var targetEmpId = maxId + 1;

        var employee = new Employee
        {
            EmployeeId = targetEmpId,
            EmployeeName = dto.EmployeeName.Trim(),
            DepartmentId = dto.DepartmentId,
            DesignationId = dto.DesignationId,
            BranchId = targetBranchId,
            Status = "Onboarding", // specific status for onboarding drafts
            OrganizationId = targetOrgId,
            WorkEmail = dto.WorkEmail?.Trim(),
            VerificationId = Guid.NewGuid() // generate a fresh secure token
        };

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        var origin = Request.Headers["Origin"].FirstOrDefault() ?? $"{Request.Scheme}://{Request.Host}";
        var onboardingLink = $"{origin}/onboarding/{employee.VerificationId}";

        return Ok(new
        {
            employeeId = employee.EmployeeId,
            verificationId = employee.VerificationId,
            onboardingLink = onboardingLink,
            message = "Onboarding link generated successfully."
        });
    }

    public record GenerateOnboardingDto(
        string EmployeeName,
        int? BranchId,
        int? DepartmentId,
        int? DesignationId,
        string? WorkEmail
    );
}
