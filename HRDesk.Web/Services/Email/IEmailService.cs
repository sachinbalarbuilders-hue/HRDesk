namespace HRDesk.Web.Services.Email;

public interface IEmailService
{
    /// <summary>
    /// Sends an email using the configured provider for the given organization.
    /// </summary>
    Task<EmailResult> SendAsync(int organizationId, string toEmail, string subject, string htmlBody);
}

public record EmailResult(bool Success, string? ErrorMessage = null);
