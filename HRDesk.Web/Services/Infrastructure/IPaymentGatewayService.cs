using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Infrastructure;

public record CreatePaymentOrderDto(
    int PlanId,
    string BillingCycle // Monthly, Yearly
);

public record PaymentOrderResponseDto(
    string OrderId,
    string InvoiceNumber,
    decimal Amount,
    decimal TaxAmount,
    decimal TotalAmount,
    string Currency,
    string KeyId,
    string PlanName,
    string BillingCycle
);

public record PaymentVerificationDto(
    string OrderId,
    string PaymentId,
    string? Signature
);

public record PaymentVerificationResult(
    bool Success,
    string? ErrorMessage,
    SubscriptionPayment? Payment,
    TenantSubscription? Subscription
);

public interface IPaymentGatewayService
{
    Task<PaymentOrderResponseDto> CreateOrderAsync(CreatePaymentOrderDto dto, int organizationId);
    Task<PaymentVerificationResult> VerifyAndActivatePaymentAsync(PaymentVerificationDto dto, int organizationId);
    Task<bool> ProcessWebhookAsync(string payload, string signature);
}
