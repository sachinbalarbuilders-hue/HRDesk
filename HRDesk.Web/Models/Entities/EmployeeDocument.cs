using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("employee_documents")]
public class EmployeeDocument : IMustHaveTenant
{
    [Key]
    [Column("document_id")]
    public int DocumentId { get; set; }

    [Column("organization_id")]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Required]
    [Column("document_type")]
    [MaxLength(100)]
    public string DocumentType { get; set; } = string.Empty;

    [Required]
    [Column("file_name")]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [Column("file_path")]
    [MaxLength(500)]
    public string FilePath { get; set; } = string.Empty;

    [Required]
    [Column("content_type")]
    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    [Column("uploaded_at")]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("OrganizationId, EmployeeId")]
    public Employee? Employee { get; set; }
}
