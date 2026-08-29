using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("roles")]
public class Role : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [StringLength(150)]
    public string? ArchivedBy { get; set; }

    /// <summary>
    /// Opaque, non-enumerable identifier used in URLs and API responses instead of the
    /// internal integer Id, so role IDs cannot be guessed/incremented by a client.
    /// </summary>
    public Guid PublicId { get; set; } = Guid.NewGuid();

    [Required]
    [Column("name")]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    [StringLength(500)]
    public string? Description { get; set; }

    [Column("is_system_role")]
    public bool IsSystemRole { get; set; } = false;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    [Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();

    public ICollection<User> Users { get; set; } = new List<User>();
}
