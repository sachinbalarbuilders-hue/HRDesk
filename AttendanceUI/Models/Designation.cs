namespace AttendanceUI.Models;

public sealed class Designation : IMustHaveTenant
{
    public int Id { get; set; }

    public string DesignationName { get; set; } = "";

    public string? Status { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

