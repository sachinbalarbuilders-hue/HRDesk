namespace HRDesk.Web.Models;

public sealed class HolidayEmployee : IMustHaveTenant
{
    public int HolidayId { get; set; }
    public int EmployeeId { get; set; }

    public Holiday? Holiday { get; set; }
    public Employee? Employee { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

