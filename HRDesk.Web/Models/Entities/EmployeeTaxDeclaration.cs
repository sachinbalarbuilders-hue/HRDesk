using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// Stores an employee's Income Tax (IT) Declaration and Regime selection for a Financial Year (e.g. "2026-2027").
/// Supports New Tax Regime (Sec 115BAC) and Old Tax Regime (80C, 80D, HRA, Sec 24, NPS).
/// </summary>
public class EmployeeTaxDeclaration : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [StringLength(150)]
    public string? ArchivedBy { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    /// <summary>Financial Year in format "YYYY-YYYY" (e.g. "2026-2027")</summary>
    [Column("financial_year")]
    [Required]
    [StringLength(15)]
    public string FinancialYear { get; set; } = "";

    /// <summary>"New" (Sec 115BAC) or "Old"</summary>
    [Column("tax_regime")]
    [Required]
    [StringLength(10)]
    public string TaxRegime { get; set; } = "New";

    /// <summary>"Draft", "Submitted", "Approved", "Rejected"</summary>
    [Column("status")]
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = "Draft";

    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [Column("approved_by")]
    [StringLength(150)]
    public string? ApprovedBy { get; set; }

    // ── Section 80C (Capped at ₹1,50,000 in Old Regime) ──────────────────────────
    [Column("sec80c_epf", TypeName = "decimal(12,2)")]
    public decimal Sec80C_EPF { get; set; }

    [Column("sec80c_ppf", TypeName = "decimal(12,2)")]
    public decimal Sec80C_PPF { get; set; }

    [Column("sec80c_elss", TypeName = "decimal(12,2)")]
    public decimal Sec80C_ELSS { get; set; }

    [Column("sec80c_life_insurance", TypeName = "decimal(12,2)")]
    public decimal Sec80C_LifeInsurance { get; set; }

    [Column("sec80c_tuition_fees", TypeName = "decimal(12,2)")]
    public decimal Sec80C_TuitionFees { get; set; }

    [Column("sec80c_home_loan_principal", TypeName = "decimal(12,2)")]
    public decimal Sec80C_HomeLoanPrincipal { get; set; }

    [Column("sec80c_other", TypeName = "decimal(12,2)")]
    public decimal Sec80C_Other { get; set; }

    // ── Section 80D (Health Insurance) ──────────────────────────────────────────
    [Column("sec80d_self_family", TypeName = "decimal(12,2)")]
    public decimal Sec80D_SelfFamily { get; set; }

    [Column("sec80d_parents", TypeName = "decimal(12,2)")]
    public decimal Sec80D_Parents { get; set; }

    [Column("sec80d_parents_senior_citizen")]
    public bool Sec80D_ParentsSeniorCitizen { get; set; }

    [Column("sec80d_preventive_checkup", TypeName = "decimal(12,2)")]
    public decimal Sec80D_PreventiveCheckup { get; set; }

    // ── Section 80CCD(1B) (National Pension Scheme - NPS up to ₹50,000) ─────────
    [Column("sec80ccd_nps", TypeName = "decimal(12,2)")]
    public decimal Sec80CCD_NPS { get; set; }

    // ── Section 24(b) (Home Loan Interest - Capped at ₹2,00,000) ───────────────
    [Column("sec24_home_loan_interest", TypeName = "decimal(12,2)")]
    public decimal Sec24_HomeLoanInterest { get; set; }

    [Column("lender_name")]
    [StringLength(150)]
    public string? LenderName { get; set; }

    [Column("lender_pan")]
    [StringLength(20)]
    public string? LenderPAN { get; set; }

    // ── Section 10(13A) (HRA Exemption) ────────────────────────────────────────
    [Column("annual_rent_paid", TypeName = "decimal(12,2)")]
    public decimal AnnualRentPaid { get; set; }

    /// <summary>"Metro" (50% basic) or "NonMetro" (40% basic)</summary>
    [Column("rental_city_type")]
    [StringLength(20)]
    public string RentalCityType { get; set; } = "NonMetro";

    [Column("landlord_name")]
    [StringLength(150)]
    public string? LandlordName { get; set; }

    [Column("landlord_pan")]
    [StringLength(20)]
    public string? LandlordPAN { get; set; }

    // ── Other Deductions ───────────────────────────────────────────────────────
    [Column("sec80e_education_loan_interest", TypeName = "decimal(12,2)")]
    public decimal Sec80E_EducationLoanInterest { get; set; }

    [Column("sec80g_donations", TypeName = "decimal(12,2)")]
    public decimal Sec80G_Donations { get; set; }

    [Column("sec80tta_savings_interest", TypeName = "decimal(12,2)")]
    public decimal Sec80TTA_SavingsInterest { get; set; }

    // ── Other Incomes & Previous Employment ────────────────────────────────────
    [Column("other_income", TypeName = "decimal(12,2)")]
    public decimal OtherIncome { get; set; }

    [Column("previous_employer_gross", TypeName = "decimal(12,2)")]
    public decimal PreviousEmployerGross { get; set; }

    [Column("previous_employer_tds", TypeName = "decimal(12,2)")]
    public decimal PreviousEmployerTDS { get; set; }

    // ── Notes & Timestamps ─────────────────────────────────────────────────────
    [Column("remarks")]
    [StringLength(1000)]
    public string? Remarks { get; set; }

    [Column("rejection_reason")]
    [StringLength(500)]
    public string? RejectionReason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    public ICollection<EmployeeTaxDeclarationProof> Proofs { get; set; } = new List<EmployeeTaxDeclarationProof>();
}
