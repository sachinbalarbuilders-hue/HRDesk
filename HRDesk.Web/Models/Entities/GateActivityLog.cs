using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("gate_activity_logs")]
public sealed class GateActivityLog : IMustHaveTenant
{
    public long Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    [ForeignKey("OrganizationId")]
    public Organization? Organization { get; set; }

    public int? BranchId { get; set; }
    public int? EmployeeId { get; set; }

    [Column(TypeName = "nvarchar(50)")]
    public string EmployeeCode { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(150)")]
    public string EmployeeName { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(100)")]
    public string? DepartmentName { get; set; }

    [Column(TypeName = "nvarchar(100)")]
    public string? DesignationName { get; set; }

    [Column(TypeName = "nvarchar(30)")]
    public string ScanStatus { get; set; } = "Granted"; // Granted, Denied

    [Column(TypeName = "nvarchar(30)")]
    public string ScanMode { get; set; } = "Camera_QR"; // Camera_QR, Manual_Search

    [Column(TypeName = "nvarchar(255)")]
    public string? Reason { get; set; }

    public DateTime ScannedAt { get; set; } = DateTime.UtcNow;

    [Column(TypeName = "nvarchar(100)")]
    public string? ScannedBy { get; set; }
}
