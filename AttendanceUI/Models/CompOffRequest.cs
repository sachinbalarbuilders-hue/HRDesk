using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("comp_off_requests")]
public class CompOffRequest
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Column("worked_date")]
    public DateOnly WorkedDate { get; set; }

    [Column("shift_id")]
    public int? ShiftId { get; set; }

    [Column("in_time")]
    public TimeOnly? InTime { get; set; }

    [Column("out_time")]
    public TimeOnly? OutTime { get; set; }

    [Column("work_minutes")]
    public int? WorkMinutes { get; set; }

    [Column("comp_off_days")]
    public decimal? CompOffDays { get; set; }

    [Column("request_date")]
    public DateTime RequestDate { get; set; } = DateTime.Now;

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "Draft"; // Draft, Pending, Approved, Rejected

    [Column("approved_by")]
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }

    [Column("approved_date")]
    public DateTime? ApprovedDate { get; set; }

    [Column("rejection_reason")]
    [MaxLength(255)]
    public string? RejectionReason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation Properties
    [ForeignKey("EmployeeId")]
    public Employee? Employee { get; set; }

    [ForeignKey("ShiftId")]
    public Shift? Shift { get; set; }
}
