using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Email;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/settings/email")]
[Authorize]
public class EmailSettingsController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IEmailService _emailService;

    public EmailSettingsController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IEmailService emailService)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _emailService = emailService;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmailSettings()
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var settings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == orgId && s.SettingKey.StartsWith("Email_"))
            .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue ?? "");

        return Ok(new
        {
            provider = settings.GetValueOrDefault("Email_Provider", "Smtp"),
            from = settings.GetValueOrDefault("Email_From", ""),
            fromName = settings.GetValueOrDefault("Email_FromName", "HRDesk"),
            // SMTP
            smtpHost = settings.GetValueOrDefault("Email_SmtpHost", ""),
            smtpPort = settings.GetValueOrDefault("Email_SmtpPort", "587"),
            smtpUsername = settings.GetValueOrDefault("Email_SmtpUsername", ""),
            smtpPassword = string.IsNullOrWhiteSpace(settings.GetValueOrDefault("Email_SmtpPassword", "")) ? "" : "••••••••",
            smtpUseSsl = settings.GetValueOrDefault("Email_SmtpUseSsl", "true"),
            // SendGrid
            sendGridApiKey = string.IsNullOrWhiteSpace(settings.GetValueOrDefault("Email_SendGridApiKey", "")) ? "" : "••••••••",
            // Status
            isConfigured = !string.IsNullOrWhiteSpace(settings.GetValueOrDefault("Email_From", ""))
        });
    }

    public record EmailSettingsDto(
        string Provider,
        string From,
        string? FromName,
        // SMTP
        string? SmtpHost,
        string? SmtpPort,
        string? SmtpUsername,
        string? SmtpPassword,
        string? SmtpUseSsl,
        // SendGrid
        string? SendGridApiKey
    );

    [HttpPost]
    public async Task<IActionResult> SaveEmailSettings([FromBody] EmailSettingsDto dto)
    {
        if (!string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.From))
            return BadRequest(new { message = "From email address is required." });

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var keysToSave = new Dictionary<string, string>
        {
            ["Email_Provider"] = (dto.Provider ?? "Smtp").Trim(),
            ["Email_From"] = dto.From.Trim(),
            ["Email_FromName"] = (dto.FromName ?? "HRDesk").Trim(),
            ["Email_SmtpHost"] = (dto.SmtpHost ?? "").Trim(),
            ["Email_SmtpPort"] = (dto.SmtpPort ?? "587").Trim(),
            ["Email_SmtpUsername"] = (dto.SmtpUsername ?? "").Trim(),
            ["Email_SmtpUseSsl"] = (dto.SmtpUseSsl ?? "true").Trim(),
        };

        // Only update password/apikey if not the masked placeholder
        if (!string.IsNullOrWhiteSpace(dto.SmtpPassword) && dto.SmtpPassword != "••••••••")
            keysToSave["Email_SmtpPassword"] = dto.SmtpPassword.Trim();

        if (!string.IsNullOrWhiteSpace(dto.SendGridApiKey) && dto.SendGridApiKey != "••••••••")
            keysToSave["Email_SendGridApiKey"] = dto.SendGridApiKey.Trim();

        foreach (var (key, value) in keysToSave)
        {
            var existing = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == orgId && s.SettingKey == key);

            if (existing != null)
            {
                existing.SettingValue = value;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = orgId,
                    SettingKey = key,
                    SettingValue = value,
                    Description = $"Email config: {key}",
                    UpdatedAt = DateTime.Now
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Email settings saved successfully." });
    }

    [HttpPost("test")]
    public async Task<IActionResult> SendTestEmail([FromBody] TestEmailDto dto)
    {
        if (!string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
            return Forbid();

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var toEmail = string.IsNullOrWhiteSpace(dto.ToEmail) ? User.Identity?.Name : dto.ToEmail.Trim();

        if (string.IsNullOrWhiteSpace(toEmail))
            return BadRequest(new { message = "Recipient email is required." });

        var htmlBody = @"
            <div style='font-family:Inter,sans-serif;max-width:400px;margin:0 auto;padding:24px;'>
                <h2 style='color:#0D9488;'>✓ Email Configuration Working!</h2>
                <p style='color:#64748B;font-size:14px;'>This is a test email from HRDesk to verify your email settings are configured correctly.</p>
                <p style='color:#94A3B8;font-size:12px;margin-top:16px;'>Sent at: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + @"</p>
            </div>";

        var result = await _emailService.SendAsync(orgId, toEmail, "HRDesk — Test Email", htmlBody);

        if (result.Success)
            return Ok(new { message = $"Test email sent successfully to {toEmail}." });

        return BadRequest(new { message = result.ErrorMessage ?? "Failed to send test email." });
    }

    public record TestEmailDto(string? ToEmail);
}
