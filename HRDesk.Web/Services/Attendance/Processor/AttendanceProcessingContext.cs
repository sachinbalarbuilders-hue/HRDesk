using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Attendance.Processor;

public class DayHistoryItem
{
    public int EmployeeId { get; set; }
    public DateOnly RecordDate { get; set; }
    public bool IsLate { get; set; }
    public bool IsEarly { get; set; }
    public int LateMinutes { get; set; }
}

public class DailyProcessingContext
{
    public DateOnly Date { get; set; }
    public Dictionary<int, DailyAttendance> ExistingRecords { get; set; } = new();
    public Dictionary<int, ShiftRoster> Rosters { get; set; } = new();
    public List<Holiday> Holidays { get; set; } = new();
    public Dictionary<int, List<AttendanceRegularization>> Regularizations { get; set; } = new();
    public Dictionary<int, List<LeaveApplication>> Leaves { get; set; } = new();
    public Dictionary<(int EmployeeId, int LeaveTypeId), LeaveAllocation> Allocations { get; set; } = new();
    public Dictionary<int, List<DayHistoryItem>> MonthHistory { get; set; } = new();
    public Dictionary<int, DateOnly?> InactiveLastPunches { get; set; } = new();
    public List<AttendanceLog> AllLogs { get; set; } = new();
    public HashSet<int> SandwichDisabledBranches { get; set; } = new();
}

public static class AttendanceProcessingUtils
{
    public static string AppendRemark(string? existing, string newRemark)
    {
        if (string.IsNullOrWhiteSpace(newRemark)) return existing ?? "";
        if (string.IsNullOrEmpty(existing)) return newRemark;

        var parts = existing.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Any(p => p.Trim().Equals(newRemark.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return existing;
        }

        return $"{existing}, {newRemark}";
    }

    public static int GetLeaveYear(DateOnly date, int startMonth = 11)
    {
        if (startMonth is < 1 or > 12) startMonth = 11;
        return date.Month >= startMonth ? date.Year : date.Year - 1;
    }

    public static decimal CalculateProRataQuota(decimal yearlyQuota, DateOnly probationEnd, int leaveYear, int startMonth = 11)
    {
        if (startMonth is < 1 or > 12) startMonth = 11;
        var cycleStart = new DateOnly(leaveYear, startMonth, 1);
        var cycleEnd = cycleStart.AddMonths(12).AddDays(-1);

        if (probationEnd <= cycleStart) return yearlyQuota;
        if (probationEnd > cycleEnd) return 0;

        int eligibleMonths = 0;
        var current = new DateOnly(probationEnd.Year, probationEnd.Month, 1);
        if (probationEnd.Day > 15)
        {
            current = current.AddMonths(1);
        }

        while (current <= cycleEnd)
        {
            eligibleMonths++;
            current = current.AddMonths(1);
        }

        var rawProRata = (yearlyQuota / 12m) * eligibleMonths;
        return Math.Round(rawProRata * 2, MidpointRounding.AwayFromZero) / 2;
    }
}
