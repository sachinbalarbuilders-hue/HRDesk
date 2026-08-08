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
}

