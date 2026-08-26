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
            // 0. Explicitly set by background services / provisioning
            if (_tenantId.HasValue)
            {
                return _tenantId.Value;
            }

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return 0;

            var user = httpContext.User;
            var isAuthenticated = user?.Identity?.IsAuthenticated == true;

            // Determine if this is a platform user (from JWT claim)
            var isPlatformUser = isAuthenticated &&
                string.Equals(user!.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase);

            if (isPlatformUser)
            {
                // PLATFORM USER: Trust X-Organization-Id header for cross-org access.
                // Platform identity is verified via the IsPlatformUser JWT claim (server-signed, tamper-proof).
                // If no header is sent, return 0 (no org context = platform dashboard mode).
                var headerValue = httpContext.Request.Headers["X-Organization-Id"].ToString();
                if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var headerOrgId) && headerOrgId > 0)
                {
                    return headerOrgId;
                }
                return 0; // Platform user, no active org context
            }

            if (isAuthenticated)
            {
                // ORGANIZATION USER: Use ONLY their JWT OrganizationId claim.
                // Do NOT trust X-Organization-Id header — prevents cross-org access by header manipulation.
                var orgClaim = user!.FindFirst("OrganizationId");
                if (orgClaim != null && int.TryParse(orgClaim.Value, out var claimOrgId) && claimOrgId > 0)
                {
                    return claimOrgId;
                }
            }

            // Unauthenticated requests (public endpoints like /auth/login, /register)
            // Return 0 — no tenant context. The [AllowAnonymous] endpoints use IgnoreQueryFilters().
            return 0;
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
