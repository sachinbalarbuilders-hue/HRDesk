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

    public HolidaysController(BiometricAttendanceDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    public record HolidayDto(
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        string? Description,
        bool IsGlobal
    );

    [HttpGet]
    public async Task<IActionResult> GetHolidays([FromQuery] int? year = null, [FromQuery] string? search = null)
    {
        var targetYear = year ?? DateTime.Today.Year;
        var startOfYear = new DateOnly(targetYear, 1, 1);
        var endOfYear = new DateOnly(targetYear, 12, 31);

        var query = _db.Holidays
            .AsNoTracking()
            .Where(h => (h.StartDate >= startOfYear && h.StartDate <= endOfYear) ||
                        (h.EndDate >= startOfYear && h.EndDate <= endOfYear))
            .AsQueryable();

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
                applicableTo = h.IsGlobal ? "All Staff" : "Department Specific"
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

        var orgId = 1;
        var orgClaim = User.FindFirst("OrganizationId")?.Value;
        if (int.TryParse(orgClaim, out var parsedOrg)) orgId = parsedOrg;

        var holiday = new Holiday
        {
            HolidayName = dto.Name.Trim(),
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Description = dto.Description?.Trim(),
            IsGlobal = dto.IsGlobal,
            OrganizationId = orgId
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

        await _db.SaveChangesAsync();
        return Ok(new { message = "Holiday updated successfully.", id = holiday.Id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHoliday(int id)
    {
        var holiday = await _db.Holidays.FindAsync(id);
        if (holiday == null) return NotFound(new { message = "Holiday not found." });

        _db.Holidays.Remove(holiday);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Holiday removed successfully." });
    }
}
