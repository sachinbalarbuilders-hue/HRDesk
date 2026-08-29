using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// A named CTC breakdown template.  HR creates one template per employee category
/// (e.g., "Standard Staff", "Senior Management", "Contract").  The template defines
/// how each rupee of CTC is split across components using formulas.
///
/// Assign the template to a PayGroup (default) or to individual employees (override).
/// At payroll time the engine resolves every component amount from the employee's CTC.
/// </summary>
public class SalaryStructureTemplate : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [StringLength(150)]
    public string? ArchivedBy { get; set; }

    [Column("name")]
    [Required]
    [StringLength(150)]
    public string Name { get; set; } = "";

    [Column("description")]
    [StringLength(1000)]
    public string? Description { get; set; }

    [Column("is_default")]
    public bool IsDefault { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    public ICollection<TemplateComponent> Components { get; set; } = new List<TemplateComponent>();
    public ICollection<PayGroup> PayGroups { get; set; } = new List<PayGroup>();
    public ICollection<EmployeeCTC> EmployeeCTCs { get; set; } = new List<EmployeeCTC>();
}
