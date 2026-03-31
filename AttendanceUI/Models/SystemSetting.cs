using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("system_settings")]
public class SystemSetting
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
}
