using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("comp_off_credits")]
public class CompOffCredit
{
    [Key]
    public int Id { get; set; }

    [Column("employee_id")]
    public int EmployeeId { get; set; }

    [Column("work_date")]
    public DateOnly WorkDate { get; set; }

    [Column("credited_days")]
    public decimal CreditedDays { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [ForeignKey("EmployeeId")]
    public virtual Employee? Employee { get; set; }
}
