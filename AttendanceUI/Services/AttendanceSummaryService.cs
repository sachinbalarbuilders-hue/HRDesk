using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

/// <summary>
/// Single source of truth for attendance counting logic.
/// Ensures MonthlyAttendanceSheet and PayrollService always produce identical results.
/// </summary>
public class AttendanceSummaryService
{
    private readonly BiometricAttendanceDbContext _db;

    public AttendanceSummaryService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Loads data from DB and calculates the attendance summary for one employee / one month.
    /// Use this from PayrollService (single-employee operations).
    /// </summary>
    public async Task<AttendanceSummaryResult> GetSummaryAsync(int employeeId, int year, int month)
    {
        var startDate = new DateOnly(year, month, 1);
        var endDate = startDate.AddMonths(1);

        var logs = await _db.DailyAttendance
            .Where(a => a.EmployeeId == employeeId &&
                        a.RecordDate >= startDate &&
                        a.RecordDate < endDate)
            .ToListAsync();

        var leaveApps = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == employeeId &&
                         (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate < endDate &&
                         la.EndDate >= startDate)
            .ToListAsync();

        return ComputeSummary(employeeId, year, month, logs, leaveApps);
    }

    /// <summary>
    /// Computes the attendance summary using pre-loaded data (no extra DB queries).
    /// Use this from MonthlyAttendanceSheet which bulk-loads all data upfront.
    /// </summary>
    public AttendanceSummaryResult ComputeSummary(
        int employeeId,
        int year,
        int month,
        List<DailyAttendance> allLogs,
        List<LeaveApplication> allLeaveApps)
    {
        int daysInMonth = DateTime.DaysInMonth(year, month);
        var result = new AttendanceSummaryResult { TotalDays = daysInMonth };
        var lopBreakdown = new Dictionary<DateOnly, decimal>();

        void AddLop(DateOnly date, decimal amount)
        {
            if (!lopBreakdown.ContainsKey(date)) lopBreakdown[date] = 0;
            lopBreakdown[date] += amount;
        }

        for (int day = 1; day <= daysInMonth; day++)
        {
            var date = new DateOnly(year, month, day);
            var log = allLogs.FirstOrDefault(l => l.EmployeeId == employeeId && l.RecordDate == date);

            if (log == null) continue;

            // Find the active approved leave application for this day
            var activeApp = allLeaveApps.FirstOrDefault(la =>
                la.EmployeeId == employeeId &&
                la.StartDate <= date && la.EndDate >= date &&
                la.Status == "Approved");

            // ── Half-Day records (COHF, PHF, SHF, HF etc.) ──────────────────────
            if (log.IsHalfDay || (log.Status != null && log.Status.EndsWith("HF") && log.Status.Length > 2))
            {
                if (activeApp == null) result.HalfDayCount++;

                // Did the employee work the other half?
                if (log.InTime != null)
                    result.PresentCount += 0.5m;
                else
                {
                    result.UnpaidLeaveCount += 0.5m;
                    AddLop(date, 0.5m);
                }

                // Classify the leave half
                bool isCompOff = (activeApp?.LeaveType?.Code == "CO") ||
                                 (log.Status == "COHF") ||
                                 (activeApp?.LeaveType?.Code?.Replace(".", "").Trim().ToUpper().StartsWith("CO") == true);

                if (isCompOff)
                {
                    result.WeekoffCount += 0.5m;          // CO credit — no LOP
                }
                else if (activeApp?.LeaveType != null && !activeApp.LeaveType.IsPaid)
                {
                    result.UnpaidLeaveCount += 0.5m;
                    AddLop(date, 0.5m);
                }
                else if (activeApp?.LeaveType != null && activeApp.LeaveType.IsPaid)
                {
                    result.LeaveCount += 0.5m;            // Paid leave — no LOP
                }
                else
                {
                    // No leave app — fall back to status string
                    if (log.Status?.StartsWith("SL") == true ||
                        log.Status?.StartsWith("PL") == true ||
                        log.Status?.Contains("Leave") == true)
                        result.LeaveCount += 0.5m;
                    else
                    {
                        result.UnpaidLeaveCount += 0.5m;
                        AddLop(date, 0.5m);
                    }
                }
            }
            // ── Present / worked on weekoff ───────────────────────────────────────
            else if (log.Status == "Present" || log.Status == "W/OP" ||
                     log.Status == "Present (W/O)" || log.Status == "Present (WO)" ||
                     log.Status == "Present (Leave)" || log.Status == "COP")
            {
                result.PresentCount += 1.0m;
            }
            // ── Absent ───────────────────────────────────────────────────────────
            else if (log.Status == "Absent")
            {
                result.AbsentCount += 1.0m;
                AddLop(date, 1.0m);
            }
            // ── Week Off / Comp Off full day ──────────────────────────────────────
            else if (log.Status == "Weekoff" || log.Status == "W/O" ||
                     log.Status == "WO" || log.Status == "CO")
            {
                result.WeekoffCount += 1.0m;
            }
            // ── Holiday ──────────────────────────────────────────────────────────
            else if (log.Status == "Holiday")
            {
                result.HolidayCount += 1.0m;
            }
            // ── Leave (full day) ─────────────────────────────────────────────────
            else if (activeApp != null ||
                     log.Status == "Leave" || log.Status == "LWP" ||
                     log.Status?.Contains("Leave") == true)
            {
                if (activeApp?.LeaveType?.Code == "CO")
                {
                    result.WeekoffCount += 1.0m;          // CO credit — no LOP
                }
                else if (activeApp?.LeaveType != null && !activeApp.LeaveType.IsPaid)
                {
                    result.UnpaidLeaveCount += 1.0m;
                    AddLop(date, 1.0m);
                }
                else if (activeApp?.LeaveType != null && activeApp.LeaveType.IsPaid)
                {
                    result.LeaveCount += 1.0m;
                }
                else
                {
                    if (log.Status == "LWP")
                    {
                        result.UnpaidLeaveCount += 1.0m;
                        AddLop(date, 1.0m);
                    }
                    else
                        result.LeaveCount += 1.0m;
                }
            }
        }

        result.PayableDays = result.PresentCount + result.WeekoffCount +
                             result.HolidayCount + result.LeaveCount;
        result.LopBreakdown = lopBreakdown;

        return result;
    }
}

/// <summary>
/// Result of the shared attendance summary calculation.
/// </summary>
public class AttendanceSummaryResult
{
    public int TotalDays { get; set; }
    public decimal PresentCount { get; set; }
    public decimal AbsentCount { get; set; }
    public int HalfDayCount { get; set; }
    public decimal WeekoffCount { get; set; }
    public decimal HolidayCount { get; set; }
    public decimal LeaveCount { get; set; }       // Paid leaves
    public decimal UnpaidLeaveCount { get; set; } // Unpaid / LWP
    public decimal PayableDays { get; set; }
    public Dictionary<DateOnly, decimal> LopBreakdown { get; set; } = new();
}
