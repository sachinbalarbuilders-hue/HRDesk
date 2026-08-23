using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeeLeaveController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;
    private readonly ICompOffService _compOffService;

    public EmployeeLeaveController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache,
        ICompOffService compOffService)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
        _compOffService = compOffService;
    }

    [HttpGet("{id}/leaves")]
    public async Task<IActionResult> GetEmployeeLeaves(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var empQuery = _db.Employees.AsNoTracking().Where(e => e.EmployeeId == id);
        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.EmployeesView);
        var employee = await empQuery.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or access restricted." });
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var startMonthSetting = await _db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s =>
                s.SettingKey == "LeaveYearStartMonth" &&
                s.OrganizationId == employee.OrganizationId &&
                s.BranchId == null);

        var startMonth = 11;
        if (int.TryParse(startMonthSetting?.SettingValue, out var parsedMonth) && parsedMonth is >= 1 and <= 12)
            startMonth = parsedMonth;

        var year = AttendanceProcessorService.GetLeaveYear(today, startMonth);
        var yearEndMonth = startMonth == 1 ? 12 : startMonth - 1;

        var allocations = await _db.LeaveAllocations
            .AsNoTracking()
            .Include(a => a.LeaveType)
            .Where(a => a.EmployeeId == id && a.Year == year)
            .OrderBy(a => a.LeaveType != null ? a.LeaveType.Name : "")
            .ToListAsync();

        var allocationDtos = allocations.Select(a => new
        {
            leaveTypeId = a.LeaveTypeId,
            code = a.LeaveType != null ? a.LeaveType.Code : "",
            name = a.LeaveType != null ? a.LeaveType.Name : "Leave",
            isPaid = a.LeaveType?.IsPaid ?? true,
            allocated = a.TotalAllocated,
            openingBalance = a.OpeningBalance,
            used = a.UsedCount,
            remaining = a.RemainingCount,
            textColor = a.LeaveType?.TextColor,
            backgroundColor = a.LeaveType?.BackgroundColor
        }).ToList();

        if (!allocationDtos.Any(a => string.Equals(a.code, "CO", StringComparison.OrdinalIgnoreCase)))
        {
            var coType = (await _cache.GetLeaveTypesAsync())
                .FirstOrDefault(t => string.Equals(t.Code, "CO", StringComparison.OrdinalIgnoreCase));
            var coBalance = await _compOffService.GetValidBalanceAsync(id, today);
            if (coType != null && coBalance > 0)
            {
                allocationDtos.Add(new
                {
                    leaveTypeId = coType.Id,
                    code = coType.Code,
                    name = coType.Name,
                    isPaid = coType.IsPaid,
                    allocated = coBalance,
                    openingBalance = 0m,
                    used = 0m,
                    remaining = coBalance,
                    textColor = (string?)coType.TextColor,
                    backgroundColor = (string?)coType.BackgroundColor
                });
            }
        }

        var history = await _db.LeaveApplications
            .AsNoTracking()
            .Include(la => la.LeaveType)
            .Where(la => la.EmployeeId == id)
            .OrderByDescending(la => la.StartDate)
            .ThenByDescending(la => la.Id)
            .Take(50)
            .Select(la => new
            {
                la.Id,
                leaveTypeName = la.LeaveType != null ? la.LeaveType.Name : "Leave",
                leaveTypeCode = la.LeaveType != null ? la.LeaveType.Code : "",
                la.StartDate,
                la.EndDate,
                la.TotalDays,
                la.DayType,
                la.Reason,
                la.Status
            })
            .ToListAsync();

        return Ok(new
        {
            employeeId = id,
            year,
            yearStartMonth = startMonth,
            yearEndMonth,
            allocations = allocationDtos,
            history
        });
    }
}
