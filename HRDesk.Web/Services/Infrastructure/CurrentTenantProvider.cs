using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace HRDesk.Web.Services;

public class CurrentTenantProvider : ICurrentTenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private int? _tenantId;
    private int? _branchId;

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

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                // 1. First priority: Check X-Organization-Id request header
                var headerValue = httpContext.Request.Headers["X-Organization-Id"].ToString();
                if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var headerTenantId) && headerTenantId > 0)
                {
                    return headerTenantId;
                }

                // 2. Second priority: Check ActiveTenantId cookie
                var cookieValue = httpContext.Request.Cookies["ActiveTenantId"];
                if (!string.IsNullOrEmpty(cookieValue) && int.TryParse(cookieValue, out var activeTenantId) && activeTenantId > 0)
                {
                    return activeTenantId;
                }

                // 3. Third priority: Check User Claims
                var user = httpContext.User;
                if (user?.Identity?.IsAuthenticated == true)
                {
                    var tenantClaim = user.FindFirst("OrganizationId");
                    if (tenantClaim != null && int.TryParse(tenantClaim.Value, out var tenantId) && tenantId > 0)
                    {
                        return tenantId;
                    }
                }
            }
            
            // Default fallback
            return 1;
        }
    }

    public int? BranchId
    {
        get
        {
            if (_branchId.HasValue)
            {
                return _branchId.Value;
            }

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                if (httpContext.Request.Headers.TryGetValue("X-Branch-Id", out var branchHeaderVals))
                {
                    var branchHeader = branchHeaderVals.ToString();
                    if (string.Equals(branchHeader, "all", StringComparison.OrdinalIgnoreCase) || branchHeader == "0" || string.IsNullOrWhiteSpace(branchHeader))
                    {
                        return null; // Explicitly ALL branches requested
                    }
                    if (int.TryParse(branchHeader, out var parsedBranchId) && parsedBranchId > 0)
                    {
                        return parsedBranchId;
                    }
                }

                // If query param 'branchId' exists
                if (httpContext.Request.Query.TryGetValue("branchId", out var queryBranchVals))
                {
                    var queryBranch = queryBranchVals.ToString();
                    if (string.Equals(queryBranch, "all", StringComparison.OrdinalIgnoreCase) || queryBranch == "0" || string.IsNullOrWhiteSpace(queryBranch))
                    {
                        return null; // Explicitly ALL branches requested
                    }
                    if (int.TryParse(queryBranch, out var parsedQueryBranch) && parsedQueryBranch > 0)
                    {
                        return parsedQueryBranch;
                    }
                }

                var branchCookie = httpContext.Request.Cookies["ActiveBranchId"];
                if (!string.IsNullOrEmpty(branchCookie) && int.TryParse(branchCookie, out var cookieBranchId) && cookieBranchId > 0)
                {
                    return cookieBranchId;
                }

                var user = httpContext.User;
                if (user?.Identity?.IsAuthenticated == true)
                {
                    var branchClaim = user.FindFirst("BranchId");
                    if (branchClaim != null && int.TryParse(branchClaim.Value, out var branchId) && branchId > 0)
                    {
                        return branchId;
                    }
                }
            }

            return null;
        }
    }

    public void SetTenantId(int tenantId)
    {
        _tenantId = tenantId;
    }

    public void SetBranchId(int? branchId)
    {
        _branchId = branchId;
    }
}
