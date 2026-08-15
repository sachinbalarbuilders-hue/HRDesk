using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;

    public DashboardController(BiometricAttendanceDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentYear = today.Year;
        var currentMonth = today.Month;

        var currentEmpId = await _permissionService.GetCurrentEmployeeIdAsync(User);
        var empScope = await _permissionService.GetPermissionScopeAsync(User, AppPermissions.Keys.EmployeesView);

        bool isPersonalOnly = (empScope == AppPermissions.Scopes.Own) && !User.IsInRole("SuperAdmin") && !User.IsInRole("Admin");

        if (isPersonalOnly && currentEmpId.HasValue)
        {
            // Personal ESS Dashboard
            var emp = await _db.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .Include(e => e.Designation)
                .FirstOrDefaultAsync(e => e.EmployeeId == currentEmpId.Value);

            var todayLog = await _db.DailyAttendance
                .AsNoTracking()
                .Include(a => a.Shift)
                .FirstOrDefaultAsync(a => a.EmployeeId == currentEmpId.Value && a.RecordDate == today);

            var pendingLeavesCount = await _db.LeaveApplications
                .CountAsync(la => la.EmployeeId == currentEmpId.Value && la.Status == "Pending");

            var monthPresentCount = await _db.DailyAttendance
                .CountAsync(a => a.EmployeeId == currentEmpId.Value &&
                                 a.RecordDate.Year == currentYear &&
                                 a.RecordDate.Month == currentMonth &&
                                 a.Status == "Present");

            return Ok(new
            {
                isPersonal = true,
                employee = new
                {
                    emp?.EmployeeId,
                    emp?.EmployeeName,
                    Department = emp?.Department?.DepartmentName,
                    Designation = emp?.Designation?.DesignationName,
                    emp?.PhotoPath
                },
                todayAttendance = new
                {
                    date = today,
                    inTime = todayLog?.InTime?.ToString("HH:mm"),
                    outTime = todayLog?.OutTime?.ToString("HH:mm"),
                    status = todayLog?.Status ?? "Not Checked In",
                    shiftName = todayLog?.Shift?.ShiftName
                },
                metrics = new
                {
                    monthPresentDays = monthPresentCount,
                    pendingLeaves = pendingLeavesCount
                }
            });
        }

        // Team / Organization Dashboard (Admin & Managers)
        var scopedEmployees = _db.Employees.AsNoTracking().Where(e => e.Status == "active");
        scopedEmployees = await _permissionService.ApplyEmployeeScopeAsync(scopedEmployees, User, AppPermissions.Keys.EmployeesView);

        var totalActive = await scopedEmployees.CountAsync();
        var scopedEmpIds = await scopedEmployees.Select(e => e.EmployeeId).ToListAsync();

        var todayLogs = await _db.DailyAttendance
            .AsNoTracking()
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Where(a => a.RecordDate == today && scopedEmpIds.Contains(a.EmployeeId))
            .ToListAsync();

        var presentCount = todayLogs.Count(a => a.Status == "Present" || a.InTime.HasValue);
        var absentCount = todayLogs.Count(a => a.Status == "Absent");
        var lateCount = todayLogs.Count(a => a.IsLate);
        var onLeaveCount = await _db.LeaveApplications
            .CountAsync(la => la.Status == "Approved" && la.StartDate <= today && la.EndDate >= today && scopedEmpIds.Contains(la.EmployeeId));

        var pendingLeaveApprovals = await _db.LeaveApplications
            .CountAsync(la => la.Status == "Pending" && scopedEmpIds.Contains(la.EmployeeId));

        // Recent Punches (Last 10 punches)
        var recentPunches = todayLogs
            .Where(a => a.InTime.HasValue)
            .OrderByDescending(a => a.InTime)
            .Take(10)
            .Select(a => new
            {
                a.EmployeeId,
                EmployeeName = a.Employee.EmployeeName,
                Department = a.Employee.Department?.DepartmentName,
                InTime = a.InTime?.ToString("hh:mm tt"),
                OutTime = a.OutTime?.ToString("hh:mm tt"),
                a.Status,
                a.IsLate
            });

        // Department Headcount distribution
        var departmentCounts = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active" && scopedEmpIds.Contains(e.EmployeeId))
            .GroupBy(e => e.Department != null ? e.Department.DepartmentName : "Unassigned")
            .Select(g => new { name = g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            isPersonal = false,
            metrics = new
            {
                totalEmployees = totalActive,
                presentToday = presentCount,
                absentToday = absentCount,
                onLeaveToday = onLeaveCount,
                lateToday = lateCount,
                pendingApprovals = pendingLeaveApprovals
            },
            recentPunches,
            departmentCounts
        });
    }

    [HttpGet("celebrations")]
    public async Task<IActionResult> GetCelebrations()
    {
        var today = DateTime.Today;
        var currentMonth = today.Month;

        var birthdays = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active" && e.DateOfBirth.HasValue && e.DateOfBirth.Value.Month == currentMonth)
            .OrderBy(e => e.DateOfBirth!.Value.Day)
            .Take(5)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                Department = e.Department != null ? e.Department.DepartmentName : null,
                Day = e.DateOfBirth!.Value.Day,
                Type = "Birthday"
            })
            .ToListAsync();

        var anniversaries = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active" && e.JoiningDate.HasValue && e.JoiningDate.Value.Month == currentMonth && e.JoiningDate.Value.Year < today.Year)
            .OrderBy(e => e.JoiningDate!.Value.Day)
            .Take(5)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                Department = e.Department != null ? e.Department.DepartmentName : null,
                Day = e.JoiningDate!.Value.Day,
                Years = today.Year - e.JoiningDate!.Value.Year,
                Type = "Work Anniversary"
            })
            .ToListAsync();

        return Ok(new { birthdays, anniversaries });
    }
}
