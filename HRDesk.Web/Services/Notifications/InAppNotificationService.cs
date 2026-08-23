using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Notifications;

public class InAppNotificationService : IInAppNotificationService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<InAppNotificationService> _logger;

    public InAppNotificationService(BiometricAttendanceDbContext db, ILogger<InAppNotificationService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<InAppNotification> NotifyUserAsync(
        int organizationId,
        int userId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null,
        int? employeeId = null)
    {
        var notification = new InAppNotification
        {
            OrganizationId = organizationId,
            UserId = userId,
            EmployeeId = employeeId,
            Title = title.Trim(),
            Message = message.Trim(),
            Type = type,
            Severity = severity,
            LinkUrl = linkUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.InAppNotifications.Add(notification);
        await _db.SaveChangesAsync();
        return notification;
    }

    public async Task<int> NotifyRoleAsync(
        int organizationId,
        string roleName,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null)
    {
        var notification = new InAppNotification
        {
            OrganizationId = organizationId,
            RoleScope = roleName,
            Title = title.Trim(),
            Message = message.Trim(),
            Type = type,
            Severity = severity,
            LinkUrl = linkUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.InAppNotifications.Add(notification);
        await _db.SaveChangesAsync();
        return 1;
    }

    public async Task<int> NotifyAdminsAsync(
        int organizationId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null)
    {
        return await NotifyRoleAsync(organizationId, "Admin", title, message, type, severity, linkUrl);
    }

    public async Task<int> BroadcastAsync(
        int organizationId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null)
    {
        var notification = new InAppNotification
        {
            OrganizationId = organizationId,
            RoleScope = "All",
            Title = title.Trim(),
            Message = message.Trim(),
            Type = type,
            Severity = severity,
            LinkUrl = linkUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.InAppNotifications.Add(notification);
        await _db.SaveChangesAsync();
        return 1;
    }

    public async Task<(List<InAppNotification> items, int unreadCount, int totalCount)> GetNotificationsForUserAsync(
        int organizationId,
        int userId,
        string? userRole,
        int? employeeId,
        bool unreadOnly = false,
        int page = 1,
        int pageSize = 20)
    {
        var query = _db.InAppNotifications
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(n => n.OrganizationId == organizationId);

        // Filter notifications addressed to this specific user, or their role, or broadcast to all
        query = query.Where(n =>
            n.UserId == userId ||
            (employeeId.HasValue && n.EmployeeId == employeeId.Value) ||
            n.RoleScope == "All" ||
            (!string.IsNullOrEmpty(userRole) && n.RoleScope == userRole) ||
            ((userRole == "Admin" || userRole == "SuperAdmin" || userRole == "Super Admin") && (n.RoleScope == "Admin" || n.RoleScope == "SuperAdmin")));

        var unreadCount = await query.CountAsync(n => !n.IsRead);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync();

        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 100) pageSize = 100;
        if (page <= 0) page = 1;

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, unreadCount, totalCount);
    }

    public async Task<bool> MarkAsReadAsync(long notificationId, int userId, int organizationId)
    {
        var notification = await _db.InAppNotifications
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.OrganizationId == organizationId);

        if (notification == null) return false;

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> MarkAllAsReadAsync(int userId, int organizationId, string? userRole = null, int? employeeId = null)
    {
        var query = _db.InAppNotifications
            .IgnoreQueryFilters()
            .Where(n => n.OrganizationId == organizationId && !n.IsRead);

        query = query.Where(n =>
            n.UserId == userId ||
            (employeeId.HasValue && n.EmployeeId == employeeId.Value) ||
            n.RoleScope == "All" ||
            (!string.IsNullOrEmpty(userRole) && n.RoleScope == userRole) ||
            ((userRole == "Admin" || userRole == "SuperAdmin" || userRole == "Super Admin") && (n.RoleScope == "Admin" || n.RoleScope == "SuperAdmin")));

        var unreadItems = await query.ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var item in unreadItems)
        {
            item.IsRead = true;
            item.ReadAt = now;
        }

        return await _db.SaveChangesAsync();
    }

    public async Task<bool> DeleteNotificationAsync(long notificationId, int userId, int organizationId)
    {
        var notification = await _db.InAppNotifications
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.OrganizationId == organizationId);

        if (notification == null) return false;

        _db.InAppNotifications.Remove(notification);
        await _db.SaveChangesAsync();
        return true;
    }
}
