using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("payroll_runs")]
public sealed class PayrollRun : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("pay_group_id")]
    public int PayGroupId { get; set; }

    [Column("month")]
    [Required]
    [StringLength(7)]
    public string Month { get; set; } = ""; // Format: YYYY-MM

    [Column("total_employees")]
    public int TotalEmployees { get; set; }

    [Column("processed_employees")]
    public int ProcessedEmployees { get; set; }

    [Column("gross_payout")]
    public decimal GrossPayout { get; set; }

    [Column("total_deductions")]
    public decimal TotalDeductions { get; set; }

    [Column("net_payout")]
    public decimal NetPayout { get; set; }

    [Column("status")]
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = "Draft"; // Draft, Review, Approved, Paid

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("processed_by")]
    [StringLength(100)]
    public string? ProcessedBy { get; set; }

    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }

    [Column("submitted_by")]
    [StringLength(100)]
    public string? SubmittedBy { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [Column("approved_by")]
    [StringLength(100)]
    public string? ApprovedBy { get; set; }

    [Column("paid_at")]
    public DateTime? PaidAt { get; set; }

    [Column("paid_by")]
    [StringLength(100)]
    public string? PaidBy { get; set; }

    [Column("payment_date")]
    public DateOnly? PaymentDate { get; set; }

    [Column("payment_method")]
    [StringLength(50)]
    public string? PaymentMethod { get; set; } // Bank Transfer, Cheque, Cash

    [Column("payment_reference")]
    [StringLength(100)]
    public string? PaymentReference { get; set; } // UTR / Cheque No / Voucher No

    [Column("notes")]
    [StringLength(500)]
    public string? Notes { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    // Navigation properties
    public PayGroup? PayGroup { get; set; }
    public Organization? Organization { get; set; }
}
