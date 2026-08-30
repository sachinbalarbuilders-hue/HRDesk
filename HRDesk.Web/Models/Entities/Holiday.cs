namespace HRDesk.Web.Models;

public sealed class Holiday : IMustHaveTenant, IArchivable
{
    public int Id { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("archived_by")]
    [System.ComponentModel.DataAnnotations.StringLength(150)]
    public string? ArchivedBy { get; set; }

    public string HolidayName { get; set; } = "";

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public string? Description { get; set; }
    
    public bool IsGlobal { get; set; } = true;

    public ICollection<HolidayEmployee>? EligibleEmployees { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("department_id")]
    public int? DepartmentId { get; set; }

    public Department? Department { get; set; }
}

