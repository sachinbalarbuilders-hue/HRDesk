using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Attendance.Processor;

public class PunchPairingResult
{
    public bool IsSinglePunch { get; set; }
    public TimeOnly InTime { get; set; }
    public TimeOnly OutTime { get; set; }
    public int TotalMinutes { get; set; }
    public int BreakMinutes { get; set; }
    public bool IsActualBreak { get; set; }
}

public class PunchPairingHandler
{
    public PunchPairingResult ProcessPunchesAndBreaks(
        Employee emp,
        DateOnly date,
        DailyAttendance existingRecord,
        ShiftRoster roster,
        List<AttendanceLog> dailyLogs,
        DailyProcessingContext context)
    {
        var sortedLogs = dailyLogs
            .OrderBy(l => l.PunchTime)
            .ThenBy(l => l.VerifyType != null && l.VerifyType.EndsWith("-In") ? 0 : 
                         (l.VerifyType != null && l.VerifyType.EndsWith("-Out") ? 2 : 1))
            .ToList();

        var inTime = TimeOnly.FromDateTime(sortedLogs.First().PunchTime);
        var outTime = TimeOnly.FromDateTime(sortedLogs.Last().PunchTime);

        existingRecord.InTime = inTime;
        existingRecord.OutTime = outTime;

        if (existingRecord.Status == null || existingRecord.Status == "Absent")
        {
            existingRecord.Status = "Present";
        }

        // Half-Day Leave Status Override
        context.Leaves.TryGetValue(emp.EmployeeId, out var empLeaves);
        var approvedLeave = empLeaves?.FirstOrDefault(la => la.Status == "Approved" && date >= la.StartDate && date <= la.EndDate);

        if (approvedLeave != null)
        {
            bool isHalfDayLeave = approvedLeave.DayType == "First Half" || approvedLeave.DayType == "Second Half";
            
            if (isHalfDayLeave)
            {
                var leaveCode = approvedLeave.LeaveType?.Code ?? "UNKNOWN";
                bool isPaid = approvedLeave.LeaveType?.IsPaid ?? false;
                
                if (!isPaid)
                {
                    existingRecord.Status = "HF";
                }
                else
                {
                    if (leaveCode.ToUpper().StartsWith("CO") || leaveCode.ToUpper() == "COMP OFF")
                    {
                        existingRecord.Status = "COHF";
                    }
                    else
                    {
                        string firstLetter = "L";
                        if (!string.IsNullOrWhiteSpace(leaveCode) && leaveCode.Length > 0)
                        {
                            firstLetter = leaveCode.Substring(0, 1).ToUpper();
                        }
                        existingRecord.Status = $"{firstLetter}HF";
                    }
                }
                existingRecord.IsHalfDay = true;
            }
        }

        if (roster.Shift != null)
        {
            TimeOnly preCalcBase = (approvedLeave != null &&
                                    approvedLeave.DayType == "First Half" &&
                                    roster.Shift.HalfTime.HasValue)
                                    ? roster.Shift.HalfTime.Value
                                    : roster.Shift.StartTime;

            existingRecord.LateMinutes = inTime > preCalcBase
                ? (int)(inTime - preCalcBase).TotalMinutes
                : 0;
        }

        // Smart Break Detection & Duration Calculation
        var totalSpan = (outTime.ToTimeSpan() - inTime.ToTimeSpan());
        if (totalSpan < TimeSpan.Zero) totalSpan = totalSpan.Add(TimeSpan.FromDays(1)); // Night shift
        
        int totalMinutes = (int)totalSpan.TotalMinutes;
        int breakMinutes = 0;

        // Check for Single Punch
        if (dailyLogs.Count == 1 || inTime == outTime)
        {
            bool isOutOnly = dailyLogs.Count == 1 && 
                             dailyLogs[0].VerifyType != null && 
                             dailyLogs[0].VerifyType!.EndsWith("-Out");

            bool isCurrentDay = date == DateOnly.FromDateTime(DateTime.Now);

            if (existingRecord.Status != "Present (Leave)")
            {
                if (isCurrentDay && !isOutOnly)
                {
                    bool isMajorLate = roster.Shift != null && 
                                       roster.Shift.HalfTime.HasValue && 
                                       inTime > roster.Shift.HalfTime.Value;

                    if (isMajorLate)
                    {
                        if (existingRecord.Status == null || (!existingRecord.Status.EndsWith("HF") && existingRecord.Status != "Half Day"))
                        {
                            existingRecord.Status = "Half Day";
                            existingRecord.IsHalfDay = true;
                            existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Major Late (> Half Time)");
                        }
                    }
                    else
                    {
                        if (existingRecord.Status == null || existingRecord.Status == "Absent")
                        {
                            existingRecord.Status = "Present";
                        }
                        existingRecord.IsHalfDay = false;
                    }
                }
                else
                {
                    if (existingRecord.Status != null && !existingRecord.Status.EndsWith("HF"))
                    {
                        existingRecord.Status = "Half Day";
                    }
                    existingRecord.IsHalfDay = true;
                }
            }
            
            string baseRemark = "Single Punch (In/Out Missing)";

            if (isOutOnly)
            {
                 existingRecord.InTime = null;
                 existingRecord.LateMinutes = 0;
                 existingRecord.IsLate = false;
                 baseRemark = "Single Punch (In Missing)";
            }
            else
            {
                if (existingRecord.LateMinutes > 0)
                {
                    context.MonthHistory.TryGetValue(emp.EmployeeId, out var previousRecords);
                    int previousLates = previousRecords?.Count(d => d.LateMinutes > 0) ?? 0;
                    int currentLateCount = previousLates + 1;
                    baseRemark = $"Late #{currentLateCount}";
                }
            }

            existingRecord.Remarks = baseRemark;
            existingRecord.WorkMinutes = 0;
            existingRecord.BreakMinutes = 0;

            if (roster.IsWeekOff && existingRecord.Status == "Half Day")
            {
                existingRecord.Status = "W/OHF";
            }

            return new PunchPairingResult
            {
                IsSinglePunch = true,
                InTime = inTime,
                OutTime = outTime,
                TotalMinutes = totalMinutes,
                BreakMinutes = 0,
                IsActualBreak = false
            };
        }

        bool isActualBreak = false;
        if (roster.Shift != null)
        {
            var shift = roster.Shift;
            
            if (sortedLogs.Count >= 4)
            {
                var punch2 = sortedLogs[1].PunchTime;
                var punch3 = sortedLogs[2].PunchTime;
                var actualBreak = (int)(punch3 - punch2).TotalMinutes;
                
                breakMinutes = actualBreak;
                isActualBreak = true;
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Actual Lunch: {breakMinutes}m");
            }
            else
            {
                breakMinutes = shift.LunchBreakDuration;
                isActualBreak = false;
            }

            existingRecord.IsActualBreak = isActualBreak;
            existingRecord.BreakMinutes = breakMinutes;
            existingRecord.WorkMinutes = Math.Max(0, totalMinutes - breakMinutes);
        }
        else
        {
            existingRecord.WorkMinutes = totalMinutes;
            existingRecord.BreakMinutes = 0;
            existingRecord.IsActualBreak = false;
            existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "No Shift Assigned (No Break Deducted)");
        }

        return new PunchPairingResult
        {
            IsSinglePunch = false,
            InTime = inTime,
            OutTime = outTime,
            TotalMinutes = totalMinutes,
            BreakMinutes = breakMinutes,
            IsActualBreak = isActualBreak
        };
    }
}
