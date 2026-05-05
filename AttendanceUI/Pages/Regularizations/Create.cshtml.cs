using System;
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
        public DateTime? PunchTimeOut { get; set; } // For "Full Day" regularization

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid || _context.AttendanceRegularizations == null || Regularization == null)
            {
                return Page();
            }

            // Generate Application Number if requested (Ignore client value to force increment)
            if (AutoGenerate)
            {
                Regularization.ApplicationNumber = await _sequenceService.GenerateApplicationNumberAsync(Regularization.RequestDate);
            }
            
            // INSTANT APPROVAL LOGIC
            Regularization.CreatedAt = DateTime.Now;
            Regularization.Status = "Approved";
            Regularization.ApprovedBy = User.Identity?.Name ?? "Auto-Approved";
            Regularization.ApproveDate = DateTime.Now;

            // HANDLE SELECTIVE PUNCHES (In / Out / Both)
            // Based on the hidden field or radio selections from the frontend
            // If the user only wants OUT, we should clear IN (if it was accidentally set)
            // Note: The frontend already hides/clears these, but we enforce here.

            if (PunchTimeOut.HasValue)
            {
                Regularization.PunchTimeOut = PunchTimeOut.Value;
                if (!Regularization.PunchTimeIn.HasValue)
                {
                    Regularization.Reason += " (Out-Time Regularization)";
                }
                else
                {
                    Regularization.Reason += " (Full Day: IN & OUT)";
                }
            }
            else if (Regularization.PunchTimeIn.HasValue)
            {
                Regularization.Reason += " (In-Time Regularization)";
            }

            _context.AttendanceRegularizations.Add(Regularization);
            await _context.SaveChangesAsync();

            // PROCESS IMMEDIATELY (Until end of month to update frequencies)
            var endOfMonth = new DateOnly(Regularization.RequestDate.Year, Regularization.RequestDate.Month, DateTime.DaysInMonth(Regularization.RequestDate.Year, Regularization.RequestDate.Month));
            for (var d = Regularization.RequestDate; d <= endOfMonth; d = d.AddDays(1))
            {
                await _processor.ProcessDailyAttendanceAsync(d, Regularization.EmployeeId);
            }

            // FAILSAFE: If Application Number was manually entered (or AutoGenerate=false), 
            // ensure the sequence table catches up to avoid future duplicates.
            if (!AutoGenerate && !string.IsNullOrWhiteSpace(Regularization.ApplicationNumber))
            {
                await _sequenceService.EnsureSequenceCatchUpAsync(Regularization.RequestDate, Regularization.ApplicationNumber);
            }

            return RedirectToPage("./Index");
        }
    }
}
