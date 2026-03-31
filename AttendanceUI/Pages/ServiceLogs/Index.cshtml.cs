using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AttendanceUI.Pages.ServiceLogs
{
    [Authorize]
    public class IndexModel : PageModel
    {
        private const string LogFilePath = @"C:\HRServices\Z903AttendanceService\Logs\service.log";

        public bool LogFileExists { get; private set; }
        public string LogFileSizeDisplay { get; private set; } = "Unknown";
        public string LastModifiedDisplay { get; private set; } = "Unknown";

        public void OnGet()
        {
            try
            {
                var fi = new FileInfo(LogFilePath);
                LogFileExists = fi.Exists;

                if (fi.Exists)
                {
                    // Human-readable file size
                    long bytes = fi.Length;
                    LogFileSizeDisplay = bytes switch
                    {
                        < 1024 => $"{bytes} B",
                        < 1024 * 1024 => $"{bytes / 1024.0:F1} KB",
                        _ => $"{bytes / (1024.0 * 1024):F1} MB"
                    };

                    LastModifiedDisplay = fi.LastWriteTime.ToString("dd MMM yyyy, HH:mm:ss");
                }
            }
            catch
            {
                LogFileExists = false;
            }
        }
    }
}
