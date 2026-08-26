using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

[Table("password_reset_tokens")]
public class PasswordResetToken
{
    [Key]
    public int Id { get; set; }

    [Required]
    [Column("user_id")]
    public int UserId { get; set; }

    public User? User { get; set; }

    [Required]
    [MaxLength(10)]
    [Column("otp_code")]
    public string OtpCode { get; set; } = "";

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("is_used")]
    public bool IsUsed { get; set; } = false;

    [Column("attempts")]
    public int Attempts { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("organization_id")]
    public int OrganizationId { get; set; }
}
