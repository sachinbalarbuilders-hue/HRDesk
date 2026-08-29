namespace HRDesk.Web.Models;

public sealed class Designation : IMustHaveTenant, IArchivable
{
    public int Id { get; set; }

    public string DesignationName { get; set; } = "";

    public string? Status { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("archived_by")]
    [System.ComponentModel.DataAnnotations.StringLength(150)]
    public string? ArchivedBy { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

