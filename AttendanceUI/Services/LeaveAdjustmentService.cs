using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AttendanceUI.Services
{
    public class LeaveAdjustmentService
    {
        private readonly BiometricAttendanceDbContext _db;
        private readonly AttendanceProcessorService _processor;
        private readonly PayrollService _payrollService;
        private readonly CompOffService _compOffService;

        public LeaveAdjustmentService(
            BiometricAttendanceDbContext db, 
            AttendanceProcessorService processor, 
            PayrollService payrollService,
            CompOffService compOffService)
        {
            _db = db;
            _processor = processor;
            _payrollService = payrollService;
            _compOffService = compOffService;
        }

        public async Task<decimal> CalculateLeaveDaysAsync(int employeeId, DateOnly startDate, DateOnly endDate, string dayType, bool ignoreSandwich)
        {
            var emp = await _db.Employees.FindAsync(employeeId);
            if (emp == null) return 0;

            decimal workDaysCount = 0;
            string weekoffDay = emp.Weekoff?.Trim() ?? "";
            decimal dayMultiplier = (dayType == "First Half" || dayType == "Second Half") ? 0.5m : 1.0m;

            var holidaysList = await _db.Holidays
                .Where(h => h.IsGlobal || _db.HolidayEmployees.Any(he => he.HolidayId == h.Id && he.EmployeeId == employeeId))
                .ToListAsync();

            var dayInfos = new System.Collections.Generic.List<(DateOnly Date, bool IsWorkDay, bool IsWeekoff, bool IsHoliday)>();
            for (var d = startDate; d <= endDate; d = d.AddDays(1))
            {
                bool isHoliday = holidaysList.Any(h => d >= h.StartDate && d <= h.EndDate);
                bool isWeekoff = !string.IsNullOrEmpty(weekoffDay) && d.DayOfWeek.ToString().Equals(weekoffDay, StringComparison.OrdinalIgnoreCase);
                bool isWorkDay = !isHoliday && !isWeekoff;
                dayInfos.Add((d, isWorkDay, isWeekoff, isHoliday));

                if (isWorkDay)
                {
                    workDaysCount += dayMultiplier;
                }
            }

            // Include sandwiched weekoffs
            if (!ignoreSandwich)
            {
                int totalDaysInSpan = endDate.DayNumber - startDate.DayNumber + 1;
                
                foreach (var di in dayInfos.Where(x => x.IsWeekoff && !x.IsHoliday))
                {
                    bool hasWorkDayBefore = dayInfos.Any(x => x.Date < di.Date && x.IsWorkDay);
                    bool hasWorkDayAfter = dayInfos.Any(x => x.Date > di.Date && x.IsWorkDay);
                    
                    // If the total leave block is 3+ days, OR it structurally sandwiches the weekoff (Leave, Weekoff, Leave)
                    if (totalDaysInSpan >= 3 || (hasWorkDayBefore && hasWorkDayAfter))
                    {
                        workDaysCount += dayMultiplier;
                    }
                    else
                    {
                        // Check outside the range for sandwiches (simplified version for single-day adjustments)
                        if (startDate == endDate && di.Date == startDate)
                        {
                            // If it's a single day adjustment on a weekoff, check if it's sandwiched by actual leaves or work
                            // However, if the user explicitly adjusted it, they probably want it to count.
                            // For now, if the original leave had a count, we should probably respect that.
                        }
                    }
                }
            }

            return workDaysCount;
        }

        /// <summary>
        /// Adjusts an existing approved leave by marking it as 'Adjusted' and applying a new leave in its place.
        /// Handles balance restoration for old leave and deduction for new leave.
        /// </summary>
        public async Task ProcessRetroactiveAdjustmentAsync(int oldAppId, LeaveApplication newApp, string approvedBy)
        {
            var oldApp = await _db.LeaveApplications
                .Include(l => l.LeaveType)
                .FirstOrDefaultAsync(l => l.Id == oldAppId);

            if (oldApp == null)
                throw new InvalidOperationException("Original leave application not found.");

            if (oldApp.Status != "Approved")
                throw new InvalidOperationException("Only approved leave applications can be adjusted.");

            // Ensure TotalDays is calculated if not provided
            if (newApp.TotalDays == 0)
            {
                newApp.TotalDays = await CalculateLeaveDaysAsync(newApp.EmployeeId, newApp.StartDate, newApp.EndDate, newApp.DayType, newApp.IgnoreSandwichRule);
                
                // FALLBACK: If calculation results in 0 but it's a replacement for a 1-day leave, use the old count
                // This handles cases where a weekoff was previously counted as a leave (e.g. via manual entry or shift override)
                if (newApp.TotalDays == 0 && oldApp.TotalDays > 0 && newApp.StartDate == oldApp.StartDate && newApp.EndDate == oldApp.EndDate)
                {
                    newApp.TotalDays = oldApp.TotalDays;
                }
            }

            // 1. Mark Old as Adjusted (History Preservation)
            oldApp.Status = "Adjusted";
            oldApp.Reason = $"[Adjusted to {newApp.LeaveType?.Code ?? "New Leave"}] " + (oldApp.Reason ?? "");
            
            // 2. Restore Balance for Old Leave
            if (oldApp.LeaveType != null && oldApp.LeaveType.IsPaid)
            {
                var oldYear = AttendanceProcessorService.GetLeaveYear(oldApp.StartDate);
                var oldAllocation = await _db.LeaveAllocations
                    .FirstOrDefaultAsync(la => la.EmployeeId == oldApp.EmployeeId && 
                                               la.LeaveTypeId == oldApp.LeaveTypeId && 
                                               la.Year == oldYear);
                
                if (oldAllocation != null)
                {
                    oldAllocation.UsedCount -= oldApp.TotalDays;
                    oldAllocation.UpdatedAt = DateTime.Now;
                }
            }

            // 3. Check and Deduct Balance for New Leave
            var newType = await _db.LeaveTypes.FindAsync(newApp.LeaveTypeId);
            if (newType == null) throw new InvalidOperationException("Invalid new leave type.");

            if (newType.IsPaid)
            {
                if (newType.Code == "CO")
                {
                    decimal coBalance = await _compOffService.GetValidBalanceAsync(newApp.EmployeeId, newApp.StartDate);
                    if (newApp.TotalDays > coBalance)
                        throw new InvalidOperationException($"Insufficient Comp-Off balance. Available: {coBalance}, Requested: {newApp.TotalDays}");
                }

                var newYear = AttendanceProcessorService.GetLeaveYear(newApp.StartDate);
                var newAllocation = await _db.LeaveAllocations
                    .FirstOrDefaultAsync(la => la.EmployeeId == newApp.EmployeeId && 
                                               la.LeaveTypeId == newApp.LeaveTypeId && 
                                               la.Year == newYear);

                if (newAllocation == null && newType.Code != "CO")
                    throw new InvalidOperationException($"No allocation found for {newType.Name} in leave year {newYear}.");

                if (newAllocation != null)
                {
                    newAllocation.UsedCount += newApp.TotalDays;
                    newAllocation.UpdatedAt = DateTime.Now;
                }
            }

            // 4. Save New Application
            newApp.Status = "Approved";
            newApp.ApprovedBy = approvedBy;
            newApp.CreatedAt = DateTime.Now;
            _db.LeaveApplications.Add(newApp);

            await _db.SaveChangesAsync();

            // 5. Refresh Attendance for the range
            var start = oldApp.StartDate < newApp.StartDate ? oldApp.StartDate : newApp.StartDate;
            var end = oldApp.EndDate > newApp.EndDate ? oldApp.EndDate : newApp.EndDate;

            for (var date = start.AddDays(-1); date <= end.AddDays(1); date = date.AddDays(1))
            {
                await _processor.ProcessDailyAttendanceAsync(date, newApp.EmployeeId);
            }

            // 6. Refresh Payroll for affected month(s)
            var months = new[] { 
                $"{newApp.StartDate:yyyy-MM}", 
                $"{newApp.EndDate:yyyy-MM}", 
                $"{oldApp.StartDate:yyyy-MM}", 
                $"{oldApp.EndDate:yyyy-MM}" 
            }.Distinct();

            foreach (var month in months)
            {
                // Re-process payroll if it exists
                var payroll = await _db.PayrollMasters
                    .FirstOrDefaultAsync(p => p.EmployeeId == newApp.EmployeeId && p.Month == month);
                
                if (payroll != null)
                {
                    await _payrollService.ProcessEmployeePayrollAsync(newApp.EmployeeId, month);
                }
            }
        }

        /// <summary>
        /// Looks for an 'Adjusted' leave application that overlaps with the deleted record and restores it.
        /// </summary>
        public async Task RestoreAdjustedLeaveAsync(int employeeId, DateOnly startDate, DateOnly endDate)
        {
            // Find the most recently adjusted leave for this employee that overlaps
            var adjustedLeave = await _db.LeaveApplications
                .Where(la => la.EmployeeId == employeeId && la.Status == "Adjusted")
                .Where(la => startDate <= la.EndDate && endDate >= la.StartDate)
                .OrderByDescending(la => la.CreatedAt)
                .FirstOrDefaultAsync();

            if (adjustedLeave != null)
            {
                // 1. Restore Status
                adjustedLeave.Status = "Approved";
                
                // Remove the "[Adjusted to ...]" prefix if possible
                if (adjustedLeave.Reason != null && adjustedLeave.Reason.StartsWith("[Adjusted to"))
                {
                    int index = adjustedLeave.Reason.IndexOf("] ");
                    if (index != -1)
                    {
                        adjustedLeave.Reason = adjustedLeave.Reason.Substring(index + 2);
                    }
                }

                // 2. Re-deduct Balance
                var type = await _db.LeaveTypes.FindAsync(adjustedLeave.LeaveTypeId);
                if (type != null && type.IsPaid)
                {
                    var year = AttendanceProcessorService.GetLeaveYear(adjustedLeave.StartDate);
                    var allocation = await _db.LeaveAllocations
                        .FirstOrDefaultAsync(la => la.EmployeeId == employeeId && 
                                                   la.LeaveTypeId == adjustedLeave.LeaveTypeId && 
                                                   la.Year == year);
                    
                    if (allocation != null)
                    {
                        allocation.UsedCount += adjustedLeave.TotalDays;
                        allocation.UpdatedAt = DateTime.Now;
                    }
                }

                await _db.SaveChangesAsync();

                // 3. Refresh Attendance
                for (var date = adjustedLeave.StartDate.AddDays(-1); date <= adjustedLeave.EndDate.AddDays(1); date = date.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(date, employeeId);
                }
            }
        }

        /// <summary>
        /// Recalculates and adjusts leave balances for all applications overlapping with a holiday range.
        /// Call this when a holiday is added, modified, or removed.
        /// </summary>
        public async Task ReconcileLeavesForHolidayAsync(DateOnly startDate, DateOnly endDate, List<int>? employeeIds = null)
        {
            // 1. Find all approved applications that overlap with the holiday range
            var query = _db.LeaveApplications
                .Include(la => la.LeaveType)
                .Where(la => la.Status == "Approved" && 
                             la.StartDate <= endDate && 
                             la.EndDate >= startDate);

            if (employeeIds != null && employeeIds.Any())
            {
                query = query.Where(la => employeeIds.Contains(la.EmployeeId));
            }

            var overlappingApps = await query.ToListAsync();

            foreach (var app in overlappingApps)
            {
                decimal oldTotalDays = app.TotalDays;
                
                // 2. Recalculate TotalDays based on CURRENT holiday status
                decimal newTotalDays = await CalculateLeaveDaysAsync(
                    app.EmployeeId, 
                    app.StartDate, 
                    app.EndDate, 
                    app.DayType, 
                    app.IgnoreSandwichRule);

                if (newTotalDays != oldTotalDays)
                {
                    decimal difference = newTotalDays - oldTotalDays;

                    // 3. Update Allocation if it's a paid leave
                    if (app.LeaveType != null && app.LeaveType.IsPaid)
                    {
                        var year = AttendanceProcessorService.GetLeaveYear(app.StartDate);
                        var allocation = await _db.LeaveAllocations
                            .FirstOrDefaultAsync(la => la.EmployeeId == app.EmployeeId && 
                                                       la.LeaveTypeId == app.LeaveTypeId && 
                                                       la.Year == year);
                        
                        if (allocation != null)
                        {
                            allocation.UsedCount += difference;
                            allocation.UpdatedAt = DateTime.Now;
                        }
                    }

                    // 4. Update the application itself
                    app.TotalDays = newTotalDays;
                    app.Reason = AppendRemark(app.Reason, $"[Holiday Adjustment: {oldTotalDays} -> {newTotalDays}]");
                }

                // 5. Always trigger attendance re-processing for the overlap period
                var procStart = (app.StartDate < startDate ? app.StartDate : startDate).AddDays(-1);
                var procEnd = (app.EndDate > endDate ? app.EndDate : endDate).AddDays(1);

                for (var d = procStart; d <= procEnd; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, app.EmployeeId);
                }
            }

            await _db.SaveChangesAsync();
        }

        private string AppendRemark(string? existing, string newRemark)
        {
            if (string.IsNullOrWhiteSpace(existing)) return newRemark;
            if (existing.Contains(newRemark)) return existing;
            return $"{existing} {newRemark}";
        }
    }
}
