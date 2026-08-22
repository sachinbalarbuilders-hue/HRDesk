using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("subscription_payments")]
public class SubscriptionPayment
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("public_id")]
    public Guid PublicId { get; set; } = Guid.NewGuid();

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Column("plan_id")]
    public int PlanId { get; set; }

    public SubscriptionPlan? Plan { get; set; }

    [Required]
    [Column("invoice_number")]
    [StringLength(50)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("tax_amount")]
    public decimal TaxAmount { get; set; } = 0;

    [Required]
    [Column("currency")]
    [StringLength(10)]
    public string Currency { get; set; } = "INR";

    [Required]
    [Column("billing_cycle")]
    [StringLength(50)]
    public string BillingCycle { get; set; } = "Monthly"; // Monthly, Yearly

    [Required]
    [Column("payment_gateway")]
    [StringLength(50)]
    public string PaymentGateway { get; set; } = "Razorpay"; // Razorpay, Stripe, Manual

    [Column("gateway_order_id")]
    [StringLength(100)]
    public string? GatewayOrderId { get; set; }

    [Column("gateway_payment_id")]
    [StringLength(100)]
    public string? GatewayPaymentId { get; set; }

    [Column("gateway_signature")]
    [StringLength(255)]
    public string? GatewaySignature { get; set; }

    [Required]
    [Column("status")]
    [StringLength(50)]
    public string Status { get; set; } = "Pending"; // Pending, Paid, Failed, Refunded

    [Column("paid_at")]
    public DateTime? PaidAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
