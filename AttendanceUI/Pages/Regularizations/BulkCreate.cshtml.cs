using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.Regularizations
{
    public class BulkCreateModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly ISequenceService _sequenceService;
        private readonly AttendanceProcessorService _processor;

        public BulkCreateModel(BiometricAttendanceDbContext context, ISequenceService sequenceService, AttendanceProcessorService processor)
        {
            _context = context;
            _sequenceService = sequenceService;
            _processor = processor;
        }

        [BindProperty]
        public BulkRequestModel Input { get; set; } = new();

        public class BulkRequestModel
        {
            public int EmployeeId { get; set; }
            public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
            public DateOnly EndDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
            public bool IncludeIn { get; set; } = true;
            public DateTime InTime { get; set; } = DateTime.Today.AddHours(9);
            public bool IncludeOut { get; set; } = true;
            public DateTime OutTime { get; set; } = DateTime.Today.AddHours(18);
            public string? Reason { get; set; } = "Bulk Regularization";
            public bool AutoApprove { get; set; } = true;
            public bool AutoGenerate { get; set; } = true;
            public bool SmartFill { get; set; } = false;
            public string? ApplicationNumber { get; set; }
        }

        public async Task<IActionResult> OnGetAsync()
        {
            ViewData["Employees"] = await _context.Employees
                .OrderBy(e => e.EmployeeName)
                .Select(e => new SelectListItem { Value = e.EmployeeId.ToString(), Text = $"{e.EmployeeName} ({e.EmployeeId})" })
                .ToListAsync();
            
            ViewData["NextAppNo"] = await _sequenceService.PeekNextApplicationNumberAsync(DateOnly.FromDateTime(DateTime.Today));
            return Page();
        }

        public async Task<IActionResult> OnGetShiftTimesAsync(int employeeId)
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var shiftId = await _context.EmployeeShiftAssignments
                .Where(a => a.EmployeeId == employeeId && a.FromDate <= today)
                .OrderByDescending(a => a.FromDate)
                .Select(a => a.ShiftId)
                .FirstOrDefaultAsync();

            var shift = await _context.Shifts.FindAsync(shiftId);
            
            if (shift != null)
            {
                return new JsonResult(new { 
                    inTime = shift.StartTime.ToString("HH:mm"), 
                    outTime = shift.EndTime.ToString("HH:mm") 
                });
            }
            return new JsonResult(new { inTime = "09:00", outTime = "18:00" });
        }

        public async Task<IActionResult> OnGetRangeSummaryAsync(int employeeId, DateOnly startDate, DateOnly endDate)
        {
            var existingRecords = await _context.DailyAttendance
                .Where(d => d.EmployeeId == employeeId && d.RecordDate >= startDate && d.RecordDate <= endDate)
                .ToDictionaryAsync(d => d.RecordDate);

            var fullSummary = new List<object>();
            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                existingRecords.TryGetValue(date, out var r);
                
                string inStr = r?.InTime?.ToString("hh:mm tt") ?? "-";
                string outStr = r?.OutTime?.ToString("hh:mm tt") ?? "-";
                
                // If single punch processed (In == Out), show one side as missing
                if (r != null && r.InTime.HasValue && r.OutTime.HasValue && r.InTime == r.OutTime)
                {
                    outStr = "-"; // Display as missing OUT
                }

                fullSummary.Add(new {
                    date = date.ToString("dd MMM (ddd)"),
                    inTime = inStr,
                    outTime = outStr,
                    isMissing = r == null || !r.InTime.HasValue || !r.OutTime.HasValue || r.InTime == r.OutTime
                });
            }

            return new JsonResult(fullSummary);
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (Input.EmployeeId <= 0)
            {
                ModelState.AddModelError("Input.EmployeeId", "Please select an employee.");
            }

            if (Input.StartDate > Input.EndDate)
            {
                ModelState.AddModelError("Input.StartDate", "Start date cannot be after end date.");
            }

            if (!Input.IncludeIn && !Input.IncludeOut)
            {
                ModelState.AddModelError("", "Please select at least one punch type (IN or OUT).");
            }

            if (!ModelState.IsValid)
            {
                await OnGetAsync();
                return Page();
            }

            var username = User.Identity?.Name ?? "Admin";
            var now = DateTime.Now;
            int totalCreated = 0;

            // Generate ONE application number for the entire bulk request
            string appNo = Input.ApplicationNumber ?? "";
            if (Input.AutoGenerate)
            {
                appNo = await _sequenceService.GenerateApplicationNumberAsync(Input.StartDate);
            }

            // Pre-load existing attendance for SmartFill to avoid N+1 queries
            Dictionary<DateOnly, DailyAttendance> existingRecords = new();
            if (Input.SmartFill)
            {
                existingRecords = await _context.DailyAttendance
                    .Where(d => d.EmployeeId == Input.EmployeeId && d.RecordDate >= Input.StartDate && d.RecordDate <= Input.EndDate)
                    .ToDictionaryAsync(d => d.RecordDate);
            }

            for (var date = Input.StartDate; date <= Input.EndDate; date = date.AddDays(1))
            {
                bool shouldCreateIn = Input.IncludeIn;
                bool shouldCreateOut = Input.IncludeOut;

                if (Input.SmartFill)
                {
                    existingRecords.TryGetValue(date, out var existing);
                    
                    if (existing != null)
                    {
                        // Check if day is truly complete (different IN and OUT)
                        bool isTrulyComplete = existing.InTime.HasValue && existing.OutTime.HasValue && existing.InTime != existing.OutTime;
                        bool isSinglePunch = existing.InTime.HasValue && existing.OutTime.HasValue && existing.InTime == existing.OutTime;

                        if (isTrulyComplete)
                        {
                            // Both exist and are different, skip this day in Smart Mode
                            shouldCreateIn = false;
                            shouldCreateOut = false;
                        }
                        else if (isSinglePunch || (existing.InTime.HasValue && !existing.OutTime.HasValue))
                        {
                            // If it's a single punch (morning), assume it's IN. Skip IN, add OUT.
                            shouldCreateIn = false;
                            shouldCreateOut = true;
                        }
                        else if (!existing.InTime.HasValue && existing.OutTime.HasValue)
                        {
                            shouldCreateIn = true;
                            shouldCreateOut = false;
                        }
                    }
                }

                // For each date, create IN and/or OUT records
                if (shouldCreateIn)
                {
                    var inDateTime = date.ToDateTime(TimeOnly.FromDateTime(Input.InTime));
                    await CreateRegularizationRecord(Input.EmployeeId, date, "Missed Punch", inDateTime, username, appNo, now);
                    totalCreated++;
                }

                if (shouldCreateOut)
                {
                    var outDateTime = date.ToDateTime(TimeOnly.FromDateTime(Input.OutTime));
                    await CreateRegularizationRecord(Input.EmployeeId, date, "Missed Punch", outDateTime, username, appNo, now);
                    totalCreated++;
                }
            }

            await _context.SaveChangesAsync();

            if (Input.AutoApprove)
            {
                var endOfMonth = new DateOnly(Input.EndDate.Year, Input.EndDate.Month, DateTime.DaysInMonth(Input.EndDate.Year, Input.EndDate.Month));
                for (var date = Input.StartDate; date <= endOfMonth; date = date.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(date, Input.EmployeeId);
                }
            }

            TempData["SuccessMessage"] = $"Successfully created {totalCreated} regularization records for employee ID {Input.EmployeeId} using App # {appNo}.";
            return RedirectToPage("./Index");
        }

        private async Task CreateRegularizationRecord(int employeeId, DateOnly date, string type, DateTime punchTime, string username, string appNo, DateTime createdAt)
        {
            var reg = new AttendanceRegularization
            {
                EmployeeId = employeeId,
                RequestType = type,
                RequestDate = date,
                PunchTimeIn = punchTime,
                Reason = Input.Reason,
                CreatedAt = createdAt,
                Status = Input.AutoApprove ? "Approved" : "Pending",
                ApprovedBy = Input.AutoApprove ? username : null,
                ApproveDate = Input.AutoApprove ? DateTime.Now : null,
                ApplicationNumber = appNo
            };
            _context.AttendanceRegularizations.Add(reg);
        }
    }
}
