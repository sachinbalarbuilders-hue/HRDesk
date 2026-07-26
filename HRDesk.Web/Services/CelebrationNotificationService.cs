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

        private DateTime _lastProcessedDate = DateTime.MinValue;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Celebration Notification Service is starting.");

            // Run check every minute to catch the exact time
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Now;
                
                // Trigger any time after 9:30 AM if it hasn't run today
                bool shouldTrigger = (now.Hour == 9 && now.Minute >= 30) || (now.Hour >= 10);

                if (shouldTrigger && _lastProcessedDate.Date != now.Date)
                    {
                        try
                        {
                            await ProcessCelebrationsAsync(now.Date);
                            _lastProcessedDate = now.Date; // Mark as processed for today
                            
                            // Wait for a minute to ensure we don't trigger multiple times in the same minute
                            await Task.Delay(TimeSpan.FromMinutes(1.5), stoppingToken);
                            continue;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error processing celebrations.");
                        }
                    }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessCelebrationsAsync(DateTime today)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            var whatsappProvider = scope.ServiceProvider.GetRequiredService<IWhatsAppProvider>();

            // Get today's logs to prevent duplicates
            var todaysLogs = await db.CelebrationLogs
                .IgnoreQueryFilters()
                .Where(l => l.SentDate.Date == today.Date)
                .Select(l => new { l.EmployeeId, l.EventType })
                .ToListAsync();

            // Get all active employees across all organizations, bypassing tenant filters for the background service
            var employees = await db.Employees
                .IgnoreQueryFilters()
                .Include(e => e.Organization)
                .Where(e => e.Status == "active")
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
                    if (todaysLogs.Any(l => l.EmployeeId == employee.EmployeeId && l.EventType == "Birthday"))
                    {
                        continue;
                    }

                    _logger.LogInformation("Queuing Birthday HTML generation for {Name} in Org {Org}", employee.EmployeeName, employee.Organization?.Name);
                    
                    string photoBase64 = "";
                    if (employee.PhotoData != null && employee.PhotoData.Length > 0)
                    {
                        photoBase64 = Convert.ToBase64String(employee.PhotoData);
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

The entire *{employee.Organization?.Name ?? "Setu Developers"}* family wishes you a day filled with joy, good health, and happiness. Thank you for your dedication and hard work. Wishing you continued success and a wonderful year ahead!";
                    // Send to Node.js microservice to generate HTML/Puppeteer poster
                    await whatsappProvider.SendCelebrationAsync(groupId, employee.EmployeeName, "Birthday", photoBase64, caption);
                    
                    db.CelebrationLogs.Add(new CelebrationLog 
                    {
                        OrganizationId = employee.OrganizationId,
                        EmployeeId = employee.EmployeeId,
                        EventType = "Birthday",
                        SentDate = today,
                        CreatedAt = DateTime.Now
                    });
                }

                // Check Work Anniversary
                if (employee.JoiningDate.HasValue && 
                    employee.JoiningDate.Value.Year > 1900 &&
                    employee.JoiningDate.Value.Month == today.Month && 
                    employee.JoiningDate.Value.Day == today.Day &&
                    employee.JoiningDate.Value.Year < today.Year)
                {
                    if (todaysLogs.Any(l => l.EmployeeId == employee.EmployeeId && l.EventType == "Anniversary"))
                    {
                        continue;
                    }

                    var years = today.Year - employee.JoiningDate.Value.Year;
                    
                    _logger.LogInformation("Queuing Work Anniversary HTML generation for {Name} ({Years} years) in Org {Org}", employee.EmployeeName, years, employee.Organization?.Name);
                    
                    string photoBase64 = "";
                    if (employee.PhotoData != null && employee.PhotoData.Length > 0)
                    {
                        photoBase64 = Convert.ToBase64String(employee.PhotoData);
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
                    
                    var caption = $"Congratulations, {employee.EmployeeName}, on your work anniversary! It's a special day to celebrate your great work and dedication to your job over the past year. We appreciate all that you have done and wish you all the best for many more successful years to come!";
                    
                    // Send to Node.js microservice to generate HTML/Puppeteer poster
                    await whatsappProvider.SendCelebrationAsync(groupId, employee.EmployeeName, "Anniversary", photoBase64, caption, years);
                    
                    db.CelebrationLogs.Add(new CelebrationLog 
                    {
                        OrganizationId = employee.OrganizationId,
                        EmployeeId = employee.EmployeeId,
                        EventType = "Anniversary",
                        SentDate = today,
                        CreatedAt = DateTime.Now
                    });
                }
            }
            
            await db.SaveChangesAsync();
            
            // Note: In a production app, we now log that we processed today's celebrations in the database
            // so we don't send duplicates if the service restarts during the 9 AM hour.
        }
    }
}
