using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly IReferenceDataCacheService _cache;

    public EmployeesController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        IReferenceDataCacheService cache)
    {
        _db = db;
        _permissionService = permissionService;
        _cache = cache;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.ReportingManager)
            .AsQueryable();

        // Apply Scope (All, Reporting, Department, Own)
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e =>
                e.EmployeeName.ToLower().Contains(s) ||
                (e.Phone != null && e.Phone.Contains(s)) ||
                e.EmployeeId.ToString().Contains(s));
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(e => e.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(e => e.Status != null && e.Status.ToLower() == status.ToLower());
        }

        var totalCount = await query.CountAsync();

        if (pageSize <= 0) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var items = await query
            .OrderBy(e => e.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                e.Phone,
                Department = e.Department != null ? e.Department.DepartmentName : null,
                DepartmentId = e.DepartmentId,
                Designation = e.Designation != null ? e.Designation.DesignationName : null,
                DesignationId = e.DesignationId,
                ReportingManager = e.ReportingManager != null ? e.ReportingManager.EmployeeName : null,
                e.ReportingManagerId,
                e.JoiningDate,
                e.Status,
                e.Weekoff,
                e.PhotoPath
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetEmployeeById(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
        {
            return Forbid();
        }

        var query = _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.ReportingManager)
            .Where(e => e.EmployeeId == id);

        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesView);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or access restricted." });
        }

        return Ok(new
        {
            employee.EmployeeId,
            employee.EmployeeName,
            employee.Phone,
            employee.DateOfBirth,
            employee.JoiningDate,
            employee.ResignationDate,
            employee.LastWorkingDate,
            employee.ProbationStart,
            employee.ProbationEnd,
            employee.Status,
            employee.Weekoff,
            employee.PhotoPath,
            Department = employee.Department != null ? employee.Department.DepartmentName : null,
            employee.DepartmentId,
            Designation = employee.Designation != null ? employee.Designation.DesignationName : null,
            employee.DesignationId,
            ReportingManager = employee.ReportingManager != null ? employee.ReportingManager.EmployeeName : null,
            employee.ReportingManagerId
        });
    }

    [HttpGet("lookups")]
    public async Task<IActionResult> GetLookups()
    {
        var departments = await _cache.GetDepartmentsAsync();
        var designations = await _cache.GetDesignationsAsync();
        var shifts = await _cache.GetShiftsAsync();

        var managers = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active")
            .OrderBy(e => e.EmployeeName)
            .Select(e => new { e.EmployeeId, e.EmployeeName, Department = e.Department != null ? e.Department.DepartmentName : null })
            .ToListAsync();

        return Ok(new
        {
            departments = departments.Select(d => new { DepartmentId = d.Id, d.DepartmentName }),
            designations = designations.Select(d => new { DesignationId = d.Id, d.DesignationName }),
            shifts = shifts.Select(s => new { ShiftId = s.Id, s.ShiftName, s.StartTime, s.EndTime }),
            managers
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateEmployee([FromBody] EmployeeCreateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesCreate))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.EmployeeName))
        {
            return BadRequest(new { message = "Employee name is required." });
        }

        var orgId = 1;
        var orgClaim = User.FindFirst("OrganizationId")?.Value;
        if (int.TryParse(orgClaim, out var parsedOrg)) orgId = parsedOrg;

        var employee = new Employee
        {
            EmployeeName = dto.EmployeeName.Trim(),
            Phone = dto.Phone?.Trim(),
            DateOfBirth = dto.DateOfBirth,
            JoiningDate = dto.JoiningDate ?? DateOnly.FromDateTime(DateTime.Today),
            DepartmentId = dto.DepartmentId,
            DesignationId = dto.DesignationId,
            ReportingManagerId = dto.ReportingManagerId,
            Weekoff = dto.Weekoff ?? "Sunday",
            Status = "active",
            OrganizationId = orgId
        };

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return CreatedAtAction(nameof(GetEmployeeById), new { id = employee.EmployeeId }, new { employee.EmployeeId, message = "Employee created successfully." });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEmployee(int id, [FromBody] EmployeeUpdateDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.EmployeeId == id);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesEdit);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or unauthorized to edit." });
        }

        if (!string.IsNullOrWhiteSpace(dto.EmployeeName)) employee.EmployeeName = dto.EmployeeName.Trim();
        employee.Phone = dto.Phone?.Trim();
        employee.DateOfBirth = dto.DateOfBirth;
        if (dto.JoiningDate.HasValue) employee.JoiningDate = dto.JoiningDate.Value;
        employee.LastWorkingDate = dto.LastWorkingDate;
        employee.ResignationDate = dto.ResignationDate;
        employee.ProbationStart = dto.ProbationStart;
        employee.ProbationEnd = dto.ProbationEnd;
        employee.DepartmentId = dto.DepartmentId;
        employee.DesignationId = dto.DesignationId;
        employee.ReportingManagerId = dto.ReportingManagerId;
        if (!string.IsNullOrWhiteSpace(dto.Weekoff)) employee.Weekoff = dto.Weekoff;

        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { message = "Employee updated successfully." });
    }

    [HttpPost("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var query = _db.Employees.Where(e => e.EmployeeId == id);
        query = await _permissionService.ApplyEmployeeScopeAsync(query, User, AppPermissions.Keys.EmployeesEdit);

        var employee = await query.FirstOrDefaultAsync();
        if (employee == null)
        {
            return NotFound(new { message = "Employee not found or unauthorized." });
        }

        var currentStatus = employee.Status?.ToLower() ?? "active";
        employee.Status = currentStatus == "active" ? "inactive" : "active";
        await _db.SaveChangesAsync();

        _permissionService.ClearCache();

        return Ok(new { status = employee.Status, message = $"Employee status set to {employee.Status}." });
    }

    public record EmployeeCreateDto(
        string EmployeeName,
        string? Phone,
        DateOnly? DateOfBirth,
        DateOnly? JoiningDate,
        int? DepartmentId,
        int? DesignationId,
        int? ReportingManagerId,
        string? Weekoff
    );

    public record EmployeeUpdateDto(
        string? EmployeeName,
        string? Phone,
        DateOnly? DateOfBirth,
        DateOnly? JoiningDate,
        DateOnly? ResignationDate,
        DateOnly? LastWorkingDate,
        DateOnly? ProbationStart,
        DateOnly? ProbationEnd,
        int? DepartmentId,
        int? DesignationId,
        int? ReportingManagerId,
        string? Weekoff
    );
}
