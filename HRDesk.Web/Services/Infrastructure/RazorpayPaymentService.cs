using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Infrastructure;

public class RazorpayPaymentService : IPaymentGatewayService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPermissionService _permissionService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RazorpayPaymentService> _logger;

    public RazorpayPaymentService(
        BiometricAttendanceDbContext db,
        IConfiguration config,
        IPermissionService permissionService,
        IHttpClientFactory httpClientFactory,
        ILogger<RazorpayPaymentService> logger)
    {
        _db = db;
        _config = config;
        _permissionService = permissionService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
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
        var taxAmount = Math.Round(subtotal * 0.18m, 2); // 18% GST
        var totalAmount = subtotal + taxAmount;

        var keyId = _config["Razorpay:KeyId"] ?? throw new InvalidOperationException("Razorpay:KeyId not configured.");
        var keySecret = _config["Razorpay:KeySecret"] ?? throw new InvalidOperationException("Razorpay:KeySecret not configured.");
        var invoiceNumber = $"INV-{DateTime.Now:yyyyMM}-{Random.Shared.Next(1000, 9999)}";

        // Call Razorpay Orders API
        var orderId = await CreateRazorpayOrderAsync(keyId, keySecret, totalAmount);

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

    private async Task<string> CreateRazorpayOrderAsync(string keyId, string keySecret, decimal totalAmountInr)
    {
        var amountInPaise = (long)(totalAmountInr * 100); // Razorpay expects amount in paise

        var client = _httpClientFactory.CreateClient();
        var authValue = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{keyId}:{keySecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authValue);

        var payload = new
        {
            amount = amountInPaise,
            currency = "INR",
            receipt = $"rcpt_{DateTime.Now:yyyyMMddHHmmss}_{Random.Shared.Next(100, 999)}",
            notes = new { source = "HRDesk SaaS" }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("https://api.razorpay.com/v1/orders", content);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            _logger.LogError("Razorpay order creation failed: {Status} {Body}", response.StatusCode, errorBody);
            throw new Exception($"Razorpay order creation failed: {response.StatusCode}");
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseBody);
        var orderId = doc.RootElement.GetProperty("id").GetString()
            ?? throw new Exception("Razorpay returned null order ID.");

        _logger.LogInformation("Razorpay order created: {OrderId}, amount: {Amount} paise", orderId, amountInPaise);
        return orderId;
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

        // Verify Razorpay signature
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
                _logger.LogWarning("Payment signature verification failed for order {OrderId}", dto.OrderId);
                return new PaymentVerificationResult(false, "Payment signature verification failed.", payment, null);
            }
        }

        payment.Status = "Paid";
        payment.GatewayPaymentId = dto.PaymentId;
        payment.GatewaySignature = dto.Signature;
        payment.PaidAt = DateTime.Now;

        // Upsert subscription
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

        _logger.LogInformation("Payment verified and subscription activated for org {OrgId}, plan {PlanId}", organizationId, payment.PlanId);
        return new PaymentVerificationResult(true, null, payment, currentSub);
    }

    public async Task<bool> ProcessWebhookAsync(string payload, string signature)
    {
        // Future: handle Razorpay webhook events (payment.captured, subscription.charged, etc.)
        await Task.CompletedTask;
        return true;
    }
}
