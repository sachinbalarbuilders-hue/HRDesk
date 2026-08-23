using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("in_app_notifications")]
public sealed class InAppNotification : IMustHaveTenant
{
    public long Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    [ForeignKey("OrganizationId")]
    public Organization? Organization { get; set; }

    public int? UserId { get; set; }
    [ForeignKey("UserId")]
    public User? User { get; set; }

    public int? EmployeeId { get; set; }

    [Column(TypeName = "nvarchar(50)")]
    public string? RoleScope { get; set; } // Null for direct user, or "Admin", "HRManager", "Employee", "All"

    [Column(TypeName = "nvarchar(150)")]
    public string Title { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(500)")]
    public string Message { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(50)")]
    public string Type { get; set; } = "System"; // Leave, Attendance, Regularization, Security, Loan, System, Celebration

    [Column(TypeName = "nvarchar(20)")]
    public string Severity { get; set; } = "info"; // info, success, warning, danger

    [Column(TypeName = "nvarchar(255)")]
    public string? LinkUrl { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReadAt { get; set; }
}
