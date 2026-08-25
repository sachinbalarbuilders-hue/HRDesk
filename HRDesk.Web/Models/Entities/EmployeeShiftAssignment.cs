using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("employee_shift_assignments")]
public class EmployeeShiftAssignment : IMustHaveTenant
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Column("shift_id")]
    public int ShiftId { get; set; }

    [Column("from_date")]
    public DateOnly FromDate { get; set; }

    [Column("to_date")]
    public DateOnly? ToDate { get; set; }

    /// <summary>
    /// If this assignment was generated from a ShiftCycle, stores the cycle reference.
    /// </summary>
    [Column("cycle_id")]
    public int? CycleId { get; set; }

    /// <summary>
    /// The calendar date that corresponds to slot index 0 of the cycle.
    /// Used to compute which slot applies on any given date:
    ///   slotIndex = (date - CycleStartDate).Days % cycle.CycleLengthDays
    /// </summary>
    [Column("cycle_start_date")]
    public DateOnly? CycleStartDate { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    public Employee? Employee { get; set; }
    public Shift? Shift { get; set; }
    public ShiftCycle? Cycle { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

