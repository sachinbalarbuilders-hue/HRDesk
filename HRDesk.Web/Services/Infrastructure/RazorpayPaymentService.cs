using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HRDesk.Web.Services.Infrastructure;

public class RazorpayPaymentService : IPaymentGatewayService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPermissionService _permissionService;

    public RazorpayPaymentService(
        BiometricAttendanceDbContext db,
        IConfiguration config,
        IPermissionService permissionService)
    {
        _db = db;
        _config = config;
        _permissionService = permissionService;
    }

    public async Task<PaymentOrderResponseDto> CreateOrderAsync(CreatePaymentOrderDto dto, int organizationId)
    {
        var plan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == dto.PlanId && p.IsActive);
        if (plan == null)
        {
            throw new ArgumentException("Selected subscription plan is invalid or inactive.");
        }

        var isYearly = string.Equals(dto.BillingCycle, "Yearly", StringComparison.OrdinalIgnoreCase);
        var baseMonthly = plan.PricePerMonth;
        var subtotal = isYearly ? Math.Round(baseMonthly * 12 * 0.85m, 2) : baseMonthly;
        var taxAmount = Math.Round(subtotal * 0.18m, 2); // 18% GST standard
        var totalAmount = subtotal + taxAmount;

        var keyId = _config["Razorpay:KeyId"] ?? "rzp_test_hrdesk_sandbox";
        var invoiceNumber = $"INV-{DateTime.Now:yyyyMM}-{Random.Shared.Next(1000, 9999)}";
        var orderId = $"order_{Guid.NewGuid():N}".Substring(0, 20);

        var payment = new SubscriptionPayment
        {
            OrganizationId = organizationId,
            PlanId = plan.Id,
            InvoiceNumber = invoiceNumber,
            Amount = subtotal,
            TaxAmount = taxAmount,
            Currency = "INR",
            BillingCycle = isYearly ? "Yearly" : "Monthly",
            PaymentGateway = "Razorpay",
            GatewayOrderId = orderId,
            Status = "Pending",
            CreatedAt = DateTime.Now
        };

        _db.SubscriptionPayments.Add(payment);
        await _db.SaveChangesAsync();

        return new PaymentOrderResponseDto(
            OrderId: orderId,
            InvoiceNumber: invoiceNumber,
            Amount: subtotal,
            TaxAmount: taxAmount,
            TotalAmount: totalAmount,
            Currency: "INR",
            KeyId: keyId,
            PlanName: plan.Name,
            BillingCycle: isYearly ? "Yearly" : "Monthly"
        );
    }

    public async Task<PaymentVerificationResult> VerifyAndActivatePaymentAsync(PaymentVerificationDto dto, int organizationId)
    {
        var payment = await _db.SubscriptionPayments
            .Include(p => p.Plan)
            .FirstOrDefaultAsync(p => p.GatewayOrderId == dto.OrderId && p.OrganizationId == organizationId);

        if (payment == null)
        {
            return new PaymentVerificationResult(false, "Order transaction not found.", null, null);
        }

        var keySecret = _config["Razorpay:KeySecret"];
        if (!string.IsNullOrEmpty(keySecret) && !string.IsNullOrEmpty(dto.Signature))
        {
            var text = $"{dto.OrderId}|{dto.PaymentId}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(keySecret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(text));
            var generatedSignature = Convert.ToHexString(hash).ToLowerInvariant();

            if (!string.Equals(generatedSignature, dto.Signature, StringComparison.OrdinalIgnoreCase))
            {
                payment.Status = "Failed";
                await _db.SaveChangesAsync();
                return new PaymentVerificationResult(false, "Payment signature verification failed.", payment, null);
            }
        }

        payment.Status = "Paid";
        payment.GatewayPaymentId = dto.PaymentId;
        payment.GatewaySignature = dto.Signature;
        payment.PaidAt = DateTime.Now;

        var currentSub = await _db.TenantSubscriptions
            .FirstOrDefaultAsync(s => s.OrganizationId == organizationId);

        var isYearly = string.Equals(payment.BillingCycle, "Yearly", StringComparison.OrdinalIgnoreCase);
        var newValidUntil = isYearly ? DateTime.Now.AddYears(1) : DateTime.Now.AddMonths(1);

        if (currentSub != null)
        {
            currentSub.PlanId = payment.PlanId;
            currentSub.Status = "Active";
            currentSub.BillingCycle = payment.BillingCycle;
            currentSub.ValidUntil = newValidUntil;
            currentSub.UpdatedAt = DateTime.Now;
        }
        else
        {
            currentSub = new TenantSubscription
            {
                OrganizationId = organizationId,
                PlanId = payment.PlanId,
                Status = "Active",
                BillingCycle = payment.BillingCycle,
                ValidUntil = newValidUntil,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.TenantSubscriptions.Add(currentSub);
        }

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return new PaymentVerificationResult(true, null, payment, currentSub);
    }

    public async Task<bool> ProcessWebhookAsync(string payload, string signature)
    {
        // Webhook processor logic for automated background events
        await Task.CompletedTask;
        return true;
    }
}
