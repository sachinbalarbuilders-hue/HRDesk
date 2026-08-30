using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("employee_exits")]
public sealed class EmployeeExit : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    [Required]
    [StringLength(50)]
    [Column("exit_type")]
    public string ExitType { get; set; } = "Resignation"; // Resignation, Termination, ContractEnd, Retirement, Absconding

    [Required]
    [StringLength(50)]
    [Column("initiated_by")]
    public string InitiatedBy { get; set; } = "Employee"; // Employee, Admin, Manager

    [Column("resignation_date")]
    public DateOnly ResignationDate { get; set; }

    [Column("last_working_date")]
    public DateOnly LastWorkingDate { get; set; }

    [Column("notice_period_days")]
    public int NoticePeriodDays { get; set; } = 30;

    [Required]
    [StringLength(100)]
    [Column("reason")]
    public string Reason { get; set; } = string.Empty; // Career Growth, Better Opportunity, Relocation, Personal, Performance, Misconduct, Health, Other

    [StringLength(1000)]
    [Column("reason_details")]
    public string? ReasonDetails { get; set; }

    [Required]
    [StringLength(50)]
    [Column("status")]
    public string Status { get; set; } = "Submitted"; // Submitted, Approved, InNoticePeriod, ClearancePending, Completed, Withdrawn, Rejected

    [Column("approved_by_user_id")]
    public int? ApprovedByUserId { get; set; }

    [StringLength(150)]
    [Column("approved_by_name")]
    public string? ApprovedByName { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [StringLength(1000)]
    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("is_eligible_for_rehire")]
    public bool IsEligibleForRehire { get; set; } = true;

    // Handover & Clearance
    [StringLength(50)]
    [Column("handover_status")]
    public string HandoverStatus { get; set; } = "Pending"; // Pending, InProgress, Completed

    [StringLength(2000)]
    [Column("clearance_checklist_json")]
    public string? ClearanceChecklistJson { get; set; } // JSON array of clearance items: IT, ID Card, Finance, HR

    [StringLength(1000)]
    [Column("handover_notes")]
    public string? HandoverNotes { get; set; }

    // Exit Interview
    [Column("exit_interview_completed")]
    public bool ExitInterviewCompleted { get; set; } = false;

    [Column("exit_interview_rating")]
    public int? ExitInterviewRating { get; set; } // 1-5 scale

    [StringLength(2000)]
    [Column("exit_interview_notes")]
    public string? ExitInterviewNotes { get; set; }

    // Final Settlement
    [StringLength(50)]
    [Column("settlement_status")]
    public string SettlementStatus { get; set; } = "Pending"; // Pending, Processed, Paid

    [Column("relieved_at")]
    public DateTime? RelievedAt { get; set; }

    // Document Storage
    [Column("resignation_doc_data")]
    public byte[]? ResignationDocData { get; set; }

    [StringLength(255)]
    [Column("resignation_doc_filename")]
    public string? ResignationDocFileName { get; set; }

    [StringLength(100)]
    [Column("resignation_doc_content_type")]
    public string? ResignationDocContentType { get; set; }

    [Column("relieving_letter_data")]
    public byte[]? RelievingLetterData { get; set; }

    [StringLength(255)]
    [Column("relieving_letter_filename")]
    public string? RelievingLetterFileName { get; set; }

    [StringLength(100)]
    [Column("relieving_letter_content_type")]
    public string? RelievingLetterContentType { get; set; }

    [Column("experience_letter_data")]
    public byte[]? ExperienceLetterData { get; set; }

    [StringLength(255)]
    [Column("experience_letter_filename")]
    public string? ExperienceLetterFileName { get; set; }

    [StringLength(100)]
    [Column("experience_letter_content_type")]
    public string? ExperienceLetterContentType { get; set; }

    [Column("clearance_doc_data")]
    public byte[]? ClearanceDocData { get; set; }

    [StringLength(255)]
    [Column("clearance_doc_filename")]
    public string? ClearanceDocFileName { get; set; }

    [StringLength(100)]
    [Column("clearance_doc_content_type")]
    public string? ClearanceDocContentType { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // IArchivable
    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [StringLength(150)]
    [Column("archived_by")]
    public string? ArchivedBy { get; set; }
}
