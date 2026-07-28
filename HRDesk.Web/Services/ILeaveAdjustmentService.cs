using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public interface ILeaveAdjustmentService
{
    Task<decimal> CalculateLeaveDaysAsync(int employeeId, DateOnly startDate, DateOnly endDate, string dayType, bool ignoreSandwich);
    Task ProcessRetroactiveAdjustmentAsync(int oldAppId, LeaveApplication newApp, string approvedBy);
    Task RestoreAdjustedLeaveAsync(int employeeId, DateOnly startDate, DateOnly endDate);
    Task ReconcileLeavesForHolidayAsync(DateOnly startDate, DateOnly endDate, List<int>? employeeIds = null);
}
