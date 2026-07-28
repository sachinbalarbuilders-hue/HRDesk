using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class LoanInstallment : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("loan_id")]
    [Required]
    public int LoanId { get; set; }

    [Column("installment_number")]
    [Required]
    public int InstallmentNumber { get; set; }

    [Column("due_month")]
    [Required]
    [StringLength(7)] // Format: YYYY-MM
    public string DueMonth { get; set; } = "";

    [Column("amount")]
    [Required]
    public decimal Amount { get; set; }

    [Column("paid_amount")]
    public decimal PaidAmount { get; set; } = 0;

    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    [Column("paid_date")]
    public DateOnly? PaidDate { get; set; }

    [Column("payroll_id")]
    public int? PayrollId { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    // Navigation property
    public EmployeeLoan? EmployeeLoan { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

