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
    private readonly IArchiveService _archive;

    public AnnouncementsController(
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
        [FromQuery] bool? activeOnly = null,
        [FromQuery] string? archiveStatus = "active")
    {
        var activeBranch = branchId ?? _tenantProvider.BranchId;
        
        IQueryable<Announcement> query;
        if (archiveStatus == "all" || archiveStatus == "archived")
        {
            query = _db.Announcements
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Include(a => a.Branch)
                .Include(a => a.CreatedByUser);

            if (archiveStatus == "archived")
                query = query.Where(a => a.ArchivedAt != null);
        }
        else
        {
            query = _db.Announcements
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Include(a => a.Branch)
                .Include(a => a.CreatedByUser)
                .Where(a => a.ArchivedAt == null);
        }

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
                archivedAt = a.ArchivedAt,
                branchId = a.BranchId,
                branchName = a.Branch != null ? a.Branch.Name : "All Branches",
                createdAt = a.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                createdByName = a.CreatedByUser != null ? a.CreatedByUser.FullName : "Admin",
                imagePath = a.ImagePath != null ? $"/api/announcements/media/{a.ImagePath}" : null,
                videoPath = a.VideoPath != null ? $"/api/announcements/media/{a.VideoPath}" : null
            })
            .ToListAsync();

        return Ok(new { totalCount = list.Count, items = list });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetAnnouncement(int id)
    {
        var item = await _db.Announcements
            .IgnoreQueryFilters()
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
            archivedAt = item.ArchivedAt,
            branchId = item.BranchId,
            branchName = item.Branch != null ? item.Branch.Name : "All Branches",
            createdAt = item.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            createdByName = item.CreatedByUser != null ? item.CreatedByUser.FullName : "Admin",
            imagePath = item.ImagePath != null ? $"/api/announcements/media/{item.ImagePath}" : null,
            videoPath = item.VideoPath != null ? $"/api/announcements/media/{item.VideoPath}" : null
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

    /// <summary>
    /// "Delete" from the main list → archive. "Delete" from the Archive view → ?permanent=true.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteAnnouncement(int id, [FromQuery] bool permanent = false)
    {
        var result = permanent
            ? await _archive.PermanentDeleteAsync<Announcement>(id)
            : await _archive.ArchiveAsync<Announcement>(id);

        return FromArchive(result);
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> RestoreAnnouncement(int id)
        => FromArchive(await _archive.RestoreAsync<Announcement>(id));

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

    // ── Media Upload ──────────────────────────────────────────────
    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
    private static readonly HashSet<string> AllowedVideoExts = new(StringComparer.OrdinalIgnoreCase) { ".mp4", ".webm", ".mov" };
    private const long MaxImageSize = 10 * 1024 * 1024;  // 10 MB
    private const long MaxVideoSize = 50 * 1024 * 1024;  // 50 MB

    [HttpPost("{id:int}/media")]
    [RequestSizeLimit(60 * 1024 * 1024)] // 60 MB overall limit
    public async Task<IActionResult> UploadMedia(int id, IFormFile file)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item == null) return NotFound(new { message = "Announcement not found." });

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        bool isImage = AllowedImageExts.Contains(ext);
        bool isVideo = AllowedVideoExts.Contains(ext);

        if (!isImage && !isVideo)
            return BadRequest(new { message = $"Unsupported file type '{ext}'. Allowed: {string.Join(", ", AllowedImageExts.Union(AllowedVideoExts))}" });

        if (isImage && file.Length > MaxImageSize)
            return BadRequest(new { message = "Image must be under 10 MB." });

        if (isVideo && file.Length > MaxVideoSize)
            return BadRequest(new { message = "Video must be under 50 MB." });

        var mediaDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "AnnouncementMedia");
        Directory.CreateDirectory(mediaDir);

        var uniqueName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(mediaDir, uniqueName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        if (isImage)
        {
            // Delete old image if exists
            if (!string.IsNullOrWhiteSpace(item.ImagePath))
            {
                var oldPath = Path.Combine(mediaDir, item.ImagePath);
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }
            item.ImagePath = uniqueName;
        }
        else
        {
            // Delete old video if exists
            if (!string.IsNullOrWhiteSpace(item.VideoPath))
            {
                var oldPath = Path.Combine(mediaDir, item.VideoPath);
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }
            item.VideoPath = uniqueName;
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"{(isImage ? "Image" : "Video")} uploaded successfully.",
            imagePath = item.ImagePath,
            videoPath = item.VideoPath
        });
    }

    [HttpDelete("{id:int}/media/{type}")]
    public async Task<IActionResult> DeleteMedia(int id, string type)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item == null) return NotFound(new { message = "Announcement not found." });

        var mediaDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "AnnouncementMedia");

        if (type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(item.ImagePath))
        {
            var path = Path.Combine(mediaDir, item.ImagePath);
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            item.ImagePath = null;
        }
        else if (type.Equals("video", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(item.VideoPath))
        {
            var path = Path.Combine(mediaDir, item.VideoPath);
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            item.VideoPath = null;
        }
        else
        {
            return BadRequest(new { message = "No media of that type to delete." });
        }

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"{type} removed." });
    }

    [HttpGet("media/{fileName}")]
    [AllowAnonymous]
    public IActionResult GetMedia(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Contains(".."))
            return BadRequest();

        var mediaDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "AnnouncementMedia");
        var filePath = Path.Combine(mediaDir, fileName);

        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".mov" => "video/quicktime",
            _ => "application/octet-stream"
        };

        return PhysicalFile(filePath, contentType, enableRangeProcessing: true);
    }
}
