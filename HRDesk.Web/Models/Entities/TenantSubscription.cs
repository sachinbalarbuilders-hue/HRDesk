using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("tenant_subscriptions")]
public class TenantSubscription
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("public_id")]
    public Guid PublicId { get; set; } = Guid.NewGuid();

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Column("plan_id")]
    public int PlanId { get; set; }

    public SubscriptionPlan? Plan { get; set; }

    [Required]
    [Column("status")]
    [StringLength(50)]
    public string Status { get; set; } = "Active"; // Active, Trialing, PastDue, Cancelled, Suspended

    [Column("billing_cycle")]
    [StringLength(50)]
    public string BillingCycle { get; set; } = "Monthly"; // Monthly, Yearly

    [Column("valid_until")]
    public DateTime ValidUntil { get; set; } = DateTime.Now.AddYears(1);

    [Column("trial_ends_at")]
    public DateTime? TrialEndsAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
