using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Roles;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;

    public IndexModel(BiometricAttendanceDbContext context, IPermissionService permissionService)
    {
        _context = context;
        _permissionService = permissionService;
    }

    public List<RoleViewModel> RolesList { get; set; } = new();

    public class RoleViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsSystemRole { get; set; }
        public int UsersCount { get; set; }
        public int PermissionsCount { get; set; }
        public List<string> TopPermissions { get; set; } = new();
        public DateTime UpdatedAt { get; set; }
    }

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var roles = await _context.Roles
            .Include(r => r.Users)
            .Include(r => r.Permissions)
            .OrderByDescending(r => r.IsSystemRole)
            .ThenBy(r => r.Name)
            .ToListAsync();

        RolesList = roles.Select(r => new RoleViewModel
        {
            Id = r.Id,
            Name = r.Name,
            Description = r.Description,
            IsSystemRole = r.IsSystemRole,
            UsersCount = r.Users.Count(u => u.IsActive),
            PermissionsCount = r.Permissions.Count,
            TopPermissions = r.Permissions
                .Take(4)
                .Select(p => p.PermissionKey + (p.Scope != AppPermissions.Scopes.All ? $" ({p.Scope})" : ""))
                .ToList(),
            UpdatedAt = r.UpdatedAt
        }).ToList();

        return Page();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var role = await _context.Roles
            .Include(r => r.Users)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
        {
            TempData["ErrorMessage"] = "Role not found.";
            return RedirectToPage();
        }

        if (role.IsSystemRole)
        {
            TempData["ErrorMessage"] = "System default roles cannot be deleted.";
            return RedirectToPage();
        }

        if (role.Users.Any())
        {
            TempData["ErrorMessage"] = $"Cannot delete role '{role.Name}' because {role.Users.Count} active user(s) are assigned to it. Please reassign them first.";
            return RedirectToPage();
        }

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Role '{role.Name}' has been deleted successfully.";
        return RedirectToPage();
    }
}
