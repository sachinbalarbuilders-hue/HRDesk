using System.Threading.Tasks;

namespace HRDesk.Web.Services.Notifications
{
    public interface IWhatsAppProvider
    {
        Task<bool> SendMessageAsync(string phoneNumber, string message);
        Task<bool> SendDocumentAsync(string phoneNumber, string message, string base64Document, string fileName, string mimeType);
        Task<bool> SendImageAsync(string phoneOrGroupId, byte[] imageBytes, string fileName, string mimeType, string? caption = null);
        Task<bool> SendCelebrationAsync(string phoneOrGroupId, string employeeName, string eventType, string photoBase64, string? caption = null, int years = 0);
        Task<(string Status, string QrCode, int QueueLength)> GetStatusAsync();
        Task<bool> ResetSessionAsync();
    }
}
