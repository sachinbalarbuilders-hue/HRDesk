using System.Text.Json;
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
    private readonly IArchiveService _archive;

    public RolesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _archive = archive;
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

    [HttpGet]
    public async Task<IActionResult> GetRoles([FromQuery] string? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        int? resolvedBranchId = null;
        if (!string.IsNullOrWhiteSpace(branchId))
        {
            if (int.TryParse(branchId, out var parsedInt))
            {
                resolvedBranchId = parsedInt;
            }
            else if (Guid.TryParse(branchId, out var parsedGuid))
            {
                var branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.PublicId == parsedGuid);
                if (branch != null) resolvedBranchId = branch.Id;
            }
        }

        var query = _db.Roles.AsNoTracking().Include(r => r.Branch).AsQueryable();

        if (resolvedBranchId.HasValue)
        {
            // Return global roles (BranchId == null) PLUS branch-specific roles
            query = query.Where(r => r.BranchId == null || r.BranchId == resolvedBranchId.Value);
        }

        var roles = await query
            .Select(r => new
            {
                r.Id,
                r.PublicId,
                r.Name,
                r.Description,
                r.IsSystemRole,
                r.BranchId,
                BranchName = r.Branch != null ? r.Branch.Name : "Organization Wide",
                IsBranchSpecific = r.BranchId != null,
                r.CreatedAt,
                r.UpdatedAt,
                UserCount = _db.Users.Count(u => u.RoleId == r.Id),
                PermissionCount = _db.RolePermissions.Count(p => p.RoleId == r.Id)
            })
            .OrderByDescending(r => r.IsSystemRole)
            .ThenBy(r => r.BranchId == null ? 0 : 1)
            .ThenBy(r => r.Name)
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
                    p.SupportsScope,
                    p.ScopeOptions,
                    p.DefaultScope,
                    p.SubSections
                })
            });

        return Ok(grouped);
    }

    [HttpGet("{publicId:guid}")]
    public async Task<IActionResult> GetRoleById(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles
            .Include(r => r.Permissions)
            .Include(r => r.Branch)
            .FirstOrDefaultAsync(r => r.PublicId == publicId);

        if (role == null)
        {
            return NotFound(new { message = "Role not found." });
        }

        var permissionsMap = role.Permissions.ToDictionary(p => p.PermissionKey, p => true);
        var scopesMap = role.Permissions.ToDictionary(p => p.PermissionKey, p => p.Scope);
        var subRestrictionsMap = new Dictionary<string, List<string>>();

        foreach (var p in role.Permissions)
        {
            if (!string.IsNullOrWhiteSpace(p.SubRestrictions))
            {
                try
                {
                    var list = JsonSerializer.Deserialize<List<string>>(p.SubRestrictions);
                    if (list != null) subRestrictionsMap[p.PermissionKey] = list;
                }
                catch
                {
                    // Ignore parse error
                }
            }
        }

        return Ok(new
        {
            role.Id,
            role.PublicId,
            role.Name,
            role.Description,
            role.IsSystemRole,
            role.BranchId,
            BranchName = role.Branch != null ? role.Branch.Name : "Organization Wide",
            IsBranchSpecific = role.BranchId != null,
            permissions = permissionsMap,
            scopes = scopesMap,
            subRestrictions = subRestrictionsMap
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

        int? branchId = null;
        if (!string.IsNullOrWhiteSpace(dto.BranchId))
        {
            if (int.TryParse(dto.BranchId, out var parsedBId))
            {
                branchId = parsedBId;
            }
            else if (Guid.TryParse(dto.BranchId, out var parsedBGuid))
            {
                var branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.PublicId == parsedBGuid);
                if (branch != null) branchId = branch.Id;
            }
        }

        var role = new Role
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsSystemRole = false,
            BranchId = branchId,
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
                    var scope = dto.Scopes != null && dto.Scopes.TryGetValue(key, out var s) ? s : AppPermissions.Scopes.OwnBranch;
                    string? subRestJson = null;
                    if (dto.SubRestrictions != null && dto.SubRestrictions.TryGetValue(key, out var subs) && subs != null)
                    {
                        subRestJson = JsonSerializer.Serialize(subs);
                    }

                    _db.RolePermissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        PermissionKey = key,
                        Scope = scope,
                        SubRestrictions = subRestJson,
                        OrganizationId = orgId
                    });
                }
            }
            await _db.SaveChangesAsync();
        }

        _permissionService.ClearCache();

        return CreatedAtAction(nameof(GetRoleById), new { publicId = role.PublicId }, new { role.Id, role.PublicId, message = "Role created successfully." });
    }

    [HttpPut("{publicId:guid}")]
    public async Task<IActionResult> UpdateRole(Guid publicId, [FromBody] RoleUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.PublicId == publicId);
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

    [HttpPut("{publicId:guid}/permission")]
    public async Task<IActionResult> UpdatePermissionLive(Guid publicId, [FromBody] PermissionToggleDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.PublicId == publicId);
        if (role == null)
        {
            return NotFound(new { message = "Role not found." });
        }

        var id = role.Id;

        var existing = await _db.RolePermissions
            .FirstOrDefaultAsync(p => p.RoleId == id && p.PermissionKey == dto.PermissionKey);

        if (dto.IsGranted)
        {
            var targetScope = !string.IsNullOrEmpty(dto.Scope) ? dto.Scope : AppPermissions.Scopes.OwnBranch;
            string? subRestJson = dto.SubRestrictions != null ? JsonSerializer.Serialize(dto.SubRestrictions) : null;

            if (existing != null)
            {
                existing.Scope = targetScope;
                existing.SubRestrictions = subRestJson;
            }
            else
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    RoleId = id,
                    PermissionKey = dto.PermissionKey,
                    Scope = targetScope,
                    SubRestrictions = subRestJson,
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

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// Domain rules (system role, role still assigned) are enforced via the guard delegate so
    /// they apply identically to both paths.
    /// </summary>
    [HttpDelete("{publicId:guid}")]
    public async Task<IActionResult> DeleteRole(Guid publicId, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        _db.BypassArchiveFilter = true;
        var role = await _db.Roles
            .Include(r => r.Permissions)
            .Include(r => r.Users)
            .FirstOrDefaultAsync(r => r.PublicId == publicId);

        if (role == null) return NotFound(new { message = "Role not found." });

        string? Guard(Role r) =>
            r.IsSystemRole ? "System roles cannot be deleted."
            : r.Users.Any() ? $"Cannot delete role because it is assigned to {r.Users.Count} active user(s)."
            : null;

        var result = permanent
            ? await _archive.PermanentDeleteAsync<Role>(role.Id, Guard, cascade: async r =>
              {
                  // FKs are Restrict-only, so permission rows must go first.
                  var perms = await _db.RolePermissions.Where(p => p.RoleId == r.Id).ToListAsync();
                  _db.RolePermissions.RemoveRange(perms);
              })
            : await _archive.ArchiveAsync<Role>(role.Id, Guard);

        if (result.Success) _permissionService.ClearCache();
        return FromArchive(result);
    }

    [HttpPost("{publicId:guid}/restore")]
    public async Task<IActionResult> RestoreRole(Guid publicId)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
            return Forbid();

        _db.BypassArchiveFilter = true;
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.PublicId == publicId);
        if (role == null) return NotFound(new { message = "Role not found." });

        var result = await _archive.RestoreAsync<Role>(role.Id);
        if (result.Success) _permissionService.ClearCache();
        return FromArchive(result);
    }

    public record RoleCreateDto(string Name, string? Description, string? BranchId, Dictionary<string, bool>? Permissions, Dictionary<string, string>? Scopes, Dictionary<string, List<string>>? SubRestrictions);
    public record RoleUpdateDto(string? Name, string? Description);
    public record PermissionToggleDto(string PermissionKey, bool IsGranted, string? Scope, List<string>? SubRestrictions);
}

