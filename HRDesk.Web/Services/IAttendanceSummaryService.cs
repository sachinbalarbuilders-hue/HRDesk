using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public interface IAttendanceSummaryService
{
    Task<AttendanceSummaryResult> GetSummaryAsync(int employeeId, int year, int month);
    AttendanceSummaryResult ComputeSummary(int employeeId, int year, int month, List<DailyAttendance> allLogs, List<LeaveApplication> allLeaveApps);
    AttendanceSummaryResult ComputeSummaryForRange(int employeeId, DateOnly startDate, DateOnly endDate, List<DailyAttendance> allLogs, List<LeaveApplication> allLeaveApps);
}
