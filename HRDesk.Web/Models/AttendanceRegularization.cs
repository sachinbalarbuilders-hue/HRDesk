using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("attendance_regularizations")]
public class AttendanceRegularization : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Required]
    [Column("request_type")]
    [MaxLength(50)]
    public string? RequestType { get; set; } // "Late Coming", "Early Go"

    [Column("waive_penalty")]
    public bool WaivePenalty { get; set; } = true;

    [Required]
    [Column("request_date")]
    public DateOnly RequestDate { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("status")]
    [MaxLength(20)]
    public string? Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    [Column("application_number")]
    [MaxLength(20)]
    public string? ApplicationNumber { get; set; }

    [Column("punch_time_in")]
    public DateTime? PunchTimeIn { get; set; }
    
    [Column("punch_time_out")]
    public DateTime? PunchTimeOut { get; set; } // For "Full Day" single request


    [Column("approved_by")]
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }

    [Column("approved_date")]
    public DateTime? ApproveDate { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [ForeignKey("EmployeeId")]
    public Employee? Employee { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

