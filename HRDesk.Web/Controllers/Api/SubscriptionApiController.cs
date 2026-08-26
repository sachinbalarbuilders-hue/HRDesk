using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubscriptionController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPlanEntitlementService _entitlementService;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public SubscriptionController(
        BiometricAttendanceDbContext db,
        IPlanEntitlementService entitlementService,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _entitlementService = entitlementService;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("quota-status")]
    public async Task<IActionResult> GetQuotaStatus()
    {
        var status = await _entitlementService.GetQuotaStatusAsync();
        return Ok(status);
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPlans()
    {
        var plans = await _db.SubscriptionPlans
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.PricePerMonth)
            .Select(p => new
            {
                p.Id,
                p.PublicId,
                p.Name,
                p.Code,
                p.Description,
                p.MaxEmployees,
                p.MaxBranches,
                p.HasBiometricsModule,
                p.HasPayrollModule,
                p.HasRecruitmentModule,
                p.HasLoanManagement,
                p.HasCustomDomain,
                p.PricePerMonth
            })
            .ToListAsync();

        return Ok(plans);
    }

    public record ChangePlanRequest(int PlanId, string? BillingCycle);

    [HttpPost("change-plan")]
    public async Task<IActionResult> ChangePlan([FromBody] ChangePlanRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations))
        {
            return Forbid();
        }

        var plan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == request.PlanId && p.IsActive);
        if (plan == null)
        {
            return BadRequest(new { message = "Selected subscription plan does not exist or is inactive." });
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var currentSub = await _db.TenantSubscriptions
            .FirstOrDefaultAsync(s => s.OrganizationId == orgId);

        if (currentSub != null)
        {
            currentSub.PlanId = plan.Id;
            currentSub.BillingCycle = request.BillingCycle ?? "Monthly";
            currentSub.UpdatedAt = DateTime.Now;
            currentSub.ValidUntil = DateTime.Now.AddMonths(request.BillingCycle == "Yearly" ? 12 : 1);
        }
        else
        {
            currentSub = new TenantSubscription
            {
                OrganizationId = orgId,
                PlanId = plan.Id,
                Status = "Active",
                BillingCycle = request.BillingCycle ?? "Monthly",
                ValidUntil = DateTime.Now.AddMonths(request.BillingCycle == "Yearly" ? 12 : 1),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.TenantSubscriptions.Add(currentSub);
        }

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        var updatedQuota = await _entitlementService.GetQuotaStatusAsync(orgId);

        return Ok(new
        {
            success = true,
            message = $"Subscription successfully switched to {plan.Name}.",
            quota = updatedQuota
        });
    }
}
