using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

/// <summary>
/// One slot in a ShiftCycle — represents a single day in the cycle.
/// SlotIndex is 0-based: slot 0 = Day 1 of the cycle, slot N-1 = last day.
/// </summary>
[Table("shift_cycle_slots")]
public class ShiftCycleSlot
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("cycle_id")]
    public int CycleId { get; set; }

    /// <summary>
    /// 0-based index within the cycle. Must be 0 to CycleLengthDays-1.
    /// </summary>
    [Column("slot_index")]
    public int SlotIndex { get; set; }

    /// <summary>
    /// Null when IsWeekOff = true.
    /// </summary>
    [Column("shift_id")]
    public int? ShiftId { get; set; }

    [Column("is_week_off")]
    public bool IsWeekOff { get; set; }

    // Navigation
    public ShiftCycle? Cycle { get; set; }
    public Shift? Shift { get; set; }
}
