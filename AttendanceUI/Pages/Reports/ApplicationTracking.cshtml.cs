using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace AttendanceUI.Pages.Reports
{
    public class ApplicationTrackingModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _db;
        private readonly ISequenceService _sequenceService;
        private readonly AttendanceProcessorService _processor;

        public ApplicationTrackingModel(BiometricAttendanceDbContext db, ISequenceService sequenceService, AttendanceProcessorService processor)
        {
            _db = db;
            _sequenceService = sequenceService;
            _processor = processor;
        }

        [BindProperty(SupportsGet = true)]
        public int Month { get; set; } = DateTime.Now.Month;

        [BindProperty(SupportsGet = true)]
        public int Year { get; set; } = DateTime.Now.Year;

        public List<ApplicationTrackItem> Applications { get; set; } = new();

        public class ApplicationTrackItem
        {
            public long? Id { get; set; }
            public string? ApplicationNumber { get; set; }
            public DateOnly Date { get; set; }
            public DateOnly? EndDate { get; set; }
            public string EmployeeName { get; set; } = "";
            public string Category { get; set; } = ""; // "Leave", "Regularization", "Attendance Record"
            public string Details { get; set; } = "";
            public string? Reason { get; set; }
            public string Status { get; set; } = "";
        }

        public async Task OnGetAsync()
        {
            var monthStart = new DateOnly(Year, Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            // 1. Get Regularizations overlapping this month
            var regularizations = await _db.AttendanceRegularizations
                .Include(r => r.Employee)
                .Where(r => r.RequestDate <= monthEnd && r.RequestDate >= monthStart)
                .Select(r => new ApplicationTrackItem
                {
                    Id = r.Id,
                    ApplicationNumber = r.ApplicationNumber,
                    Date = r.RequestDate,
                    EmployeeName = r.Employee != null ? r.Employee.EmployeeName : "Unknown",
                    Category = "Regularization",
                    Details = r.RequestType ?? "Regularization",
                    Reason = r.Reason,
                    Status = r.Status ?? "Pending"
                })
                .ToListAsync();

            // 2. Get Leaves overlapping this month
            var leaves = await _db.LeaveApplications
                .Include(l => l.Employee)
                .Include(l => l.LeaveType)
                .Where(l => l.StartDate <= monthEnd && l.EndDate >= monthStart)
                .Select(l => new ApplicationTrackItem
                {
                    Id = l.Id,
                    ApplicationNumber = l.ApplicationNumber,
                    Date = l.StartDate,
                    EndDate = l.EndDate,
                    EmployeeName = l.Employee != null ? l.Employee.EmployeeName : "Unknown",
                    Category = "Leave",
                    Details = l.LeaveType != null ? l.LeaveType.Name : "Leave",
                    Reason = l.Reason,
                    Status = l.Status
                })
                .ToListAsync();

            // 3. Get Manual Overrides from DailyAttendance (only those NOT linked to above records)
            var linkedAppNos = regularizations.Select(r => r.ApplicationNumber)
                .Concat(leaves.Select(l => l.ApplicationNumber))
                .Where(n => !string.IsNullOrEmpty(n))
                .ToHashSet();

            var manualOverrides = await _db.DailyAttendance
                .Include(d => d.Employee)
                .Where(d => d.RecordDate >= monthStart && d.RecordDate <= monthEnd && d.ApplicationNumber != null)
                .OrderBy(d => d.RecordDate)
                .ToListAsync();

            var attendanceItems = manualOverrides
                .Where(d => !linkedAppNos.Contains(d.ApplicationNumber))
                .Select(d => new ApplicationTrackItem
                {
                    Id = d.Id,
                    ApplicationNumber = d.ApplicationNumber,
                    Date = d.RecordDate,
                    EmployeeName = d.Employee != null ? d.Employee.EmployeeName : "Unknown",
                    Category = "Attendance Record",
                    Details = "Manual Entry / Override",
                    Status = "Active"
                })
                .ToList();

            // 4. Combine and Sort (Group by Month Descending, then Numeric ID Descending)
            Applications = regularizations.Concat(leaves).Concat(attendanceItems)
                .OrderByDescending(a => a.Date.Year)
                .ThenByDescending(a => a.Date.Month)
                .ThenByDescending(a => {
                    if (string.IsNullOrEmpty(a.ApplicationNumber)) return -1;
                    var parts = a.ApplicationNumber.Split(' ');
                    return parts.Length > 1 && int.TryParse(parts[^1], out var num) ? num : -1;
                })
                .ToList();
        }



        public async Task<IActionResult> OnPostClearAsync(long id, string category)
        {
            if (category == "Attendance Record")
            {
                var record = await _db.DailyAttendance.FindAsync(id);
                if (record != null)
                {
                    var date = record.RecordDate;
                    var empId = record.EmployeeId;

                    record.ApplicationNumber = null;
                    record.Status = null; // Let the processor re-calculate
                    record.Remarks = "Tracking cleared via report";
                    record.UpdatedAt = DateTime.Now;
                    await _db.SaveChangesAsync();
                    
                    // Re-process this day for this employee to restore calculated status
                    await _processor.ProcessDailyAttendanceAsync(date, empId);

                    // Auto-resync sequences
                    await _sequenceService.ResyncSequenceAsync(Year, Month);
                }
            }
            // For Leaves and Regularizations, the user should delete the actual request 
            // from their respective index pages to maintain audit trail.
            
            return RedirectToPage(new { Year, Month });
        }
    }
}
