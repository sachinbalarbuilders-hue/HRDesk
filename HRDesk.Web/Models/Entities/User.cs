using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("username")]
    [StringLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [Column("password_hash")]
    [StringLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("full_name")]
    [StringLength(100)]
    public string? FullName { get; set; }

    [Column("role")]
    [StringLength(50)]
    public string Role { get; set; } = "Employee"; // Legacy fallback / Quick check

    [Column("role_id")]
    public int? RoleId { get; set; }

    public Role? CustomRole { get; set; }

    [Column("employee_id")]
    public int? EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("last_login")]
    public DateTime? LastLogin { get; set; }

    [Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    /// <summary>
    /// Organization this user belongs to. NULL for platform-level users (PlatformSuperAdmin).
    /// Non-null for all organization-level users.
    /// </summary>
    [Column("organization_id")]
    public int? OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    /// <summary>
    /// Explicit platform-level identity flag. Only true for Platform Super Admin accounts.
    /// This is the sole authority for platform-level access — NOT derived from Role string,
    /// email, user ID, or organization ID.
    /// </summary>
    [Column("is_platform_user")]
    public bool IsPlatformUser { get; set; } = false;
}
