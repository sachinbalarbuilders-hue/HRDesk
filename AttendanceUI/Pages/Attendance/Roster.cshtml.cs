using System;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Attendance;

public class RosterModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public RosterModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public List<Employee> Employees { get; set; } = new();
    public List<Shift> Shifts { get; set; } = new();
    public List<ShiftRoster> RosterEntries { get; set; } = new();
    public List<LeaveApplication> LeaveApplications { get; set; } = new();
    public List<DailyAttendance> DailyAttendanceRecords { get; set; } = new();
    
    [BindProperty(SupportsGet = true)]
    public DateOnly? StartDate { get; set; }

    public DateOnly EndDate => (StartDate ?? DateOnly.FromDateTime(DateTime.Now)).AddDays(6);

    public async Task OnGetAsync()
    {
        if (!StartDate.HasValue)
        {
            // Start from previous Monday or today if today is Monday
            var today = DateOnly.FromDateTime(DateTime.Now);
            int diff = (7 + (today.DayOfWeek - DayOfWeek.Monday)) % 7;
            StartDate = today.AddDays(-1 * diff);
        }

        Shifts = await _db.Shifts.Where(s => s.Status == "active").ToListAsync();
        Employees = await _db.Employees
            .Include(e => e.Department)
            .Where(e => e.Status == "active")
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();
        
        RosterEntries = await _db.ShiftRosters
            .Include(r => r.Shift)
            .Where(r => r.RosterDate >= StartDate && r.RosterDate <= EndDate)
            .ToListAsync();

        LeaveApplications = await _db.LeaveApplications
            .Include(l => l.LeaveType)
            .Where(l => l.StartDate <= EndDate && l.EndDate >= StartDate && l.Status == "Approved")
            .ToListAsync();

        DailyAttendanceRecords = await _db.DailyAttendance
            .Where(a => a.RecordDate >= StartDate && a.RecordDate <= EndDate)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostGenerateAsync(string fromDate, string toDate, bool overwrite = false, int? employeeId = null)
    {
        var start = DateOnly.Parse(fromDate);
        var end = DateOnly.Parse(toDate);

        var query = _db.Employees.Where(e => e.Status == "active");
        if (employeeId.HasValue)
        {
            query = query.Where(e => e.EmployeeId == employeeId.Value);
        }
        var targetEmployees = await query.ToListAsync();
        
        foreach (var emp in targetEmployees)
        {
            for (var date = start; date <= end; date = date.AddDays(1))
            {
                var existing = await _db.ShiftRosters
                    .FirstOrDefaultAsync(r => r.EmployeeId == emp.EmployeeId && r.RosterDate == date);

                bool isWeekoff = !string.IsNullOrWhiteSpace(emp.Weekoff) && 
                    emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase);

                if (existing == null)
                {
                    _db.ShiftRosters.Add(new ShiftRoster
                    {
                        EmployeeId = emp.EmployeeId,
                        ShiftId = emp.ShiftId,
                        RosterDate = date,
                        IsWeekOff = isWeekoff
                    });
                }
                else if (overwrite)
                {
                    existing.ShiftId = emp.ShiftId;
                    existing.IsWeekOff = isWeekoff;
                }
            }
        }

        await _db.SaveChangesAsync();
        string targetName = employeeId.HasValue ? targetEmployees.FirstOrDefault()?.EmployeeName : "all active employees";
        TempData["SuccessMessage"] = $"Roster generated for {targetName} from {start:dd/MM/yyyy} to {end:dd/MM/yyyy}.";
        return RedirectToPage(new { StartDate = start.ToString("yyyy-MM-dd") });
    }

    public async Task<JsonResult> OnPostUpdateCellAsync(int empId, string dateStr, int? shiftId, bool isWeekOff)
    {
        var date = DateOnly.Parse(dateStr);
        var entry = await _db.ShiftRosters
            .FirstOrDefaultAsync(r => r.EmployeeId == empId && r.RosterDate == date);

        if (entry == null)
        {
            entry = new ShiftRoster { EmployeeId = empId, RosterDate = date };
            _db.ShiftRosters.Add(entry);
        }

        entry.ShiftId = shiftId;
        entry.IsWeekOff = isWeekOff;
        
        await _db.SaveChangesAsync();
        return new JsonResult(new { success = true });
    }
}
