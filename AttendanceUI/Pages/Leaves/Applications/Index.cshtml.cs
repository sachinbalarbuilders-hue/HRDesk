using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Leaves.Applications;

public class IndexModel : PageModel
{
    private readonly CompOffService _compOffService;
    private readonly BiometricAttendanceDbContext _db;
    private readonly ISequenceService _sequenceService;
    private readonly AttendanceProcessorService _processor;

    public IndexModel(BiometricAttendanceDbContext db, ISequenceService sequenceService, AttendanceProcessorService processor, CompOffService compOffService)
    {
        _db = db;
        _sequenceService = sequenceService;
        _processor = processor;
        _compOffService = compOffService;
    }

    public List<LeaveApplication> LeaveApplications { get; set; } = new();
    public List<Employee> Employees { get; set; } = new();
    public List<LeaveType> LeaveTypes { get; set; } = new();

    public async Task OnGetAsync()
    {
        Employees = await _db.Employees.Where(e => e.Status == "active").OrderBy(e => e.EmployeeName).ToListAsync();
        LeaveTypes = await _db.LeaveTypes.Where(lt => lt.Status == "Active").ToListAsync();

        // Default to today to avoid 0001-01-01 error
        NewApplication.StartDate = DateOnly.FromDateTime(DateTime.Today);
        NewApplication.EndDate = DateOnly.FromDateTime(DateTime.Today);
        
        ViewData["NextAppNo"] = await _sequenceService.PeekNextApplicationNumberAsync(NewApplication.StartDate);

        LeaveApplications = await _db.LeaveApplications
            .Include(la => la.Employee)
            .Include(la => la.LeaveType)
            .OrderByDescending(la => la.CreatedAt) // Changed to CreatedAt for better tracking of recent entries
            .ToListAsync();
    }

    public async Task<IActionResult> OnGetCheckBalanceAsync(int employeeId, int leaveTypeId, DateOnly date, int? currentAppId = null)
    {
        var type = await _db.LeaveTypes.FindAsync(leaveTypeId);
        decimal remaining = 0;

        if (type != null && type.Code == "CO")
        {
            // For Comp-Off, use the custom expiry-aware calculation
            remaining = await _compOffService.GetValidBalanceAsync(employeeId, date);
        }
        else
        {
            var leaveYear = AttendanceProcessorService.GetLeaveYear(date);
            var allocation = await _db.LeaveAllocations
                .FirstOrDefaultAsync(la => la.EmployeeId == employeeId && la.LeaveTypeId == leaveTypeId && la.Year == leaveYear);

            if (allocation != null)
            {
                remaining = allocation.TotalAllocated + allocation.OpeningBalance - allocation.UsedCount;
            }
        }

        // If editing, add back the days from the current application
        if (currentAppId.HasValue)
        {
            var currentApp = await _db.LeaveApplications.FindAsync(currentAppId.Value);
            if (currentApp != null && currentApp.EmployeeId == employeeId && currentApp.LeaveTypeId == leaveTypeId)
            {
                var appYear = AttendanceProcessorService.GetLeaveYear(currentApp.StartDate);
                // For CO, we always add back as it's a simple deduction from valid pool
                // For others, check leave year
                if (type?.Code == "CO" || appYear == AttendanceProcessorService.GetLeaveYear(date))
                {
                    remaining += currentApp.TotalDays;
                }
            }
        }

        return new JsonResult(new { remaining });
    }

    public async Task<IActionResult> OnGetNextAppNoAsync(DateOnly date)
    {
        string nextAppNo = await _sequenceService.PeekNextApplicationNumberAsync(date);
        return new JsonResult(new { nextAppNo });
    }

    public async Task<IActionResult> OnGetGetEligibleLeaveTypesAsync(int employeeId, string date = null)
    {
        // A leave type is eligible for an employee if:
        // 1. It has NO explicit assignments (General leave type)
        // 2. OR it is explicitly assigned to this employee
        
        var emp = await _db.Employees.FindAsync(employeeId);
        DateOnly checkDate = DateOnly.FromDateTime(DateTime.Today);
        if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var parsedDate))
        {
            checkDate = parsedDate;
        }

        bool isOnProbation = emp?.ProbationEnd.HasValue == true && checkDate < emp.ProbationEnd.Value;

        var eligibleTypes = await _db.LeaveTypes
            .Where(lt => lt.Status == "Active")
            .Where(lt => !_db.LeaveTypeEligibilities.Any(lte => lte.LeaveTypeId == lt.Id) 
                      || _db.LeaveTypeEligibilities.Any(lte => lte.LeaveTypeId == lt.Id && lte.EmployeeId == employeeId))
            .Select(lt => new { 
                lt.Id, 
                lt.Name, 
                lt.Code,
                IsDisabled = isOnProbation && lt.IsPaid && lt.ApplicableAfterProbation
            })
            .ToListAsync();

        return new JsonResult(eligibleTypes);
    }

    public async Task<IActionResult> OnGetCheckSandwichAsync(int employeeId, DateOnly startDate, DateOnly endDate, string dayType = "Full Day")
    {
        var emp = await _db.Employees.FindAsync(employeeId);
        if (emp == null || string.IsNullOrWhiteSpace(emp.Weekoff)) 
        {
            return new JsonResult(new { isSandwich = false, message = "" });
        }

        string weekoffDay = emp.Weekoff.Trim();
        // Check every day from (StartDate - 1) to (EndDate + 1) to see if it's a weekoff
        var checkStart = startDate.AddDays(-1);
        var checkEnd = endDate.AddDays(1);
        
        bool willSandwich = false;
        List<string> sandwichedDates = new();

        for (var date = checkStart; date <= checkEnd; date = date.AddDays(1))
        {
            if (date.DayOfWeek.ToString().Equals(weekoffDay, StringComparison.OrdinalIgnoreCase))
            {
                // A weekoff is sandwiched if it is connected to a block of 2 or more leaves on either side
                // OR if it is sandwiched by leaves on both sides.
                var dayBefore1 = date.AddDays(-1);
                var dayBefore2 = date.AddDays(-2);
                var dayAfter1 = date.AddDays(1);
                var dayAfter2 = date.AddDays(2);
                
                async Task<bool> IsLeaveAsync(DateOnly d) 
                {
                    if (d >= startDate && d <= endDate) return dayType == "Full Day";
                    return await _db.LeaveApplications.AnyAsync(la => la.EmployeeId == employeeId && la.Status == "Approved" && !la.IgnoreSandwichRule && d >= la.StartDate && d <= la.EndDate && la.DayType == "Full Day");
                }

                bool b1 = await IsLeaveAsync(dayBefore1);
                bool b2 = b1 && await IsLeaveAsync(dayBefore2);

                bool a1 = await IsLeaveAsync(dayAfter1);
                bool a2 = a1 && await IsLeaveAsync(dayAfter2);

                if (b2 || a2 || (b1 && a1))
                {
                    // Check if they actually worked on this weekoff date
                    var workedOnWeekoff = await _db.AttendanceLogs.AnyAsync(l => 
                        l.EmployeeId == employeeId && 
                        l.PunchTime >= date.ToDateTime(TimeOnly.MinValue) && 
                        l.PunchTime < date.AddDays(1).ToDateTime(TimeOnly.MinValue));

                    if (!workedOnWeekoff)
                    {
                        willSandwich = true;
                        sandwichedDates.Add($"{date:dd-MMM-yyyy} ({weekoffDay})");
                    }
                }
            }
        }

        string warningMsg = "";
        if (willSandwich)
        {
            warningMsg = $"This leave connects to weekoff(s) on {string.Join(", ", sandwichedDates)} forming Sandwich condition(s). The weekoff(s) will be converted to Leave unless skipped.";
        }

        return new JsonResult(new { isSandwich = willSandwich, message = warningMsg });
    }

    [BindProperty]
    public LeaveApplication NewApplication { get; set; } = new();

    [BindProperty]
    public bool AutoGenerate { get; set; } = true;

    [BindProperty]
    public LeaveApplication EditApplication { get; set; } = new();


    public async Task<IActionResult> OnPostAddAsync()
    {
        var emp = await _db.Employees.FindAsync(NewApplication.EmployeeId);
        var type = await _db.LeaveTypes.FindAsync(NewApplication.LeaveTypeId);

        if (emp == null || type == null)
        {
            ModelState.AddModelError("", "Invalid Employee or Leave Type.");
            await OnGetAsync();
            return Page();
        }

        // Probation Logic: No paid leave if on probation
        var isOnProbation = emp.ProbationEnd.HasValue && NewApplication.StartDate < emp.ProbationEnd.Value;
        if (isOnProbation && type.IsPaid && type.ApplicableAfterProbation)
        {
            ModelState.AddModelError("", $"Employee is on probation until {emp.ProbationEnd:dd-MMM-yyyy}. Paid leaves like {type.Name} are not allowed yet.");
            await OnGetAsync();
            return Page();
        }

        string baseAppNo = NewApplication.ApplicationNumber;
        
        // 1. Generate App Number if needed
        if (AutoGenerate)
        {
            baseAppNo = await _sequenceService.GenerateApplicationNumberAsync(NewApplication.StartDate);
        }

        DateTime now = DateTime.Now;

        // 2. Overlap Check
        var overlapping = await _db.LeaveApplications
            .AnyAsync(la => la.EmployeeId == NewApplication.EmployeeId &&
                           la.Status == "Approved" &&
                           NewApplication.StartDate <= la.EndDate &&
                           NewApplication.EndDate >= la.StartDate);

        if (overlapping)
        {
            ModelState.AddModelError("", "This employee already has an approved leave application overlapping with the selected dates.");
            await OnGetAsync();
            return Page();
        }

        // 3. Calculate Total Days (Skipping Holidays and Weekoffs, but including sandwiched weekoffs)
        decimal workDaysCount = 0;
        string weekoffDay = emp.Weekoff?.Trim() ?? "";
        decimal dayMultiplier = (NewApplication.DayType == "First Half" || NewApplication.DayType == "Second Half") ? 0.5m : 1.0m;
        
        var holidaysList = await _db.Holidays
            .Where(h => h.IsGlobal || _db.HolidayEmployees.Any(he => he.HolidayId == h.Id && he.EmployeeId == NewApplication.EmployeeId))
            .ToListAsync();

        // Build a list of day classifications within the range
        var dayInfos = new List<(DateOnly Date, bool IsWorkDay, bool IsWeekoff, bool IsHoliday)>();
        for (var d = NewApplication.StartDate; d <= NewApplication.EndDate; d = d.AddDays(1))
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

        // Include sandwiched weekoffs: a weekoff within the range that has working days on both sides
        if (!NewApplication.IgnoreSandwichRule)
        {
            foreach (var di in dayInfos.Where(x => x.IsWeekoff))
            {
                bool hasWorkDayBefore = dayInfos.Any(x => x.Date < di.Date && x.IsWorkDay);
                bool hasWorkDayAfter = dayInfos.Any(x => x.Date > di.Date && x.IsWorkDay);
                if (hasWorkDayBefore && hasWorkDayAfter)
                {
                    workDaysCount += dayMultiplier;
                }
            }
        }

        if (workDaysCount <= 0)
        {
            ModelState.AddModelError("", "Selected date range only contains holidays or weekoffs. No leave deduction is required.");
            await OnGetAsync();
            return Page();
        }

        NewApplication.TotalDays = workDaysCount;

        // 4. Set Base Properties
        NewApplication.ApplicationNumber = baseAppNo;
        NewApplication.Status = "Approved";
        NewApplication.CreatedAt = now;

        decimal totalDaysRequested = NewApplication.TotalDays;

        // 5. Update Allocation & Check Balance
        var leaveYear = AttendanceProcessorService.GetLeaveYear(NewApplication.StartDate);
        var allocation = await _db.LeaveAllocations
            .FirstOrDefaultAsync(la => la.EmployeeId == NewApplication.EmployeeId && 
                                       la.LeaveTypeId == NewApplication.LeaveTypeId && 
                                       la.Year == leaveYear);
        
        // BALANCE VALIDATION
        if (type.IsPaid)
        {
            if (allocation == null)
            {
                 ModelState.AddModelError("", $"No leave allocation found for {type.Name} in leave year {leaveYear}.");
                 await OnGetAsync();
                 return Page();
            }

            decimal remaining = allocation.TotalAllocated + allocation.OpeningBalance - allocation.UsedCount;
            if (totalDaysRequested > remaining)
            {
                ModelState.AddModelError("", $"Insufficient balance. Available: {remaining} days, Requested: {totalDaysRequested} days.");
                await OnGetAsync();
                return Page();
            }
        }

        // 4. Save Changes
        if (allocation != null)
        {
            allocation.UsedCount += totalDaysRequested;
            allocation.UpdatedAt = DateTime.Now;
        }

        _db.LeaveApplications.Add(NewApplication);
        await _db.SaveChangesAsync();

        // 5. Trigger attendance re-processing for the FULL range (including adjacent days for sandwiches)
        for (var date = NewApplication.StartDate.AddDays(-1); date <= NewApplication.EndDate.AddDays(1); date = date.AddDays(1))
        {
            await _processor.ProcessDailyAttendanceAsync(date, NewApplication.EmployeeId);
        }

        // FAILSAFE for Sequence
        if (!AutoGenerate && !string.IsNullOrWhiteSpace(baseAppNo))
        {
            await _sequenceService.EnsureSequenceCatchUpAsync(NewApplication.StartDate, baseAppNo);
        }

        return RedirectToPage();
    }



    public async Task<IActionResult> OnPostEditAsync()
    {
        var application = await _db.LeaveApplications.FindAsync(EditApplication.Id);
        if (application == null) return NotFound();

        // 1. Reverse old allocation
        var oldLeaveYear = AttendanceProcessorService.GetLeaveYear(application.StartDate);
        var oldTotalDays = application.TotalDays;
        var oldAllocation = await _db.LeaveAllocations
            .FirstOrDefaultAsync(la => la.EmployeeId == application.EmployeeId && 
                                       la.LeaveTypeId == application.LeaveTypeId && 
                                       la.Year == oldLeaveYear);
        if (oldAllocation != null)
        {
            oldAllocation.UsedCount -= oldTotalDays;

            // Also reverse any cross-application sandwich deductions linked to this application
            var oldSandwichCount = await _db.DailyAttendance
                .Where(d => d.EmployeeId == application.EmployeeId &&
                            d.ApplicationNumber == application.ApplicationNumber &&
                            d.Remarks != null && d.Remarks.Contains("Sandwich Leave (covered by"))
                .CountAsync();
            if (oldSandwichCount > 0)
            {
                oldAllocation.UsedCount -= oldSandwichCount;
            }
        }

        // Store old range for re-processing
        var oldStart = application.StartDate;
        var oldEnd = application.EndDate;

        // 3. Overlap Check (Excluding self)
        var overlapping = await _db.LeaveApplications
            .AnyAsync(la => la.Id != application.Id &&
                           la.EmployeeId == application.EmployeeId &&
                           la.Status == "Approved" &&
                           EditApplication.StartDate <= la.EndDate &&
                           EditApplication.EndDate >= la.StartDate);

        if (overlapping)
        {
            ModelState.AddModelError("", "The updated dates overlap with another approved leave application.");
            await OnGetAsync();
            return Page();
        }

        // 4. Calculate Total Days (Skipping Holidays and Weekoffs, but including sandwiched weekoffs)
        var emp = await _db.Employees.FindAsync(application.EmployeeId);
        decimal workDaysCount = 0;
        string weekoffDay = emp?.Weekoff?.Trim() ?? "";
        decimal dayMultiplier = (EditApplication.DayType == "First Half" || EditApplication.DayType == "Second Half") ? 0.5m : 1.0m;
        
        var holidaysList = await _db.Holidays
            .Where(h => h.IsGlobal || _db.HolidayEmployees.Any(he => he.HolidayId == h.Id && he.EmployeeId == application.EmployeeId))
            .ToListAsync();

        var dayInfos = new List<(DateOnly Date, bool IsWorkDay, bool IsWeekoff, bool IsHoliday)>();
        for (var d = EditApplication.StartDate; d <= EditApplication.EndDate; d = d.AddDays(1))
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
        if (!EditApplication.IgnoreSandwichRule)
        {
            foreach (var di in dayInfos.Where(x => x.IsWeekoff))
            {
                bool hasWorkDayBefore = dayInfos.Any(x => x.Date < di.Date && x.IsWorkDay);
                bool hasWorkDayAfter = dayInfos.Any(x => x.Date > di.Date && x.IsWorkDay);
                if (hasWorkDayBefore && hasWorkDayAfter)
                {
                    workDaysCount += dayMultiplier;
                }
            }
        }

        if (workDaysCount <= 0)
        {
            ModelState.AddModelError("", "Updated date range only contains holidays or weekoffs.");
            await OnGetAsync();
            return Page();
        }

        // 5. Update application details
        application.LeaveTypeId = EditApplication.LeaveTypeId;
        application.StartDate = EditApplication.StartDate;
        application.EndDate = EditApplication.EndDate;
        application.Reason = EditApplication.Reason;
        application.DayType = EditApplication.DayType;
        application.IgnoreSandwichRule = EditApplication.IgnoreSandwichRule;
        application.TotalDays = workDaysCount;

        // 6. Apply to new allocation & VALIDATE
        var newLeaveYear = AttendanceProcessorService.GetLeaveYear(application.StartDate);
        var newAllocation = await _db.LeaveAllocations
            .Include(la => la.LeaveType)
            .FirstOrDefaultAsync(la => la.EmployeeId == application.EmployeeId && 
                                       la.LeaveTypeId == application.LeaveTypeId && 
                                       la.Year == newLeaveYear);
        
        var newType = await _db.LeaveTypes.FindAsync(application.LeaveTypeId);
        if (newType != null && newType.IsPaid)
        {
            if (newAllocation == null)
            {
                 ModelState.AddModelError("", $"No leave allocation found for {newType.Name} in leave year {newLeaveYear}.");
                 await OnGetAsync();
                 return Page();
            }

            decimal remaining = newAllocation.TotalAllocated + newAllocation.OpeningBalance - newAllocation.UsedCount;

            if (application.TotalDays > remaining)
            {
                // Note: We need to put back the oldUsedCount if validation fails because we subtracted it above
                if (oldAllocation != null) oldAllocation.UsedCount += oldTotalDays;
                
                ModelState.AddModelError("", $"Insufficient balance for update. Available: {remaining} days, Requested: {application.TotalDays} days.");
                await OnGetAsync();
                return Page();
            }
        }

        if (newAllocation != null)
        {
            newAllocation.UsedCount += application.TotalDays;
            newAllocation.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();

        // Re-process both old and new ranges (including adjacent days for sandwiches)
        var combinedStart = (oldStart < application.StartDate ? oldStart : application.StartDate).AddDays(-1);
        var combinedEnd = (oldEnd > application.EndDate ? oldEnd : application.EndDate).AddDays(1);

        for (var d = combinedStart; d <= combinedEnd; d = d.AddDays(1))
        {
            await _processor.ProcessDailyAttendanceAsync(d, application.EmployeeId);
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var application = await _db.LeaveApplications.FindAsync(id);
        if (application != null)
        {
            // Reverse allocation update
            var leaveYear = AttendanceProcessorService.GetLeaveYear(application.StartDate);
            var allocation = await _db.LeaveAllocations
                .FirstOrDefaultAsync(la => la.EmployeeId == application.EmployeeId && 
                                           la.LeaveTypeId == application.LeaveTypeId && 
                                           la.Year == leaveYear);
            if (allocation != null)
            {
                allocation.UsedCount -= application.TotalDays;

                // Also reverse any cross-application sandwich deductions linked to this application
                // (Within-range sandwiches are already included in TotalDays above)
                var sandwichCount = await _db.DailyAttendance
                    .Where(d => d.EmployeeId == application.EmployeeId &&
                                d.ApplicationNumber == application.ApplicationNumber &&
                                d.Remarks != null && d.Remarks.Contains("Sandwich Leave (covered by"))
                    .CountAsync();
                if (sandwichCount > 0)
                {
                    allocation.UsedCount -= sandwichCount;
                }
            }

            _db.LeaveApplications.Remove(application);
            await _db.SaveChangesAsync();

            // Auto-resync sequence to close gaps if it was the latest
            await _sequenceService.ResyncSequenceAsync(application.StartDate.Year, application.StartDate.Month);

            // Re-process attendance for the deleted leave range (including adjacent days for sandwiches)
            for (var d = application.StartDate.AddDays(-1); d <= application.EndDate.AddDays(1); d = d.AddDays(1))
            {
                await _processor.ProcessDailyAttendanceAsync(d, application.EmployeeId);
            }

        }
        return RedirectToPage();
    }
}
