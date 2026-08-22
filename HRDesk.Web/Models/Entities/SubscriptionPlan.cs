using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("subscription_plans")]
public class SubscriptionPlan
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("public_id")]
    public Guid PublicId { get; set; } = Guid.NewGuid();

    [Required]
    [Column("name")]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("code")]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Column("description")]
    [StringLength(500)]
    public string? Description { get; set; }

    [Column("max_employees")]
    public int MaxEmployees { get; set; } = 25;

    [Column("max_branches")]
    public int MaxBranches { get; set; } = 1;

    [Column("has_biometrics_module")]
    public bool HasBiometricsModule { get; set; } = true;

    [Column("has_payroll_module")]
    public bool HasPayrollModule { get; set; } = true;

    [Column("has_recruitment_module")]
    public bool HasRecruitmentModule { get; set; } = false;

    [Column("has_loan_management")]
    public bool HasLoanManagement { get; set; } = false;

    [Column("has_custom_domain")]
    public bool HasCustomDomain { get; set; } = false;

    [Column("price_per_month")]
    public decimal PricePerMonth { get; set; } = 0;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
