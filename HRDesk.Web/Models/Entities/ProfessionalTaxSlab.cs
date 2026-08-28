using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// State-specific Professional Tax (PT) slab.
/// PT is deducted from the employee's gross salary each month.
/// Standard slabs (Telangana / AP example):
///   Gross ≤ 15,000       → PT = ₹0
///   Gross 15,001–20,000  → PT = ₹150
///   Gross > 20,000        → PT = ₹200
/// February is sometimes ₹300 in some states (use IsFebruary = true for those rows).
/// </summary>
public class ProfessionalTaxSlab : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("state")]
    [Required]
    [StringLength(60)]
    public string State { get; set; } = "";

    /// <summary>Minimum gross for this slab (0 = starts from zero).</summary>
    [Column("min_gross", TypeName = "decimal(10,2)")]
    public decimal MinGross { get; set; }

    /// <summary>Maximum gross for this slab (null = no upper limit).</summary>
    [Column("max_gross", TypeName = "decimal(10,2)")]
    public decimal? MaxGross { get; set; }

    /// <summary>Monthly PT deduction in rupees for this slab.</summary>
    [Column("monthly_pt", TypeName = "decimal(8,2)")]
    public decimal MonthlyPt { get; set; }

    /// <summary>
    /// Some states charge a different amount in February.
    /// If true, this row applies ONLY in February.
    /// </summary>
    [Column("is_february")]
    public bool IsFebruary { get; set; } = false;

    [Column("effective_from")]
    public DateOnly EffectiveFrom { get; set; } = new DateOnly(2024, 4, 1);

    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}
