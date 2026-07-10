using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models
{
    [Table("celebration_logs")]
    public class CelebrationLog : IMustHaveTenant
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("organization_id")]
        public int OrganizationId { get; set; }

        [Column("employee_id")]
        public int EmployeeId { get; set; }

        [Required]
        [Column("event_type")]
        [MaxLength(50)]
        public string EventType { get; set; } = null!;

        [Column("sent_date")]
        public DateTime SentDate { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        // Navigation Property
        public virtual Employee? Employee { get; set; }
        public virtual Organization? Organization { get; set; }
    }
}
