using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("leave_types")]
public class LeaveType
{
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

    public ICollection<LeaveTypeEligibility> EligibleEmployees { get; set; } = new List<LeaveTypeEligibility>();
}
