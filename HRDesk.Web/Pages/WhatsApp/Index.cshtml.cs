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

        [TempData]
        public string? Message { get; set; }

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

        public async Task<IActionResult> OnPostResetSessionAsync()
        {
            await _whatsAppService.ResetSessionAsync();
            Message = "WhatsApp session reset request sent. Please wait a few seconds and refresh for a new QR code.";
            return RedirectToPage();
        }
    }
}
