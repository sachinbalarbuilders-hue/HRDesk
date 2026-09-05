using System;
using System.Collections.Generic;
using HRDesk.Web.Core;

namespace HRDesk.Web.Services.Attendance;

public class AttendanceDialSegment
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Minutes { get; set; }
    public string Color { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public class AttendanceDialResult
{
    public int ShiftTotalMinutes { get; set; } = 540;
    public string? ShiftStart { get; set; }
    public string? ShiftEnd { get; set; }
    public int RegularWorkMinutes { get; set; }
    public int OvertimeMinutes { get; set; }
    public int BreakMinutes { get; set; }
    public int RemainingMinutes { get; set; }
    public int EffectiveWorkMinutes { get; set; }
    public bool IsOvertime { get; set; }
    public bool IsShiftInProgress { get; set; }
    public int InProgressElapsedMinutes { get; set; }
    public bool IsAfterHours { get; set; }
    public int LateArrivalMinutes { get; set; }
    public string StatusBadge { get; set; } = "Normal";
    public string Subtitle { get; set; } = "0 mins";
    public string TotalWorkFormatted { get; set; } = "00hr 00min";
    public List<AttendanceDialSegment> Segments { get; set; } = new();
}

public class AttendanceDialService
{
    public AttendanceDialResult ComputeShiftDial(
        TimeOnly? shiftStart,
        TimeOnly? shiftEnd,
        TimeOnly? effectiveInTime,
        TimeOnly? effectiveOutTime,
        int breakMinutes,
        int dbWorkMinutes,
        DateOnly recordDate)
    {
        var result = new AttendanceDialResult
        {
            BreakMinutes = breakMinutes,
            ShiftStart = shiftStart?.ToString("HH:mm"),
            ShiftEnd = shiftEnd?.ToString("HH:mm")
        };

        // 1. Scheduled Shift Duration
        int shiftTotalMinutes = 540; // Default 9h
        bool hasShift = shiftStart.HasValue && shiftEnd.HasValue;
        if (hasShift)
        {
            int diff = (int)(shiftEnd!.Value - shiftStart!.Value).TotalMinutes;
            if (diff < 0) diff += 24 * 60; // Overnight shift crossing midnight
            if (diff > 0) shiftTotalMinutes = diff;
        }
        result.ShiftTotalMinutes = shiftTotalMinutes;

        // 2. In-Progress Shift Handling
        bool isToday = recordDate == DateOnly.FromDateTime(IstDateTime.Now);
        bool isShiftInProgress = isToday && effectiveInTime.HasValue && !effectiveOutTime.HasValue;
        int inProgressElapsedMinutes = 0;

        if (isShiftInProgress && effectiveInTime.HasValue)
        {
            var nowTime = TimeOnly.FromDateTime(IstDateTime.Now);
            if (nowTime > effectiveInTime.Value)
            {
                inProgressElapsedMinutes = (int)(nowTime - effectiveInTime.Value).TotalMinutes;
            }
        }

        result.IsShiftInProgress = isShiftInProgress;
        result.InProgressElapsedMinutes = inProgressElapsedMinutes;

        // 3. Effective Worked Minutes
        int effectiveWorkMinutes = 0;
        if (effectiveInTime.HasValue && effectiveOutTime.HasValue && effectiveOutTime > effectiveInTime)
        {
            effectiveWorkMinutes = (int)(effectiveOutTime.Value - effectiveInTime.Value).TotalMinutes;
        }
        else if (dbWorkMinutes > 0 && effectiveOutTime.HasValue)
        {
            effectiveWorkMinutes = dbWorkMinutes;
        }

        int totalWorkedMinutes = effectiveWorkMinutes > 0
            ? effectiveWorkMinutes
            : (isShiftInProgress ? inProgressElapsedMinutes : 0);

        result.EffectiveWorkMinutes = totalWorkedMinutes;
        result.RegularWorkMinutes = Math.Min(totalWorkedMinutes, shiftTotalMinutes);
        result.OvertimeMinutes = Math.Max(0, totalWorkedMinutes - shiftTotalMinutes);
        result.RemainingMinutes = Math.Max(0, shiftTotalMinutes - totalWorkedMinutes);
        result.IsOvertime = totalWorkedMinutes > shiftTotalMinutes;

        result.TotalWorkFormatted = totalWorkedMinutes > 0
            ? $"{totalWorkedMinutes / 60:D2}hr {totalWorkedMinutes % 60:D2}min"
            : "00hr 00min";

        // 4. Shift Timeline & Punch Delay Analysis
        int lateArrivalMinutes = 0;
        bool isAfterHours = false;

        if (effectiveInTime.HasValue && hasShift)
        {
            int inM = effectiveInTime.Value.Hour * 60 + effectiveInTime.Value.Minute;
            int startM = shiftStart!.Value.Hour * 60 + shiftStart.Value.Minute;
            int delayFromShiftStart = inM - startM;
            if (delayFromShiftStart < -720) delayFromShiftStart += 1440;
            else if (delayFromShiftStart > 720) delayFromShiftStart -= 1440;

            if (delayFromShiftStart > 0)
            {
                if (delayFromShiftStart >= shiftTotalMinutes)
                {
                    // Clocked in AFTER the scheduled shift ended (e.g. shift 10:00 - 19:30, punched at 21:45)
                    isAfterHours = true;
                    lateArrivalMinutes = shiftTotalMinutes;
                }
                else
                {
                    lateArrivalMinutes = delayFromShiftStart;
                }
            }
        }

        result.IsAfterHours = isAfterHours;
        result.LateArrivalMinutes = lateArrivalMinutes;

        // 5. Build Proportional Display Segments
        if (isAfterHours)
        {
            result.StatusBadge = "After-Hours";
            result.Subtitle = $"After-Hours (Shift ended {shiftEnd?.ToString("hh:mm tt")})";

            // Scheduled shift missed entirely
            result.Segments.Add(new AttendanceDialSegment
            {
                Id = "missed_shift",
                Label = $"Missed Shift ({shiftStart?.ToString("HH:mm")} - {shiftEnd?.ToString("HH:mm")})",
                Minutes = shiftTotalMinutes,
                Color = "#94a3b8", // Muted slate
                Type = "missed"
            });

            // Active after-hours work
            if (totalWorkedMinutes > 0)
            {
                result.Segments.Add(new AttendanceDialSegment
                {
                    Id = "after_hours",
                    Label = "After-Hours Work",
                    Minutes = totalWorkedMinutes,
                    Color = "#f59e0b", // Warm amber
                    Type = "after_hours"
                });
            }
        }
        else if (lateArrivalMinutes > 0)
        {
            result.StatusBadge = "Late Arrival";
            result.Subtitle = $"Late: +{lateArrivalMinutes}m";

            // Late unworked gap at shift start (highlighted in neutral slate gray)
            result.Segments.Add(new AttendanceDialSegment
            {
                Id = "late",
                Label = $"Late (+{lateArrivalMinutes}m)",
                Minutes = lateArrivalMinutes,
                Color = "#94a3b8", // Slate gray: unworked window from shift start to clock-in
                Type = "late"
            });

            // Actual shift work starting from clock-in
            int workInShift = Math.Min(totalWorkedMinutes, shiftTotalMinutes - lateArrivalMinutes);
            if (breakMinutes > 0 && workInShift > breakMinutes)
            {
                workInShift -= breakMinutes;
            }

            if (workInShift > 0)
            {
                result.Segments.Add(new AttendanceDialSegment
                {
                    Id = "work",
                    Label = "Work",
                    Minutes = workInShift,
                    Color = "#2dd4bf", // Mint teal: actual worked period
                    Type = "work"
                });
            }

            // Overtime past shift end
            int ot = Math.Max(0, totalWorkedMinutes - (shiftTotalMinutes - lateArrivalMinutes));
            if (ot > 0)
            {
                result.IsOvertime = true;
                result.OvertimeMinutes = ot;
                result.Segments.Add(new AttendanceDialSegment
                {
                    Id = "overtime",
                    Label = "Overtime",
                    Minutes = ot,
                    Color = "#f59e0b", // Warm amber
                    Type = "overtime"
                });
            }

            if (breakMinutes > 0)
            {
                result.Segments.Add(new AttendanceDialSegment
                {
                    Id = "break",
                    Label = "Break",
                    Minutes = breakMinutes,
                    Color = "#fb923c", // Warm orange
                    Type = "break"
                });
            }
        }
        else
        {
            // On-time or Pre-shift
            if (result.OvertimeMinutes > 0)
            {
                result.StatusBadge = "Overtime";
                result.Subtitle = $"+{result.OvertimeMinutes}m Overtime";

                if (result.RegularWorkMinutes > 0)
                {
                    result.Segments.Add(new AttendanceDialSegment
                    {
                        Id = "regular",
                        Label = "Shift Work",
                        Minutes = result.RegularWorkMinutes,
                        Color = "#2dd4bf",
                        Type = "work"
                    });
                }

                result.Segments.Add(new AttendanceDialSegment
                {
                    Id = "overtime",
                    Label = "Overtime",
                    Minutes = result.OvertimeMinutes,
                    Color = "#f59e0b",
                    Type = "overtime"
                });

                if (breakMinutes > 0)
                {
                    result.Segments.Add(new AttendanceDialSegment
                    {
                        Id = "break",
                        Label = "Break",
                        Minutes = breakMinutes,
                        Color = "#fb923c",
                        Type = "break"
                    });
                }
            }
            else
            {
                if (isShiftInProgress)
                {
                    result.StatusBadge = "In Progress";
                    result.Subtitle = "In Progress";
                }
                else if (totalWorkedMinutes > 0)
                {
                    result.StatusBadge = "Completed";
                    result.Subtitle = $"{Math.Round((totalWorkedMinutes / (double)shiftTotalMinutes) * 100)}% of Shift";
                }

                if (totalWorkedMinutes > 0)
                {
                    result.Segments.Add(new AttendanceDialSegment
                    {
                        Id = "work",
                        Label = "Work",
                        Minutes = totalWorkedMinutes,
                        Color = "#2dd4bf",
                        Type = "work"
                    });
                }

                if (breakMinutes > 0)
                {
                    result.Segments.Add(new AttendanceDialSegment
                    {
                        Id = "break",
                        Label = "Break",
                        Minutes = breakMinutes,
                        Color = "#fb923c",
                        Type = "break"
                    });
                }
            }
        }

        return result;
    }
}
