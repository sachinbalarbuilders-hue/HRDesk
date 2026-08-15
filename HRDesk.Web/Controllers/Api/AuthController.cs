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

    public AuthController(
        BiometricAttendanceDbContext context,
        IConfiguration config,
        IPermissionService permissionService)
    {
        _context = context;
        _config = config;
        _permissionService = permissionService;
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

        var user = await _context.Users
            .Include(u => u.CustomRole)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password." });
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
                avatarUrl = user.Employee?.PhotoPath,
                organizationId = user.OrganizationId
            },
            permissions
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
            .Include(u => u.CustomRole)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

        if (user == null)
        {
            return Unauthorized();
        }

        var permissions = await _permissionService.GetUserPermissionsAsync(User);

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
                avatarUrl = user.Employee?.PhotoPath,
                organizationId = user.OrganizationId
            },
            permissions
        });
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = _config["Jwt:Key"] ?? "HRDeskDefaultSuperSecretJwtKey2026!#$@%";
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
