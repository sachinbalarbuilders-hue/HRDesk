namespace HRDesk.Web.Models;

public class ManualAdjustment : IMustHaveTenant
{
    public string Name { get; set; } = "";
    public decimal Amount { get; set; }
    public string Type { get; set; } = "Allowance"; // Allowance or Deduction

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

