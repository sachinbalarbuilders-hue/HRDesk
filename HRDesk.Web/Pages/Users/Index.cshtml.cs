using System.ComponentModel.DataAnnotations;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Users;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public IndexModel(
        BiometricAttendanceDbContext context,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _context = context;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    public List<UserViewModel> UsersList { get; set; } = new();
    public List<Role> RolesList { get; set; } = new();
    public List<Employee> EmployeesList { get; set; } = new();

    [BindProperty]
    public CreateUserInput CreateInput { get; set; } = new();

    [BindProperty]
    public EditUserInput EditInput { get; set; } = new();

    public class CreateUserInput
    {
        [Required(ErrorMessage = "Username is required.")]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(100, MinimumLength = 4, ErrorMessage = "Password must be at least 4 characters.")]
        public string Password { get; set; } = string.Empty;

        [StringLength(100)]
        public string? FullName { get; set; }

        [Required(ErrorMessage = "Please select a role.")]
        public int RoleId { get; set; }

        public int? EmployeeId { get; set; }
    }

    public class EditUserInput
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Username is required.")]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [StringLength(100)]
        public string? FullName { get; set; }

        [Required(ErrorMessage = "Please select a role.")]
        public int RoleId { get; set; }

        public int? EmployeeId { get; set; }
    }

    public class UserViewModel
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string RoleName { get; set; } = string.Empty;
        public int? RoleId { get; set; }
        public string? LinkedEmployeeName { get; set; }
        public int? LinkedEmployeeId { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLogin { get; set; }
    }

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        await LoadDataAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostCreateAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        if (await _context.Users.AnyAsync(u => u.Username == CreateInput.Username.Trim()))
        {
            ModelState.AddModelError("CreateInput.Username", "Username already exists. Please choose a different username.");
        }

        if (!ModelState.IsValid)
        {
            await LoadDataAsync();
            return Page();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == CreateInput.RoleId);

        var newUser = new User
        {
            Username = CreateInput.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(CreateInput.Password),
            FullName = CreateInput.FullName?.Trim() ?? CreateInput.Username.Trim(),
            Role = role?.Name == "Super Admin" ? "SuperAdmin" : (role?.Name == "Employee" ? "Employee" : (role?.Name == "Department Manager" ? "Manager" : "User")),
            RoleId = CreateInput.RoleId,
            EmployeeId = CreateInput.EmployeeId,
            IsActive = true,
            CreatedAt = DateTime.Now,
            OrganizationId = orgId
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"User account '{newUser.Username}' created successfully.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostEditAsync()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
            return Forbid();

        if (string.IsNullOrWhiteSpace(EditInput.Username))
        {
            TempData["ErrorMessage"] = "Username is required.";
            return RedirectToPage();
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == EditInput.Id);
        if (user == null)
        {
            TempData["ErrorMessage"] = "User not found.";
            return RedirectToPage();
        }

        // Check username uniqueness (excluding self)
        if (await _context.Users.AnyAsync(u => u.Username == EditInput.Username.Trim() && u.Id != EditInput.Id))
        {
            TempData["ErrorMessage"] = $"Username '{EditInput.Username}' is already taken.";            
            return RedirectToPage();
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == EditInput.RoleId);

        user.Username = EditInput.Username.Trim();
        user.FullName = EditInput.FullName?.Trim() ?? EditInput.Username.Trim();
        user.RoleId = EditInput.RoleId;
        user.EmployeeId = EditInput.EmployeeId;
        // Keep legacy Role string in sync
        user.Role = role?.Name switch
        {
            "Super Admin" => "SuperAdmin",
            "Employee" => "Employee",
            "Department Manager" => "Manager",
            _ => "User"
        };

        await _context.SaveChangesAsync();
        _permissionService.ClearCache();

        TempData["SuccessMessage"] = $"User '{user.Username}' updated successfully.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostToggleActiveAsync(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            TempData["ErrorMessage"] = "User not found.";
            return RedirectToPage();
        }

        if (user.Username == "admin")
        {
            TempData["ErrorMessage"] = "Cannot deactivate the primary administrator account.";
            return RedirectToPage();
        }

        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"User '{user.Username}' is now {(user.IsActive ? "active" : "deactivated")}.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostResetPasswordAsync(int id, string newPassword)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemRoles))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
        {
            TempData["ErrorMessage"] = "Password must be at least 4 characters.";
            return RedirectToPage();
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            TempData["ErrorMessage"] = "User not found.";
            return RedirectToPage();
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Password for '{user.Username}' has been reset successfully.";
        return RedirectToPage();
    }

    private async Task LoadDataAsync()
    {
        RolesList = await _context.Roles.OrderBy(r => r.Name).ToListAsync();
        EmployeesList = await _context.Employees.OrderBy(e => e.EmployeeName).ToListAsync();

        var users = await _context.Users
            .Include(u => u.CustomRole)
            .Include(u => u.Employee)
            .OrderBy(u => u.Username)
            .ToListAsync();

        UsersList = users.Select(u => new UserViewModel
        {
            Id = u.Id,
            Username = u.Username,
            FullName = u.FullName,
            RoleName = u.CustomRole?.Name ?? u.Role,
            RoleId = u.RoleId,
            LinkedEmployeeName = u.Employee?.EmployeeName,
            LinkedEmployeeId = u.EmployeeId,
            IsActive = u.IsActive,
            CreatedAt = u.CreatedAt,
            LastLogin = u.LastLogin
        }).ToList();
    }
}
