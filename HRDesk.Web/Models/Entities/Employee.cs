using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public sealed class Employee : IMustHaveTenant
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = "";

    public int? DepartmentId { get; set; }

    public int? DesignationId { get; set; }



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

    [Column("pay_group_id")]
    public int? PayGroupId { get; set; }

    public PayGroup? PayGroup { get; set; }

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

    [Column("uan_number")]
    [System.ComponentModel.DataAnnotations.StringLength(20)]
    public string? UanNumber { get; set; }

    [Column("pf_number")]
    [System.ComponentModel.DataAnnotations.StringLength(50)]
    public string? PfNumber { get; set; }

    [Column("is_pf_eligible")]
    public bool IsPfEligible { get; set; } = true;

    [Column("pf_wage_cap")]
    public bool PfWageCap { get; set; } = true;

    [Column("esic_number")]
    [System.ComponentModel.DataAnnotations.StringLength(20)]
    public string? EsicNumber { get; set; }

    [Column("is_esic_eligible")]
    public bool IsEsicEligible { get; set; } = true;

    [Column("is_pt_eligible")]
    public bool IsPtEligible { get; set; } = true;

    [Column("pan_number")]
    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string? PanNumber { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

