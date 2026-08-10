using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("biometric_employee_mappings")]
public class BiometricEmployeeMapping : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; } = 1;

    [ForeignKey("OrganizationId")]
    public virtual Organization? Organization { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("biometric_code")]
    public string BiometricCode { get; set; } = string.Empty;

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [MaxLength(255)]
    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
