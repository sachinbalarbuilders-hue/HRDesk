using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace HRDesk.Web.Models.Entities;

public class UserSession
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    [JsonIgnore]
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [Required]
    [MaxLength(100)]
    public string SessionIdentifier { get; set; } = null!;

    [MaxLength(50)]
    public string DeviceType { get; set; } = "Web Browser";

    [MaxLength(200)]
    public string DeviceName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string IpAddress { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Location { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime LastAccessedAt { get; set; } = DateTime.Now;
}
