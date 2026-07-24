using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Notifications
{
    /// <summary>
    /// Higher-level business service that abstracts away the notification provider.
    /// In the future, this can inject multiple providers (Email, SMS, WhatsApp) and orchestrate them.
    /// </summary>
    public class WhatsAppNotificationService
    {
        private readonly IWhatsAppProvider _whatsAppProvider;
        private readonly ILogger<WhatsAppNotificationService> _logger;

        public WhatsAppNotificationService(IWhatsAppProvider whatsAppProvider, ILogger<WhatsAppNotificationService> logger)
        {
            _whatsAppProvider = whatsAppProvider;
            _logger = logger;
        }

        public async Task<bool> SendBulkPayslipAsync(string phoneNumber, string base64Pdf, string fileName)
        {
            // Optional: Add business logic here (e.g. check if phone number is valid before calling provider)
            _logger.LogInformation("Attempting to send payslip to {Phone}", phoneNumber);
            return await _whatsAppProvider.SendDocumentAsync(phoneNumber, string.Empty, base64Pdf, fileName, "application/pdf");
        }

        public async Task<bool> SendLeaveApprovalAlertAsync(string phoneNumber, string employeeName, string leaveType, string date)
        {
            var message = $"Hello {employeeName},\n\nYour {leaveType} application for {date} has been approved.\n\nThank you,\nHR Desk";
            return await _whatsAppProvider.SendMessageAsync(phoneNumber, message);
        }
        
        public async Task<bool> SendGenericAlertAsync(string phoneNumber, string message)
        {
            return await _whatsAppProvider.SendMessageAsync(phoneNumber, message);
        }

        public async Task<(string Status, string QrCode, int QueueLength)> GetStatusAsync()
        {
            return await _whatsAppProvider.GetStatusAsync();
        }

        public async Task<bool> ResetSessionAsync()
        {
            return await _whatsAppProvider.ResetSessionAsync();
        }
    }
}
