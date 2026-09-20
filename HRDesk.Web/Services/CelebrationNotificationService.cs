using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services
{
    public class CelebrationNotificationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<CelebrationNotificationService> _logger;
        private readonly IConfiguration _configuration;

        public CelebrationNotificationService(
            IServiceProvider serviceProvider, 
            ILogger<CelebrationNotificationService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Celebration Notification Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Now;
                
                // Trigger any time after 9:30 AM
                bool shouldTrigger = (now.Hour == 9 && now.Minute >= 30) || (now.Hour >= 10);

                if (shouldTrigger)
                {
                    try
                    {
                        bool allSent = await ProcessCelebrationsAsync(now.Date);

                        if (allSent)
                        {
                            // All messages sent — sleep until tomorrow 9:30 AM
                            var tomorrow930 = now.Date.AddDays(1).AddHours(9).AddMinutes(30);
                            var sleepDuration = tomorrow930 - DateTime.Now;
                            _logger.LogInformation("All celebrations processed. Sleeping until {Time}.", tomorrow930);
                            await Task.Delay(sleepDuration, stoppingToken);
                            continue;
                        }
                        else
                        {
                            // Some failed (WhatsApp disconnected) — retry in 5 minutes
                            _logger.LogWarning("Some celebration messages failed. Retrying in 5 minutes.");
                            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                            continue;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing celebrations. Retrying in 5 minutes.");
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                        continue;
                    }
                }

                // Before 9:30 AM — check every 5 minutes
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }

        private async Task<bool> ProcessCelebrationsAsync(DateTime today)
        {
            bool allSent = true;
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            var whatsappProvider = scope.ServiceProvider.GetRequiredService<IWhatsAppProvider>();

            // ── Pre-flight: only proceed if WhatsApp is actually connected ──────────
            // The /send endpoint always returns HTTP 200 (queued), even when WhatsApp
            // is disconnected. If we wrote the CelebrationLog on a queued-but-not-
            // delivered message, the log would block all future retries for that day.
            // By checking connection first, we ensure the log is only written after
            // the message has a real chance of being delivered.
            var (waStatus, _, _) = await whatsappProvider.GetStatusAsync();
            if (waStatus != "connected")
            {
                _logger.LogWarning(
                    "WhatsApp is not connected (status: {Status}). Skipping celebrations — will retry in 5 minutes.",
                    waStatus);
                return false; // triggers the 5-minute retry loop in ExecuteAsync
            }
            // ─────────────────────────────────────────────────────────────────────────

            // Get today's logs to prevent duplicates
            var todaysLogs = await db.CelebrationLogs
                .IgnoreQueryFilters()
                .Where(l => l.SentDate.Date == today.Date)
                .Select(l => new { l.OrganizationId, l.EmployeeId, l.EventType })
                .ToListAsync();

            // Get ONLY employees who have a birthday or anniversary today, bypassing tenant filters
            var employees = await db.Employees
                .IgnoreQueryFilters()
                .Include(e => e.Organization)
                .Where(e => e.Status == "active" && (
                    (e.DateOfBirth != null && e.DateOfBirth.Value.Month == today.Month && e.DateOfBirth.Value.Day == today.Day) ||
                    (e.JoiningDate != null && e.JoiningDate.Value.Month == today.Month && e.JoiningDate.Value.Day == today.Day)
                ))
                .ToListAsync();

            foreach (var employee in employees)
            {
                // Fetch the Group ID from the employee's organization
                var groupId = employee.Organization?.WhatsAppGroupId;
                if (string.IsNullOrEmpty(groupId))
                {
                    _logger.LogWarning("No WhatsApp Group ID configured for Organization {OrgName}. Skipping celebration for {EmpName}.", 
                        employee.Organization?.Name, employee.EmployeeName);
                    continue;
                }

                // Check Birthday
                if (employee.DateOfBirth.HasValue && 
                    employee.DateOfBirth.Value.Year > 1900 &&
                    employee.DateOfBirth.Value.Month == today.Month && 
                    employee.DateOfBirth.Value.Day == today.Day)
                {
                    if (todaysLogs.Any(l => l.OrganizationId == employee.OrganizationId && l.EmployeeId == employee.EmployeeId && l.EventType == "Birthday"))
                    {
                        continue;
                    }

                    _logger.LogInformation("Queuing Birthday HTML generation for {Name} in Org {Org}", employee.EmployeeName, employee.Organization?.Name);
                    
                    string photoBase64 = "";
                    byte[]? dbPhotoBytes = null;
                    using (var cmd = db.Database.GetDbConnection().CreateCommand())
                    {
                        cmd.CommandText = "SELECT PhotoData FROM employees WHERE employee_id = @id AND organization_id = @org";
                        var p1 = cmd.CreateParameter(); p1.ParameterName = "@id"; p1.Value = employee.EmployeeId; cmd.Parameters.Add(p1);
                        var p2 = cmd.CreateParameter(); p2.ParameterName = "@org"; p2.Value = employee.OrganizationId; cmd.Parameters.Add(p2);
                        
                        bool wasClosed = cmd.Connection.State == System.Data.ConnectionState.Closed;
                        if (wasClosed) await cmd.Connection.OpenAsync();
                        try 
                        {
                            var res = await cmd.ExecuteScalarAsync();
                            if (res != null && res != DBNull.Value) dbPhotoBytes = (byte[])res;
                        }
                        finally { if (wasClosed) await cmd.Connection.CloseAsync(); }
                    }

                    if (dbPhotoBytes != null && dbPhotoBytes.Length > 0)
                    {
                        photoBase64 = Convert.ToBase64String(dbPhotoBytes);
                    }
                    else if (!string.IsNullOrEmpty(employee.PhotoPath))
                    {
                        var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
                        var fullPhotoPath = System.IO.Path.Combine(photoDir ?? "", employee.PhotoPath);
                        if (System.IO.File.Exists(fullPhotoPath))
                        {
                            var bytes = await System.IO.File.ReadAllBytesAsync(fullPhotoPath);
                            photoBase64 = Convert.ToBase64String(bytes);
                        }
                    }
                    var caption = $@"Happy Birthday, {employee.EmployeeName}!

The entire *Balar Builders* family wishes you a day filled with joy, good health, and happiness. Thank you for your dedication and hard work. Wishing you continued success and a wonderful year ahead!";
                    // Send to Node.js microservice to generate HTML/Puppeteer poster
                    bool birthdaySent = await whatsappProvider.SendCelebrationAsync(groupId, employee.EmployeeName, "Birthday", photoBase64, caption);
                    
                    // Only log to DB if message was actually delivered
                    if (birthdaySent)
                    {
                        db.CelebrationLogs.Add(new CelebrationLog 
                        {
                            OrganizationId = employee.OrganizationId,
                            EmployeeId = employee.EmployeeId,
                            EventType = "Birthday",
                            SentDate = today,
                            CreatedAt = DateTime.Now
                        });
                    }
                    else
                    {
                        allSent = false;
                        _logger.LogWarning("Birthday message for {Name} failed to send (WhatsApp may be disconnected). Will retry on next check.", employee.EmployeeName);
                    }
                }

                // Check Work Anniversary
                if (employee.JoiningDate.HasValue && 
                    employee.JoiningDate.Value.Year > 1900 &&
                    employee.JoiningDate.Value.Month == today.Month && 
                    employee.JoiningDate.Value.Day == today.Day &&
                    employee.JoiningDate.Value.Year < today.Year)
                {
                    if (todaysLogs.Any(l => l.OrganizationId == employee.OrganizationId && l.EmployeeId == employee.EmployeeId && l.EventType == "Anniversary"))
                    {
                        continue;
                    }

                    var years = today.Year - employee.JoiningDate.Value.Year;
                    
                    _logger.LogInformation("Queuing Work Anniversary HTML generation for {Name} ({Years} years) in Org {Org}", employee.EmployeeName, years, employee.Organization?.Name);
                    
                    string photoBase64 = "";
                    byte[]? dbPhotoBytes = null;
                    using (var cmd = db.Database.GetDbConnection().CreateCommand())
                    {
                        cmd.CommandText = "SELECT PhotoData FROM employees WHERE employee_id = @id AND organization_id = @org";
                        var p1 = cmd.CreateParameter(); p1.ParameterName = "@id"; p1.Value = employee.EmployeeId; cmd.Parameters.Add(p1);
                        var p2 = cmd.CreateParameter(); p2.ParameterName = "@org"; p2.Value = employee.OrganizationId; cmd.Parameters.Add(p2);
                        
                        bool wasClosed = cmd.Connection.State == System.Data.ConnectionState.Closed;
                        if (wasClosed) await cmd.Connection.OpenAsync();
                        try 
                        {
                            var res = await cmd.ExecuteScalarAsync();
                            if (res != null && res != DBNull.Value) dbPhotoBytes = (byte[])res;
                        }
                        finally { if (wasClosed) await cmd.Connection.CloseAsync(); }
                    }

                    if (dbPhotoBytes != null && dbPhotoBytes.Length > 0)
                    {
                        photoBase64 = Convert.ToBase64String(dbPhotoBytes);
                    }
                    else if (!string.IsNullOrEmpty(employee.PhotoPath))
                    {
                        var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
                        var fullPhotoPath = System.IO.Path.Combine(photoDir ?? "", employee.PhotoPath);
                        if (System.IO.File.Exists(fullPhotoPath))
                        {
                            var bytes = await System.IO.File.ReadAllBytesAsync(fullPhotoPath);
                            photoBase64 = Convert.ToBase64String(bytes);
                        }
                    }
                    
                    string caption;
                    if (years == 1)
                    {
                        caption = $"Happy 1st Work Anniversary, {employee.EmployeeName}!\n\nCongratulations on completing your first year with us. The entire *Balar Builders* family appreciates your hard work and dedication, and we wish you continued success.";
                    }
                    else if (years >= 2 && years < 5)
                    {
                        caption = $"Happy {years}th Work Anniversary, {employee.EmployeeName}!\n\nCongratulations on completing {years} years with us. The entire *Balar Builders* family appreciates your commitment and valuable contributions, and we wish you continued success.";
                    }
                    else if (years >= 5 && years < 10)
                    {
                        caption = $"Happy {years}th Work Anniversary, {employee.EmployeeName}!\n\nCongratulations on completing {years} years with us. The entire *Balar Builders* family appreciates your loyalty, dedication, and valuable contributions, and we wish you continued success.";
                    }
                    else
                    {
                        caption = $"Happy {years}th Work Anniversary, {employee.EmployeeName}!\n\nHeartiest congratulations on completing {years} years with Balar Builders. The entire *Balar Builders* family appreciates your long-standing dedication and valuable contributions, and we wish you continued success.";
                    }
                    
                    // Send to Node.js microservice to generate HTML/Puppeteer poster
                    bool anniversarySent = await whatsappProvider.SendCelebrationAsync(groupId, employee.EmployeeName, "Anniversary", photoBase64, caption, years);
                    
                    // Only log to DB if message was actually delivered
                    if (anniversarySent)
                    {
                        db.CelebrationLogs.Add(new CelebrationLog 
                        {
                            OrganizationId = employee.OrganizationId,
                            EmployeeId = employee.EmployeeId,
                            EventType = "Anniversary",
                            SentDate = today,
                            CreatedAt = DateTime.Now
                        });
                    }
                    else
                    {
                        allSent = false;
                        _logger.LogWarning("Anniversary message for {Name} failed to send (WhatsApp may be disconnected). Will retry on next check.", employee.EmployeeName);
                    }
                }
            }
            
            db.BypassTenantId = true;
            await db.SaveChangesAsync();
            return allSent;
        }
    }
}
