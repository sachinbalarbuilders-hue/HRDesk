using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("leave_applications")]
public class LeaveApplication : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [MaxLength(150)]
    public string? ArchivedBy { get; set; }

    [Required]
    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Required]
    [Column("leave_type_id")]
    [ForeignKey(nameof(LeaveType))]
    public int LeaveTypeId { get; set; }

    [Required]
    [Column("start_date")]
    public DateOnly StartDate { get; set; }

    [Required]
    [Column("end_date")]
    public DateOnly EndDate { get; set; }

    [Required]
    [Column("total_days")]
    public decimal TotalDays { get; set; }

    [Column("day_type")]
    public string DayType { get; set; } = "Full Day"; // "Full Day", "First Half", "Second Half"

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("status")]
    public string Status { get; set; } = "Approved";

    [Column("approved_by")]
    public string? ApprovedBy { get; set; }

    [Column("ignore_sandwich_rule")]
    public bool IgnoreSandwichRule { get; set; } = false;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public Employee? Employee { get; set; }
    public LeaveType? LeaveType { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

