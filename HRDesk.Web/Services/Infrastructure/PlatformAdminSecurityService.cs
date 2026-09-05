using System;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Infrastructure;

public class PlatformAdminSecurityService
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PlatformAdminSecurityService> _logger;

    public PlatformAdminSecurityService(
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<PlatformAdminSecurityService> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;
    }

    public string GetClientIpAddress(HttpContext context)
    {
        // 1. Cloudflare real client IP
        if (context.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfIp) &&
            !string.IsNullOrWhiteSpace(cfIp))
        {
            return cfIp.ToString().Trim();
        }

        // 2. Standard X-Forwarded-For header (left-most IP is the original client)
        if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var xff) &&
            !string.IsNullOrWhiteSpace(xff))
        {
            var firstIp = xff.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(firstIp))
            {
                return firstIp;
            }
        }

        // 3. X-Real-IP
        if (context.Request.Headers.TryGetValue("X-Real-IP", out var realIp) &&
            !string.IsNullOrWhiteSpace(realIp))
        {
            return realIp.ToString().Trim();
        }

        // 4. Remote IP Address from socket
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp != null)
        {
            // Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
            if (remoteIp.IsIPv4MappedToIPv6)
            {
                remoteIp = remoteIp.MapToIPv4();
            }
            return remoteIp.ToString();
        }

        return "unknown";
    }

    public bool IsRequestAuthorized(HttpContext context, out string failureReason)
    {
        failureReason = string.Empty;

        var clientIp = GetClientIpAddress(context);
        var isLoopback = IsLoopbackAddress(clientIp);

        var configuredKey = _config["SuperAdmin:SecurityKey"]?.Trim();
        var allowedIpsRaw = _config["SuperAdmin:AllowedIps"]?.Trim();
        var requireBoth = _config.GetValue<bool>("SuperAdmin:RequireBothIpAndKey");
        var requireCloudflare = _config.GetValue<bool>("SuperAdmin:RequireCloudflareAccess");

        // 1. Cloudflare Access enforcement if configured
        if (requireCloudflare)
        {
            var hasCfToken = context.Request.Headers.ContainsKey("Cf-Access-Jwt-Assertion") ||
                             context.Request.Headers.ContainsKey("CF-Access-Authenticated-User-Email");
            if (!hasCfToken)
            {
                failureReason = "Missing Cloudflare Access assertion header";
                return false;
            }
        }

        var hasKeyConfigured = !string.IsNullOrWhiteSpace(configuredKey);
        var hasIpsConfigured = !string.IsNullOrWhiteSpace(allowedIpsRaw);

        // In local development or loopback without strict configuration, permit access automatically
        if ((_env.IsDevelopment() || isLoopback) && !hasKeyConfigured && !hasIpsConfigured)
        {
            return true;
        }

        bool ipAllowed = false;
        if (hasIpsConfigured)
        {
            var allowedList = allowedIpsRaw!
                .Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            ipAllowed = allowedList.Any(allowed => IsIpMatch(clientIp, allowed));
        }

        bool keyValid = false;
        if (hasKeyConfigured)
        {
            keyValid = ValidateProvidedKey(context, configuredKey!);
        }

        // Decision logic
        if (requireBoth)
        {
            if (hasIpsConfigured && !ipAllowed)
            {
                failureReason = $"IP address {clientIp} is not in the allowed list";
                return false;
            }
            if (hasKeyConfigured && !keyValid)
            {
                failureReason = "Invalid or missing X-Platform-Key";
                return false;
            }
            return true;
        }

        // If either IP or Key matches:
        if (hasIpsConfigured && ipAllowed)
        {
            return true;
        }

        if (hasKeyConfigured && keyValid)
        {
            return true;
        }

        // Loopback fallback if only one or none is set
        if (isLoopback && (!hasIpsConfigured || ipAllowed))
        {
            return true;
        }

        failureReason = hasIpsConfigured && hasKeyConfigured
            ? $"Access requires authorized IP or valid Platform Key. Client IP: {clientIp}"
            : hasIpsConfigured
                ? $"IP {clientIp} not in allowed list"
                : "Invalid or missing Platform Key";

        return false;
    }

    private static bool IsLoopbackAddress(string ip)
    {
        if (string.Equals(ip, "127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(ip, "::1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(ip, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (IPAddress.TryParse(ip, out var parsed))
        {
            return IPAddress.IsLoopback(parsed);
        }

        return false;
    }

    private static bool IsIpMatch(string clientIp, string allowedPattern)
    {
        if (string.Equals(clientIp, allowedPattern, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (allowedPattern == "127.0.0.1" && IsLoopbackAddress(clientIp))
        {
            return true;
        }

        // Support CIDR subnet check if pattern contains '/'
        if (allowedPattern.Contains('/') && IPAddress.TryParse(clientIp, out var clientParsed))
        {
            try
            {
                var parts = allowedPattern.Split('/');
                if (IPAddress.TryParse(parts[0], out var networkIp) && int.TryParse(parts[1], out var prefixLength))
                {
                    return IsInSubnet(clientParsed, networkIp, prefixLength);
                }
            }
            catch
            {
                // Ignore parsing errors and fallback to false
            }
        }

        return false;
    }

    private static bool IsInSubnet(IPAddress address, IPAddress subnet, int prefixLength)
    {
        var addressBytes = address.GetAddressBytes();
        var subnetBytes = subnet.GetAddressBytes();

        if (addressBytes.Length != subnetBytes.Length) return false;

        var fullBytes = prefixLength / 8;
        var remainingBits = prefixLength % 8;

        for (var i = 0; i < fullBytes; i++)
        {
            if (addressBytes[i] != subnetBytes[i]) return false;
        }

        if (remainingBits > 0 && fullBytes < addressBytes.Length)
        {
            var mask = (byte)(0xFF << (8 - remainingBits));
            if ((addressBytes[fullBytes] & mask) != (subnetBytes[fullBytes] & mask))
            {
                return false;
            }
        }

        return true;
    }

    private static bool ValidateProvidedKey(HttpContext context, string configuredKey)
    {
        // 1. Check Header X-Platform-Key
        if (context.Request.Headers.TryGetValue("X-Platform-Key", out var headerKey) &&
            !string.IsNullOrWhiteSpace(headerKey))
        {
            if (FixedTimeEquals(headerKey.ToString().Trim(), configuredKey))
            {
                return true;
            }
        }

        // 2. Check Query parameter ?platform_key= or ?key=
        if (context.Request.Query.TryGetValue("platform_key", out var queryKey) &&
            !string.IsNullOrWhiteSpace(queryKey))
        {
            if (FixedTimeEquals(queryKey.ToString().Trim(), configuredKey))
            {
                return true;
            }
        }
        if (context.Request.Query.TryGetValue("key", out var altQueryKey) &&
            !string.IsNullOrWhiteSpace(altQueryKey))
        {
            if (FixedTimeEquals(altQueryKey.ToString().Trim(), configuredKey))
            {
                return true;
            }
        }

        // 3. Check Cookie hrdesk_platform_key
        if (context.Request.Cookies.TryGetValue("hrdesk_platform_key", out var cookieKey) &&
            !string.IsNullOrWhiteSpace(cookieKey))
        {
            if (FixedTimeEquals(cookieKey.Trim(), configuredKey))
            {
                return true;
            }
        }

        return false;
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
