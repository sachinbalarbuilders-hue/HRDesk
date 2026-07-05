using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("leave_allocations")]
public class LeaveAllocation : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Required]
    [Column("leave_type_id")]
    public int LeaveTypeId { get; set; }

    [Required]
    [Column("year")]
    public int Year { get; set; }

    [Column("total_allocated")]
    public decimal TotalAllocated { get; set; }

    [Column("opening_balance")]
    public decimal OpeningBalance { get; set; }

    [Column("used_count")]
    public decimal UsedCount { get; set; }

    [NotMapped]
    public decimal RemainingCount => TotalAllocated + OpeningBalance - UsedCount;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    public Employee? Employee { get; set; }
    public LeaveType? LeaveType { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

