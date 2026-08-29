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
public class HolidaysController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public HolidaysController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _archive = archive;
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

    public record HolidayDto(
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        string? Description,
        bool IsGlobal,
        int? BranchId = null
    );

    [HttpGet]
    public async Task<IActionResult> GetHolidays([FromQuery] int? year = null, [FromQuery] string? search = null, [FromQuery] int? branchId = null, [FromQuery] string status = "active")
    {
        if (status.Equals("archived", StringComparison.OrdinalIgnoreCase) || status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _db.BypassArchiveFilter = true;
        }

        var targetYear = year ?? DateTime.Today.Year;
        var startOfYear = new DateOnly(targetYear, 1, 1);
        var endOfYear = new DateOnly(targetYear, 12, 31);
        var activeBranch = branchId ?? _tenantProvider.BranchId;

        var query = _db.Holidays
            .AsNoTracking()
            .Where(h => (h.StartDate >= startOfYear && h.StartDate <= endOfYear) ||
                        (h.EndDate >= startOfYear && h.EndDate <= endOfYear))
            .AsQueryable();

        if (status.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(h => h.ArchivedAt != null);
        else if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(h => h.ArchivedAt == null);

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(h => h.BranchId == activeBranch.Value || h.BranchId == null);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(h => h.HolidayName.ToLower().Contains(s) || (h.Description != null && h.Description.ToLower().Contains(s)));
        }

        var holidays = await query
            .OrderBy(h => h.StartDate)
            .Select(h => new
            {
                id = h.Id,
                name = h.HolidayName,
                startDate = h.StartDate.ToString("yyyy-MM-dd"),
                endDate = h.EndDate.ToString("yyyy-MM-dd"),
                days = h.EndDate.DayNumber - h.StartDate.DayNumber + 1,
                isGlobal = h.IsGlobal,
                description = h.Description ?? "",
                applicableTo = h.IsGlobal ? "All Staff" : "Department Specific",
                branchId = h.BranchId,
                branchName = h.Branch != null ? h.Branch.Name : null,
                archivedAt = h.ArchivedAt
            })
            .ToListAsync();

        return Ok(new
        {
            year = targetYear,
            totalCount = holidays.Count,
            items = holidays
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateHoliday([FromBody] HolidayDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Holiday name is required." });
        }

        if (dto.EndDate < dto.StartDate)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = dto.BranchId ?? _tenantProvider.BranchId;

        var holiday = new Holiday
        {
            HolidayName = dto.Name.Trim(),
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Description = dto.Description?.Trim(),
            IsGlobal = dto.IsGlobal,
            OrganizationId = orgId,
            BranchId = targetBranch
        };

        _db.Holidays.Add(holiday);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Holiday created successfully.", id = holiday.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHoliday(int id, [FromBody] HolidayDto dto)
    {
        var holiday = await _db.Holidays.FindAsync(id);
        if (holiday == null) return NotFound(new { message = "Holiday not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) holiday.HolidayName = dto.Name.Trim();
        holiday.StartDate = dto.StartDate;
        holiday.EndDate = dto.EndDate;
        holiday.Description = dto.Description?.Trim();
        holiday.IsGlobal = dto.IsGlobal;
        if (dto.BranchId.HasValue) holiday.BranchId = dto.BranchId.Value > 0 ? dto.BranchId.Value : null;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Holiday updated successfully.", id = holiday.Id });
    }

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHoliday(int id, [FromQuery] bool permanent = false)
    {
        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<Holiday>(id));

        return FromArchive(await _archive.PermanentDeleteAsync<Holiday>(id, cascade: async _ =>
        {
            // holiday_employees has a restricted FK — clear the join rows first.
            var links = await _db.HolidayEmployees.Where(he => he.HolidayId == id).ToListAsync();
            _db.HolidayEmployees.RemoveRange(links);
        }));
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreHoliday(int id)
        => FromArchive(await _archive.RestoreAsync<Holiday>(id));
}
