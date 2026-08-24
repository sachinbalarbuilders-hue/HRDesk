using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IConfiguration _config;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvisioningService _provisioningService;

    public AuthController(
        BiometricAttendanceDbContext context,
        IConfiguration config,
        IPermissionService permissionService,
        ITenantProvisioningService provisioningService)
    {
        _context = context;
        _config = config;
        _permissionService = permissionService;
        _provisioningService = provisioningService;
    }

    public record LoginRequest(string Username, string Password);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username and password are required." });
        }

        var cleanUsername = request.Username.Trim();

        // 1. Match by username (for admin) or employee Work Email / Personal Email
        var user = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.CustomRole)
            .Include(u => u.Employee)
                .ThenInclude(e => e.Branch)
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.IsActive && (
                u.Username == cleanUsername ||
                (u.Employee != null && (u.Employee.WorkEmail == cleanUsername || u.Employee.PersonalEmail == cleanUsername))
            ));

        // 2. If User record doesn't exist yet, check Employee table strictly by Work Email or Personal Email
        if (user == null && cleanUsername.Contains("@"))
        {
            var emp = await _context.Employees
                .IgnoreQueryFilters()
                .Include(e => e.Organization)
                .FirstOrDefaultAsync(e => e.WorkEmail == cleanUsername || e.PersonalEmail == cleanUsername);

            if (emp != null)
            {
                bool isInitialAuth = request.Password == "123456" 
                    || request.Password == "Password@123" 
                    || request.Password == "admin"
                    || (!string.IsNullOrWhiteSpace(emp.Phone) && request.Password == emp.Phone);

                if (isInitialAuth)
                {
                    user = new User
                    {
                        Username = !string.IsNullOrWhiteSpace(emp.WorkEmail) ? emp.WorkEmail : cleanUsername,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
                        FullName = emp.EmployeeName,
                        Role = "Employee",
                        RoleId = 3,
                        EmployeeId = emp.EmployeeId,
                        OrganizationId = emp.OrganizationId,
                        IsActive = true,
                        CreatedAt = DateTime.Now
                    };
                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();

                    user = await _context.Users
                        .IgnoreQueryFilters()
                        .Include(u => u.CustomRole)
                        .Include(u => u.Employee)
                        .Include(u => u.Organization)
                        .FirstOrDefaultAsync(u => u.Id == user.Id);
                }
            }
        }

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid work email or password." });
        }

        // Auto-upgrade plain-text password to BCrypt hash
        if (!user.PasswordHash.StartsWith("$2a$") && !user.PasswordHash.StartsWith("$2b$") && !user.PasswordHash.StartsWith("$2y$"))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12);
        }

        user.LastLogin = DateTime.Now;
        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("OrganizationId", user.OrganizationId.ToString()),
            new Claim("RoleId", user.RoleId?.ToString() ?? ""),
            new Claim("EmployeeId", user.EmployeeId?.ToString() ?? "")
        }, "Jwt"));

        var permissions = await _permissionService.GetUserPermissionsAsync(principal);
        var permissionScopes = await _permissionService.GetUserPermissionScopesAsync(principal);

        var orgQuery = _context.Organizations
            .AsNoTracking()
            .Where(o => o.IsActive);

        if (user.Role != "SuperAdmin")
        {
            orgQuery = orgQuery.Where(o => o.Id == user.OrganizationId);
        }

        var rawOrgs = await orgQuery
            .OrderBy(o => o.Id)
            .ToListAsync();

        var orgs = rawOrgs.Select(o => new
        {
            id = o.Id.ToString(),
            name = o.Name,
            code = o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name,
            address = o.Address,
            whatsAppGroupId = o.WhatsAppGroupId,
            isActive = o.IsActive
        }).ToList();

        var empCode = await GetFormattedEmployeeCodeAsync(user.Employee, user.OrganizationId);

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName ?? user.Username,
                role = user.Role,
                roleId = user.RoleId,
                roleName = user.CustomRole?.Name ?? user.Role,
                employeeId = user.EmployeeId,
                employeeName = user.Employee?.EmployeeName,
                employeeCode = empCode,
                attendanceType = user.Employee?.AttendanceType,
                branchId = user.Employee?.BranchId,
                isFaceEnrolled = !string.IsNullOrEmpty(user.Employee?.FaceId),
                faceId = user.Employee?.FaceId,
                avatarUrl = user.Employee?.PhotoPath,
                organizationId = user.OrganizationId,
                organizationName = user.Organization?.Name ?? "HRDesk Builders & Developers"
            },
            permissions,
            permissionScopes,
            organizations = orgs
        });
    }

    [HttpGet("check-slug")]
    [AllowAnonymous]
    public async Task<IActionResult> CheckSlug([FromQuery] string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return BadRequest(new { available = false, message = "Slug cannot be empty." });
        }

        var isAvailable = await _provisioningService.IsSlugAvailableAsync(slug);
        return Ok(new
        {
            slug = slug.Trim().ToLowerInvariant(),
            available = isAvailable,
            message = isAvailable ? "Workspace slug is available." : "Workspace slug is already taken or reserved."
        });
    }

    [HttpPost("register-tenant")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterTenant([FromBody] TenantRegistrationDto dto)
    {
        if (dto == null)
        {
            return BadRequest(new { message = "Registration details are required." });
        }

        var result = await _provisioningService.ProvisionTenantAsync(dto);
        if (!result.Success || result.Organization == null || result.AdminUser == null)
        {
            return BadRequest(new { message = result.ErrorMessage ?? "Failed to provision workspace." });
        }

        var user = result.AdminUser;
        var org = result.Organization;
        var token = GenerateJwtToken(user);

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("OrganizationId", user.OrganizationId.ToString()),
            new Claim("RoleId", user.RoleId?.ToString() ?? ""),
            new Claim("EmployeeId", user.EmployeeId?.ToString() ?? "")
        }, "Jwt"));

        var permissions = await _permissionService.GetUserPermissionsAsync(principal);

        var orgs = new[]
        {
            new
            {
                id = org.Id.ToString(),
                name = org.Name,
                code = org.Code ?? org.Name,
                address = org.Address,
                whatsAppGroupId = org.WhatsAppGroupId,
                isActive = org.IsActive
            }
        };

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName ?? user.Username,
                role = user.Role,
                roleId = user.RoleId,
                roleName = "Administrator",
                employeeId = user.EmployeeId,
                employeeName = user.FullName,
                organizationId = user.OrganizationId,
                organizationName = org.Name
            },
            permissions,
            organizations = orgs,
            message = "Organization workspace created successfully! Welcome to HRDesk."
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.CustomRole)
            .Include(u => u.Employee)
                .ThenInclude(e => e.Branch)
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

        if (user == null)
        {
            return Unauthorized();
        }

        var permissions = await _permissionService.GetUserPermissionsAsync(User);
        var permissionScopes = await _permissionService.GetUserPermissionScopesAsync(User);

        var orgQuery = _context.Organizations
            .AsNoTracking()
            .Where(o => o.IsActive);

        if (user.Role != "SuperAdmin")
        {
            orgQuery = orgQuery.Where(o => o.Id == user.OrganizationId);
        }

        var rawOrgs = await orgQuery
            .OrderBy(o => o.Id)
            .ToListAsync();

        var orgs = rawOrgs.Select(o => new
        {
            id = o.Id.ToString(),
            name = o.Name,
            code = o.Name.Length > 3 ? string.Concat(o.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0])) : o.Name,
            address = o.Address,
            whatsAppGroupId = o.WhatsAppGroupId,
            isActive = o.IsActive
        }).ToList();

        var empCode = await GetFormattedEmployeeCodeAsync(user.Employee, user.OrganizationId);

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName ?? user.Username,
                role = user.Role,
                roleId = user.RoleId,
                roleName = user.CustomRole?.Name ?? user.Role,
                employeeId = user.EmployeeId,
                employeeName = user.Employee?.EmployeeName,
                attendanceType = user.Employee?.AttendanceType,
                employeeCode = empCode,
                branchId = user.Employee?.BranchId,
                isFaceEnrolled = !string.IsNullOrEmpty(user.Employee?.FaceId),
                faceId = user.Employee?.FaceId,
                avatarUrl = user.Employee?.PhotoPath,
                organizationId = user.OrganizationId,
                organizationName = user.Organization?.Name ?? "HRDesk Builders & Developers"
            },
            permissions,
            permissionScopes,
            organizations = orgs
        });
    }

    private async Task<string?> GetFormattedEmployeeCodeAsync(Employee? employee, int orgId)
    {
        if (employee == null) return null;

        var targetBranch = employee.BranchId;

        var settings = await _context.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == orgId && (s.BranchId == targetBranch || s.BranchId == null))
            .ToListAsync();

        string series = settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? employee.Branch?.Code
            ?? "EMP";

        string connector = settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? "#";

        int padding = int.TryParse(settings.FirstOrDefault(s => s.BranchId == targetBranch && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue, out var p) ? p : 3;

        var cleanSeries = series.Trim();
        if (cleanSeries.EndsWith('#') || cleanSeries.EndsWith('-') || cleanSeries.EndsWith('_') || cleanSeries.EndsWith('/'))
        {
            return $"{cleanSeries}{employee.EmployeeId.ToString($"D{padding}")}";
        }

        return $"{cleanSeries}{connector}{employee.EmployeeId.ToString($"D{padding}")}";
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = _config["Jwt:Key"] ?? _config["JwtSettings:Secret"] ?? "YourSuperSecretKeyWithAtLeast32CharactersForHMACSHA256";
        var jwtIssuer = _config["Jwt:Issuer"] ?? "HRDesk.Web";

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.GivenName, user.FullName ?? user.Username),
            new(ClaimTypes.Role, user.Role),
            new("OrganizationId", user.OrganizationId.ToString())
        };

        if (user.RoleId.HasValue)
        {
            claims.Add(new Claim("RoleId", user.RoleId.Value.ToString()));
        }

        if (user.EmployeeId.HasValue)
        {
            claims.Add(new Claim("EmployeeId", user.EmployeeId.Value.ToString()));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddDays(7);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: null,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private bool VerifyPassword(string password, string hash)
    {
        if (hash.StartsWith("$2a$") || hash.StartsWith("$2b$") || hash.StartsWith("$2y$"))
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        return password == hash;
    }
}
