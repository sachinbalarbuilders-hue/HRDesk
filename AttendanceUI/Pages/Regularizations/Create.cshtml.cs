using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;
using System.Collections.Generic;

namespace AttendanceUI.Pages.Regularizations
{
    public class RegularizationRequestItem
    {
        public DateOnly RequestDate { get; set; }
        public string? PunchTarget { get; set; } // "in", "out", "both"
        public DateTime? PunchTimeIn { get; set; }
        public DateTime? PunchTimeOut { get; set; }
    }

    public class CreateModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly ISequenceService _sequenceService;
        private readonly AttendanceProcessorService _processor;

        public CreateModel(BiometricAttendanceDbContext context, ISequenceService sequenceService, AttendanceProcessorService processor)
        {
            _context = context;
            _sequenceService = sequenceService;
            _processor = processor;
        }

        public async Task<IActionResult> OnGetAsync()
        {
            ViewData["EmployeeId"] = new SelectList(_context.Employees.Where(e => e.Status == "active"), "EmployeeId", "EmployeeName");
            ViewData["NextAppNo"] = await _sequenceService.PeekNextApplicationNumberAsync(DateOnly.FromDateTime(DateTime.Today));
            return Page();
        }

        public async Task<IActionResult> OnGetNextAppNoAsync(DateOnly date)
        {
            string nextAppNo = await _sequenceService.PeekNextApplicationNumberAsync(date);
            return new JsonResult(new { nextAppNo });
        }

        public async Task<IActionResult> OnGetExistingPunchAsync(int employeeId, DateOnly date)
        {
            var existing = await _context.DailyAttendance
                .Where(d => d.EmployeeId == employeeId && d.RecordDate == date)
                .Select(d => new { 
                    inTime = d.InTime.HasValue ? d.InTime.Value.ToString("HH:mm") : null, 
                    outTime = d.OutTime.HasValue ? d.OutTime.Value.ToString("HH:mm") : null 
                })
                .FirstOrDefaultAsync();

            var roster = await _context.ShiftRosters
                .Include(r => r.Shift)
                .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.RosterDate == date);

            return new JsonResult(new { 
                punch = existing ?? new { inTime = (string?)null, outTime = (string?)null },
                shift = roster?.Shift != null ? new { start = roster.Shift.StartTime.ToString("HH:mm"), end = roster.Shift.EndTime.ToString("HH:mm") } : null
            });
        }

        [BindProperty]
        public AttendanceRegularization Regularization { get; set; } = default!;

        [BindProperty]
        public bool AutoGenerate { get; set; } = true;

        [BindProperty]
        public List<RegularizationRequestItem> Requests { get; set; } = new();

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid || _context.AttendanceRegularizations == null || Regularization == null)
            {
                return Page();
            }

            if (Requests == null || !Requests.Any())
            {
                ModelState.AddModelError(string.Empty, "At least one date must be selected.");
                return Page();
            }

            var requestDates = new List<DateOnly>();

            for (int i = 0; i < Requests.Count; i++)
            {
                var reqItem = Requests[i];
                var newReg = new AttendanceRegularization
                {
                    EmployeeId = Regularization.EmployeeId,
                    RequestType = Regularization.RequestType,
                    WaivePenalty = Regularization.WaivePenalty,
                    Reason = Regularization.Reason,
                    RequestDate = reqItem.RequestDate,
                    CreatedAt = DateTime.Now,
                    Status = "Approved",
                    ApprovedBy = User.Identity?.Name ?? "Auto-Approved",
                    ApproveDate = DateTime.Now
                };

                if (AutoGenerate)
                {
                    newReg.ApplicationNumber = await _sequenceService.GenerateApplicationNumberAsync(newReg.RequestDate);
                }
                else
                {
                    newReg.ApplicationNumber = Regularization.ApplicationNumber;
                    // If multiple requests and manual app no, append suffix to avoid unique constraint if any
                    if (Requests.Count > 1 && !string.IsNullOrWhiteSpace(newReg.ApplicationNumber))
                    {
                        newReg.ApplicationNumber = $"{newReg.ApplicationNumber}-{i + 1}";
                    }
                }

                if (newReg.RequestType == "Missed Punch")
                {
                    if (reqItem.PunchTarget == "both" || reqItem.PunchTarget == "out")
                    {
                        newReg.PunchTimeOut = reqItem.PunchTimeOut;
                        if (reqItem.PunchTarget == "out")
                        {
                            newReg.Reason += " (Out-Time Regularization)";
                        }
                        else
                        {
                            newReg.PunchTimeIn = reqItem.PunchTimeIn;
                            newReg.Reason += " (Full Day: IN & OUT)";
                        }
                    }
                    else if (reqItem.PunchTarget == "in")
                    {
                        newReg.PunchTimeIn = reqItem.PunchTimeIn;
                        newReg.Reason += " (In-Time Regularization)";
                    }
                }

                _context.AttendanceRegularizations.Add(newReg);
                requestDates.Add(newReg.RequestDate);
            }
            
            await _context.SaveChangesAsync();

            // PROCESS IMMEDIATELY (Until end of month to update frequencies)
            foreach (var rDate in requestDates.Distinct())
            {
                var endOfMonth = new DateOnly(rDate.Year, rDate.Month, DateTime.DaysInMonth(rDate.Year, rDate.Month));
                for (var d = rDate; d <= endOfMonth; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, Regularization.EmployeeId);
                }
                
                if (!AutoGenerate && !string.IsNullOrWhiteSpace(Regularization.ApplicationNumber))
                {
                    await _sequenceService.EnsureSequenceCatchUpAsync(rDate, Regularization.ApplicationNumber);
                }
            }

            return RedirectToPage("./Index");
        }
    }
}
