using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("shift_change_requests")]
public class ShiftChangeRequest : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    [ForeignKey("OrganizationId")]
    public virtual Organization Organization { get; set; } = null!;

    [Column("branch_id")]
    public int? BranchId { get; set; }

    [ForeignKey("BranchId")]
    public virtual Branch? Branch { get; set; }

    [Required]
    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [ForeignKey("OrganizationId,EmployeeId")]
    public virtual Employee? Employee { get; set; }

    [Required]
    [Column("request_date")]
    public DateOnly RequestDate { get; set; }

    [Column("current_shift_id")]
    public int? CurrentShiftId { get; set; }

    [ForeignKey("CurrentShiftId")]
    public virtual Shift? CurrentShift { get; set; }

    [Column("is_current_week_off")]
    public bool IsCurrentWeekOff { get; set; }

    [Column("requested_shift_id")]
    public int? RequestedShiftId { get; set; }

    [ForeignKey("RequestedShiftId")]
    public virtual Shift? RequestedShift { get; set; }

    [Column("is_requested_week_off")]
    public bool IsRequestedWeekOff { get; set; }

    [MaxLength(500)]
    [Column("reason")]
    public string? Reason { get; set; }

    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    [MaxLength(100)]
    [Column("reviewed_by")]
    public string? ReviewedBy { get; set; }

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    [MaxLength(500)]
    [Column("rejection_reason")]
    public string? RejectionReason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
