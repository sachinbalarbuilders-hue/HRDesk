using System.Threading.Tasks;
using AttendanceUI.Services.Notifications;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AttendanceUI.Pages.WhatsApp
{
    public class IndexModel : PageModel
    {
        private readonly WhatsAppNotificationService _whatsAppService;

        public IndexModel(WhatsAppNotificationService whatsAppService)
        {
            _whatsAppService = whatsAppService;
        }

        public string WhatsAppStatus { get; set; } = string.Empty;
        public string QrCodeData { get; set; } = string.Empty;
        public int QueueLength { get; set; } = 0;

        public async Task OnGetAsync()
        {
            var statusInfo = await _whatsAppService.GetStatusAsync();
            WhatsAppStatus = statusInfo.Status;
            QrCodeData = statusInfo.QrCode;
            QueueLength = statusInfo.QueueLength;
        }
    }
}
