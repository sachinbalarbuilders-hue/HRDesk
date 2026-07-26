using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using HRDesk.Web.Models;

namespace HRDesk.Web.Areas.Recruitment.Models;

public sealed class Candidate : IMustHaveTenant
{
    [Key]
    public int CandidateId { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    [Required]
    [StringLength(200)]
    [Display(Name = "Candidate Name")]
    public string CandidateName { get; set; } = string.Empty;

    [EmailAddress]
    [StringLength(150)]
    public string? Email { get; set; }

    [Phone]
    [StringLength(20)]
    public string? Phone { get; set; }

    [Required]
    [StringLength(150)]
    public string AppliedFor { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Sourced"; // Sourced, Screening, Interview, Offered, Hired, Rejected

    public string? Notes { get; set; }

    public byte[]? ResumeData { get; set; }
    
    [StringLength(255)]
    public string? ResumeFileName { get; set; }
    
    [StringLength(100)]
    public string? ResumeContentType { get; set; }

    public DateOnly ApplicationDate { get; set; }

    public int? HiredEmployeeId { get; set; }
    
    [ForeignKey(nameof(HiredEmployeeId))]
    public Employee? HiredEmployee { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
