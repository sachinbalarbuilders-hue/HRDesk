using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.Attendance;

public class MonthlyAttendanceSheetModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public MonthlyAttendanceSheetModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty(SupportsGet = true)]
    public int Month { get; set; } = DateTime.Now.Month;

    [BindProperty(SupportsGet = true)]
    public int Year { get; set; } = DateTime.Now.Year;

    public List<EmployeeSummaryDto> EmployeeSummaries { get; set; } = new();

    public int DaysInMonth { get; set; }

    public async Task OnGetAsync()
    {
        var startDate = new DateOnly(Year, Month, 1);
        DaysInMonth = DateTime.DaysInMonth(Year, Month);
        var endDate = startDate.AddMonths(1);

        // 1. Fetch employees: Active OR those who have records for this month
        var employees = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Shift)
            .Where(e => (e.Status != null && e.Status.ToLower() == "active") || 
                        _db.DailyAttendance.Any(a => a.EmployeeId == e.EmployeeId && 
                                                     a.RecordDate >= startDate && a.RecordDate < endDate && 
                                                     a.Status != "Absent" && a.Status != "W/O" && a.Status != "Holiday"))
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();

        // 2. Fetch all attendance logs for the month
        var logs = await _db.DailyAttendance
            .Where(a => a.RecordDate >= startDate && a.RecordDate < endDate)
            .ToListAsync();

        // 2b. Fetch all leave applications for the month (both Approved and Adjusted for tooltip context)
        var leaveApps = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => (la.Status == "Approved" || la.Status == "Adjusted") && 
                         la.StartDate < endDate && 
                         la.EndDate >= startDate)
            .ToListAsync();

        // 3. Transform data
        foreach (var emp in employees)
        {
            var empLogs = logs.Where(l => l.EmployeeId == emp.EmployeeId).ToList();
            var summary = new EmployeeSummaryDto
            {
                Employee = emp,
                DailyRecords = new Dictionary<int, DailyAttendanceDto>(),
                PresentCount = 0,
                AbsentCount = 0,
                WeekoffCount = 0,
                HolidayCount = 0,
                LeaveCount = 0,
                HalfDayCount = 0,
                TotalWorkDuration = TimeSpan.Zero
            };

            for (int day = 1; day <= DaysInMonth; day++)
            {
                var date = new DateOnly(Year, Month, day);
                var log = empLogs.FirstOrDefault(l => l.RecordDate == date);
                var dto = new DailyAttendanceDto();

                if (log != null)
                {
                    dto.InTime = log.InTime;
                    dto.OutTime = log.OutTime;
                    
                    // Find matching leave applications for this date
                    var dayApps = leaveApps.Where(la => la.EmployeeId == emp.EmployeeId && date >= la.StartDate && date <= la.EndDate).ToList();
                    var activeApp = dayApps.FirstOrDefault(la => la.Status == "Approved");

                    // Specific Leave Logic
                    if (log.Status == "Leave" || log.Status == "Present (Leave)")
                    {
                        if (activeApp?.LeaveType != null)
                        {
                            dto.Status = activeApp.LeaveType.Code + (log.Status == "Present (Leave)" ? "P" : "");
                        }
                        else
                        {
                            dto.Status = GetStatusChar(log);
                        }
                    }
                    else
                    {
                        dto.Status = GetStatusChar(log);
                    }

                    // Build tooltip: Application No + Reason/Remarks
                    var tooltipParts = new List<string>();
                    
                    if (activeApp != null)
                    {
                        tooltipParts.Add($"App#: {activeApp.ApplicationNumber}");
                        if (!string.IsNullOrEmpty(activeApp.Reason))
                            tooltipParts.Add($"Reason: {activeApp.Reason}");
                    }
                    else if (!string.IsNullOrEmpty(log.ApplicationNumber))
                    {
                        tooltipParts.Add($"App#: {log.ApplicationNumber}");
                    }
                    
                    // Add Adjusted leaves info
                    var adjustedApps = dayApps.Where(la => la.Status == "Adjusted").ToList();
                    foreach (var adj in adjustedApps)
                    {
                        tooltipParts.Add($"Adjusted: {adj.LeaveType?.Code ?? "Leave"} ({adj.ApplicationNumber})");
                        if (!string.IsNullOrEmpty(adj.Reason))
                            tooltipParts.Add($"Orig Reason: {adj.Reason}");
                    }

                    if (!string.IsNullOrEmpty(log.Remarks))
                        tooltipParts.Add(log.Remarks);
                    
                    dto.Tooltip = string.Join(" | ", tooltipParts);
                    dto.IsEarly = log.IsEarly;
                    dto.ShiftStartTime = emp.Shift?.StartTime;
                    
                    if (log.WorkMinutes > 0 || (log.BreakMinutes > 0))
                    {
                        // Use stored values if available
                        dto.WorkDuration = TimeSpan.FromMinutes(log.WorkMinutes);
                        summary.TotalWorkDuration += dto.WorkDuration.Value;
                    }
                    else if (log.InTime.HasValue && log.OutTime.HasValue)
                    {
                        // Fallback for older records: calculate manually
                        var duration = log.OutTime.Value - log.InTime.Value;
                        if (duration < TimeSpan.Zero) duration = duration.Add(TimeSpan.FromDays(1)); // Night shift fix
                        
                        int netMinutes = (int)duration.TotalMinutes;
                        if (emp.Shift != null)
                        {
                            netMinutes = Math.Max(0, netMinutes - emp.Shift.LunchBreakDuration);
                        }
                        
                        dto.WorkDuration = TimeSpan.FromMinutes(netMinutes);
                        summary.TotalWorkDuration += dto.WorkDuration.Value;
                    }

                    if (log.BreakMinutes > 0)
                    {
                        dto.BreakDuration = TimeSpan.FromMinutes(log.BreakMinutes);
                        dto.IsActualBreak = log.IsActualBreak;
                    }

                    // Count logic based on status string from DB
                    if (log.Status != null && log.Status.EndsWith("HF") && log.Status.Length > 2)
                    {
                         // Check if it's a half-day Comp Off
                         if (activeApp?.LeaveType?.Code == "CO" || log.Status == "COHF") {
                             summary.WeekoffCount++; 
                         } else {
                             summary.LeaveCount++; 
                         }
                    }
                    else if (log.IsHalfDay) summary.HalfDayCount++;
                    else if (log.Status == "Present" || log.Status == "W/OP" || log.Status == "Present (W/O)" || log.Status == "Present (WO)" || log.Status == "Present (Leave)") 
                    {
                        summary.PresentCount++;
                    }
                    else if (log.Status == "Absent") summary.AbsentCount++;
                    else if (log.Status == "Weekoff" || log.Status == "W/O" || log.Status == "WO" || log.Status == "CO") 
                    {
                        summary.WeekoffCount++;
                    }
                    else if (log.Status == "Holiday") summary.HolidayCount++;
                    else if (log.Status == "Leave" || log.Status == "LWP" || log.Status == "COP" || log.Status?.Contains("Leave") == true) 
                    {
                        if (activeApp?.LeaveType?.Code == "CO") summary.WeekoffCount++;
                        else summary.LeaveCount++;
                    }
                    else if (log.Status != null && (log.Status == "CO" || log.Status == "COP"))
                    {
                         // Double check for CO if not caught above
                         summary.WeekoffCount++;
                         if (log.Status == "COP") summary.PresentCount++;
                    }
                }
                else
                {
                    // No attendance record - show dash (not processed)
                    dto.Status = "-";
                }
                
                summary.DailyRecords[day] = dto;
            }
            EmployeeSummaries.Add(summary);
        }
    }

    private string GetStatusChar(DailyAttendance log)
    {
        if (log.Status == "Present (W/O)" || log.Status == "Present (WO)") return "W/OP";
        if (log.Status == "Present (Leave)") return "LP";
        if (log.Status != null && log.Status.EndsWith("HF") && log.Status.Length > 2) return log.Status; // Return PHF, SHF etc.
        if (log.IsHalfDay) return "HF";
        if (log.Status == "Present") return "P";
        if (log.Status == "Absent") return "A";
        if (log.Status == "Weekoff" || log.Status == "W/O") return "W/O";
        if (log.Status == "Holiday") return "H";
        if (log.Status?.Contains("Leave") == true) return "L";
        return log.Status ?? "-";
    }

    public class EmployeeSummaryDto
    {
        public Employee? Employee { get; set; }
        public Dictionary<int, DailyAttendanceDto> DailyRecords { get; set; } = new();
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public int HalfDayCount { get; set; }
        public int WeekoffCount { get; set; }
        public int HolidayCount { get; set; }
        public int LeaveCount { get; set; }
        public TimeSpan TotalWorkDuration { get; set; }
    }

    public class DailyAttendanceDto
    {
        public TimeOnly? InTime { get; set; }
        public TimeOnly? OutTime { get; set; }
        public TimeSpan? WorkDuration { get; set; }
        public TimeSpan? BreakDuration { get; set; }
        public bool IsActualBreak { get; set; }
        public string Status { get; set; } = "-";
        public string Tooltip { get; set; } = "";
        public bool IsEarly { get; set; }
        public TimeOnly? ShiftStartTime { get; set; }
    }
}
