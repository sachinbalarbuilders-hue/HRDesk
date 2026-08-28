using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class PayrollMaster : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    [Required]
    public int EmployeeId { get; set; }

    [Column("month")]
    [Required]
    [StringLength(7)] // Format: YYYY-MM
    public string Month { get; set; } = "";

    [Column("total_days")]
    public int TotalDays { get; set; }

    [Column("present_days")]
    public decimal PresentDays { get; set; }

    [Column("absent_days")]
    public decimal AbsentDays { get; set; }

    [Column("paid_leaves")]
    public decimal PaidLeaves { get; set; }

    [Column("unpaid_leaves")]
    public decimal UnpaidLeaves { get; set; }

    [Column("half_days")]
    public decimal HalfDays { get; set; }

    [Column("weekoffs")]
    public decimal Weekoffs { get; set; }

    [Column("holidays")]
    public decimal Holidays { get; set; }

    [Column("payable_days")]
    public decimal PayableDays { get; set; }

    [Column("gross_salary")]
    public decimal GrossSalary { get; set; }

    [Column("total_earnings")]
    public decimal TotalEarnings { get; set; }

    [Column("total_deductions")]
    public decimal TotalDeductions { get; set; }

    [Column("net_salary")]
    public decimal NetSalary { get; set; }

    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "Draft";

    [Column("processed_date")]
    public DateTime? ProcessedDate { get; set; }

    [Column("approved_by")]
    [StringLength(100)]
    public string? ApprovedBy { get; set; }

    [Column("approved_date")]
    public DateTime? ApprovedDate { get; set; }

    [Column("payment_date")]
    public DateOnly? PaymentDate { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("leave_breakdown")]
    public string? LeaveBreakdown { get; set; }

    /// <summary>
    /// Set when payroll is Approved or Paid.  Once set, the payroll engine
    /// refuses to re-process this record unless an admin explicitly unlocks it.
    /// </summary>
    [Column("locked_at")]
    public DateTime? LockedAt { get; set; }

    /// <summary>Annual CTC snapshot at processing time (informational).</summary>
    [Column("annual_ctc", TypeName = "decimal(14,2)")]
    public decimal? AnnualCTC { get; set; }

    /// <summary>Employer PF contribution (informational — not deducted from employee).</summary>
    [Column("employer_pf", TypeName = "decimal(10,2)")]
    public decimal? EmployerPF { get; set; }

    /// <summary>Employer ESI contribution (informational).</summary>
    [Column("employer_esi", TypeName = "decimal(10,2)")]
    public decimal? EmployerESI { get; set; }

    /// <summary>Professional Tax deducted this month.</summary>
    [Column("professional_tax", TypeName = "decimal(8,2)")]
    public decimal? ProfessionalTax { get; set; }

    /// <summary>TDS (income tax) deducted this month.</summary>
    [Column("tds", TypeName = "decimal(10,2)")]
    public decimal? TDS { get; set; }

    /// <summary>True when salary was prorated (mid-month joiner or exit).</summary>
    [Column("is_prorated")]
    public bool IsProrated { get; set; } = false;

    /// <summary>Actual earning days used for proration (null = full month).</summary>
    [Column("proration_days")]
    public int? ProratedDays { get; set; }

    /// <summary>Salary basis used for this payroll run (snapshot from PayGroup).</summary>
    [Column("salary_basis")]
    [StringLength(30)]
    public string? SalaryBasis { get; set; }

    // Navigation properties
    public Employee? Employee { get; set; }
    public ICollection<PayrollDetail> PayrollDetails { get; set; } = new List<PayrollDetail>();

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

