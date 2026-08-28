using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// Stores an employee's Cost-To-Company (CTC) and assigned salary structure template.
/// Multiple records per employee are kept for revision history.
/// The active record is the one where EffectiveTo is null (or past the processing month end).
///
/// At payroll time the engine:
///   1. Finds the active EmployeeCTC for the processed month.
///   2. Loads the template's TemplateComponents.
///   3. Evaluates each component amount using AnnualCTC and the component formula.
///   4. Uses those amounts for the payslip.
///
/// The old EmployeeSalaryStructure flat amounts are supported as a fallback for employees
/// not yet migrated to the CTC-based system.
/// </summary>
public class EmployeeCTC : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    /// <summary>Annual CTC in rupees (e.g. 600000 for ₹6 LPA).</summary>
    [Column("annual_ctc", TypeName = "decimal(14,2)")]
    public decimal AnnualCTC { get; set; }

    [Column("template_id")]
    public int TemplateId { get; set; }

    public SalaryStructureTemplate? Template { get; set; }

    /// <summary>
    /// Optional per-employee override of the pay group's salary basis.
    /// Null = use the pay group's basis.
    /// </summary>
    [Column("salary_basis_override")]
    [StringLength(30)]
    public string? SalaryBasisOverride { get; set; }

    [Column("effective_from")]
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>Null = currently active.</summary>
    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("remarks")]
    [StringLength(500)]
    public string? Remarks { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}
