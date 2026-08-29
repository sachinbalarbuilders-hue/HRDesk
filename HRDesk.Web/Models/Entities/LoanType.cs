using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class LoanType : IMustHaveTenant, IArchivable
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("archived_at")]
    public DateTime? ArchivedAt { get; set; }

    [Column("archived_by")]
    [StringLength(150)]
    public string? ArchivedBy { get; set; }

    [Column("type_name")]
    [Required]
    [StringLength(100)]
    public string TypeName { get; set; } = "";

    [Column("max_amount")]
    public decimal? MaxAmount { get; set; }

    [Column("max_installments")]
    public int? MaxInstallments { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

