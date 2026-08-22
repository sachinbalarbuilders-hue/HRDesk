using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Infrastructure;

public class PlanEntitlementService : IPlanEntitlementService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;

    public PlanEntitlementService(BiometricAttendanceDbContext db, ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _tenantProvider = tenantProvider;
    }

    public async Task<TenantQuotaStatusDto> GetQuotaStatusAsync(int? organizationId = null)
    {
        var orgId = organizationId ?? (_tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1);

        var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orgId);
        var orgName = org?.Name ?? "Organization";

        var sub = await _db.TenantSubscriptions
            .AsNoTracking()
            .Include(s => s.Plan)
            .Where(s => s.OrganizationId == orgId)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        // Fallback default plan if no subscription record exists yet
        var plan = sub?.Plan;
        if (plan == null)
        {
            plan = new SubscriptionPlan
            {
                Name = "Growth (Standard)",
                Code = "growth",
                MaxEmployees = 250,
                MaxBranches = 5,
                HasBiometricsModule = true,
                HasPayrollModule = true,
                HasRecruitmentModule = true,
                HasLoanManagement = true,
                HasCustomDomain = false
            };
        }

        var usedEmployees = await _db.Employees
            .AsNoTracking()
            .CountAsync(e => e.OrganizationId == orgId && e.Status != "inactive" && e.Status != "terminated");

        var usedBranches = await _db.Branches
            .AsNoTracking()
            .CountAsync(b => b.OrganizationId == orgId && b.IsActive);

        var validUntil = sub?.ValidUntil ?? DateTime.Now.AddYears(1);
        var status = sub?.Status ?? "Active";
        var isExpired = validUntil < DateTime.Now && status != "Active";

        return new TenantQuotaStatusDto(
            OrganizationId: orgId,
            OrganizationName: orgName,
            PlanName: plan.Name,
            PlanCode: plan.Code,
            Status: status,
            MaxEmployees: plan.MaxEmployees,
            UsedEmployees: usedEmployees,
            AvailableEmployees: Math.Max(0, plan.MaxEmployees - usedEmployees),
            MaxBranches: plan.MaxBranches,
            UsedBranches: usedBranches,
            AvailableBranches: Math.Max(0, plan.MaxBranches - usedBranches),
            HasBiometricsModule: plan.HasBiometricsModule,
            HasPayrollModule: plan.HasPayrollModule,
            HasRecruitmentModule: plan.HasRecruitmentModule,
            HasLoanManagement: plan.HasLoanManagement,
            HasCustomDomain: plan.HasCustomDomain,
            ValidUntil: validUntil,
            TrialEndsAt: sub?.TrialEndsAt,
            IsExpired: isExpired
        );
    }

    public async Task<(bool Allowed, string? ErrorMessage)> CanAddEmployeeAsync(int? organizationId = null)
    {
        var quota = await GetQuotaStatusAsync(organizationId);

        if (quota.IsExpired)
        {
            return (false, $"Your subscription for {quota.PlanName} has expired. Please renew your subscription to add new employees.");
        }

        if (quota.UsedEmployees >= quota.MaxEmployees)
        {
            return (false, $"Employee seat limit reached for your plan ({quota.UsedEmployees}/{quota.MaxEmployees} seats used). Please upgrade your subscription to add more employees.");
        }

        return (true, null);
    }

    public async Task<(bool Allowed, string? ErrorMessage)> CanAddBranchAsync(int? organizationId = null)
    {
        var quota = await GetQuotaStatusAsync(organizationId);

        if (quota.IsExpired)
        {
            return (false, $"Your subscription for {quota.PlanName} has expired. Please renew your subscription to add new branches.");
        }

        if (quota.UsedBranches >= quota.MaxBranches)
        {
            return (false, $"Branch limit reached for your plan ({quota.UsedBranches}/{quota.MaxBranches} branches created). Please upgrade your subscription to add more branches.");
        }

        return (true, null);
    }

    public async Task<bool> IsFeatureEnabledAsync(string featureKey, int? organizationId = null)
    {
        var quota = await GetQuotaStatusAsync(organizationId);
        if (quota.IsExpired) return false;

        return featureKey.ToLowerInvariant() switch
        {
            "biometrics" => quota.HasBiometricsModule,
            "payroll" => quota.HasPayrollModule,
            "recruitment" => quota.HasRecruitmentModule,
            "loans" => quota.HasLoanManagement,
            "customdomain" => quota.HasCustomDomain,
            _ => true
        };
    }
}
