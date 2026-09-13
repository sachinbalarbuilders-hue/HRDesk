using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public sealed class PayGroup : IMustHaveTenant
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Required]
    [StringLength(20)]
    public string Code { get; set; } = "";

    [StringLength(250)]
    public string? Description { get; set; }

    [Required]
    [StringLength(20)]
    public string PaymentFrequency { get; set; } = "Monthly"; // Monthly, Fortnightly, Weekly

    public int CutoffDay { get; set; } = 30;

    [StringLength(20)]
    public string Status { get; set; } = "active"; // active, inactive

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
