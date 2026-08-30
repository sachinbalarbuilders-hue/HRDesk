using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using HRDesk.Web.Models;

namespace HRDesk.Web.Areas.Recruitment.Models;

public sealed class InterviewSchedule : IMustHaveTenant, IArchivable
{
    [Key]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [StringLength(150)]
    public string? ArchivedBy { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    [Required]
    public int CandidateId { get; set; }

    [ForeignKey(nameof(CandidateId))]
    public Candidate? Candidate { get; set; }

    [Required]
    [Display(Name = "Interview Date & Time")]
    public DateTime InterviewDateTime { get; set; }

    [Required]
    [StringLength(50)]
    [Display(Name = "Interview Type")]
    public string InterviewType { get; set; } = "In-Person"; // Phone / Video / In-Person

    [Required]
    [StringLength(50)]
    [Display(Name = "Round")]
    public string Round { get; set; } = "Round 1"; // Round 1, Round 2, HR Round, Technical, Final

    [Required]
    [StringLength(200)]
    [Display(Name = "Interviewer Name")]
    public string InterviewerName { get; set; } = string.Empty;

    [StringLength(20)]
    [Display(Name = "Interviewer Phone")]
    public string? InterviewerPhone { get; set; }

    [StringLength(500)]
    [Display(Name = "Location / Link")]
    public string? Location { get; set; }

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Scheduled"; // Scheduled / Completed / Cancelled / No Show

    [StringLength(20)]
    public string? Result { get; set; } // Pass / Fail / Hold

    public string? Feedback { get; set; }

    [Display(Name = "WhatsApp Reminder Sent")]
    public bool ReminderSent { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
