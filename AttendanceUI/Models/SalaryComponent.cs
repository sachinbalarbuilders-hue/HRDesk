using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

public class SalaryComponent : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("component_name")]
    [Required]
    [StringLength(100)]
    public string ComponentName { get; set; } = "";

    [Column("component_code")]
    [Required]
    [StringLength(20)]
    public string ComponentCode { get; set; } = "";

    [Column("component_type")]
    [Required]
    [StringLength(20)]
    public string ComponentType { get; set; } = ""; // Earning or Deduction

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

