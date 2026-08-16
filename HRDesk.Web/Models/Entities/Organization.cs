using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class Organization
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("name")]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("code")]
    [StringLength(50)]
    public string? Code { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("whatsapp_group_id")]
    [StringLength(100)]
    [Display(Name = "WhatsApp Group ID")]
    public string? WhatsAppGroupId { get; set; }

    [Column("address")]
    [StringLength(500)]
    public string? Address { get; set; }

    [Column("latitude")]
    public double? Latitude { get; set; }

    [Column("longitude")]
    public double? Longitude { get; set; }

    [Column("radius_meters")]
    public double? RadiusMeters { get; set; } = 100;

    [Column("company_id")]
    public int? CompanyId { get; set; }

    public Company? Company { get; set; }
}
