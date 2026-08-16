using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("system_settings")]
public class SystemSetting : IMustHaveTenant
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("setting_key")]
    public string SettingKey { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("setting_value")]
    public string? SettingValue { get; set; }

    [MaxLength(255)]
    [Column("description")]
    public string? Description { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

