namespace HRDesk.Web.Models;

public sealed class Department : IMustHaveTenant
{
    public int Id { get; set; }

    public string DepartmentName { get; set; } = "";

    public string? Status { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

