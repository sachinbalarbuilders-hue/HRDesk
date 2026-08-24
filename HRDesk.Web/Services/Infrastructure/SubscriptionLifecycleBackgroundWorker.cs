using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Infrastructure;

public class SubscriptionLifecycleBackgroundWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionLifecycleBackgroundWorker> _logger;

    public SubscriptionLifecycleBackgroundWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<SubscriptionLifecycleBackgroundWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Subscription Lifecycle Worker started.");

        try
        {
            // Initial brief delay on startup
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessExpiredSubscriptionsAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing expired subscriptions.");
                }

                // Runs every 6 hours
                try
                {
                    await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal graceful shutdown
        }

        _logger.LogInformation("Subscription Lifecycle Worker stopped.");
    }

    private async Task ProcessExpiredSubscriptionsAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
        db.BypassTenantId = true;

        var now = DateTime.Now;
        var expiredSubs = await db.TenantSubscriptions
            .Include(s => s.Plan)
            .Where(s => s.Status == "Active" && s.ValidUntil < now)
            .ToListAsync(stoppingToken);

        if (expiredSubs.Count == 0)
        {
            return;
        }

        _logger.LogInformation("Found {Count} expired subscriptions to process.", expiredSubs.Count);

        var freePlan = await db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == "FREE_STARTER", stoppingToken);

        foreach (var sub in expiredSubs)
        {
            var oldPlanName = sub.Plan?.Name ?? "Plan";
            sub.Status = "Expired";
            sub.UpdatedAt = now;

            // Downgrade to Free Starter if plan expired without renewal
            if (freePlan != null && sub.PlanId != freePlan.Id)
            {
                sub.PlanId = freePlan.Id;
            }

            db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = sub.OrganizationId,
                UserName = "System (SubscriptionWorker)",
                Action = "UPDATE",
                EntityName = "TenantSubscription",
                PrimaryKey = sub.Id.ToString(),
                ChangedColumns = "Status, PlanId",
                OldValues = $"{{\"Status\":\"Active\",\"Plan\":\"{oldPlanName}\"}}",
                NewValues = $"{{\"Status\":\"Expired\",\"Plan\":\"{freePlan?.Name ?? "Free Starter"}\"}}",
                Timestamp = now
            });
        }

        await db.SaveChangesAsync(stoppingToken);
        _logger.LogInformation("Successfully processed and downgraded {Count} expired subscriptions.", expiredSubs.Count);
    }
}
