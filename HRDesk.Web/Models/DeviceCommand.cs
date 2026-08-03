using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("device_commands")]
public class DeviceCommand : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("action")]
    public string Action { get; set; } = string.Empty;

    [Column("employee_id")]
    public int? EmployeeId { get; set; }

    [MaxLength(100)]
    [Column("employee_name")]
    public string? EmployeeName { get; set; }

    [Column("enabled")]
    public bool? Enabled { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = "Pending";

    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }
}
