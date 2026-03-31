using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

[Table("device_sync_state")]
public class DeviceSyncState
{
    [Key]
    [Column("device_id")]
    public int DeviceId { get; set; }

    [Column("device_ip")]
    public string DeviceIp { get; set; } = "";

    [Column("last_synced_time")]
    public DateTime LastSyncedTime { get; set; }

    [Column("last_sync_status")]
    public string LastSyncStatus { get; set; } = "";

    [Column("records_synced")]
    public int RecordsSynced { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
