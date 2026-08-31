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
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPaymentGatewayService _paymentService;
    private readonly IPlanEntitlementService _entitlementService;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public PaymentsController(
        BiometricAttendanceDbContext db,
        IPaymentGatewayService paymentService,
        IPlanEntitlementService entitlementService,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _paymentService = paymentService;
        _entitlementService = entitlementService;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpPost("create-order")]
    public async Task<IActionResult> CreateOrder([FromBody] CreatePaymentOrderDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        try
        {
            var order = await _paymentService.CreateOrderAsync(dto, orgId);
            return Ok(order);
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Payment order creation failed. Please try again." });
        }
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyPayment([FromBody] PaymentVerificationDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var result = await _paymentService.VerifyAndActivatePaymentAsync(dto, orgId);
        if (!result.Success || result.Payment == null)
        {
            return BadRequest(new { message = result.ErrorMessage ?? "Payment verification failed." });
        }

        var updatedQuota = await _entitlementService.GetQuotaStatusAsync(orgId);

        return Ok(new
        {
            success = true,
            message = "Payment verified successfully and subscription activated!",
            invoiceNumber = result.Payment.InvoiceNumber,
            quota = updatedQuota
        });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetPaymentHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.MastersOrganizations) && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
        {
            return Forbid();
        }

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var query = _db.SubscriptionPayments
            .AsNoTracking()
            .Include(p => p.Plan)
            .Where(p => p.OrganizationId == orgId)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.PublicId,
                p.InvoiceNumber,
                PlanName = p.Plan != null ? p.Plan.Name : "Plan",
                p.Amount,
                p.TaxAmount,
                Total = p.Amount + p.TaxAmount,
                p.Currency,
                p.BillingCycle,
                p.PaymentGateway,
                p.Status,
                p.PaidAt,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> CancelOrder([FromBody] CancelOrderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.OrderId))
            return BadRequest(new { message = "Order ID is required." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var payment = await _db.SubscriptionPayments
            .FirstOrDefaultAsync(p => p.GatewayOrderId == dto.OrderId && p.OrganizationId == orgId && p.Status == "Pending");

        if (payment == null)
            return NotFound(new { message = "Pending order not found." });

        payment.Status = string.IsNullOrWhiteSpace(dto.Reason) ? "Cancelled" : "Failed";
        await _db.SaveChangesAsync();

        return Ok(new { message = "Order marked as " + payment.Status.ToLower() + "." });
    }

    public record CancelOrderDto(string OrderId, string? Reason);
}
