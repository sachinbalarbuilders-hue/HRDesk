using System;
using System.Threading.Tasks;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Attributes;

/// <summary>
/// Hardens platform-owner endpoints (SuperAdmin) against unauthorized network access.
/// Validates client IP allowlists, secret platform access keys, and edge reverse-proxy assertions.
/// Any unauthorized request receives an HTTP 404 Not Found (Stealth Cloaking) to prevent discovery.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class PlatformAdminSecurityAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var securityService = context.HttpContext.RequestServices.GetRequiredService<PlatformAdminSecurityService>();
        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<PlatformAdminSecurityAttribute>>();

        if (!securityService.IsRequestAuthorized(context.HttpContext, out var failureReason))
        {
            var ip = securityService.GetClientIpAddress(context.HttpContext);
            logger.LogWarning(
                "[PlatformAdminSecurity] Denied access to {Path} from IP {Ip}. Reason: {Reason}. Cloaking with 404.",
                context.HttpContext.Request.Path,
                ip,
                failureReason);

            // Return 404 Not Found (Stealth Mode) so unauthorized scanners cannot discover this endpoint.
            context.Result = new NotFoundResult();
            return;
        }

        await next();
    }
}
