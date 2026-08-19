namespace HRDesk.Web.Models;

public sealed class AttendanceLog : IMustHaveTenant
{
    public long Id { get; set; }

    public int EmployeeId { get; set; }

    public int MachineNumber { get; set; }

    public DateTime PunchTime { get; set; }

    public int VerifyMode { get; set; }

    public string? VerifyType { get; set; }

    public DateTime SyncedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public Employee? Employee { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    public double? Latitude { get; set; }
    
    public double? Longitude { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(50)")]
    public string? IpAddress { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
    public string? PhotoUrl { get; set; }

    public bool? IsGeofenceValid { get; set; }
    
    public bool? IsIpValid { get; set; }
}

