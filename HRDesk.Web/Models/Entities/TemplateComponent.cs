using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// A line item in a SalaryStructureTemplate defining how one salary component's
/// monthly amount is computed from the employee's annual CTC.
///
/// CalculationType values:
///   FixedAmount          — constant monthly rupee amount (e.g. ₹1,600 transport)
///   PercentOfCTC         — value = (AnnualCTC/12) × Value/100
///   PercentOfComponent   — value = [BaseComponentCode]_amount × Value/100
///   Remainder            — value = (AnnualCTC/12) − sum(all_other_earnings)
///                          Used for Special Allowance so CTC adds up exactly.
///   Statutory            — auto-computed by the payroll engine (PF, ESI, PT, TDS).
///                          Value and BaseComponentCode are ignored.
/// </summary>
public class TemplateComponent : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("template_id")]
    public int TemplateId { get; set; }

    public SalaryStructureTemplate? Template { get; set; }

    [Column("component_id")]
    public int ComponentId { get; set; }

    public SalaryComponent? Component { get; set; }

    /// <summary>FixedAmount | PercentOfCTC | PercentOfComponent | Remainder | Statutory</summary>
    [Column("calculation_type")]
    [Required]
    [StringLength(30)]
    public string CalculationType { get; set; } = "FixedAmount";

    /// <summary>
    /// For FixedAmount: the monthly rupee amount (e.g. 1600.00).
    /// For PercentOfCTC/PercentOfComponent: the percentage (e.g. 40 for 40%).
    /// Null for Remainder and Statutory.
    /// </summary>
    [Column("value", TypeName = "decimal(10,4)")]
    public decimal? Value { get; set; }

    /// <summary>
    /// For PercentOfComponent: the ComponentCode of the base component.
    /// e.g. "BASIC" → this component = BASIC_amount × Value%
    /// </summary>
    [Column("base_component_code")]
    [StringLength(20)]
    public string? BaseComponentCode { get; set; }

    /// <summary>Display order on payslip (earnings shown first, then deductions).</summary>
    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}
