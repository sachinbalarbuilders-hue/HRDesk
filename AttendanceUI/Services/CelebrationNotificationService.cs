using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Services.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AttendanceUI.Services
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

            // Run check every minute to catch the exact time
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Now;
                
                // Trigger exactly at 10:30 AM every day
                if (now.Hour == 10 && now.Minute == 30)
                {
                    try
                    {
                        await ProcessCelebrationsAsync(now.Date);
                        
                        // Wait for a minute to ensure we don't trigger multiple times in the same minute
                        await Task.Delay(TimeSpan.FromMinutes(1.5), stoppingToken);
                        continue;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing celebrations.");
                    }
                }

                // Wait 1 minute before checking again
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessCelebrationsAsync(DateTime today)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            var whatsappProvider = scope.ServiceProvider.GetRequiredService<IWhatsAppProvider>();

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
                    // Fallback to appsettings if the organization doesn't have one configured
                    groupId = _configuration.GetValue<string>("CelebrationWhatsAppGroupId");
                    
                    if (string.IsNullOrEmpty(groupId))
                    {
                        _logger.LogWarning("No WhatsApp Group ID configured for Organization {OrgName} or globally. Skipping celebration for {EmpName}.", 
                            employee.Organization?.Name, employee.EmployeeName);
                        continue;
                    }
                }

                // Check Birthday
                if (employee.DateOfBirth.HasValue && 
                    employee.DateOfBirth.Value.Year > 1900 &&
                    employee.DateOfBirth.Value.Month == today.Month && 
                    employee.DateOfBirth.Value.Day == today.Day)
                {
                    _logger.LogInformation("Queuing Birthday HTML generation for {Name} in Org {Org}", employee.EmployeeName, employee.Organization?.Name);
                    
                    var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
                    string photoBase64 = "";
                    if (!string.IsNullOrEmpty(employee.PhotoPath))
                    {
                        var fullPhotoPath = System.IO.Path.Combine(photoDir ?? "", employee.PhotoPath);
                        if (System.IO.File.Exists(fullPhotoPath))
                        {
                            var bytes = await System.IO.File.ReadAllBytesAsync(fullPhotoPath);
                            photoBase64 = Convert.ToBase64String(bytes);
                        }
                    }
                    var caption = $@"🎉 Happy Birthday, {employee.EmployeeName}! 🎂

The entire *{employee.Organization?.Name ?? "Setu Developers"}* family wishes you a day filled with joy, good health, and happiness. Thank you for your dedication and hard work. Wishing you continued success and a wonderful year ahead! 🥳";
                    // Send to Node.js microservice to generate HTML/Puppeteer poster
                    await whatsappProvider.SendCelebrationAsync(groupId, employee.EmployeeName, "Birthday", photoBase64, caption);
                }

                // Check Work Anniversary
                if (employee.JoiningDate.HasValue && 
                    employee.JoiningDate.Value.Year > 1900 &&
                    employee.JoiningDate.Value.Month == today.Month && 
                    employee.JoiningDate.Value.Day == today.Day &&
                    employee.JoiningDate.Value.Year < today.Year)
                {
                    var years = today.Year - employee.JoiningDate.Value.Year;
                    
                    _logger.LogInformation("Queuing Work Anniversary HTML generation for {Name} ({Years} years) in Org {Org}", employee.EmployeeName, years, employee.Organization?.Name);
                    
                    var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
                    string photoBase64 = "";
                    if (!string.IsNullOrEmpty(employee.PhotoPath))
                    {
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
                }
            }
            
            // Note: In a production app, we would log that we processed today's celebrations in the database
            // so we don't send duplicates if the service restarts during the 9 AM hour.
            // But this is a basic implementation as requested.
        }
    }
}
