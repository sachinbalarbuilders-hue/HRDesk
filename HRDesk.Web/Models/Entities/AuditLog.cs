using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("audit_logs")]
public class AuditLog
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    [Column("user_id")]
    public int? UserId { get; set; }

    [Column("user_name")]
    [StringLength(150)]
    public string? UserName { get; set; }

    [Required]
    [Column("action")]
    [StringLength(50)]
    public string Action { get; set; } = "UPDATE"; // CREATE, UPDATE, DELETE

    [Required]
    [Column("entity_name")]
    [StringLength(100)]
    public string EntityName { get; set; } = string.Empty;

    [Column("primary_key")]
    [StringLength(100)]
    public string? PrimaryKey { get; set; }

    [Column("old_values")]
    public string? OldValues { get; set; } // JSON

    [Column("new_values")]
    public string? NewValues { get; set; } // JSON

    [Column("changed_columns")]
    [StringLength(500)]
    public string? ChangedColumns { get; set; }

    [Column("ip_address")]
    [StringLength(50)]
    public string? IpAddress { get; set; }

    [Column("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.Now;
}
