using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("daily_attendance")]
public sealed class DailyAttendance : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Column("record_date")]
    public DateOnly RecordDate { get; set; }

    [Column("in_time")]
    public TimeOnly? InTime { get; set; }

    [Column("out_time")]
    public TimeOnly? OutTime { get; set; }

    [Column("shift_id")]
    public int? ShiftId { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string? Status { get; set; } = "Absent"; // Present, Absent, Half Day, Holiday, Weekoff, Leave

    [Column("is_late")]
    public bool IsLate { get; set; }

    [Column("late_minutes")]
    public int LateMinutes { get; set; }

    [Column("is_early")]
    public bool IsEarly { get; set; }

    [Column("early_minutes")]
    public int EarlyMinutes { get; set; }

    [Column("work_minutes")]
    public int WorkMinutes { get; set; }

    [Column("break_minutes")]
    public int BreakMinutes { get; set; }

    [Column("is_actual_break")]
    public bool IsActualBreak { get; set; }

    [Column("is_half_day")]
    public bool IsHalfDay { get; set; }

    [Column("remarks")]
    [MaxLength(255)]
    public string? Remarks { get; set; }


    [Column("application_number")]
    [MaxLength(20)]
    public string? ApplicationNumber { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation Properties
    [ForeignKey("EmployeeId")]
    public Employee? Employee { get; set; }

    [ForeignKey("ShiftId")]
    public Shift? Shift { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

