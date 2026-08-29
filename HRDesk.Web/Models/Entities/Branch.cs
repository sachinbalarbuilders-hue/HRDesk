using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("branches")]
public class Branch : IMustHaveTenant, IArchivable
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
    /// internal integer Id, so IDs cannot be guessed/incremented by a client.
    /// </summary>
    [Column("public_id")]
    public Guid PublicId { get; set; } = Guid.NewGuid();

    [Required]
    [Column("organization_id")]
    public int OrganizationId { get; set; }

    [Required]
    [Column("name")]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("code")]
    [StringLength(50)]
    public string? Code { get; set; }

    [Column("address")]
    [StringLength(500)]
    public string? Address { get; set; }

    [Column("city")]
    [StringLength(100)]
    public string? City { get; set; }

    [Column("state")]
    [StringLength(100)]
    public string? State { get; set; }

    [Column("pincode")]
    [StringLength(20)]
    public string? Pincode { get; set; }

    [Column("latitude")]
    public double? Latitude { get; set; }

    [Column("longitude")]
    public double? Longitude { get; set; }

    [Column("radius_meters")]
    public double? RadiusMeters { get; set; } = 100;

    [Column("whatsapp_group_id")]
    [StringLength(100)]
    public string? WhatsAppGroupId { get; set; }

    [Column("allowed_ips")]
    [StringLength(500)]
    public string? AllowedIPs { get; set; }

    /// <summary>
    /// Controls what happens when an employee punches from outside the geofence.
    /// Values: "Block" | "AllowAndFlag" | "AlwaysAllow"
    /// </summary>
    [Column("outside_attendance_policy")]
    [StringLength(50)]
    public string OutsideAttendancePolicy { get; set; } = "Block";

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    public Organization? Organization { get; set; }
}
