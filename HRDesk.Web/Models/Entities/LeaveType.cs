using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("leave_types")]
public class LeaveType : IMustHaveTenant, IArchivable
{
    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [MaxLength(150)]
    public string? ArchivedBy { get; set; }

    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(10)]
    [Column("code")]
    public string Code { get; set; } = "";

    [Required]
    [MaxLength(50)]
    [Column("name")]
    public string Name { get; set; } = "";

    [Column("default_yearly_quota")]
    public decimal DefaultYearlyQuota { get; set; } = 10;

    [Column("is_paid")]
    public bool IsPaid { get; set; } = true;

    [Column("applicable_after_probation")]
    public bool ApplicableAfterProbation { get; set; } = true;

    [Column("allow_carry_forward")]
    public bool AllowCarryForward { get; set; } = false;

    [Column("status")]
    public string Status { get; set; } = "Active";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("text_color")]
    public string TextColor { get; set; } = "#212529";

    [Column("background_color")]
    public string BackgroundColor { get; set; } = "transparent";

    [Column("gender_applicability")]
    [MaxLength(50)]
    public string GenderApplicability { get; set; } = "All";

    [Column("marital_status_applicability")]
    [MaxLength(200)]
    public string MaritalStatusApplicability { get; set; } = "All";

    [Column("department_ids")]
    public string? DepartmentIds { get; set; }

    [Column("designation_ids")]
    public string? DesignationIds { get; set; }

    [Column("role_ids")]
    public string? RoleIds { get; set; }

    public ICollection<LeaveTypeEligibility> EligibleEmployees { get; set; } = new List<LeaveTypeEligibility>();

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

