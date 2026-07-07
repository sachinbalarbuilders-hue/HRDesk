using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace HRDesk.Web.Services;

public class CurrentTenantProvider : ICurrentTenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private int? _tenantId;

    public CurrentTenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public int TenantId
    {
        get
        {
            if (_tenantId.HasValue)
            {
                return _tenantId.Value;
            }

            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                // Check if user is SuperAdmin and has an active tenant cookie
                if (user.IsInRole("SuperAdmin"))
                {
                    var cookieValue = _httpContextAccessor.HttpContext?.Request.Cookies["ActiveTenantId"];
                    if (!string.IsNullOrEmpty(cookieValue) && int.TryParse(cookieValue, out var activeTenantId))
                    {
                        return activeTenantId;
                    }
                }

                var tenantClaim = user.FindFirst("OrganizationId");
                if (tenantClaim != null && int.TryParse(tenantClaim.Value, out var tenantId))
                {
                    return tenantId;
                }
            }
            
            // Default fallback
            return 1;
        }
    }

    public void SetTenantId(int tenantId)
    {
        _tenantId = tenantId;
    }
}
