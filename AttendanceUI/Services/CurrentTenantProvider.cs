using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace AttendanceUI.Services;

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
                var tenantClaim = user.FindFirst("OrganizationId");
                if (tenantClaim != null && int.TryParse(tenantClaim.Value, out var tenantId))
                {
                    return tenantId;
                }
            }
            
            // If we can't find a tenant id (e.g., background service or unauthenticated), 
            // return a default or handle appropriately. Usually this means TenantId = 1 or 0 depending on the app design.
            // For this admin system, if not authenticated, we could return 1 for the default organization or 0 to trigger an error.
            return 1;
        }
    }

    public void SetTenantId(int tenantId)
    {
        _tenantId = tenantId;
    }
}
