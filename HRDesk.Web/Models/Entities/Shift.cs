using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public sealed class Shift : IMustHaveTenant
{
    public int Id { get; set; }

    public string ShiftName { get; set; } = "";

    public string ShiftCode { get; set; } = "";

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public TimeOnly? LunchBreakStart { get; set; }

    public TimeOnly? LunchBreakEnd { get; set; }

    public TimeOnly? HalfTime { get; set; }

    public int? LateComingGraceMinutes { get; set; }

    public int? LateComingAllowedCountPerMonth { get; set; }

    public bool? LateComingHalfDayOnExceed { get; set; }

    public int? EarlyLeaveGraceMinutes { get; set; }

    public TimeOnly? EarlyGoAllowedTime { get; set; }

    public int? EarlyGoFrequencyPerMonth { get; set; }

    [Column("color_code")]
    public string? ColorCode { get; set; } = "#4e73df";

    public int LunchBreakDuration { get; set; }

    public decimal WorkingHours { get; set; }

    public string? Status { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }
}

