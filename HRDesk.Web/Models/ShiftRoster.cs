using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("shift_roster")]
public class ShiftRoster : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Column("shift_id")]
    public int? ShiftId { get; set; }

    [Column("roster_date")]
    public DateOnly RosterDate { get; set; }

    [Column("is_week_off")]
    public bool IsWeekOff { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    public Employee? Employee { get; set; }
    public Shift? Shift { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

