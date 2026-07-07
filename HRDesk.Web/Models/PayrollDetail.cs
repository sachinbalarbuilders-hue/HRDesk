using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class PayrollDetail : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("payroll_id")]
    [Required]
    public int PayrollId { get; set; }

    [Column("component_id")]
    public int? ComponentId { get; set; }

    [Column("component_type")]
    [Required]
    [StringLength(20)]
    public string ComponentType { get; set; } = ""; // Earning or Deduction

    [Column("component_name")]
    [Required]
    [StringLength(100)]
    public string ComponentName { get; set; } = "";

    [Column("amount")]
    [Required]
    public decimal Amount { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    // Navigation properties
    public PayrollMaster? PayrollMaster { get; set; }
    public SalaryComponent? SalaryComponent { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

