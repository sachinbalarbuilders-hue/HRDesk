using System.Net;
using System.Net.Mail;
using HRDesk.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Email;

public record EmailResult(bool Success, string? ErrorMessage = null);

/// <summary>
/// Reads email provider config from SystemSettings (per org) and dispatches via the appropriate provider.
/// Supported providers: Smtp, SendGrid (via SMTP relay), custom SMTP.
/// </summary>
public class EmailService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ILogger<EmailService> _logger;

    public EmailService(BiometricAttendanceDbContext db, ILogger<EmailService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<EmailResult> SendAsync(int organizationId, string toEmail, string subject, string htmlBody)
    {
        try
        {
            var settings = await _db.SystemSettings
                .AsNoTracking()
                .Where(s => s.OrganizationId == organizationId && s.SettingKey.StartsWith("Email_"))
                .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue ?? "");

            var provider = settings.GetValueOrDefault("Email_Provider", "Smtp")?.Trim() ?? "Smtp";
            var fromEmail = settings.GetValueOrDefault("Email_From", "")?.Trim();
            var fromName = settings.GetValueOrDefault("Email_FromName", "HRDesk")?.Trim();

            if (string.IsNullOrWhiteSpace(fromEmail))
            {
                return new EmailResult(false, "Email not configured. Please set up email settings in Settings → Email Configuration.");
            }

            return provider.ToLowerInvariant() switch
            {
                "smtp" => await SendViaSmtpAsync(settings, fromEmail!, fromName!, toEmail, subject, htmlBody),
                "sendgrid" => await SendViaSendGridSmtpAsync(settings, fromEmail!, fromName!, toEmail, subject, htmlBody),
                _ => new EmailResult(false, $"Unsupported email provider: {provider}")
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email} for org {OrgId}", toEmail, organizationId);
            return new EmailResult(false, $"Email sending failed: {ex.Message}");
        }
    }

    private async Task<EmailResult> SendViaSmtpAsync(
        Dictionary<string, string> settings, string fromEmail, string fromName,
        string toEmail, string subject, string htmlBody)
    {
        var host = settings.GetValueOrDefault("Email_SmtpHost", "")?.Trim();
        var portStr = settings.GetValueOrDefault("Email_SmtpPort", "587");
        var username = settings.GetValueOrDefault("Email_SmtpUsername", "")?.Trim();
        var password = settings.GetValueOrDefault("Email_SmtpPassword", "")?.Trim();
        var useSslStr = settings.GetValueOrDefault("Email_SmtpUseSsl", "true");

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return new EmailResult(false, "SMTP settings incomplete. Please configure Host, Username, and Password in Settings.");
        }

        int port = int.TryParse(portStr, out var p) ? p : 587;
        bool useSsl = useSslStr?.ToLower() != "false";

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = useSsl,
            Timeout = 15000
        };

        var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        await client.SendMailAsync(message);
        _logger.LogInformation("Email sent via SMTP to {Email}", toEmail);
        return new EmailResult(true);
    }

    private async Task<EmailResult> SendViaSendGridSmtpAsync(
        Dictionary<string, string> settings, string fromEmail, string fromName,
        string toEmail, string subject, string htmlBody)
    {
        // SendGrid uses SMTP relay: smtp.sendgrid.net, port 587, username=apikey, password=<API_KEY>
        var apiKey = settings.GetValueOrDefault("Email_SendGridApiKey", "")?.Trim();

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new EmailResult(false, "SendGrid API key not configured.");
        }

        using var client = new SmtpClient("smtp.sendgrid.net", 587)
        {
            Credentials = new NetworkCredential("apikey", apiKey),
            EnableSsl = true,
            Timeout = 15000
        };

        var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        await client.SendMailAsync(message);
        _logger.LogInformation("Email sent via SendGrid to {Email}", toEmail);
        return new EmailResult(true);
    }
}
