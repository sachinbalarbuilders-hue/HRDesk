namespace HRDesk.Web.Models;

public sealed class Holiday : IMustHaveTenant
{
    public int Id { get; set; }

    public string HolidayName { get; set; } = "";

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public string? Description { get; set; }
    
    public bool IsGlobal { get; set; } = true;

    public ICollection<HolidayEmployee>? EligibleEmployees { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

