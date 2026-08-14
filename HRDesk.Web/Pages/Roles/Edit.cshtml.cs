using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Pages.Roles;

public class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly IMemoryCache _cache;

    public EditModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        IMemoryCache cache)
    {
        _context = context;
        _permissionService = permissionService;
        _cache = cache;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public class InputModel
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Role name is required.")]
        [StringLength(100, ErrorMessage = "Role name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters.")]
        public string? Description { get; set; }

        public bool IsSystemRole { get; set; }

        public Dictionary<string, bool> Permissions { get; set; } = new();
        public Dictionary<string, string> Scopes { get; set; } = new();
    }

    public Dictionary<string, List<AppPermissions.PermissionDefinition>> GroupedPermissions { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
        {
            TempData["ErrorMessage"] = "Role not found.";
            return RedirectToPage("/Roles/Index");
        }

        Input.Id = role.Id;
        Input.Name = role.Name;
        Input.Description = role.Description;
        Input.IsSystemRole = role.IsSystemRole;

        GroupedPermissions = AppPermissions.All
            .GroupBy(p => p.Module)
            .ToDictionary(g => g.Key, g => g.ToList());

        var existingPermMap = role.Permissions.ToDictionary(p => p.PermissionKey, p => p.Scope);

        foreach (var perm in AppPermissions.All)
        {
            bool hasPerm = existingPermMap.ContainsKey(perm.Key);
            Input.Permissions[perm.Key] = hasPerm;
            Input.Scopes[perm.Key] = hasPerm 
                ? existingPermMap[perm.Key] 
                : (perm.Module == AppPermissions.Modules.SelfService ? AppPermissions.Scopes.Own : AppPermissions.Scopes.All);
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        if (!ModelState.IsValid)
        {
            GroupedPermissions = AppPermissions.All
                .GroupBy(p => p.Module)
                .ToDictionary(g => g.Key, g => g.ToList());
            return Page();
        }

        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == Input.Id);

        if (role == null)
        {
            TempData["ErrorMessage"] = "Role not found.";
            return RedirectToPage("/Roles/Index");
        }

        // Only allow renaming if not a system role, or update description
        if (!role.IsSystemRole)
        {
            role.Name = Input.Name.Trim();
        }
        role.Description = Input.Description?.Trim();
        role.UpdatedAt = DateTime.Now;

        // Remove previous permissions and add updated ones
        _context.RolePermissions.RemoveRange(role.Permissions);

        foreach (var (key, isSelected) in Input.Permissions)
        {
            if (isSelected)
            {
                var scope = Input.Scopes.TryGetValue(key, out var s) ? s : AppPermissions.Scopes.All;
                _context.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    PermissionKey = key,
                    Scope = scope,
                    OrganizationId = role.OrganizationId
                });
            }
        }

        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        TempData["SuccessMessage"] = $"Permissions for role '{role.Name}' have been updated successfully.";
        return RedirectToPage("/Roles/Index");
    }

    public class RoleDetailsUpdateDto
    {
        public int RoleId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public async Task<IActionResult> OnPostUpdateRoleDetailsAjaxAsync([FromBody] RoleDetailsUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return new JsonResult(new { success = false, message = "Unauthorized." }) { StatusCode = 403 };
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId);
        if (role == null)
        {
            return new JsonResult(new { success = false, message = "Role not found." }) { StatusCode = 404 };
        }

        if (!role.IsSystemRole && !string.IsNullOrWhiteSpace(dto.Name))
        {
            role.Name = dto.Name.Trim();
        }
        role.Description = dto.Description?.Trim();
        role.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        return new JsonResult(new { success = true, message = "Role details saved." });
    }


    public class SinglePermissionUpdateDto
    {
        public int RoleId { get; set; }
        public string PermissionKey { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public string Scope { get; set; } = AppPermissions.Scopes.All;
    }

    public async Task<IActionResult> OnPostUpdatePermissionAjaxAsync([FromBody] SinglePermissionUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return new JsonResult(new { success = false, message = "Unauthorized." }) { StatusCode = 403 };
        }

        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == dto.RoleId);

        if (role == null)
        {
            return new JsonResult(new { success = false, message = "Role not found." }) { StatusCode = 404 };
        }

        var existing = role.Permissions.FirstOrDefault(p => p.PermissionKey == dto.PermissionKey);

        if (dto.Enabled)
        {
            if (existing != null)
            {
                existing.Scope = dto.Scope;
            }
            else
            {
                _context.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    PermissionKey = dto.PermissionKey,
                    Scope = dto.Scope,
                    OrganizationId = role.OrganizationId
                });
            }
        }
        else
        {
            if (existing != null)
            {
                _context.RolePermissions.Remove(existing);
            }
        }

        role.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        return new JsonResult(new { success = true, message = "Saved instantly.", key = dto.PermissionKey, enabled = dto.Enabled, scope = dto.Scope });
    }

    public class BulkPermissionsUpdateDto
    {
        public int RoleId { get; set; }
        public Dictionary<string, bool> Permissions { get; set; } = new();
        public Dictionary<string, string> Scopes { get; set; } = new();
    }

    public async Task<IActionResult> OnPostUpdateBulkPermissionsAjaxAsync([FromBody] BulkPermissionsUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return new JsonResult(new { success = false, message = "Unauthorized." }) { StatusCode = 403 };
        }

        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == dto.RoleId);

        if (role == null)
        {
            return new JsonResult(new { success = false, message = "Role not found." }) { StatusCode = 404 };
        }

        var targetKeys = dto.Permissions.Keys.ToHashSet();
        var existingToUpdate = role.Permissions.Where(p => targetKeys.Contains(p.PermissionKey)).ToList();
        _context.RolePermissions.RemoveRange(existingToUpdate);

        foreach (var (key, isSelected) in dto.Permissions)
        {
            if (isSelected)
            {
                var scope = dto.Scopes.TryGetValue(key, out var s) ? s : AppPermissions.Scopes.All;
                _context.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    PermissionKey = key,
                    Scope = scope,
                    OrganizationId = role.OrganizationId
                });
            }
        }

        role.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        return new JsonResult(new { success = true, message = "Permissions updated in bulk." });
    }
}

