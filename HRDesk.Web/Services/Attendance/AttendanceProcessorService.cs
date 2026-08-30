using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services;

public class AttendanceProcessorService : IAttendanceProcessorService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<AttendanceProcessorService> _logger;
    private readonly ICompOffService _compOffService;

    public AttendanceProcessorService(BiometricAttendanceDbContext db, ILogger<AttendanceProcessorService> logger, ICompOffService compOffService)
    {
        _db = db;
        _logger = logger;
        _compOffService = compOffService;
    }

    private class DayHistoryItem
    {
        public int EmployeeId { get; set; }
        public DateOnly RecordDate { get; set; }
        public bool IsLate { get; set; }
        public bool IsEarly { get; set; }
        public int LateMinutes { get; set; }
    }

    private class DailyProcessingContext
    {
        public DateOnly Date { get; set; }
        public Dictionary<int, DailyAttendance> ExistingRecords { get; set; } = new();
        public Dictionary<int, ShiftRoster> Rosters { get; set; } = new();
        public List<Holiday> Holidays { get; set; } = new();
        public Dictionary<int, List<AttendanceRegularization>> Regularizations { get; set; } = new();
        public Dictionary<int, List<LeaveApplication>> Leaves { get; set; } = new();
        public Dictionary<(int EmployeeId, int LeaveTypeId), LeaveAllocation> Allocations { get; set; } = new();
        public Dictionary<int, List<DayHistoryItem>> MonthHistory { get; set; } = new();
        public Dictionary<int, DateOnly?> InactiveLastPunches { get; set; } = new();
        public List<AttendanceLog> AllLogs { get; set; } = new();
        public HashSet<int> SandwichDisabledBranches { get; set; } = new();
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

        // Pre-load Leave Allocations for Leave Year (tracked for UsedCount increment if cross-app sandwich)
        var startMonthRows = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.SettingKey == "LeaveYearStartMonth" && s.BranchId == null)
            .ToListAsync();
        var startMonthByOrg = startMonthRows
            .Where(s => int.TryParse(s.SettingValue, out var m) && m is >= 1 and <= 12)
            .GroupBy(s => s.OrganizationId)
            .ToDictionary(g => g.Key, g => int.Parse(g.First().SettingValue!));

        var leaveYears = employees
            .Select(e => GetLeaveYear(date, startMonthByOrg.GetValueOrDefault(e.OrganizationId, 11)))
            .Distinct()
            .ToList();
        if (leaveYears.Count == 0) leaveYears.Add(GetLeaveYear(date));

        var allocList = await _db.LeaveAllocations
            .Where(a => leaveYears.Contains(a.Year) && (employeeId == null || a.EmployeeId == employeeId.Value))
            .ToListAsync();
        context.Allocations = allocList.GroupBy(a => (a.EmployeeId, a.LeaveTypeId)).ToDictionary(g => g.Key, g => g.First());

        // Pre-load branches where sandwich rule is explicitly disabled
        var sandwichDisabledBranches = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.SettingKey == "SandwichRuleEnabled" && s.SettingValue == "False" && s.BranchId != null)
            .Select(s => s.BranchId!.Value)
            .ToListAsync();
        context.SandwichDisabledBranches = new HashSet<int>(sandwichDisabledBranches);

        // Pre-load Month History for Lates/Early frequency counts (lightweight projection)
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
        // 1. Check for Existing Record
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

        // IDEMPOTENCY: Reverse previous cross-application sandwich deduction before reset
        if (!string.IsNullOrEmpty(existingRecord.Status) && 
            !string.IsNullOrEmpty(existingRecord.ApplicationNumber) &&
            existingRecord.Remarks != null && 
            existingRecord.Remarks.Contains("Sandwich Leave (covered by"))
        {
            _logger.LogInformation("IDEMPOTENCY: Found cross-app sandwich for {EmpId} on {Date}. Reference ID: {AppNum}", emp.EmployeeId, date, existingRecord.ApplicationNumber);
            
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

        // 1. Resolve Shift from Daily Roster (Sole Source of Truth - No Fallback)
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

        // 2. Check Holiday (Always respected above all, never sandwiched)
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

        // 3. Check for Approved Regularizations
        context.Regularizations.TryGetValue(emp.EmployeeId, out var empRegs);
        empRegs ??= new List<AttendanceRegularization>();

        var lateRegularization = empRegs.FirstOrDefault(r => r.RequestType == "Late Coming");
        var earlyRegularization = empRegs.FirstOrDefault(r => r.RequestType == "Early Go");
        var missedPunchRegularization = empRegs.FirstOrDefault(r => r.RequestType == "Missed Punch");

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
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{reg.RequestType} {regText}{reasonText}");
            }
        }

        // 4. Check Weekoff & Sandwich Logic
        if (existingRecord.Status == "Weekoff")
        {
            if (dailyLogs.Any()) 
            {
                existingRecord.Status = "W/OP"; // Weekoff Present - worked on weekoff
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Worked on scheduled weekoff.");
                return;
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
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks,
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
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks,
                            $"Sandwich Leave (covered by {sandwichingLeave.LeaveType?.Name ?? $"Leave #{sandwichingLeave.Id}"})");
                    }
                    else
                    {
                        existingRecord.Status = "LWP";
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Sandwich Leave (LWP - No Balance)");
                    }
                }
                return;
            }
            else
            {
                existingRecord.Status = "W/O"; // Standard unworked Weekoff
                return;
            }
        }

        // 5. Check Leave (Explicitly applied by admin)
        context.Leaves.TryGetValue(emp.EmployeeId, out var empLeaves);
        empLeaves ??= new List<LeaveApplication>();

        var approvedLeave = empLeaves.FirstOrDefault(la => la.Status == "Approved" && date >= la.StartDate && date <= la.EndDate);
        var adjustedLeaves = empLeaves.Where(la => la.Status == "Adjusted" && date >= la.StartDate && date <= la.EndDate).ToList();

        if (adjustedLeaves.Any())
        {
            var adjText = string.Join(", ", adjustedLeaves.Select(al => $"{al.LeaveType?.Code ?? "Leave"} (#{al.Id})"));
            existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Adjusted: {adjText}");
        }
        
        if (approvedLeave != null)
        {
            bool isHalfDayLeave = approvedLeave.DayType == "First Half" || approvedLeave.DayType == "Second Half";
            
            if (isHalfDayLeave)
            {
                existingRecord.ApplicationNumber = approvedLeave.Id.ToString();
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Half Day Leave: {approvedLeave.LeaveType?.Code ?? approvedLeave.LeaveType?.Name} ({approvedLeave.DayType})");
            }
            else
            {
                existingRecord.Status = approvedLeave.LeaveType?.Code ?? "Leave";
                existingRecord.ApplicationNumber = approvedLeave.Id.ToString();
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Leave: {approvedLeave.LeaveType?.Name}");
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

        // 4. Calculate In/Out and Duration with Smart Break Detection
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

        // 5. Smart Break Detection & Duration Calculation
        var totalSpan = (outTime.ToTimeSpan() - inTime.ToTimeSpan());
        if (totalSpan < TimeSpan.Zero) totalSpan = totalSpan.Add(TimeSpan.FromDays(1)); // Night shift
        
        int totalMinutes = (int)totalSpan.TotalMinutes;
        int breakMinutes = 0;

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
                            existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Major Late (> Half Time)");
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
                existingRecord.Status = "W/OHF";

            return;
        }

        if (roster.Shift != null)
        {
            var shift = roster.Shift;
            
            if (sortedLogs.Count >= 4)
            {
                var punch2 = sortedLogs[1].PunchTime;
                var punch3 = sortedLogs[2].PunchTime;
                var actualBreak = (int)(punch3 - punch2).TotalMinutes;
                
                breakMinutes = actualBreak;
                existingRecord.IsActualBreak = true;
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Actual Lunch: {breakMinutes}m");
            }
            else
            {
                breakMinutes = shift.LunchBreakDuration;
                existingRecord.IsActualBreak = false;
            }

            existingRecord.BreakMinutes = breakMinutes;
            existingRecord.WorkMinutes = Math.Max(0, totalMinutes - breakMinutes);
        }
        else
        {
            existingRecord.WorkMinutes = totalMinutes;
            existingRecord.BreakMinutes = 0;
            existingRecord.IsActualBreak = false;
            existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "No Shift Assigned (No Break Deducted)");
        }

        if (roster.Shift == null) return;
        var currentShift = roster.Shift;

        // 6. Timing Rules
        bool isNoticePeriod = emp.ResignationDate.HasValue && date >= emp.ResignationDate.Value;
        bool isProbation = emp.ProbationEnd.HasValue && date < emp.ProbationEnd.Value;

        TimeOnly expectedStartTime = currentShift.StartTime;
        if (approvedLeave != null && approvedLeave.DayType == "First Half")
        {
            expectedStartTime = currentShift.HalfTime ?? currentShift.StartTime;
        }

        // Late Coming Check
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
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Late Waived ({lateMins}m)");
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
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Major Late (> Half Time)");
                    }
                }
                else if ((isProbation || isNoticePeriod) && lateMins > 5)
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        var ruleName = isNoticePeriod ? "Notice Period" : "Probation";
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{ruleName} Late (Grace: 5m)");
                    }
                }
                else if (lateMins > graceLimit)
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Late Beyond Grace");
                    }
                }
                else
                {
                     existingRecord.IsLate = true; 
                }
            }
        }

        // Early Exit Check
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
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, 
                        $"First Half Absent: Left at {outTime:HH\\:mm} before half-time ({currentShift.HalfTime.Value:HH\\:mm}).");
                }
            }
            else if (currentShift.EarlyGoAllowedTime.HasValue && outTime < currentShift.EarlyGoAllowedTime.Value.AddMinutes(-graceMinutes))
            {
                if (waiveEarly)
                {
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Early Waived (Half Day Granted)");
                }
                else 
                {
                    if (existingRecord.Status != "Present (Leave)" && (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF")))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Major Early Exit (< {currentShift.EarlyGoAllowedTime:HH:mm})");
                    }
                }
            }
            else
            {
                if (waiveEarly)
                {
                    existingRecord.EarlyMinutes = 0;
                    existingRecord.IsEarly = false;
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Early Waived ({earlyMins}m)");
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
                                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{ruleName} Early Exit (Grace: 5m)");
                            }
                        }
                    }
                }
            }
        }

        // 7. Monthly Penalties
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
            
            currentRecord.Remarks = AppendRemark(currentRecord.Remarks, $"Late #{currentLateCount}");

            var isProbation = emp.ProbationEnd.HasValue && currentRecord.RecordDate < emp.ProbationEnd.Value;
            
            if (isProbation)
            {
                currentRecord.Status = "Half Day";
                currentRecord.IsHalfDay = true;
                currentRecord.Remarks = AppendRemark(currentRecord.Remarks, "Probation Penalty");
            }
            else
            {
                int allowedLates = shift.LateComingAllowedCountPerMonth ?? 3;
                bool halfDayOnExceed = shift.LateComingHalfDayOnExceed ?? true;

                if (currentLateCount > allowedLates && halfDayOnExceed)
                {
                    currentRecord.Status = "Half Day";
                    currentRecord.IsHalfDay = true;
                    currentRecord.Remarks = AppendRemark(currentRecord.Remarks, $"Penalty Applied (Max {allowedLates} allowed)");
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
                currentRecord.Remarks = AppendRemark(currentRecord.Remarks, "Early Go (Probation)");
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
                    currentRecord.Remarks = AppendRemark(currentRecord.Remarks, $"Early Go #{previousEarly + 1} Penalty (Max {allowedEarly} allowed)");
                }
            }
        }
    }

    private string AppendRemark(string? existing, string newRemark)
    {
        if (string.IsNullOrWhiteSpace(newRemark)) return existing ?? "";
        if (string.IsNullOrEmpty(existing)) return newRemark;

        var parts = existing.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Any(p => p.Trim().Equals(newRemark.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return existing;
        }

        return $"{existing}, {newRemark}";
    }

    public static int GetLeaveYear(DateOnly date, int startMonth = 11)
    {
        if (startMonth is < 1 or > 12) startMonth = 11;
        return date.Month >= startMonth ? date.Year : date.Year - 1;
    }

    public static decimal CalculateProRataQuota(decimal yearlyQuota, DateOnly probationEnd, int leaveYear, int startMonth = 11)
    {
        if (startMonth is < 1 or > 12) startMonth = 11;
        var cycleStart = new DateOnly(leaveYear, startMonth, 1);
        var cycleEnd = cycleStart.AddMonths(12).AddDays(-1);

        if (probationEnd <= cycleStart) return yearlyQuota;
        if (probationEnd > cycleEnd) return 0;

        int eligibleMonths = 0;
        var current = new DateOnly(probationEnd.Year, probationEnd.Month, 1);
        if (probationEnd.Day > 15)
        {
            current = current.AddMonths(1);
        }

        while (current <= cycleEnd)
        {
            eligibleMonths++;
            current = current.AddMonths(1);
        }

        var rawProRata = (yearlyQuota / 12m) * eligibleMonths;
        return Math.Round(rawProRata * 2, MidpointRounding.AwayFromZero) / 2;
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
