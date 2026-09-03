using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Attendance.Processor;

public class TimingPenaltyHandler
{
    private readonly BiometricAttendanceDbContext _db;

    public TimingPenaltyHandler(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public void ApplyTimingRulesAndPenalties(
        Employee emp,
        DateOnly date,
        DailyAttendance existingRecord,
        ShiftRoster roster,
        TimeOnly inTime,
        TimeOnly outTime,
        bool waiveLate,
        bool waiveEarly,
        LeaveApplication? approvedLeave,
        DailyProcessingContext context)
    {
        if (roster.Shift == null) return;
        var currentShift = roster.Shift;

        bool isNoticePeriod = emp.ResignationDate.HasValue && date >= emp.ResignationDate.Value;
        bool isProbation = emp.ProbationEnd.HasValue && date < emp.ProbationEnd.Value;

        TimeOnly expectedStartTime = currentShift.StartTime;
        if (approvedLeave != null && approvedLeave.DayType == "First Half")
        {
            expectedStartTime = currentShift.HalfTime ?? currentShift.StartTime;
        }

        // 1. Late Coming Check
        var inTimeMinute = new TimeOnly(inTime.Hour, inTime.Minute);
        var expectedMinute = new TimeOnly(expectedStartTime.Hour, expectedStartTime.Minute);

        if (inTimeMinute > expectedMinute)
        {
            int lateMins = (int)(inTimeMinute - expectedMinute).TotalMinutes;
            int graceLimit = isNoticePeriod ? 0 : (currentShift.LateComingGraceMinutes ?? 30);
            
            if (waiveLate)
            {
                existingRecord.LateMinutes = 0;
                existingRecord.IsLate = false;
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Late Waived ({lateMins}m)");
            }
            else
            {
                existingRecord.LateMinutes = lateMins;
                
                if (currentShift.HalfTime.HasValue && expectedStartTime != currentShift.HalfTime.Value && inTime > currentShift.HalfTime.Value)
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day"; 
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Major Late (> Half Time)");
                    }
                }
                else if ((isProbation || isNoticePeriod) && lateMins > 5)
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        var ruleName = isNoticePeriod ? "Notice Period" : "Probation";
                        existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"{ruleName} Late (Grace: 5m)");
                    }
                }
                else if (lateMins > graceLimit)
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Late Beyond Grace");
                    }
                }
                else
                {
                     existingRecord.IsLate = true; 
                }
            }
        }

        // 2. Early Exit Check
        var outTimeMinute = new TimeOnly(outTime.Hour, outTime.Minute);
        var expectedEndMinute = new TimeOnly(currentShift.EndTime.Hour, currentShift.EndTime.Minute);

        if (outTimeMinute < expectedEndMinute)
        {
            int earlyMins = (int)(expectedEndMinute - outTimeMinute).TotalMinutes;
            int graceMinutes = (isNoticePeriod || isProbation) ? 5 : (currentShift.EarlyLeaveGraceMinutes ?? 0);
            
            if (approvedLeave != null && approvedLeave.DayType == "Second Half" && currentShift.HalfTime.HasValue && outTime < currentShift.HalfTime.Value.AddMinutes(-graceMinutes))
            {
                if (!waiveEarly)
                {
                    existingRecord.WorkMinutes = 0;
                    existingRecord.BreakMinutes = 0;
                    existingRecord.IsActualBreak = false;
                    existingRecord.IsHalfDay = true;
                    existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, 
                        $"First Half Absent: Left at {outTime:HH\\:mm} before half-time ({currentShift.HalfTime.Value:HH\\:mm}).");
                }
            }
            else if (currentShift.EarlyGoAllowedTime.HasValue && outTime < currentShift.EarlyGoAllowedTime.Value.AddMinutes(-graceMinutes))
            {
                if (waiveEarly)
                {
                    existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Early Waived (Half Day Granted)");
                }
                else 
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Major Early Exit (< {currentShift.EarlyGoAllowedTime:HH:mm})");
                    }
                }
            }
            else
            {
                if (waiveEarly)
                {
                    existingRecord.EarlyMinutes = 0;
                    existingRecord.IsEarly = false;
                    existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Early Waived ({earlyMins}m)");
                }
                else
                {
                    existingRecord.EarlyMinutes = earlyMins;
                    
                    if (earlyMins > graceMinutes || isProbation || isNoticePeriod)
                    {
                        existingRecord.IsEarly = true;
                        
                        if ((isNoticePeriod || isProbation) && earlyMins > 5)
                        {
                            if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                            {
                                existingRecord.Status = "Half Day";
                                existingRecord.IsHalfDay = true;
                                var ruleName = isNoticePeriod ? "Notice Period" : "Probation";
                                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"{ruleName} Early Exit (Grace: 5m)");
                            }
                        }
                    }
                }
            }
        }

        // 3. Monthly Penalties
        ApplyMonthlyPenaltiesFromContext(emp, existingRecord, currentShift, context.MonthHistory);

        if (roster.IsWeekOff && existingRecord.IsHalfDay && existingRecord.Status == "Half Day")
        {
            existingRecord.Status = "W/OHF";
        }
    }

    private void ApplyMonthlyPenaltiesFromContext(Employee emp, DailyAttendance currentRecord, Shift shift, Dictionary<int, List<DayHistoryItem>> monthHistory)
    {
        var startOfMonth = new DateOnly(currentRecord.RecordDate.Year, currentRecord.RecordDate.Month, 1);
        
        if (currentRecord.IsLate)
        {
            monthHistory.TryGetValue(emp.EmployeeId, out var dbRecords);
            dbRecords ??= new List<DayHistoryItem>();

            var localRecords = _db.DailyAttendance.Local
                .Where(d => d.EmployeeId == emp.EmployeeId && 
                            d.RecordDate >= startOfMonth && 
                            d.RecordDate < currentRecord.RecordDate)
                .Select(d => new DayHistoryItem
                {
                    EmployeeId = d.EmployeeId,
                    RecordDate = d.RecordDate,
                    IsLate = d.IsLate,
                    IsEarly = d.IsEarly,
                    LateMinutes = d.LateMinutes
                })
                .ToList();

            var allRecords = localRecords.Concat(dbRecords)
                .GroupBy(x => x.RecordDate)
                .Select(g => g.First())
                .ToList();

            int previousLatesCount = allRecords.Count(d => d.IsLate);
            int currentLateCount = previousLatesCount + 1;
            
            currentRecord.Remarks = AttendanceProcessingUtils.AppendRemark(currentRecord.Remarks, $"Late #{currentLateCount}");

            var isProbation = emp.ProbationEnd.HasValue && currentRecord.RecordDate < emp.ProbationEnd.Value;
            
            if (isProbation)
            {
                currentRecord.Status = "Half Day";
                currentRecord.IsHalfDay = true;
                currentRecord.Remarks = AttendanceProcessingUtils.AppendRemark(currentRecord.Remarks, "Probation Penalty");
            }
            else
            {
                int allowedLates = shift.LateComingAllowedCountPerMonth ?? 3;
                bool halfDayOnExceed = shift.LateComingHalfDayOnExceed ?? true;

                if (currentLateCount > allowedLates && halfDayOnExceed)
                {
                    currentRecord.Status = "Half Day";
                    currentRecord.IsHalfDay = true;
                    currentRecord.Remarks = AttendanceProcessingUtils.AppendRemark(currentRecord.Remarks, $"Penalty Applied (Max {allowedLates} allowed)");
                }
            }
        }

        if (currentRecord.IsEarly && currentRecord.Status != "Half Day")
        {
            var isProbation = emp.ProbationEnd.HasValue && currentRecord.RecordDate < emp.ProbationEnd.Value;
            
            if (isProbation)
            {
                currentRecord.Status = "Half Day";
                currentRecord.IsHalfDay = true;
                currentRecord.Remarks = AttendanceProcessingUtils.AppendRemark(currentRecord.Remarks, "Early Go (Probation)");
            }
            else
            {
                monthHistory.TryGetValue(emp.EmployeeId, out var dbRecords);
                dbRecords ??= new List<DayHistoryItem>();

                var localRecords = _db.DailyAttendance.Local
                    .Where(d => d.EmployeeId == emp.EmployeeId && 
                                d.RecordDate >= startOfMonth && 
                                d.RecordDate < currentRecord.RecordDate)
                    .Select(d => new DayHistoryItem
                    {
                        EmployeeId = d.EmployeeId,
                        RecordDate = d.RecordDate,
                        IsLate = d.IsLate,
                        IsEarly = d.IsEarly,
                        LateMinutes = d.LateMinutes
                    })
                    .ToList();

                var allRecords = localRecords.Concat(dbRecords)
                    .GroupBy(x => x.RecordDate)
                    .Select(g => g.First())
                    .ToList();

                int previousEarly = allRecords.Count(d => d.IsEarly);
                int allowedEarly = shift.EarlyGoFrequencyPerMonth ?? 1;

                if (previousEarly >= allowedEarly)
                {
                    currentRecord.Status = "Half Day";
                    currentRecord.IsHalfDay = true;
                    currentRecord.Remarks = AttendanceProcessingUtils.AppendRemark(currentRecord.Remarks, $"Early Go #{previousEarly + 1} Penalty (Max {allowedEarly} allowed)");
                }
            }
        }
    }
}
