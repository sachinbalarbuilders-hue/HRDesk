using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsApiController : ControllerBase
{
    private readonly IInAppNotificationService _notificationService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<NotificationsApiController> _logger;

    public NotificationsApiController(
        IInAppNotificationService notificationService,
        ICurrentTenantProvider tenantProvider,
        BiometricAttendanceDbContext db,
        ILogger<NotificationsApiController> logger)
    {
        _notificationService = notificationService;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    private int CurrentUserId
    {
        get
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value ?? User.FindFirst("id")?.Value;
            return int.TryParse(claim, out int id) ? id : 0;
        }
    }

    private string CurrentUserRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "User";

    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        int userId = CurrentUserId;
        string userRole = CurrentUserRole;

        // Lookup employeeId if linked
        int? employeeId = null;
        if (userId > 0)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            employeeId = user?.EmployeeId;
        }

        var (items, unreadCount, totalCount) = await _notificationService.GetNotificationsForUserAsync(
            orgId, userId, userRole, employeeId, unreadOnly, page, pageSize);

        var projected = items.Select(n => new
        {
            id = n.Id,
            title = n.Title,
            message = n.Message,
            type = n.Type,
            severity = n.Severity,
            linkUrl = n.LinkUrl,
            isRead = n.IsRead,
            createdAt = n.CreatedAt,
            timeAgo = GetTimeAgo(n.CreatedAt)
        });

        return Ok(new
        {
            items = projected,
            unreadCount,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(long id)
    {
        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        int userId = CurrentUserId;
        string userRole = CurrentUserRole;

        var success = await _notificationService.MarkAsReadAsync(id, userId, orgId);
        if (!success)
        {
            return NotFound(new { message = "Notification not found." });
        }

        int? employeeId = null;
        if (userId > 0)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            employeeId = user?.EmployeeId;
        }

        var (_, unreadCount, _) = await _notificationService.GetNotificationsForUserAsync(
            orgId, userId, userRole, employeeId, unreadOnly: false, page: 1, pageSize: 1);

        return Ok(new { success = true, unreadCount, message = "Notification marked as read." });
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        int userId = CurrentUserId;
        string userRole = CurrentUserRole;

        int? employeeId = null;
        if (userId > 0)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            employeeId = user?.EmployeeId;
        }

        var count = await _notificationService.MarkAllAsReadAsync(userId, orgId, userRole, employeeId);
        return Ok(new { success = true, unreadCount = 0, markedCount = count, message = "All notifications marked as read." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(long id)
    {
        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        int userId = CurrentUserId;

        var success = await _notificationService.DeleteNotificationAsync(id, userId, orgId);
        if (!success)
        {
            return NotFound(new { message = "Notification not found." });
        }

        return Ok(new { success = true, message = "Notification deleted." });
    }

    [HttpPost("broadcast")]
    [Authorize(Roles = "SuperAdmin,Admin,Super Admin")]
    public async Task<IActionResult> BroadcastNotification([FromBody] BroadcastNotificationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
        {
            return BadRequest(new { message = "Title and message are required." });
        }

        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        if (dto.OrganizationId.HasValue && dto.OrganizationId.Value > 0 && (User.IsInRole("SuperAdmin") || User.IsInRole("Super Admin")))
        {
            orgId = dto.OrganizationId.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.TargetRole) && dto.TargetRole != "All")
        {
            await _notificationService.NotifyRoleAsync(
                orgId, dto.TargetRole, dto.Title, dto.Message, dto.Type ?? "System", dto.Severity ?? "info", dto.LinkUrl);
        }
        else
        {
            await _notificationService.BroadcastAsync(
                orgId, dto.Title, dto.Message, dto.Type ?? "System", dto.Severity ?? "info", dto.LinkUrl);
        }

        return Ok(new { success = true, message = "Notification broadcast sent successfully." });
    }

    private static string GetTimeAgo(DateTime utcDate)
    {
        var span = DateTime.UtcNow - utcDate;
        if (span.TotalSeconds < 60) return "Just now";
        if (span.TotalMinutes < 60) return $"{(int)span.TotalMinutes}m ago";
        if (span.TotalHours < 24) return $"{(int)span.TotalHours}h ago";
        if (span.TotalDays < 7) return $"{(int)span.TotalDays}d ago";
        return utcDate.ToLocalTime().ToString("dd MMM yyyy");
    }

    public record BroadcastNotificationDto(
        string Title,
        string Message,
        string? Type,
        string? Severity,
        string? LinkUrl,
        string? TargetRole,
        int? OrganizationId
    );
}
