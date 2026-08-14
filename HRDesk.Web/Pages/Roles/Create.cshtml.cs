using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace HRDesk.Web.Pages.Roles;

public class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public CreateModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _context = context;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public class InputModel
    {
        [Required(ErrorMessage = "Role name is required.")]
        [StringLength(100, ErrorMessage = "Role name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters.")]
        public string? Description { get; set; }

        public Dictionary<string, bool> Permissions { get; set; } = new();
        public Dictionary<string, string> Scopes { get; set; } = new();
    }

    public Dictionary<string, List<AppPermissions.PermissionDefinition>> GroupedPermissions { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        GroupedPermissions = AppPermissions.All
            .GroupBy(p => p.Module)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Default all permissions unchecked and scope = All (or Own for ESS)
        foreach (var perm in AppPermissions.All)
        {
            Input.Permissions[perm.Key] = false;
            Input.Scopes[perm.Key] = perm.Module == AppPermissions.Modules.SelfService 
                ? AppPermissions.Scopes.Own 
                : AppPermissions.Scopes.All;
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

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var role = new Role
        {
            Name = Input.Name.Trim(),
            Description = Input.Description?.Trim(),
            IsSystemRole = false,
            OrganizationId = orgId,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        // Add selected permissions
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
                    OrganizationId = orgId
                });
            }
        }

        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        TempData["SuccessMessage"] = $"Custom Role '{role.Name}' created successfully with {role.Permissions.Count} permission(s).";
        return RedirectToPage("/Roles/Index");
    }
}
