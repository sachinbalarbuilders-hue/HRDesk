using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

public class EmployeeLoan
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    [Required]
    public int EmployeeId { get; set; }

    [Column("loan_type_id")]
    [Required]
    public int LoanTypeId { get; set; }

    [Column("application_number")]
    [StringLength(20)]
    public string? ApplicationNumber { get; set; }

    [Column("loan_amount")]
    [Required]
    public decimal LoanAmount { get; set; }

    [Column("installments")]
    [Required]
    public int Installments { get; set; }

    [Column("installment_amount")]
    public decimal InstallmentAmount { get; set; }

    [Column("remaining_amount")]
    public decimal RemainingAmount { get; set; }

    [Column("remaining_installments")]
    public int RemainingInstallments { get; set; }

    [Column("starting_paid_installments")]
    public int StartingPaidInstallments { get; set; } // For migration of ongoing loans

    [Column("start_date")]
    [Required]
    public DateOnly StartDate { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    [Column("approved_by")]
    [StringLength(100)]
    public string? ApprovedBy { get; set; }

    [Column("approved_date")]
    public DateTime? ApprovedDate { get; set; }

    [Column("foreclosure_remark")]
    [StringLength(500)]
    public string? ForeclosureRemark { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    public Employee? Employee { get; set; }
    public LoanType? LoanType { get; set; }
    public ICollection<LoanInstallment> LoanInstallments { get; set; } = new List<LoanInstallment>();
}
