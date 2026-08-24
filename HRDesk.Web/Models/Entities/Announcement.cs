using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public sealed class Announcement : IMustHaveTenant
{
    public int Id { get; set; }

    public string Title { get; set; } = "";

    public string Message { get; set; } = "";

    public string Category { get; set; } = "General"; // General, Holiday, Event, Policy, Urgent

    public string Priority { get; set; } = "Normal"; // Low, Normal, High, Urgent

    public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    public DateOnly? EndDate { get; set; }

    public bool IsPinned { get; set; } = false;

    public bool IsActive { get; set; } = true;

    [Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }

    [Column("branch_id")]
    public int? BranchId { get; set; }

    public Branch? Branch { get; set; }

    public int? CreatedByUserId { get; set; }

    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
