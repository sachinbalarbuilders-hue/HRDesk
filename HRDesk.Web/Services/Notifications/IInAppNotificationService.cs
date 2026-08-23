using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Notifications;

public interface IInAppNotificationService
{
    Task<InAppNotification> NotifyUserAsync(
        int organizationId,
        int userId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null,
        int? employeeId = null);

    Task<int> NotifyRoleAsync(
        int organizationId,
        string roleName,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null);

    Task<int> NotifyAdminsAsync(
        int organizationId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null);

    Task<int> BroadcastAsync(
        int organizationId,
        string title,
        string message,
        string type = "System",
        string severity = "info",
        string? linkUrl = null);

    Task<(List<InAppNotification> items, int unreadCount, int totalCount)> GetNotificationsForUserAsync(
        int organizationId,
        int userId,
        string? userRole,
        int? employeeId,
        bool unreadOnly = false,
        int page = 1,
        int pageSize = 20);

    Task<bool> MarkAsReadAsync(long notificationId, int userId, int organizationId);

    Task<int> MarkAllAsReadAsync(int userId, int organizationId, string? userRole = null, int? employeeId = null);

    Task<bool> DeleteNotificationAsync(long notificationId, int userId, int organizationId);
}
