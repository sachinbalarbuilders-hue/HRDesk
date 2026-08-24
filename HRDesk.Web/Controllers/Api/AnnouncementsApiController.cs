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
public class AnnouncementsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public AnnouncementsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    public record AnnouncementDto(
        string Title,
        string Message,
        string? Category,
        string? Priority,
        DateOnly? StartDate,
        DateOnly? EndDate,
        bool? IsPinned,
        bool? IsActive,
        int? BranchId
    );

    [HttpGet]
    public async Task<IActionResult> GetAnnouncements(
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] int? branchId = null,
        [FromQuery] bool? activeOnly = null)
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        var query = _db.Announcements
            .AsNoTracking()
            .Include(a => a.Branch)
            .Include(a => a.CreatedByUser)
            .AsQueryable();

        if (activeBranch.HasValue && activeBranch.Value > 0)
        {
            query = query.Where(a => a.BranchId == activeBranch.Value || a.BranchId == null);
        }

        if (activeOnly == true)
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            query = query.Where(a => a.IsActive && a.StartDate <= today && (a.EndDate == null || a.EndDate >= today));
        }

        if (!string.IsNullOrWhiteSpace(category) && category.ToLower() != "all")
        {
            var c = category.Trim().ToLower();
            query = query.Where(a => a.Category.ToLower() == c);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a => a.Title.ToLower().Contains(s) || a.Message.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(a => a.IsPinned)
            .ThenByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                id = a.Id,
                title = a.Title,
                message = a.Message,
                category = a.Category,
                priority = a.Priority,
                startDate = a.StartDate.ToString("yyyy-MM-dd"),
                endDate = a.EndDate != null ? a.EndDate.Value.ToString("yyyy-MM-dd") : null,
                isPinned = a.IsPinned,
                isActive = a.IsActive,
                branchId = a.BranchId,
                branchName = a.Branch != null ? a.Branch.Name : "All Branches",
                createdAt = a.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                createdByName = a.CreatedByUser != null ? a.CreatedByUser.FullName : "Admin"
            })
            .ToListAsync();

        return Ok(new { totalCount = list.Count, items = list });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetAnnouncement(int id)
    {
        var item = await _db.Announcements
            .AsNoTracking()
            .Include(a => a.Branch)
            .Include(a => a.CreatedByUser)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (item == null) return NotFound(new { message = "Announcement not found." });

        return Ok(new
        {
            id = item.Id,
            title = item.Title,
            message = item.Message,
            category = item.Category,
            priority = item.Priority,
            startDate = item.StartDate.ToString("yyyy-MM-dd"),
            endDate = item.EndDate != null ? item.EndDate.Value.ToString("yyyy-MM-dd") : null,
            isPinned = item.IsPinned,
            isActive = item.IsActive,
            branchId = item.BranchId,
            branchName = item.Branch != null ? item.Branch.Name : "All Branches",
            createdAt = item.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            createdByName = item.CreatedByUser != null ? item.CreatedByUser.FullName : "Admin"
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateAnnouncement([FromBody] AnnouncementDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Title is required." });

        if (string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { message = "Message body is required." });

        int? currentUserId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : null;

        var announcement = new Announcement
        {
            Title = dto.Title.Trim(),
            Message = dto.Message.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "General" : dto.Category.Trim(),
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Normal" : dto.Priority.Trim(),
            StartDate = dto.StartDate ?? DateOnly.FromDateTime(DateTime.Today),
            EndDate = dto.EndDate,
            IsPinned = dto.IsPinned ?? false,
            IsActive = dto.IsActive ?? true,
            BranchId = dto.BranchId > 0 ? dto.BranchId : null,
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Announcements.Add(announcement);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Announcement posted successfully.", id = announcement.Id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateAnnouncement(int id, [FromBody] AnnouncementDto dto)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item == null) return NotFound(new { message = "Announcement not found." });

        if (!string.IsNullOrWhiteSpace(dto.Title)) item.Title = dto.Title.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Message)) item.Message = dto.Message.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Category)) item.Category = dto.Category.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Priority)) item.Priority = dto.Priority.Trim();
        if (dto.StartDate.HasValue) item.StartDate = dto.StartDate.Value;
        item.EndDate = dto.EndDate;
        if (dto.IsPinned.HasValue) item.IsPinned = dto.IsPinned.Value;
        if (dto.IsActive.HasValue) item.IsActive = dto.IsActive.Value;
        item.BranchId = dto.BranchId > 0 ? dto.BranchId : null;
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Announcement updated successfully.", id = item.Id });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteAnnouncement(int id)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item == null) return NotFound(new { message = "Announcement not found." });

        _db.Announcements.Remove(item);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Announcement deleted successfully." });
    }

    [HttpPatch("{id:int}/pin")]
    public async Task<IActionResult> TogglePin(int id)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item == null) return NotFound(new { message = "Announcement not found." });

        item.IsPinned = !item.IsPinned;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = item.IsPinned ? "Announcement pinned." : "Announcement unpinned.", isPinned = item.IsPinned });
    }
}
