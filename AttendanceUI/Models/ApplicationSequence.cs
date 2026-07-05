using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("application_sequences")]
public class ApplicationSequence : IMustHaveTenant
{
    [Column("year")]
    public int Year { get; set; }

    [Column("month")]
    public int Month { get; set; }

    [Column("current_value")]
    public int CurrentValue { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

