using System;

namespace HRDesk.Web.Core;

/// <summary>
/// Provides guaranteed Indian Standard Time (IST - UTC+05:30) date & time values,
/// preventing server timezone drift when hosted in UTC or US-based cloud hosting (like SmarterASP/IIS/Azure/AWS).
/// </summary>
public static class IstDateTime
{
    private static readonly TimeZoneInfo IstTimeZone = ResolveIstTimeZone();

    private static TimeZoneInfo ResolveIstTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
        catch
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
            }
            catch
            {
                return TimeZoneInfo.CreateCustomTimeZone(
                    "IST",
                    TimeSpan.FromHours(5.5),
                    "(UTC+05:30) India Standard Time",
                    "India Standard Time"
                );
            }
        }
    }

    /// <summary>
    /// Returns the current DateTime in Indian Standard Time (UTC+05:30).
    /// </summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IstTimeZone);

    /// <summary>
    /// Returns the current DateOnly in Indian Standard Time (UTC+05:30).
    /// </summary>
    public static DateOnly Today => DateOnly.FromDateTime(Now);

    /// <summary>
    /// Returns the current TimeOnly in Indian Standard Time (UTC+05:30).
    /// </summary>
    public static TimeOnly TimeOfDay => TimeOnly.FromDateTime(Now);
}
