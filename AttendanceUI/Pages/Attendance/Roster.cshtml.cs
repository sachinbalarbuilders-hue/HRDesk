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
    public List<Department> Departments { get; set; } = new();
    public List<ShiftRoster> RosterEntries { get; set; } = new();
    public List<LeaveApplication> LeaveApplications { get; set; } = new();
    public List<DailyAttendance> DailyAttendanceRecords { get; set; } = new();
    
    [BindProperty(SupportsGet = true)]
    public DateOnly? StartDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? SearchQuery { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? DeptId { get; set; }

    [BindProperty(SupportsGet = true)]
    public int PageNum { get; set; } = 1;

    public int PageSize { get; set; } = 50;
    public int TotalCount { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);

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
        Departments = await _db.Departments.Where(d => d.Status == "active").OrderBy(d => d.DepartmentName).ToListAsync();

        var query = _db.Employees
            .Include(e => e.Department)
            .Where(e => e.Status == "active");

        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            query = query.Where(e => e.EmployeeName.Contains(SearchQuery) || e.EmployeeId.ToString().Contains(SearchQuery));
        }

        if (DeptId.HasValue)
        {
            query = query.Where(e => e.DepartmentId == DeptId.Value);
        }

        TotalCount = await query.CountAsync();
        
        // Ensure PageNum is within valid range
        if (PageNum < 1) PageNum = 1;
        if (TotalPages > 0 && PageNum > TotalPages) PageNum = TotalPages;

        Employees = await query
            .OrderBy(e => e.EmployeeName)
            .Skip((PageNum - 1) * PageSize)
            .Take(PageSize)
            .ToListAsync();
        
        var employeeIds = Employees.Select(e => e.EmployeeId).ToList();

        RosterEntries = await _db.ShiftRosters
            .Include(r => r.Shift)
            .Where(r => employeeIds.Contains(r.EmployeeId) && r.RosterDate >= StartDate && r.RosterDate <= EndDate)
            .ToListAsync();

        LeaveApplications = await _db.LeaveApplications
            .Include(l => l.LeaveType)
            .Where(l => employeeIds.Contains(l.EmployeeId) && l.StartDate <= EndDate && l.EndDate >= StartDate && l.Status == "Approved")
            .ToListAsync();

        DailyAttendanceRecords = await _db.DailyAttendance
            .Where(a => employeeIds.Contains(a.EmployeeId) && a.RecordDate >= StartDate && a.RecordDate <= EndDate)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostGenerateAsync(string fromDate, string toDate, bool overwrite = false, List<int>? employeeIds = null, int? newShiftId = null, bool updateMasterShift = false)
    {
        var start = DateOnly.Parse(fromDate);
        var end = DateOnly.Parse(toDate);

        var query = _db.Employees.Where(e => e.Status == "active");
        if (employeeIds != null && employeeIds.Any())
        {
            query = query.Where(e => employeeIds.Contains(e.EmployeeId));
        }
        var targetEmployees = await query.ToListAsync();
        
        // Pre-load current active shift assignments for all target employees to avoid N+1 queries
        var targetEmpIds = targetEmployees.Select(e => e.EmployeeId).ToList();
        var currentAssignments = await _db.EmployeeShiftAssignments
            .Where(a => targetEmpIds.Contains(a.EmployeeId) && a.ToDate == null)
            .ToListAsync();

        // Pre-load all existing roster entries for the target range to avoid N+1 queries
        var existingRosters = await _db.ShiftRosters
            .Where(r => targetEmpIds.Contains(r.EmployeeId) && r.RosterDate >= start && r.RosterDate <= end)
            .ToListAsync();
        
        var rosterLookup = existingRosters.ToLookup(r => r.EmployeeId);

        foreach (var emp in targetEmployees)
        {
            var activeAssignment = currentAssignments.FirstOrDefault(a => a.EmployeeId == emp.EmployeeId);
            var empExistingRosters = rosterLookup[emp.EmployeeId].ToDictionary(r => r.RosterDate);

            // If user explicitly chose to update master shift
            if (updateMasterShift && newShiftId.HasValue && (activeAssignment == null || activeAssignment.ShiftId != newShiftId))
            {
                var effectiveDate = start; 

                // 1. Close current assignment
                if (activeAssignment != null)
                {
                    activeAssignment.ToDate = effectiveDate.AddDays(-1);
                }

                // 2. Open new assignment
                _db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
                {
                    EmployeeId = emp.EmployeeId,
                    ShiftId = newShiftId.Value,
                    FromDate = effectiveDate,
                    ToDate = null
                });

                // Update our local reference for the 'generationShiftId' logic below
                activeAssignment = new EmployeeShiftAssignment { ShiftId = newShiftId.Value }; 
            }

            // Decide which shift to use for this generation
            int? masterShiftId = activeAssignment?.ShiftId;
            int? generationShiftId = newShiftId ?? masterShiftId;

            for (var date = start; date <= end; date = date.AddDays(1))
            {
                empExistingRosters.TryGetValue(date, out var existing);

                bool isWeekoff = !string.IsNullOrWhiteSpace(emp.Weekoff) && 
                    emp.Weekoff.Trim().Equals(date.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase);

                if (existing == null)
                {
                    _db.ShiftRosters.Add(new ShiftRoster
                    {
                        EmployeeId = emp.EmployeeId,
                        ShiftId = generationShiftId,
                        RosterDate = date,
                        IsWeekOff = isWeekoff
                    });
                }
                else if (overwrite)
                {
                    existing.ShiftId = generationShiftId;
                    existing.IsWeekOff = isWeekoff;
                }
            }
        }

        await _db.SaveChangesAsync();
        string targetName = (employeeIds != null && employeeIds.Count == 1) 
            ? targetEmployees.FirstOrDefault()?.EmployeeName 
            : (employeeIds != null && employeeIds.Any() ? $"{targetEmployees.Count} employees" : "all active employees");
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
