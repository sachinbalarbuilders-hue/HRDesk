using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// Defines a repeating shift rotation pattern of any length.
/// Examples: "3-Shift Weekly" (21 days), "Hospital 4-On 2-Off" (6 days), "IT Fixed" (7 days).
/// </summary>
[Table("shift_cycles")]
public class ShiftCycle : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [MaxLength(150)]
    public string? ArchivedBy { get; set; }

    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = "";

    [Column("description")]
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Total number of days in one full cycle before it repeats.
    /// e.g. 7 for weekly, 21 for 3-week rotation, 6 for 4-on/2-off.
    /// </summary>
    [Column("cycle_length_days")]
    public int CycleLengthDays { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    // Navigation
    public ICollection<ShiftCycleSlot> Slots { get; set; } = new List<ShiftCycleSlot>();
}
