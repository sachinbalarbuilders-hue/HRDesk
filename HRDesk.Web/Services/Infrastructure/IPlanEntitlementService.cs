using System;
using System.Threading.Tasks;

namespace HRDesk.Web.Services.Infrastructure;

public record TenantQuotaStatusDto(
    int OrganizationId,
    string OrganizationName,
    string PlanName,
    string PlanCode,
    string Status,
    int MaxEmployees,
    int UsedEmployees,
    int AvailableEmployees,
    int MaxBranches,
    int UsedBranches,
    int AvailableBranches,
    bool HasBiometricsModule,
    bool HasPayrollModule,
    bool HasRecruitmentModule,
    bool HasLoanManagement,
    bool HasCustomDomain,
    DateTime ValidUntil,
    DateTime? TrialEndsAt,
    bool IsExpired
);

public interface IPlanEntitlementService
{
    Task<TenantQuotaStatusDto> GetQuotaStatusAsync(int? organizationId = null);
    Task<(bool Allowed, string? ErrorMessage)> CanAddEmployeeAsync(int? organizationId = null);
    Task<(bool Allowed, string? ErrorMessage)> CanAddBranchAsync(int? organizationId = null);
    Task<bool> IsFeatureEnabledAsync(string featureKey, int? organizationId = null);
}
