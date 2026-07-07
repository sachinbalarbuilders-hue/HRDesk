using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HRDesk.Web.Models;

public class DeviceConfiguration : IMustHaveTenant
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "Main Device";

    [Required]
    [StringLength(50)]
    public string IpAddress { get; set; } = "192.168.1.201";

    [Required]
    public int Port { get; set; } = 4370;

    [Required]
    public int MachineNumber { get; set; } = 1;

    public int? CommKey { get; set; } = 0;

    [System.ComponentModel.DataAnnotations.Schema.Column("organization_id")]
    public int OrganizationId { get; set; }

    public Organization? Organization { get; set; }
}

