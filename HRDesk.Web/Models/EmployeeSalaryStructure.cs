using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class EmployeeSalaryStructure : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    [Required]
    public int EmployeeId { get; set; }

    [Column("component_id")]
    [Required]
    public int ComponentId { get; set; }

    [Column("amount")]
    [Required]
    public decimal Amount { get; set; }

    [Column("effective_from")]
    [Required]
    public DateOnly EffectiveFrom { get; set; }

    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    public Employee? Employee { get; set; }
    public SalaryComponent? SalaryComponent { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

