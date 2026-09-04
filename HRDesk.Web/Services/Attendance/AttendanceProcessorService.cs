using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Attendance.Processor;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services;

public class AttendanceProcessorService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<AttendanceProcessorService> _logger;
    private readonly CompOffService _compOffService;
    private readonly SandwichRuleEvaluator _sandwichEvaluator;
    private readonly PunchPairingHandler _punchPairingHandler;
    private readonly TimingPenaltyHandler _timingPenaltyHandler;

    public AttendanceProcessorService(
        BiometricAttendanceDbContext db,
        ILogger<AttendanceProcessorService> logger,
        CompOffService compOffService,
        SandwichRuleEvaluator sandwichEvaluator,
        PunchPairingHandler punchPairingHandler,
        TimingPenaltyHandler timingPenaltyHandler)
    {
        _db = db;
        _logger = logger;
        _compOffService = compOffService;
        _sandwichEvaluator = sandwichEvaluator;
        _punchPairingHandler = punchPairingHandler;
        _timingPenaltyHandler = timingPenaltyHandler;
    }

    public async Task ProcessDailyAttendanceAsync(DateOnly date, int? employeeId = null)
    {
        _logger.LogInformation("Processing attendance for Date: {Date}", date);

        var query = _db.Employees.AsQueryable();

        if (employeeId.HasValue)
        {
            query = query.Where(e => e.EmployeeId == employeeId.Value && (e.JoiningDate == null || e.JoiningDate <= date));
        }
        else
        {
            var startOfMonth = new DateTime(date.Year, date.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1);
            var startOfMonthDateOnly = new DateOnly(date.Year, date.Month, 1);
            
            query = query.Where(e => (e.JoiningDate == null || e.JoiningDate <= date) &&
                                     ((e.Status != null && e.Status.ToLower() == "active") || 
                                      (e.LastWorkingDate != null && e.LastWorkingDate >= startOfMonthDateOnly) ||
                                      _db.AttendanceLogs.Any(l => l.EmployeeId == e.EmployeeId && 
                                                                  l.PunchTime >= startOfMonth && 
                                                                  l.PunchTime < endOfMonth)));
        }

        var employees = await query.AsNoTracking().ToListAsync();
        var empIds = employees.Select(e => e.EmployeeId).ToList();

        // 1. Fetch Biometric Logs for the day
        var biometricLogs = await _db.AttendanceLogs
            .AsNoTracking()
            .Where(l => l.PunchTime >= date.ToDateTime(TimeOnly.MinValue) && 
                        l.PunchTime < date.AddDays(1).ToDateTime(TimeOnly.MinValue) &&
                        (employeeId == null || l.EmployeeId == employeeId.Value))
            .ToListAsync();

        // 2. Fetch Approved Regularization 'Manual Punches'
        var approvedRegularizations = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => r.RequestType == "Missed Punch" && 
                        r.Status == "Approved" && 
                        (r.PunchTimeIn != null || r.PunchTimeOut != null) &&
                        r.RequestDate == date &&
                        (employeeId == null || r.EmployeeId == employeeId.Value))
            .ToListAsync();

        var regularizationLogs = new List<AttendanceLog>();
        foreach (var r in approvedRegularizations)
        {
            if (r.PunchTimeIn.HasValue)
            {
                regularizationLogs.Add(new AttendanceLog
                {
                    Id = -r.Id - 100000, 
                    EmployeeId = r.EmployeeId,
                    PunchTime = r.PunchTimeIn.Value,
                    MachineNumber = 0,
                    VerifyMode = 98, 
                    VerifyType = "Regularized-Punch-In",
                    SyncedAt = r.ApproveDate ?? DateTime.Now 
                });
            }

            if (r.PunchTimeOut.HasValue)
            {
                regularizationLogs.Add(new AttendanceLog
                {
                    Id = -r.Id - 200000, 
                    EmployeeId = r.EmployeeId,
                    PunchTime = r.PunchTimeOut.Value,
                    MachineNumber = 0,
                    VerifyMode = 98, 
                    VerifyType = "Regularized-Punch-Out",
                    SyncedAt = r.ApproveDate ?? DateTime.Now 
                });
            }
        }

        var allLogs = biometricLogs.Concat(regularizationLogs).ToList();

        // 3. BULK PRE-LOAD: Load all day context in bulk queries
        var context = new DailyProcessingContext
        {
            Date = date,
            AllLogs = allLogs
        };

        // Pre-load Existing Records (must be tracked for modifications/additions)
        var existingList = await _db.DailyAttendance
            .Where(d => d.RecordDate == date && (employeeId == null || d.EmployeeId == employeeId.Value))
            .ToListAsync();
        context.ExistingRecords = existingList.GroupBy(d => d.EmployeeId).ToDictionary(g => g.Key, g => g.First());

        // Pre-load Daily Shift Rosters
        var rostersList = await _db.ShiftRosters
            .Include(r => r.Shift)
            .AsNoTracking()
            .Where(r => r.RosterDate == date && (employeeId == null || r.EmployeeId == employeeId.Value))
            .ToListAsync();
        context.Rosters = rostersList.GroupBy(r => r.EmployeeId).ToDictionary(g => g.Key, g => g.First());

        // Pre-load Holidays
        context.Holidays = await _db.Holidays
            .Include(h => h.EligibleEmployees)
            .AsNoTracking()
            .Where(h => date >= h.StartDate && date <= h.EndDate)
            .ToListAsync();

        // Pre-load All Approved Regularizations for the date
        var allApprovedRegs = await _db.AttendanceRegularizations
            .AsNoTracking()
            .Where(r => r.RequestDate == date && r.Status == "Approved" && (employeeId == null || r.EmployeeId == employeeId.Value))
            .ToListAsync();
        context.Regularizations = allApprovedRegs.GroupBy(r => r.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

        // Pre-load Nearby Leaves (Approved & Adjusted) covering date ± 2 days
        var leavesList = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .AsNoTracking()
            .Where(la => (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate <= date.AddDays(2) && 
                         la.EndDate >= date.AddDays(-2) &&
                         (employeeId == null || la.EmployeeId == employeeId.Value))
            .ToListAsync();
        context.Leaves = leavesList.GroupBy(l => l.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

        // Pre-load Leave Allocations for Leave Year
        var startMonthRows = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.SettingKey == "LeaveYearStartMonth" && s.BranchId == null)
            .ToListAsync();
        var startMonthByOrg = startMonthRows
            .Where(s => int.TryParse(s.SettingValue, out var m) && m is >= 1 and <= 12)
            .GroupBy(s => s.OrganizationId)
            .ToDictionary(g => g.Key, g => int.Parse(g.First().SettingValue!));

        var leaveYears = employees
            .Select(e => AttendanceProcessingUtils.GetLeaveYear(date, startMonthByOrg.GetValueOrDefault(e.OrganizationId, 11)))
            .Distinct()
            .ToList();

        var allocationsList = await _db.LeaveAllocations
            .Where(la => leaveYears.Contains(la.Year) && empIds.Contains(la.EmployeeId))
            .ToListAsync();
        context.Allocations = allocationsList
            .GroupBy(la => (la.EmployeeId, la.LeaveTypeId))
            .ToDictionary(g => g.Key, g => g.First());

        // Pre-load Sandwich Disabled Branches
        var sandwichRows = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.SettingKey == "SandwichRuleEnabled" && s.BranchId != null)
            .ToListAsync();
        context.SandwichDisabledBranches = sandwichRows
            .Where(s => bool.TryParse(s.SettingValue, out var val) && !val)
            .Select(s => s.BranchId!.Value)
            .ToHashSet();

        // Pre-load Month Attendance History (for 3-Late penalty strikes & early go counts)
        var startOfMonthDate = new DateOnly(date.Year, date.Month, 1);
        var historyList = await _db.DailyAttendance
            .Where(d => d.RecordDate >= startOfMonthDate && d.RecordDate < date && (employeeId == null || d.EmployeeId == employeeId.Value))
            .Select(d => new DayHistoryItem
            {
                EmployeeId = d.EmployeeId,
                RecordDate = d.RecordDate,
                IsLate = d.IsLate,
                IsEarly = d.IsEarly,
                LateMinutes = d.LateMinutes
            })
            .AsNoTracking()
            .ToListAsync();
        context.MonthHistory = historyList.GroupBy(d => d.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

        // Pre-load Inactive Employees Last Biometric Punch (in 1 query)
        var inactiveWithoutLWD = employees
            .Where(e => e.LastWorkingDate == null && e.Status != null && e.Status.ToLower() != "active")
            .Select(e => e.EmployeeId)
            .ToList();

        if (inactiveWithoutLWD.Any())
        {
            var lastPunches = await _db.AttendanceLogs
                .AsNoTracking()
                .Where(l => inactiveWithoutLWD.Contains(l.EmployeeId))
                .GroupBy(l => l.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, LastPunch = g.Max(l => l.PunchTime) })
                .ToListAsync();

            context.InactiveLastPunches = lastPunches.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => (DateOnly?)DateOnly.FromDateTime(g.First().LastPunch));
        }

        // 4. Process each employee in-memory
        foreach (var emp in employees)
        {
            DateOnly? lastWorkingDay = emp.LastWorkingDate;

            if (lastWorkingDay == null && emp.Status != null && emp.Status.ToLower() != "active")
            {
                context.InactiveLastPunches.TryGetValue(emp.EmployeeId, out lastWorkingDay);
            }

            if (lastWorkingDay.HasValue && date > lastWorkingDay.Value)
            {
                continue; // Skip processing: no attendance records after last working day
            }

            var empLogs = allLogs.Where(l => l.EmployeeId == emp.EmployeeId).ToList();
            await ProcessEmployeeDayInternalAsync(emp, date, empLogs, context);
        }

        // 5. CLEANUP: If batch processing (no specific employeeId), handle inactive employees in-memory
        if (!employeeId.HasValue)
        {
            var empIdsWithLogsToday = allLogs.Select(l => l.EmployeeId).ToHashSet();
            var inactiveEmpIds = employees
                .Where(e => e.Status == null || e.Status.ToLower() != "active")
                .Select(e => e.EmployeeId)
                .ToHashSet();

            var recordsToRemove = new List<DailyAttendance>();
            foreach (var record in context.ExistingRecords.Values)
            {
                if (inactiveEmpIds.Contains(record.EmployeeId) && 
                    !empIdsWithLogsToday.Contains(record.EmployeeId) && 
                    record.ApplicationNumber == null)
                {
                    var emp = employees.FirstOrDefault(e => e.EmployeeId == record.EmployeeId);
                    DateOnly? lastWorkingDay = emp?.LastWorkingDate;

                    if (lastWorkingDay == null)
                    {
                        context.InactiveLastPunches.TryGetValue(record.EmployeeId, out lastWorkingDay);
                    }

                    if (lastWorkingDay == null || date > lastWorkingDay.Value)
                    {
                        recordsToRemove.Add(record);
                    }
                }
            }

            if (recordsToRemove.Any())
            {
                _db.DailyAttendance.RemoveRange(recordsToRemove);
            }
        }

        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        _logger.LogInformation("Attendance processing completed for {Date}", date);
    }

    private async Task ProcessEmployeeDayInternalAsync(Employee emp, DateOnly date, List<AttendanceLog> dailyLogs, DailyProcessingContext context)
    {
        // 1. Get or Create Existing Record
        if (!context.ExistingRecords.TryGetValue(emp.EmployeeId, out var existingRecord))
        {
            existingRecord = new DailyAttendance
            {
                EmployeeId = emp.EmployeeId,
                RecordDate = date
            };
            _db.DailyAttendance.Add(existingRecord);
            context.ExistingRecords[emp.EmployeeId] = existingRecord;
        }

        // 2. IDEMPOTENCY: Reverse previous cross-application sandwich deduction before reset
        await _sandwichEvaluator.ReversePreviousSandwichDeductionAsync(existingRecord, emp, context);

        // 3. Resolve Shift from Daily Roster (Sole Source of Truth)
        if (!context.Rosters.TryGetValue(emp.EmployeeId, out var roster))
        {
            existingRecord.Status = "Roster Missing";
            existingRecord.Remarks = "No shift assigned in daily roster.";
            existingRecord.ShiftId = null;
            return;
        }

        int? effectiveShiftId = roster.ShiftId;

        // Reset calculated fields
        existingRecord.ShiftId = effectiveShiftId;
        existingRecord.Status = null; 
        existingRecord.ApplicationNumber = null; 
        existingRecord.IsLate = false;
        existingRecord.LateMinutes = 0;
        existingRecord.IsEarly = false;
        existingRecord.EarlyMinutes = 0;
        existingRecord.IsHalfDay = false;
        existingRecord.InTime = null;
        existingRecord.OutTime = null;
        existingRecord.WorkMinutes = 0;
        existingRecord.BreakMinutes = 0;
        existingRecord.IsActualBreak = false;
        existingRecord.Remarks = roster.Remarks;
        existingRecord.UpdatedAt = DateTime.Now;

        if (roster.IsWeekOff)
        {
            existingRecord.Status = "Weekoff";
        }

        // 4. Check Holiday (Always respected above all, never sandwiched)
        var isHoliday = context.Holidays.Any(h => 
            (h.IsGlobal || 
             (emp.DepartmentId.HasValue && (
                 (h.DepartmentId.HasValue && h.DepartmentId.Value == emp.DepartmentId.Value) ||
                 (!string.IsNullOrEmpty(h.DepartmentIds) && ("," + h.DepartmentIds + ",").Contains("," + emp.DepartmentId.Value + ","))
             ) && (!h.BranchId.HasValue || h.BranchId == emp.BranchId)) ||
             (h.BranchId.HasValue && !h.DepartmentId.HasValue && string.IsNullOrEmpty(h.DepartmentIds) && h.BranchId.Value == emp.BranchId) ||
             (h.EligibleEmployees != null && h.EligibleEmployees.Any(he => he.EmployeeId == emp.EmployeeId))));
        
        if (isHoliday)
        {
            existingRecord.Status = "Holiday";
            return;
        }

        // 5. Check Approved Regularizations
        context.Regularizations.TryGetValue(emp.EmployeeId, out var empRegs);
        empRegs ??= new List<AttendanceRegularization>();

        var lateRegularization = empRegs.FirstOrDefault(r => r.RequestType == "Late Coming");
        var earlyRegularization = empRegs.FirstOrDefault(r => r.RequestType == "Early Go");

        bool waiveLate = lateRegularization != null && lateRegularization.WaivePenalty;
        bool waiveEarly = earlyRegularization != null && earlyRegularization.WaivePenalty;

        if (empRegs.Any())
        {
            foreach (var reg in empRegs)
            {
                string regText = "Regularized";
                if (reg.RequestType != "Missed Punch" && !reg.WaivePenalty)
                {
                    regText = "Logged (Tracking Only)";
                }

                var reasonText = !string.IsNullOrWhiteSpace(reg.Reason) ? $" - Reason: {reg.Reason}" : "";
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"{reg.RequestType} {regText}{reasonText}");
            }
        }

        // 6. Check Weekoff & Sandwich Logic
        if (_sandwichEvaluator.EvaluateAndApplySandwich(emp, date, existingRecord, roster, context, dailyLogs))
        {
            return;
        }

        // 7. Check Leave (Explicitly applied by admin)
        context.Leaves.TryGetValue(emp.EmployeeId, out var empLeaves);
        empLeaves ??= new List<LeaveApplication>();

        var approvedLeave = empLeaves.FirstOrDefault(la => la.Status == "Approved" && date >= la.StartDate && date <= la.EndDate);
        var adjustedLeaves = empLeaves.Where(la => la.Status == "Adjusted" && date >= la.StartDate && date <= la.EndDate).ToList();

        if (adjustedLeaves.Any())
        {
            var adjText = string.Join(", ", adjustedLeaves.Select(al => $"{al.LeaveType?.Code ?? "Leave"} (#{al.Id})"));
            existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Adjusted: {adjText}");
        }
        
        if (approvedLeave != null)
        {
            bool isHalfDayLeave = approvedLeave.DayType == "First Half" || approvedLeave.DayType == "Second Half";
            
            if (isHalfDayLeave)
            {
                existingRecord.ApplicationNumber = approvedLeave.Id.ToString();
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Half Day Leave: {approvedLeave.LeaveType?.Code ?? approvedLeave.LeaveType?.Name} ({approvedLeave.DayType})");
            }
            else
            {
                existingRecord.Status = approvedLeave.LeaveType?.Code ?? "Leave";
                existingRecord.ApplicationNumber = approvedLeave.Id.ToString();
                existingRecord.Remarks = AttendanceProcessingUtils.AppendRemark(existingRecord.Remarks, $"Leave: {approvedLeave.LeaveType?.Name}");
                if (dailyLogs.Any())
                {
                    existingRecord.Status = "Present (Leave)";
                }
                else
                {
                    return;
                }
            }
        }

        // 8. Handle No Punches (Absent / Unpaid Half Day)
        if (!dailyLogs.Any() && existingRecord.Status == null)
        {
            bool hasHalfDay = false;
            
            if (approvedLeave != null && !string.IsNullOrEmpty(approvedLeave.DayType))
            {
                if (approvedLeave.DayType.Contains("Half", StringComparison.OrdinalIgnoreCase))
                {
                    hasHalfDay = true;
                }
            }

            if (!hasHalfDay)
            {
                existingRecord.Status = "Absent";
            }
            else
            {
                var leaveCode = approvedLeave!.LeaveType?.Code ?? "L";
                bool isPaid = approvedLeave.LeaveType?.IsPaid ?? false;

                if (!isPaid)
                {
                    existingRecord.Status = "HF";
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
                existingRecord.IsHalfDay = true;
            }

            existingRecord.InTime = null;
            existingRecord.OutTime = null;
            existingRecord.WorkMinutes = 0;
            existingRecord.BreakMinutes = 0;
            existingRecord.IsActualBreak = false;
            return;
        }

        // 9. Process In/Out Punches, Single Punch, and Smart Lunch Break Deduction
        var punchResult = _punchPairingHandler.ProcessPunchesAndBreaks(emp, date, existingRecord, roster, dailyLogs, context);
        if (punchResult.IsSinglePunch)
        {
            return;
        }

        // 10. Apply Late Coming, Early Exit, and Monthly 3-Strike Penalties
        _timingPenaltyHandler.ApplyTimingRulesAndPenalties(
            emp,
            date,
            existingRecord,
            roster,
            punchResult.InTime,
            punchResult.OutTime!.Value,
            waiveLate,
            waiveEarly,
            approvedLeave,
            context);
    }

    // Static helpers maintained for backwards compatibility
    public static int GetLeaveYear(DateOnly date, int startMonth = 11) =>
        AttendanceProcessingUtils.GetLeaveYear(date, startMonth);

    public static decimal CalculateProRataQuota(decimal yearlyQuota, DateOnly probationEnd, int leaveYear, int startMonth = 11) =>
        AttendanceProcessingUtils.CalculateProRataQuota(yearlyQuota, probationEnd, leaveYear, startMonth);
}
