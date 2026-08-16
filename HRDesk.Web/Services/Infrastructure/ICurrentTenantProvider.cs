namespace HRDesk.Web.Services;

public interface ICurrentTenantProvider
{
    int TenantId { get; }
    int? BranchId { get; }
    void SetTenantId(int tenantId);
    void SetBranchId(int? branchId);
}
