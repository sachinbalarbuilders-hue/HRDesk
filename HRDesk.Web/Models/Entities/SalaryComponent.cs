using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class SalaryComponent : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("component_name")]
    [Required]
    [StringLength(100)]
    public string ComponentName { get; set; } = "";

    [Column("component_code")]
    [Required]
    [StringLength(20)]
    public string ComponentCode { get; set; } = "";

    [Column("component_type")]
    [Required]
    [StringLength(20)]
    public string ComponentType { get; set; } = ""; // Earning or Deduction

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    /// <summary>
    /// Category for statutory computation.
    /// Earning | Deduction | EmployerContribution | Informational
    /// </summary>
    [Column("category")]
    [StringLength(30)]
    public string Category { get; set; } = "Allowance";

    /// <summary>True = included in PF computation (Basic + DA).</summary>
    [Column("is_epf_applicable")]
    public bool IsEpfApplicable { get; set; } = false;

    /// <summary>True = included in ESI gross computation.</summary>
    [Column("is_esi_applicable")]
    public bool IsEsiApplicable { get; set; } = false;

    /// <summary>True = amount is taxable under income tax.</summary>
    [Column("is_taxable")]
    public bool IsTaxable { get; set; } = true;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

