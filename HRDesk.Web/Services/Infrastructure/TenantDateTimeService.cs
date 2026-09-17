using System;
using System.Linq;
using HRDesk.Web.Data;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Services.Infrastructure;

public class TenantDateTimeService
{
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly BiometricAttendanceDbContext _db;
    private readonly IMemoryCache _cache;
    
    // Default fallback timezone
    private static readonly TimeZoneInfo DefaultTimeZone = ResolveDefaultTimeZone();

    public TenantDateTimeService(
        ICurrentTenantProvider tenantProvider,
        BiometricAttendanceDbContext db,
        IMemoryCache cache)
    {
        _tenantProvider = tenantProvider;
        _db = db;
        _cache = cache;
    }

    private static TimeZoneInfo ResolveDefaultTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
    }

    public TimeZoneInfo GetTenantTimeZone()
    {
        int tenantId = _tenantProvider.TenantId;
        if (tenantId <= 0) return DefaultTimeZone;

        // Try cache first
        string cacheKey = $"tenant_timezone_{tenantId}";
        if (_cache.TryGetValue(cacheKey, out TimeZoneInfo? cachedZone) && cachedZone != null)
        {
            return cachedZone;
        }

        // Disable change tracking for fast read
        var setting = _db.SystemSettings
            .Where(s => s.OrganizationId == tenantId && s.SettingKey == "Organization_TimeZone" && s.BranchId == null)
            .Select(s => s.SettingValue)
            .FirstOrDefault();

        string tzString = setting ?? "Asia/Kolkata";
        
        // Extract exact timezone id (e.g. from "America/New_York (UTC-05:00)" -> "America/New_York")
        var id = tzString.Split(' ')[0];

        TimeZoneInfo zone;
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (TimeZoneNotFoundException)
        {
            zone = DefaultTimeZone;
        }

        // Cache for 1 hour to avoid DB hit every time DateTime is requested
        _cache.Set(cacheKey, zone, TimeSpan.FromHours(1));
        return zone;
    }

    public DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, GetTenantTimeZone());

    public DateOnly Today => DateOnly.FromDateTime(Now);
}
