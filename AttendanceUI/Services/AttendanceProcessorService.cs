using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

public class AttendanceProcessorService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<AttendanceProcessorService> _logger;
    private readonly CompOffService _compOffService;

    public AttendanceProcessorService(BiometricAttendanceDbContext db, ILogger<AttendanceProcessorService> logger, CompOffService compOffService)
    {
        _db = db;
        _logger = logger;
        _compOffService = compOffService;
    }

    public async Task ProcessDailyAttendanceAsync(DateOnly date, int? employeeId = null)
    {
        _logger.LogInformation("Processing attendance for Date: {Date}", date);

        var query = _db.Employees
            .Include(e => e.Shift)
            .AsQueryable();

        if (employeeId.HasValue)
        {
            query = query.Where(e => e.EmployeeId == employeeId.Value && (e.JoiningDate == null || e.JoiningDate <= date));
        }
        else
        {
            // Only process employees who have already joined by this date
            // AND are active OR those who have actual biometric logs for this month
            var startOfMonth = new DateTime(date.Year, date.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1);
            
            query = query.Where(e => (e.JoiningDate == null || e.JoiningDate <= date) &&
                                     ((e.Status != null && e.Status.ToLower() == "active") || 
                                      _db.AttendanceLogs.Any(l => l.EmployeeId == e.EmployeeId && 
                                                                  l.PunchTime >= startOfMonth && 
                                                                  l.PunchTime < endOfMonth)));
        }

        var employees = await query.ToListAsync();
        
        // Fetch Biometric Logs
        var biometricLogs = await _db.AttendanceLogs
            .Where(l => l.PunchTime >= date.ToDateTime(TimeOnly.MinValue) && 
                         l.PunchTime < date.AddDays(1).ToDateTime(TimeOnly.MinValue))
            .ToListAsync();

        // Fetch Approved Regularization 'Manual Punches'
        var approvedRegularizations = await _db.AttendanceRegularizations
            .Where(r => r.RequestType == "Missed Punch" && 
                        r.Status == "Approved" && 
                        (r.PunchTimeIn != null || r.PunchTimeOut != null) &&
                        r.RequestDate == date)
            .ToListAsync();

        var regularizationLogs = new List<AttendanceLog>();
        foreach (var r in approvedRegularizations)
        {
            // IN Punch
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

            // OUT Punch (for Full Day)
            if (r.PunchTimeOut.HasValue)
            {
                regularizationLogs.Add(new AttendanceLog
                {
                    Id = -r.Id - 200000, 
                    EmployeeId = r.EmployeeId,
                    PunchTime = r.PunchTimeOut.Value, // Map to log PunchTime
                    MachineNumber = 0,
                    VerifyMode = 98, 
                    VerifyType = "Regularized-Punch-Out",
                    SyncedAt = r.ApproveDate ?? DateTime.Now 
                });
            }
        }

        // Merge logs (Biometric + Regularization)
        var allLogs = biometricLogs.Concat(regularizationLogs).ToList();

        foreach (var emp in employees)
        {
            // If the employee is inactive, treat their last working day as the cutoff.
            // Priority: 1) Explicit LastWorkingDate on employee record, 2) Last biometric punch.
            // Do not process attendance for them on dates after their last working day.
            if (emp.Status != null && emp.Status.ToLower() != "active")
            {
                DateOnly? lastWorkingDay = emp.LastWorkingDate;

                if (lastWorkingDay == null)
                {
                    // Fall back to last biometric punch
                    var latestPunch = await _db.AttendanceLogs
                        .Where(l => l.EmployeeId == emp.EmployeeId)
                        .OrderByDescending(l => l.PunchTime)
                        .FirstOrDefaultAsync();

                    if (latestPunch != null)
                        lastWorkingDay = DateOnly.FromDateTime(latestPunch.PunchTime);
                }

                if (lastWorkingDay.HasValue && date > lastWorkingDay.Value)
                {
                    continue; // Skip processing: no weekoffs/absents after last working day
                }
            }

            await ProcessEmployeeDayAsync(emp, date, allLogs.Where(l => l.EmployeeId == emp.EmployeeId).ToList());
        }

        // CLEANUP: If batch processing (no specific employeeId), handle inactive employees
        // If an employee became inactive, they might have existing "Absent" or "W/O" records 
        // from a previous run. We should remove them if they have no logs for this day.
        // IMPORTANT: Only clean up records for dates AFTER the employee's last working day.
        // Weekoffs and other records BEFORE the last working day are legitimate and must be kept.
        if (!employeeId.HasValue)
        {
            var inactiveToCleanup = await _db.DailyAttendance
                .Where(d => d.RecordDate == date)
                .Where(d => _db.Employees.Any(e => e.EmployeeId == d.EmployeeId && (e.Status == null || e.Status.ToLower() != "active")))
                .Where(d => !_db.AttendanceLogs.Any(l => l.EmployeeId == d.EmployeeId && 
                                                         l.PunchTime >= date.ToDateTime(TimeOnly.MinValue) && 
                                                         l.PunchTime < date.AddDays(1).ToDateTime(TimeOnly.MinValue)))
                // Don't delete if they have approved leave/regularization (processed in DailyAttendance)
                .Where(d => d.ApplicationNumber == null) 
                .ToListAsync();

            // Filter out records that are ON OR BEFORE the employee's last working day.
            // For inactive employees, weekoffs before their last working day are valid and must be preserved.
            // Priority: 1) Employee.LastWorkingDate, 2) Last biometric punch.
            var recordsToRemove = new List<DailyAttendance>();
            foreach (var record in inactiveToCleanup)
            {
                var empRecord = await _db.Employees
                    .Where(e => e.EmployeeId == record.EmployeeId)
                    .Select(e => new { e.LastWorkingDate })
                    .FirstOrDefaultAsync();

                DateOnly? lastWorkingDay = empRecord?.LastWorkingDate;

                if (lastWorkingDay == null)
                {
                    // Fall back to last biometric punch
                    var lastPunch = await _db.AttendanceLogs
                        .Where(l => l.EmployeeId == record.EmployeeId)
                        .OrderByDescending(l => l.PunchTime)
                        .Select(l => l.PunchTime)
                        .FirstOrDefaultAsync();

                    if (lastPunch != default)
                        lastWorkingDay = DateOnly.FromDateTime(lastPunch);
                }

                if (lastWorkingDay == null)
                {
                    // No punches and no LastWorkingDate — safe to remove
                    recordsToRemove.Add(record);
                }
                else if (date > lastWorkingDay.Value)
                {
                    // Date is after last working day — safe to remove (no weekoffs after exit)
                    recordsToRemove.Add(record);
                }
                // else: date is on or before last working day — keep the record (valid weekoff/absent)
            }

            if (recordsToRemove.Any())
            {
                _db.DailyAttendance.RemoveRange(recordsToRemove);
            }
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Attendance processing completed for {Date}", date);
    }

    private async Task ProcessEmployeeDayAsync(Employee emp, DateOnly date, List<AttendanceLog> dailyLogs)
    {
        // 1. Check for Manual Override
        var existingRecord = await _db.DailyAttendance
            .FirstOrDefaultAsync(d => d.EmployeeId == emp.EmployeeId && d.RecordDate == date);

        if (existingRecord == null)
        {
            existingRecord = new DailyAttendance
            {
                EmployeeId = emp.EmployeeId,
                RecordDate = date
            };
            _db.DailyAttendance.Add(existingRecord);
        }

        // 1. Manual Override Check
        // If manually overridden, we DO NOT reset Status/Remarks/Penalties.
        // We ONLY update the time-based fields (In/Out/WorkDuration) based on logs.


        // IDEMPOTENCY: Reverse previous cross-application sandwich deduction before reset
        // Within-range sandwiches ("within application") don't modify UsedCount, so skip them
        if (!string.IsNullOrEmpty(existingRecord.Status) && 
            !string.IsNullOrEmpty(existingRecord.ApplicationNumber) &&
            existingRecord.Remarks != null && 
            existingRecord.Remarks.Contains("Sandwich Leave (covered by"))
        {
            _logger.LogInformation("IDEMPOTENCY: Found cross-app sandwich for {EmpId} on {Date}. Application: {AppNum}", emp.EmployeeId, date, existingRecord.ApplicationNumber);
            var prevYear = GetLeaveYear(date);
            var refApp = await _db.LeaveApplications
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(la => la.ApplicationNumber == existingRecord.ApplicationNumber);
            
            if (refApp != null)
            {
                var allocation = await _db.LeaveAllocations
                    .FirstOrDefaultAsync(a => a.EmployeeId == emp.EmployeeId && 
                                             a.LeaveTypeId == refApp.LeaveTypeId && 
                                             a.Year == prevYear);
                if (allocation != null)
                {
                    _logger.LogInformation("IDEMPOTENCY: Reversing -1 from {LeaveType} balance. Current: {UsedCount}", refApp.LeaveType?.Code ?? refApp.LeaveTypeId.ToString(), allocation.UsedCount);
                    allocation.UsedCount -= 1;
                }
            }
        }

        // Reset calculated fields
        existingRecord.ShiftId = emp.ShiftId;
        existingRecord.Status = null; // Fix: Reset status so re-processing can change it
        existingRecord.ApplicationNumber = null; // Fix: Reset application number so deleted leaves don't leave phantom records
        existingRecord.IsLate = false;
        existingRecord.LateMinutes = 0;
        existingRecord.IsEarly = false;
        existingRecord.EarlyMinutes = 0;
        existingRecord.IsHalfDay = false;
        existingRecord.Remarks = null;
        existingRecord.UpdatedAt = DateTime.Now;

        // 2. Check Holiday (Always respected above all, never sandwiched)
        var isHoliday = await _db.Holidays.AnyAsync(h => 
            date >= h.StartDate && date <= h.EndDate &&
            (h.IsGlobal || _db.HolidayEmployees.Any(he => he.HolidayId == h.Id && he.EmployeeId == emp.EmployeeId)));
        if (isHoliday) { existingRecord.Status = "Holiday"; return; }

        // 3. Check for Approved Regularizations (Late/Early) — fetch ALL for this date
        var approvedRegularizations = await _db.AttendanceRegularizations
            .Where(r => r.EmployeeId == emp.EmployeeId && 
                                      r.RequestDate == date && 
                                      r.Status == "Approved")
            .ToListAsync();

        var lateRegularization = approvedRegularizations.FirstOrDefault(r => r.RequestType == "Late Coming");
        var earlyRegularization = approvedRegularizations.FirstOrDefault(r => r.RequestType == "Early Go");
        var missedPunchRegularization = approvedRegularizations.FirstOrDefault(r => r.RequestType == "Missed Punch");

        bool waiveLate = lateRegularization != null && lateRegularization.WaivePenalty;
        bool waiveEarly = earlyRegularization != null && earlyRegularization.WaivePenalty;
        
        // If regularized, we might want to note it
        if (approvedRegularizations.Any())
        {
            var firstReg = approvedRegularizations.First();
            existingRecord.ApplicationNumber = firstReg.ApplicationNumber;
            
            foreach (var reg in approvedRegularizations)
            {
                var appNumText = !string.IsNullOrWhiteSpace(reg.ApplicationNumber) ? $" ({reg.ApplicationNumber})" : "";
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{reg.RequestType} Regularized{appNumText}");
            }
        }

        // 4. Check Weekoff & Sandwich Logic
        // Very basic string check - ideal would be DayOfWeek enum matching
        bool isWeekoff = !string.IsNullOrWhiteSpace(emp.Weekoff) && 
            emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase);
        
        if (isWeekoff && existingRecord.Status == null)
        {
            // If they punched on the weekoff, they actually worked. 
            // This immediately breaks any sandwich rule and converts the day to a "worked weekoff"
            if (dailyLogs.Any()) 
            {
                existingRecord.Status = "W/OP"; // Weekoff Present - worked on weekoff
                
                // Get first and last punch times
                var orderedLogs = dailyLogs.OrderBy(l => l.PunchTime).ToList();
                var compOffInTime = TimeOnly.FromDateTime(orderedLogs.First().PunchTime);
                var compOffOutTime = orderedLogs.Count > 1 ? TimeOnly.FromDateTime(orderedLogs.Last().PunchTime) : (TimeOnly?)null;
                
                // Always create draft request first (will skip if already exists)
                await _compOffService.CreateDraftRequestAsync(emp.EmployeeId, date, compOffInTime, emp.ShiftId);
                
                // If OUT punch exists, update with hours worked
                if (compOffOutTime.HasValue)
                {
                    await _compOffService.UpdateWithOutPunchAsync(emp.EmployeeId, date, compOffOutTime.Value);
                }
                
                // Continue processing to calculate In/Out times below (Return removed)
            }
            else 
            {
                // No punches. Check if it's sandwiched by leaves.
                var sandwichingLeave = await GetSandwichingLeaveAsync(emp.EmployeeId, date);
                if (sandwichingLeave != null)
                {
                    // Treat like a leave day with no punches
                    existingRecord.InTime = null;
                    existingRecord.OutTime = null;
                    existingRecord.WorkMinutes = 0;
                    existingRecord.BreakMinutes = 0;
                    existingRecord.IsActualBreak = false;

                    // Check if this weekoff is WITHIN the sandwiching leave's date range
                    // If so, it's already counted in the application's TotalDays — don't deduct again
                    bool alreadyInTotalDays = date >= sandwichingLeave.StartDate && date <= sandwichingLeave.EndDate;

                    if (alreadyInTotalDays)
                    {
                        // Already counted in TotalDays — just mark the status, no balance change
                        _logger.LogInformation("SANDWICH (within-range): Marking {Date} for {EmpId} — no deduction (already in TotalDays)", date, emp.EmployeeId);
                        existingRecord.Status = sandwichingLeave.LeaveType?.Code ?? "Leave";
                        existingRecord.ApplicationNumber = sandwichingLeave.ApplicationNumber;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks,
                            $"Sandwich Leave (within application {sandwichingLeave.ApplicationNumber})");
                    }
                    else
                    {
                        // Cross-application sandwich — needs balance deduction
                        int leaveYear = GetLeaveYear(date);
                        var allocation = await _db.LeaveAllocations
                            .FirstOrDefaultAsync(a => a.EmployeeId == emp.EmployeeId
                                                   && a.LeaveTypeId == sandwichingLeave.LeaveTypeId
                                                   && a.Year == leaveYear);

                        if (allocation != null && allocation.RemainingCount >= 1)
                        {
                            _logger.LogInformation("SANDWICH (cross-app): Deducting +1 from {LeaveType} for {EmpId} on {Date}. Previous Used: {UsedCount}", sandwichingLeave.LeaveType?.Code ?? sandwichingLeave.LeaveTypeId.ToString(), emp.EmployeeId, date, allocation.UsedCount);
                            allocation.UsedCount += 1;
                            allocation.UpdatedAt = DateTime.Now;
                            existingRecord.Status = sandwichingLeave.LeaveType?.Code ?? "Leave";
                            existingRecord.ApplicationNumber = sandwichingLeave.ApplicationNumber;
                            existingRecord.Remarks = AppendRemark(existingRecord.Remarks,
                                $"Sandwich Leave (covered by {sandwichingLeave.LeaveType?.Name ?? sandwichingLeave.ApplicationNumber})");
                        }
                        else
                        {
                            // No balance available — fall back to LWP
                            existingRecord.Status = "LWP";
                            existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Sandwich Leave (LWP - No Balance)");
                        }
                    }
                    return;
                }
                else
                {
                    existingRecord.Status = "W/O"; // Standard unworked Weekoff
                    return; // No punches, just a standard Weekoff
                }
            }
        }

        // 5. Check Leave (Explicitly applied by admin)
        var approvedLeave = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .FirstOrDefaultAsync(la => la.EmployeeId == emp.EmployeeId && 
                                       la.Status == "Approved" && 
                                       date >= la.StartDate && 
                                       date <= la.EndDate);

        // Capture adjusted leaves for historical context in tooltips
        var adjustedLeaves = await _db.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == emp.EmployeeId && 
                         la.Status == "Adjusted" && 
                         date >= la.StartDate && 
                         date <= la.EndDate)
            .ToListAsync();

        if (adjustedLeaves.Any())
        {
            var adjText = string.Join(", ", adjustedLeaves.Select(al => $"{al.LeaveType?.Code ?? "Leave"} ({al.ApplicationNumber})"));
            existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Adjusted: {adjText}");
        }
        
        if (approvedLeave != null)
        {
            bool isHalfDayLeave = approvedLeave.DayType == "First Half" || approvedLeave.DayType == "Second Half";
            
            if (isHalfDayLeave)
            {
                // Half-day leave: employee is expected to work the other half
                existingRecord.ApplicationNumber = approvedLeave.ApplicationNumber;
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Half Day Leave: {approvedLeave.LeaveType?.Code ?? approvedLeave.LeaveType?.Name} ({approvedLeave.DayType})");
            }
            else
            {
                // Full day leave
                existingRecord.Status = approvedLeave.LeaveType?.Code ?? "Leave";
                existingRecord.ApplicationNumber = approvedLeave.ApplicationNumber;
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Leave: {approvedLeave.LeaveType?.Name} ({approvedLeave.ApplicationNumber})");
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

            // Fix: If Half Day Leave is already approved, don't overwrite with "Absent"
            if (!hasHalfDay)
            {
                existingRecord.Status = "Absent";
            }
            else
            {
                // Must set a valid status if it's a Half Day leave with no punches
                // Logic mirrored from lines 288+
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
                    existingRecord.Status = $"{firstLetter}HF"; // e.g., PHF, SHF
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
        
        // Only set status to Present if it wasn't already set (e.g. to Present (WO))
        if (existingRecord.Status == null || existingRecord.Status == "Absent")
        {
            existingRecord.Status = "Present";
        }

        // Half-Day Leave Status Override
        // If employee has a half-day leave, set PHF/SHF immediately
        if (approvedLeave != null)
        {
            bool isHalfDayLeave = approvedLeave.DayType == "First Half" || approvedLeave.DayType == "Second Half";
            
            if (isHalfDayLeave)
            {
                var leaveCode = approvedLeave.LeaveType?.Code ?? "UNKNOWN";
                var leaveTypeName = approvedLeave.LeaveType?.Name ?? "Unknown";
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
                        // Get first letter for status
                        string firstLetter = "L"; // Default
                        if (!string.IsNullOrWhiteSpace(leaveCode) && leaveCode.Length > 0)
                        {
                            firstLetter = leaveCode.Substring(0, 1).ToUpper();
                        }
                        existingRecord.Status = $"{firstLetter}HF"; // PL→PHF, SL→SHF
                    }
                }
                // Skip adding remark here as it's already added at line ~359 (Half Day Leave: PL (Second Half))
            }
        }

        // PRE-CALCULATION: Calculate Late Minutes even for Single Punch scenarios so it shows in reports
        // IMPORTANT: If the employee is on a First Half leave, they are expected to arrive at HalfTime,
        // NOT at ShiftStart. Use HalfTime as the baseline so single-punch early-returns (line ~591)
        // don't incorrectly stamp a Late count against a legitimately absent first half.
        if (emp.Shift != null)
        {
            TimeOnly preCalcBase = (approvedLeave != null &&
                                    approvedLeave.DayType == "First Half" &&
                                    emp.Shift.HalfTime.HasValue)
                                    ? emp.Shift.HalfTime.Value
                                    : emp.Shift.StartTime;

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
            // Check if this is explicitly an OUT punch (Regularized as Out)
            bool isOutOnly = dailyLogs.Count == 1 && 
                             dailyLogs[0].VerifyType != null && 
                             dailyLogs[0].VerifyType.EndsWith("-Out");

            // Single Punch Rule
            // BUT: Don't overwrite half-day leave status (PHF, SHF, etc)
            if (!existingRecord.Status.EndsWith("HF"))
            {
                existingRecord.Status = "Half Day";
            }
            existingRecord.IsHalfDay = true;
            
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
                // If also late, prioritize showing the Late Count
                if (existingRecord.LateMinutes > 0)
            {
                var startOfMonth = new DateOnly(existingRecord.RecordDate.Year, existingRecord.RecordDate.Month, 1);
                var previousLates = await _db.DailyAttendance
                    .Where(d => d.EmployeeId == emp.EmployeeId && 
                                d.RecordDate >= startOfMonth && 
                                d.RecordDate < existingRecord.RecordDate && 
                                d.LateMinutes > 0)
                    .CountAsync();

                int currentLateCount = previousLates + 1;
                baseRemark = $"Late #{currentLateCount}";
            }
            }

            existingRecord.Remarks = baseRemark;
            existingRecord.WorkMinutes = 0;
            existingRecord.BreakMinutes = 0;
            return;
        }

        if (emp.Shift != null)
        {
            var shift = emp.Shift;
            
            // Check for actual lunch punches (Intermediate punches)
            // Minimum 4 punches: IN, OUT (Lunch), IN (Lunch), OUT (End)
            if (sortedLogs.Count >= 4)
            {
                // Simple logic: assume the largest gap between intermediate punches is the lunch break
                // Or more safely: gap between 2nd and 3rd punch if 4 logs
                var punch2 = sortedLogs[1].PunchTime;
                var punch3 = sortedLogs[2].PunchTime;
                var actualBreak = (int)(punch3 - punch2).TotalMinutes;
                
                // If the gap is between LunchStart/End range or simply > 15 mins, consider it lunch
                breakMinutes = actualBreak;
                existingRecord.IsActualBreak = true;
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Actual Lunch: {breakMinutes}m");
            }
            else
            {
                // Fallback to standard shift break (generated column)
                breakMinutes = shift.LunchBreakDuration;
                existingRecord.IsActualBreak = false;
                // Remarks = AppendRemark(existingRecord.Remarks, $"Standard Lunch: {breakMinutes}m"); // Removed as per request
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

        if (emp.Shift == null) return; // Already handled above but for safety
        var currentShift = emp.Shift; // Variable rename for consistency below

        // 6. Timing Rules (Dynamic based on Shift)
        
        bool isNoticePeriod = emp.ResignationDate.HasValue && date >= emp.ResignationDate.Value;
        bool isProbation = emp.ProbationEnd.HasValue && date < emp.ProbationEnd.Value;

        // Adjust expected start time if the employee is on a First Half leave
        TimeOnly expectedStartTime = currentShift.StartTime;
        if (approvedLeave != null && approvedLeave.DayType == "First Half")
        {
            // If they are on First Half leave, they are expected to arrive at HalfTime
            expectedStartTime = currentShift.HalfTime ?? currentShift.StartTime;
        }

        // Late Coming Check
        if (inTime > expectedStartTime)
        {
            int lateMins = (int)(inTime - expectedStartTime).TotalMinutes;
            int graceLimit = isNoticePeriod ? 0 : (currentShift.LateComingGraceMinutes ?? 30);
            
            if (waiveLate)
            {
                existingRecord.LateMinutes = 0; // Waived
                existingRecord.IsLate = false;
                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Late Waived ({lateMins}m)");
            }
            else
            {
                existingRecord.LateMinutes = lateMins; // Always store for reports
                
                // MAJOR LATE: arriving after HalfTime boundary (only applies if expected start wasn't already HalfTime)
                if (currentShift.HalfTime.HasValue && expectedStartTime != currentShift.HalfTime.Value && inTime > currentShift.HalfTime.Value)
                {
                    if (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF"))
                    {
                        existingRecord.Status = "Half Day"; 
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Major Late (> Half Time)");
                    }
                }
                else if ((isProbation || isNoticePeriod) && lateMins > 0)
                {
                    // Probation or Notice Period employees: immediate Half Day for any lateness
                    if (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF"))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        var ruleName = isNoticePeriod ? "Notice Period" : "Probation";
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{ruleName} Late (No Grace)");
                    }
                }
                else if (lateMins > graceLimit)
                {
                    // Regular employees: immediate Half Day if beyond grace period
                    if (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF"))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Late Beyond Grace");
                    }
                }
                else
                {
                     // Minor Late: Handle via frequency in ApplyMonthlyPenaltiesAsync
                     existingRecord.IsLate = true; 
                }
            }
        }

        // Early Exit Check
        if (outTime < currentShift.EndTime)
        {
            int earlyMins = (int)(currentShift.EndTime - outTime).TotalMinutes;
            
            // Early Exit Zone Separation
            // SPECIAL CASE: Second Half Leave but left before HalfTime boundary
            if (approvedLeave != null && approvedLeave.DayType == "Second Half" && currentShift.HalfTime.HasValue && outTime < currentShift.HalfTime.Value)
            {
                if (waiveEarly)
                {
                    // Remarks already handled by the regularization block at line ~229
                    // No penalty to WorkMinutes!
                }
                else
                {
                    // Not regularized -> First half is absent
                    existingRecord.WorkMinutes = 0;
                    existingRecord.BreakMinutes = 0;
                    existingRecord.IsActualBreak = false;
                    existingRecord.IsHalfDay = true;
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, 
                        $"First Half Absent: Left at {outTime:HH\\:mm} before half-time ({currentShift.HalfTime.Value:HH\\:mm}).");
                }
            }
            else if (currentShift.EarlyGoAllowedTime.HasValue && outTime < currentShift.EarlyGoAllowedTime.Value)
            {
                // MAJOR EARLY EXIT: Before the allowed time (e.g., leaving at 14:32 when allowed time is 17:00)
                if (waiveEarly)
                {
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, "Early Waived (Half Day Granted)");
                }
                else 
                {
                    if (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF"))
                    {
                        existingRecord.Status = "Half Day";
                        existingRecord.IsHalfDay = true;
                        existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Major Early Exit (< {currentShift.EarlyGoAllowedTime:HH:mm})");
                    }
                }
            }
            else
            {
                // MINOR EARLY EXIT: After allowed time but before EndTime
                if (waiveEarly)
                {
                    existingRecord.EarlyMinutes = 0;
                    existingRecord.IsEarly = false;
                    existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"Early Waived ({earlyMins}m)");
                }
                else
                {
                    existingRecord.EarlyMinutes = earlyMins;
                    int graceMinutes = (isNoticePeriod || isProbation) ? 0 : (currentShift.EarlyLeaveGraceMinutes ?? 0);
                    
                    if (earlyMins > graceMinutes || isProbation || isNoticePeriod)
                    {
                        // Mark as Early so Monthly Frequency penalty can apply in ApplyMonthlyPenaltiesAsync
                        existingRecord.IsEarly = true;
                        
                        if (isNoticePeriod || isProbation)
                        {
                            // Stricter rule for Notice/Probation: any early exit is a Half Day if beyond grace (which is 0)
                            if (existingRecord.Status == null || !existingRecord.Status.EndsWith("HF"))
                            {
                                existingRecord.Status = "Half Day";
                                existingRecord.IsHalfDay = true;
                                var ruleName = isNoticePeriod ? "Notice Period" : "Probation";
                                existingRecord.Remarks = AppendRemark(existingRecord.Remarks, $"{ruleName} Early Exit (No Grace)");
                            }
                        }
                    }
                }
            }
        }



        // 7. Monthly Penalties (Dynamic based on Shift limits)
        await ApplyMonthlyPenaltiesAsync(emp, existingRecord, currentShift);
    }

    private async Task ApplyMonthlyPenaltiesAsync(Employee emp, DailyAttendance currentRecord, Shift shift)
    {
        var startOfMonth = new DateOnly(currentRecord.RecordDate.Year, currentRecord.RecordDate.Month, 1);
        
        // Late Coming Policy
        // Late Coming Policy: Count ALL minor late arrivals (even within grace) for frequency penalties
        if (currentRecord.IsLate)
        {
            // Count all previous instances where employee had a minor late (IsLate == true)
            // Note: We don't count LateMinutes > 0 because major lates (already penalised with Half Day) shouldn't drain the allowed minor lates pool.
            // FIX: We must also check _db.DailyAttendance.Local because during bulk-processing (Process.cshtml.cs),
            // previous days might not be saved to the database yet.
            var dbLatesCount = await _db.DailyAttendance
                .Where(d => d.EmployeeId == emp.EmployeeId && 
                            d.RecordDate >= startOfMonth && 
                            d.RecordDate < currentRecord.RecordDate && 
                            d.IsLate)
                .CountAsync();

            var localLatesCount = _db.DailyAttendance.Local
                .Where(d => d.EmployeeId == emp.EmployeeId && 
                            d.RecordDate >= startOfMonth && 
                            d.RecordDate < currentRecord.RecordDate && 
                            d.IsLate)
                .Count();

            // The local set contains newly added/modified records not yet in the DB.
            // We shouldn't double count if a record is in both (modified state), but it's safer
            // to just evaluate the local first, then fallback to DB if not found in local.
            
            // Better approach: Get all distinct records from Local + DB for this employee/month/before today
            var localRecords = _db.DailyAttendance.Local
                .Where(d => d.EmployeeId == emp.EmployeeId && 
                            d.RecordDate >= startOfMonth && 
                            d.RecordDate < currentRecord.RecordDate)
                .ToList();

            var dbRecords = await _db.DailyAttendance
                .Where(d => d.EmployeeId == emp.EmployeeId && 
                            d.RecordDate >= startOfMonth && 
                            d.RecordDate < currentRecord.RecordDate)
                .AsNoTracking()
                .ToListAsync();

            var allRecords = localRecords.Concat(dbRecords)
                .GroupBy(x => x.RecordDate)
                .Select(g => g.First()) // Prefer local if duplicate
                .ToList();

            int previousLatesCount = allRecords.Count(d => d.IsLate);

            int currentLateCount = previousLatesCount + 1;
            
            // Append "Late #X" to remarks for report visibility
            currentRecord.Remarks = AppendRemark(currentRecord.Remarks, $"Late #{currentLateCount}");

            // Now apply PENALTY if allowed count is exceeded, regardless of IsLate flag
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

                // STRICT INTERPRETATION: If we are counting ALL lates towards the limit
                if (currentLateCount > allowedLates && halfDayOnExceed)
                {
                    currentRecord.Status = "Half Day";
                    currentRecord.IsHalfDay = true;
                    currentRecord.Remarks = AppendRemark(currentRecord.Remarks, $"Penalty Applied (Max {allowedLates} allowed)");
                }
            }
        }


        // Early Go Policy
        if (currentRecord.IsEarly && currentRecord.Status != "Half Day")
        {
            // Probation check remains (strict rule usually)
            var isProbation = emp.ProbationEnd.HasValue && currentRecord.RecordDate < emp.ProbationEnd.Value;
            
            if (isProbation)
            {
                currentRecord.Status = "Half Day";
                currentRecord.IsHalfDay = true;
                currentRecord.Remarks = AppendRemark(currentRecord.Remarks, "Early Go (Probation)");
            }
            else
            {
                // Check against shift policy
                var previousEarly = await _db.DailyAttendance
                    .Where(d => d.EmployeeId == emp.EmployeeId && 
                                d.RecordDate >= startOfMonth && 
                                d.RecordDate < currentRecord.RecordDate && 
                                d.IsEarly)
                    .CountAsync();

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

        // Split existing remarks and check if newRemark is already present (case-insensitive)
        var parts = existing.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Any(p => p.Trim().Equals(newRemark.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return existing;
        }

        return $"{existing}, {newRemark}";
    }

    public static int GetLeaveYear(DateOnly date)
    {
        // Custom cycle: November to October
        // November 2025 belongs to Leave Year 2025
        // October 2026 belongs to Leave Year 2025
        return date.Month >= 11 ? date.Year : date.Year - 1;
    }

    public static decimal CalculateProRataQuota(decimal yearlyQuota, DateOnly probationEnd, int leaveYear)
    {
        // Cycle Start: Nov 1st of leaveYear
        // Cycle End: Oct 31st of leaveYear + 1
        var cycleStart = new DateOnly(leaveYear, 11, 1);
        var cycleEnd = new DateOnly(leaveYear + 1, 10, 31);

        // If probation ends before cycle starts, full quota
        if (probationEnd <= cycleStart) return yearlyQuota;
        
        // If probation ends after cycle ends, 0 quota
        if (probationEnd > cycleEnd) return 0;

        // Calculate months eligible (from probationEnd to cycleEnd)
        int eligibleMonths = 0;
        var current = new DateOnly(probationEnd.Year, probationEnd.Month, 1);
        if (probationEnd.Day > 15) // If they join after 15th, count from next month
        {
            current = current.AddMonths(1);
        }

        while (current <= cycleEnd)
        {
            eligibleMonths++;
            current = current.AddMonths(1);
        }

        // Return pro-rata (Quota / 12 * eligibleMonths) rounded to nearest 0.5
        var rawProRata = (yearlyQuota / 12m) * eligibleMonths;
        return Math.Round(rawProRata * 2, MidpointRounding.AwayFromZero) / 2;
    }

    private async Task<LeaveApplication?> GetSandwichingLeaveAsync(int employeeId, DateOnly weekoffDate)
    {
        async Task<LeaveApplication?> FindLeaveAsync(DateOnly d)
        {
            return await _db.LeaveApplications
                .Include(la => la.LeaveType)
                .FirstOrDefaultAsync(la => la.EmployeeId == employeeId
                                        && la.Status == "Approved"
                                        && !la.IgnoreSandwichRule
                                        && d >= la.StartDate && d <= la.EndDate
                                        && la.DayType == "Full Day");
        }

        var prevDay1 = await FindLeaveAsync(weekoffDate.AddDays(-1));
        var prevDay2 = prevDay1 != null ? await FindLeaveAsync(weekoffDate.AddDays(-2)) : null;

        var nextDay1 = await FindLeaveAsync(weekoffDate.AddDays(1));
        var nextDay2 = nextDay1 != null ? await FindLeaveAsync(weekoffDate.AddDays(2)) : null;

        // A sandwich occurs if >= 2 consecutive leave days touch either side, or leave is on both sides.
        bool isSandwich = prevDay2 != null || nextDay2 != null || (prevDay1 != null && nextDay1 != null);

        if (!isSandwich) return null;

        // Return an adjacent leave application so caller can use its leave type/allocation
        return prevDay1 ?? nextDay1;
    }
}
