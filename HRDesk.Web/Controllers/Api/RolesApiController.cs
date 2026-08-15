using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;

    public RolesController(BiometricAttendanceDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var roles = await _db.Roles
            .AsNoTracking()
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.IsSystemRole,
                r.CreatedAt,
                r.UpdatedAt,
                UserCount = _db.Users.Count(u => u.RoleId == r.Id),
                PermissionCount = _db.RolePermissions.Count(p => p.RoleId == r.Id)
            })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpGet("definitions")]
    public IActionResult GetPermissionDefinitions()
    {
        var grouped = AppPermissions.All
            .GroupBy(p => p.Module)
            .Select(g => new
            {
                module = g.Key,
                permissions = g.Select(p => new
                {
                    p.Key,
                    p.DisplayName,
                    p.Description,
                    p.SupportsScope
                })
            });

        return Ok(grouped);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRoleById(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
        {
            return NotFound(new { message = "Role not found." });
        }

        var permissionsMap = role.Permissions.ToDictionary(p => p.PermissionKey, p => true);
        var scopesMap = role.Permissions.ToDictionary(p => p.PermissionKey, p => p.Scope);

        return Ok(new
        {
            role.Id,
            role.Name,
            role.Description,
            role.IsSystemRole,
            permissions = permissionsMap,
            scopes = scopesMap
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateRole([FromBody] RoleCreateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        var orgId = 1;
        var orgClaim = User.FindFirst("OrganizationId")?.Value;
        if (int.TryParse(orgClaim, out var parsedOrg)) orgId = parsedOrg;

        var role = new Role
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsSystemRole = false,
            OrganizationId = orgId,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.Roles.Add(role);
        await _db.SaveChangesAsync();

        if (dto.Permissions != null)
        {
            foreach (var (key, isGranted) in dto.Permissions)
            {
                if (isGranted)
                {
                    var scope = dto.Scopes != null && dto.Scopes.TryGetValue(key, out var s) ? s : AppPermissions.Scopes.All;
                    _db.RolePermissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        PermissionKey = key,
                        Scope = scope,
                        OrganizationId = orgId
                    });
                }
            }
            await _db.SaveChangesAsync();
        }

        _permissionService.ClearCache();

        return CreatedAtAction(nameof(GetRoleById), new { id = role.Id }, new { role.Id, message = "Role created successfully." });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] RoleUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles.FindAsync(id);
        if (role == null)
        {
            return NotFound(new { message = "Role not found." });
        }

        if (!role.IsSystemRole && !string.IsNullOrWhiteSpace(dto.Name))
        {
            role.Name = dto.Name.Trim();
        }
        role.Description = dto.Description?.Trim();
        role.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return Ok(new { message = "Role details updated successfully." });
    }

    [HttpPut("{id}/permission")]
    public async Task<IActionResult> UpdatePermissionLive(int id, [FromBody] PermissionToggleDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles.FindAsync(id);
        if (role == null)
        {
            return NotFound(new { message = "Role not found." });
        }

        var existing = await _db.RolePermissions
            .FirstOrDefaultAsync(p => p.RoleId == id && p.PermissionKey == dto.PermissionKey);

        if (dto.IsGranted)
        {
            var targetScope = !string.IsNullOrEmpty(dto.Scope) ? dto.Scope : AppPermissions.Scopes.All;
            if (existing != null)
            {
                existing.Scope = targetScope;
            }
            else
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    RoleId = id,
                    PermissionKey = dto.PermissionKey,
                    Scope = targetScope,
                    OrganizationId = role.OrganizationId
                });
            }
        }
        else
        {
            if (existing != null)
            {
                _db.RolePermissions.Remove(existing);
            }
        }

        role.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return Ok(new { success = true, message = "Permission updated live." });
    }

    public record RoleCreateDto(string Name, string? Description, Dictionary<string, bool>? Permissions, Dictionary<string, string>? Scopes);
    public record RoleUpdateDto(string? Name, string? Description);
    public record PermissionToggleDto(string PermissionKey, bool IsGranted, string? Scope);
}
