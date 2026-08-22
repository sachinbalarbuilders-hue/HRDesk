using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public sealed class Employee : IMustHaveTenant
{
    public int EmployeeId { get; set; }

    /// <summary>
    /// Opaque, non-enumerable identifier used in URLs and API responses instead of the
    /// internal integer EmployeeId, so employee IDs cannot be guessed/incremented by a client.
    /// Distinct from VerificationId, which is a stable public QR/ID-card verification token.
    /// </summary>
    public Guid PublicId { get; set; } = Guid.NewGuid();

    public Guid VerificationId { get; set; } = Guid.NewGuid();

    public string EmployeeName { get; set; } = "";

    public int? DepartmentId { get; set; }

    public int? DesignationId { get; set; }

    [Column("reporting_manager_id")]
    public int? ReportingManagerId { get; set; }

    public Employee? ReportingManager { get; set; }

    public string? Phone { get; set; }

    public DateOnly? JoiningDate { get; set; }
    
    public DateOnly? ResignationDate { get; set; }

    public DateOnly? LastWorkingDate { get; set; }

    public DateOnly? ProbationStart { get; set; }

    public DateOnly? ProbationEnd { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? Weekoff { get; set; }

    public string? Status { get; set; }

    public Department? Department { get; set; }

    public Designation? Designation { get; set; }

    public string? PhotoPath { get; set; }

    [NotMapped]
    public byte[]? PhotoData { get; set; }
    
    [NotMapped]
    [System.ComponentModel.DataAnnotations.StringLength(100)]
    public string? PhotoContentType { get; set; }

    [Column("device_synced")]
    public int DeviceSynced { get; set; } // 0 = not in machine, 1 = in machine

    [Column("device_sync_error")]
    public string? DeviceSyncError { get; set; }

    [Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(50)]
    public string? EmploymentType { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string? BloodGroup { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(20)]
    public string? Gender { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(50)]
    public string? AttendanceType { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(50)]
    public string? MaritalStatus { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(100)]
    public string? Nationality { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(100)]
    public string? WorkEmail { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(100)]
    public string? PersonalEmail { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(500)]
    public string? CurrentAddress { get; set; }

    [System.ComponentModel.DataAnnotations.StringLength(500)]
    public string? PermanentAddress { get; set; }

    public bool HasProbation { get; set; }

    public int? ProbationDays { get; set; }

    public int? ContractDurationMonths { get; set; }

    public DateTime? ContractEndDate { get; set; }
}
