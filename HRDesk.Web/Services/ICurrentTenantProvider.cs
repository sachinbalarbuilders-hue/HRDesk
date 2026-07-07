namespace HRDesk.Web.Services;

public interface ICurrentTenantProvider
{
    int TenantId { get; }
    void SetTenantId(int tenantId);
}
