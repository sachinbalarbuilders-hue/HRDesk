using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Notifications;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.WhatsApp
{
    public class IndexModel : PageModel
    {
        private readonly WhatsAppNotificationService _whatsAppService;
        private readonly BiometricAttendanceDbContext _db;

        public IndexModel(WhatsAppNotificationService whatsAppService, BiometricAttendanceDbContext db)
        {
            _whatsAppService = whatsAppService;
            _db = db;
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
