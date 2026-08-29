namespace HRDesk.Web.Models;

/// <summary>
/// Marks an entity as supporting the archive-then-delete lifecycle.
///
/// LIFECYCLE
/// ---------
///   Active  ──(Delete button in main list)──▶  Archived  ──(Delete button in Archive view)──▶  Gone
///      ▲                                          │
///      └──────────(Restore button)─────────────────┘
///
/// The UI exposes ONE button labelled "Delete" everywhere. Its behaviour depends on
/// which view it is rendered in:
///   - Main/active list  → calls IArchiveService.ArchiveAsync         (reversible)
///   - Archive view      → calls IArchiveService.PermanentDeleteAsync (irreversible, confirmed)
///
/// QUERY BEHAVIOUR
/// ---------------
/// Archived rows are excluded automatically by the global query filter in
/// <see cref="Data.BiometricAttendanceDbContext"/>. To read them, either:
///   - set <c>_db.BypassArchiveFilter = true</c>, or
///   - use <c>IArchiveService.GetArchivedAsync&lt;T&gt;()</c>.
///
/// Never write soft-delete logic per-module. Always go through IArchiveService.
/// </summary>
public interface IArchivable
{
    /// <summary>UTC timestamp when the row was archived. Null = active.</summary>
    DateTime? ArchivedAt { get; set; }

    /// <summary>Username of whoever archived the row. Null when active.</summary>
    string? ArchivedBy { get; set; }
}
