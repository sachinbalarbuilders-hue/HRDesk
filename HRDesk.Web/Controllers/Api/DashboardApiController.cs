using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Services;
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
    private readonly ICurrentTenantProvider _tenantProvider;

    public DashboardController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("summary")]
    [HttpGet("stats")]
    public async Task<IActionResult> GetDashboardSummary([FromQuery] int? branchId = null)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentYear = today.Year;
        var currentMonth = today.Month;
        var activeBranch = branchId ?? _tenantProvider.BranchId;

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
                    employeeId = emp?.EmployeeId,
                    employeeName = emp?.EmployeeName,
                    department = emp?.Department?.DepartmentName ?? "General",
                    designation = emp?.Designation?.DesignationName ?? "Staff",
                    photoPath = emp?.PhotoPath
                },
                todayAttendance = new
                {
                    date = today.ToString("yyyy-MM-dd"),
                    inTime = todayLog?.InTime?.ToString("HH:mm") ?? "--:--",
                    outTime = todayLog?.OutTime?.ToString("HH:mm") ?? "--:--",
                    status = todayLog?.Status ?? "Not Checked In",
                    shiftName = todayLog?.Shift?.ShiftName ?? "General Shift"
                },
                metrics = new
                {
                    monthPresentDays = monthPresentCount,
                    pendingLeaves = pendingLeavesCount
                }
            });
        }

        // Team / Organization Dashboard (Admin & Managers)
        bool isAdminOrSuper = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

        var empQuery = _db.Employees.AsNoTracking().Where(e => e.Status == null || e.Status.ToLower() == "active");
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            empQuery = empQuery.Where(e => e.BranchId == activeBranch.Value);
        }

        if (!isAdminOrSuper)
        {
            empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.EmployeesView);
        }

        var totalActive = await empQuery.CountAsync();

        var attQuery = _db.DailyAttendance.AsNoTracking().Where(a => a.RecordDate == today);
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            attQuery = attQuery.Where(a => a.BranchId == activeBranch.Value || (a.Employee != null && a.Employee.BranchId == activeBranch.Value));
        }

        if (!isAdminOrSuper)
        {
            attQuery = await _permissionService.ApplyAttendanceScopeAsync(attQuery, User, AppPermissions.Keys.AttendanceView);
        }

        var presentCount = await attQuery.CountAsync(a => a.Status == "Present" || a.InTime != null);
        var absentCount = await attQuery.CountAsync(a => a.Status == "Absent");
        var lateCount = await attQuery.CountAsync(a => a.IsLate);

        var leaveQuery = _db.LeaveApplications.AsNoTracking();
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            leaveQuery = leaveQuery.Where(l => l.Employee != null && l.Employee.BranchId == activeBranch.Value);
        }

        if (!isAdminOrSuper)
        {
            leaveQuery = await _permissionService.ApplyLeaveScopeAsync(leaveQuery, User, AppPermissions.Keys.LeavesView);
        }

        var onLeaveCount = await leaveQuery
            .CountAsync(la => la.Status == "Approved" && la.StartDate <= today && la.EndDate >= today);

        var pendingLeaveApprovals = await leaveQuery
            .Include(la => la.Employee)
            .Include(la => la.LeaveType)
            .Where(la => la.Status == "Pending")
            .OrderByDescending(la => la.CreatedAt)
            .Take(5)
            .Select(la => new
            {
                id = la.Id,
                employeeId = la.EmployeeId,
                employeeName = la.Employee != null ? la.Employee.EmployeeName : "Employee",
                leaveType = la.LeaveType != null ? la.LeaveType.Name : "Leave",
                startDate = la.StartDate.ToString("yyyy-MM-dd"),
                endDate = la.EndDate.ToString("yyyy-MM-dd"),
                days = la.TotalDays,
                reason = la.Reason
            })
            .ToListAsync();

        var recentPunches = await attQuery
            .Where(a => a.InTime != null)
            .OrderByDescending(a => a.InTime)
            .Take(10)
            .Select(a => new
            {
                employeeId = a.EmployeeId,
                employeeName = a.Employee != null ? a.Employee.EmployeeName : "Staff",
                department = (a.Employee != null && a.Employee.Department != null) ? a.Employee.Department.DepartmentName : "General",
                inTime = a.InTime != null ? a.InTime.Value.ToString("HH:mm") : "--:--",
                outTime = a.OutTime != null ? a.OutTime.Value.ToString("HH:mm") : "--:--",
                status = a.Status ?? "Present",
                isLate = a.IsLate
            })
            .ToListAsync();

        var departmentCounts = await empQuery
            .GroupBy(e => e.Department != null ? e.Department.DepartmentName : "General")
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
                pendingApprovals = pendingLeaveApprovals.Count
            },
            recentPunches,
            pendingApprovals = pendingLeaveApprovals,
            departmentCounts
        });
    }

    [HttpGet("celebrations")]
    public async Task<IActionResult> GetCelebrations([FromQuery] int? branchId = null)
    {
        var today = DateTime.Today;
        var currentMonth = today.Month;
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var baseEmpQuery = _db.Employees.AsNoTracking().Where(e => e.Status == null || e.Status.ToLower() == "active");
        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            baseEmpQuery = baseEmpQuery.Where(e => e.BranchId == activeBranch.Value);
        }

        var birthdays = await baseEmpQuery
            .Where(e => e.DateOfBirth.HasValue && e.DateOfBirth.Value.Month == currentMonth)
            .OrderBy(e => e.DateOfBirth!.Value.Day)
            .Take(5)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                Department = e.Department != null ? e.Department.DepartmentName : "General",
                Day = e.DateOfBirth!.Value.Day,
                Type = "Birthday"
            })
            .ToListAsync();

        var anniversaries = await baseEmpQuery
            .Where(e => e.JoiningDate.HasValue && e.JoiningDate.Value.Month == currentMonth && e.JoiningDate.Value.Year < today.Year)
            .OrderBy(e => e.JoiningDate!.Value.Day)
            .Take(5)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                Department = e.Department != null ? e.Department.DepartmentName : "General",
                Day = e.JoiningDate!.Value.Day,
                Years = today.Year - e.JoiningDate!.Value.Year,
                Type = "Work Anniversary"
            })
            .ToListAsync();

        return Ok(new { birthdays, anniversaries });
    }
}
