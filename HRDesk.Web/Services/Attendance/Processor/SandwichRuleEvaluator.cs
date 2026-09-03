using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Attendance.Processor;

public class SandwichRuleEvaluator
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<SandwichRuleEvaluator> _logger;

    public SandwichRuleEvaluator(BiometricAttendanceDbContext db, ILogger<SandwichRuleEvaluator> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ReversePreviousSandwichDeductionAsync(DailyAttendance existingRecord, Employee emp, DailyProcessingContext context)
    {
        if (!string.IsNullOrEmpty(existingRecord.Status) && 
            !string.IsNullOrEmpty(existingRecord.ApplicationNumber) &&
            existingRecord.Remarks != null && 
            existingRecord.Remarks.Contains("Sandwich Leave (covered by"))
        {
            _logger.LogInformation("IDEMPOTENCY: Found cross-app sandwich for {EmpId} on {Date}. Reference ID: {AppNum}", emp.EmployeeId, existingRecord.RecordDate, existingRecord.ApplicationNumber);
            
            if (int.TryParse(existingRecord.ApplicationNumber, out int refLeaveId))
            {
                var refApp = await _db.LeaveApplications
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(la => la.Id == refLeaveId);
                
                if (refApp != null && context.Allocations.TryGetValue((emp.EmployeeId, refApp.LeaveTypeId), out var allocation))
                {
                    _logger.LogInformation("IDEMPOTENCY: Reversing -1 from {LeaveType} balance. Current: {UsedCount}", refApp.LeaveType?.Code ?? refApp.LeaveTypeId.ToString(), allocation.UsedCount);
                    allocation.UsedCount -= 1;
                }
            }
        }
    }

    public bool EvaluateAndApplySandwich(
        Employee emp,
        DateOnly date,
        DailyAttendance existingRecord,
        ShiftRoster roster,
        DailyProcessingContext context,
        List<AttendanceLog> dailyLogs)
    {
        if (existingRecord.Status != "Weekoff")
        {
            return false;
        }

        if (dailyLogs.Any()) 
        {
            existingRecord.Status = "W/OP"; // Weekoff Present - worked on weekoff
            existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Worked on scheduled weekoff.");
            return true;
        }

        var sandwichEnabled = emp.BranchId == null || !context.SandwichDisabledBranches.Contains(emp.BranchId.Value);
        var sandwichingLeave = sandwichEnabled ? GetSandwichingLeaveFromContext(emp.EmployeeId, date, context.Leaves) : null;

        if (sandwichingLeave != null)
        {
            existingRecord.InTime = null;
            existingRecord.OutTime = null;
            existingRecord.WorkMinutes = 0;
            existingRecord.BreakMinutes = 0;
            existingRecord.IsActualBreak = false;

            bool alreadyInTotalDays = date >= sandwichingLeave.StartDate && date <= sandwichingLeave.EndDate;

            if (alreadyInTotalDays)
            {
                _logger.LogInformation("SANDWICH (within-range): Marking {Date} for {EmpId} — no deduction (already in TotalDays)", date, emp.EmployeeId);
                existingRecord.Status = sandwichingLeave.LeaveType?.Code ?? "Leave";
                existingRecord.ApplicationNumber = sandwichingLeave.Id.ToString();
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks,
                    $"Sandwich Leave (within application #{sandwichingLeave.Id})");
            }
            else
            {
                context.Allocations.TryGetValue((emp.EmployeeId, sandwichingLeave.LeaveTypeId), out var allocation);

                if (allocation != null && allocation.RemainingCount >= 1)
                {
                    _logger.LogInformation("SANDWICH (cross-app): Deducting +1 from {LeaveType} for {EmpId} on {Date}. Previous Used: {UsedCount}", sandwichingLeave.LeaveType?.Code ?? sandwichingLeave.LeaveTypeId.ToString(), emp.EmployeeId, date, allocation.UsedCount);
                    allocation.UsedCount += 1;
                    allocation.UpdatedAt = DateTime.Now;
                    existingRecord.Status = sandwichingLeave.LeaveType?.Code ?? "Leave";
                    existingRecord.ApplicationNumber = sandwichingLeave.Id.ToString();
                    existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks,
                        $"Sandwich Leave (covered by {sandwichingLeave.LeaveType?.Name ?? $"Leave #{sandwichingLeave.Id}"})");
                }
                else
                {
                    existingRecord.Status = "LWP";
                    existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, "Sandwich Leave (LWP - No Balance)");
                }
            }
            return true;
        }
        else
        {
            existingRecord.Status = "W/O"; // Standard unworked Weekoff
            return true;
        }
    }

    private LeaveApplication? GetSandwichingLeaveFromContext(int employeeId, DateOnly weekoffDate, Dictionary<int, List<LeaveApplication>> leavesByEmp)
    {
        if (!leavesByEmp.TryGetValue(employeeId, out var nearbyLeaves)) return null;

        var validLeaves = nearbyLeaves.Where(la => la.Status == "Approved" && !la.IgnoreSandwichRule && la.DayType == "Full Day").ToList();

        var prevDay1 = validLeaves.FirstOrDefault(la => weekoffDate.AddDays(-1) >= la.StartDate && weekoffDate.AddDays(-1) <= la.EndDate);
        var prevDay2 = prevDay1 != null ? validLeaves.FirstOrDefault(la => weekoffDate.AddDays(-2) >= la.StartDate && weekoffDate.AddDays(-2) <= la.EndDate) : null;

        var nextDay1 = validLeaves.FirstOrDefault(la => weekoffDate.AddDays(1) >= la.StartDate && weekoffDate.AddDays(1) <= la.EndDate);
        var nextDay2 = nextDay1 != null ? validLeaves.FirstOrDefault(la => weekoffDate.AddDays(2) >= la.StartDate && weekoffDate.AddDays(2) <= la.EndDate) : null;

        bool isSandwich = prevDay2 != null || nextDay2 != null || (prevDay1 != null && nextDay1 != null);

        if (!isSandwich) return null;

        return prevDay1 ?? nextDay1;
    }
}
