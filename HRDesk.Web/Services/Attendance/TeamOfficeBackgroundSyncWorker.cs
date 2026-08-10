using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Attendance;

public class TeamOfficeBackgroundSyncWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _config;
    private readonly ILogger<TeamOfficeBackgroundSyncWorker> _logger;

    public TeamOfficeBackgroundSyncWorker(
        IServiceProvider serviceProvider,
        IConfiguration config,
        ILogger<TeamOfficeBackgroundSyncWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TeamOfficeBackgroundSyncWorker is starting.");

        // Initial delay to allow web app to boot cleanly
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var section = _config.GetSection("TeamOfficeApi");
            bool enabled = section.GetValue<bool>("Enabled", true);
            int intervalMins = section.GetValue<int>("SyncIntervalMinutes", 5);
            if (intervalMins < 1) intervalMins = 1;

            if (enabled)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<ITeamOfficeSyncService>();
                    var result = await syncService.SyncLatestPunchesAsync(stoppingToken);
                    if (result.success && result.newLogs > 0)
                    {
                        _logger.LogInformation("TeamOffice background sync imported {Count} new punches.", result.newLogs);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in TeamOfficeBackgroundSyncWorker loop.");
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(intervalMins), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("TeamOfficeBackgroundSyncWorker is stopping.");
    }
}
