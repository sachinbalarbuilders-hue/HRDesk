using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Infrastructure;

public record TenantRegistrationDto(
    string CompanyName,
    string WorkspaceSlug,
    string AdminFullName,
    string AdminEmail,
    string? AdminPhone,
    string Password,
    string? HeadOfficeCity,
    string? EmployeeCountRange
);

public record ProvisioningResult(
    bool Success,
    string? ErrorMessage,
    Organization? Organization,
    User? AdminUser,
    Branch? PrimaryBranch
);

public interface ITenantProvisioningService
{
    Task<bool> IsSlugAvailableAsync(string slug);
    Task<ProvisioningResult> ProvisionTenantAsync(TenantRegistrationDto dto);
}
