using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("companies")]
public class Company
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("legal_name")]
    [StringLength(150)]
    public string LegalName { get; set; } = string.Empty;

    [Column("trade_name")]
    [StringLength(100)]
    public string? TradeName { get; set; }

    [Column("code")]
    [StringLength(20)]
    public string? Code { get; set; }

    [Column("gstin")]
    [StringLength(30)]
    public string? Gstin { get; set; }

    [Column("cin")]
    [StringLength(50)]
    public string? Cin { get; set; }

    [Column("pan")]
    [StringLength(20)]
    public string? Pan { get; set; }

    [Column("logo_url")]
    [StringLength(500)]
    public string? LogoUrl { get; set; }

    [Column("website")]
    [StringLength(200)]
    public string? Website { get; set; }

    [Column("email")]
    [StringLength(100)]
    public string? Email { get; set; }

    [Column("phone")]
    [StringLength(30)]
    public string? Phone { get; set; }

    [Column("headquarters_address")]
    [StringLength(500)]
    public string? HeadquartersAddress { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public ICollection<Organization> Branches { get; set; } = new List<Organization>();
}
