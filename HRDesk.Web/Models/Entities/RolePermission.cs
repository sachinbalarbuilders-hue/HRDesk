using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("role_permissions")]
public class RolePermission : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("role_id")]
    public int RoleId { get; set; }

    public Role? Role { get; set; }

    [Required]
    [Column("permission_key")]
    [StringLength(100)]
    public string PermissionKey { get; set; } = string.Empty;

    [Required]
    [Column("scope")]
    [StringLength(50)]
    public string Scope { get; set; } = "All"; // All, Reporting, Department, Own

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}
