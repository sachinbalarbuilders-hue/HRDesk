using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// A Pay Group controls how salary is calculated for a set of employees.
/// Different groups can have different calculation bases (calendar days, fixed 26, etc.)
/// and different salary structure templates.
///
/// Examples:
///   "Management Staff"  — CalendarDays, standard CTC template
///   "Factory Workers"   — Fixed26, basic wage template
///   "Daily Wage"        — PerDay, per-day rate
///   "Contract"          — CalendarDays, consultant template (no PF/ESI)
/// </summary>
public class PayGroup : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("name")]
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Column("description")]
    [StringLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Determines the per-day rate denominator used for LOP and proration.
    ///   CalendarDays   — salary / days_in_month  (most common, greytHR default)
    ///   Fixed26        — salary / 26             (manufacturing / factories)
    ///   Fixed30        — salary / 30             (simplified, constant per-day)
    ///   ActualWorkingDays — salary / working_days_in_month (BPO / call centre)
    ///   PerDay         — employee has a per-day rate, paid only for days present
    /// </summary>
    [Column("salary_basis")]
    [Required]
    [StringLength(30)]
    public string SalaryBasis { get; set; } = "CalendarDays";

    /// <summary>
    /// Rounding rule for LOP days (e.g., 0.4 days → Full or Half).
    ///   None      — keep decimal (default)
    ///   HalfDay   — round to nearest 0.5
    ///   FullDay   — round up to full day
    /// </summary>
    [Column("lop_rounding")]
    [StringLength(20)]
    public string LopRounding { get; set; } = "None";

    /// <summary>Whether PF is applicable for employees in this group.</summary>
    [Column("pf_applicable")]
    public bool PfApplicable { get; set; } = true;

    /// <summary>Whether ESI is applicable (automatically disabled when gross > ₹21,000).</summary>
    [Column("esi_applicable")]
    public bool EsiApplicable { get; set; } = true;

    /// <summary>Whether Professional Tax is applicable.</summary>
    [Column("pt_applicable")]
    public bool PtApplicable { get; set; } = true;

    /// <summary>The state whose PT slab applies to this group.</summary>
    [Column("pt_state")]
    [StringLength(50)]
    public string? PtState { get; set; }

    /// <summary>Default salary structure template assigned to this group.
    /// Employees can override individually.</summary>
    [Column("template_id")]
    public int? TemplateId { get; set; }

    public SalaryStructureTemplate? Template { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
