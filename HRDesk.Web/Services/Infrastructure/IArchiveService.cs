using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Infrastructure;

/// <summary>
/// Outcome of an archive-lifecycle operation. Controllers map this straight onto an IActionResult.
/// </summary>
public sealed record ArchiveResult(bool Success, string Message, string? ErrorCode = null)
{
    public static ArchiveResult Ok(string message) => new(true, message);
    public static ArchiveResult Fail(string message, string? code = null) => new(false, message, code);

    /// <summary>Row does not exist, or exists outside the caller's tenant.</summary>
    public const string NotFound = "NOT_FOUND";
    /// <summary>Hard delete attempted on a row that has not been archived first.</summary>
    public const string NotArchived = "NOT_ARCHIVED";
    /// <summary>A domain rule forbids the operation (system role, disbursed loan, default template, ...).</summary>
    public const string Blocked = "BLOCKED";
    /// <summary>Row is already in the requested state.</summary>
    public const string NoOp = "NO_OP";
}

/// <summary>
/// THE single place archive / restore / permanent-delete logic lives.
///
/// Do NOT reimplement soft delete in a controller, page, or module service. Every
/// module routes through here so behaviour and audit logging stay identical everywhere.
///
/// UI CONTRACT — one button, always labelled "Delete":
///   Main/active list → <see cref="ArchiveAsync{T}"/>          (reversible, no scary warning)
///   Archive view     → <see cref="PermanentDeleteAsync{T}"/>  (irreversible, confirm modal)
///   Archive view also shows a separate "Restore" → <see cref="RestoreAsync{T}"/>
///
/// GUARD HOOK
/// Pass a <paramref name="guard"/> delegate to enforce domain rules (e.g. "cannot delete a
/// system role", "cannot delete a disbursed loan"). Returning a non-null string blocks the
/// operation and that string becomes the error message.
/// </summary>
public interface IArchiveService
{
    /// <summary>
    /// Soft delete: stamps ArchivedAt/ArchivedBy so the row disappears from normal queries.
    /// This is what the "Delete" button calls from the main list.
    /// </summary>
    Task<ArchiveResult> ArchiveAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable;

    /// <summary>
    /// Clears ArchivedAt/ArchivedBy, returning the row to the active list.
    /// Backs the "Restore" button inside the Archive view.
    /// </summary>
    Task<ArchiveResult> RestoreAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable;

    /// <summary>
    /// Hard delete. Throws/fails unless the row is already archived — you can only
    /// permanently delete something you have already archived.
    /// This is what the "Delete" button calls from inside the Archive view.
    /// </summary>
    /// <param name="cascade">
    /// Optional hook to clear dependent rows before the delete. Required for entities with
    /// restricted FKs, since the model disables cascade delete globally.
    /// </param>
    Task<ArchiveResult> PermanentDeleteAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        Func<T, Task>? cascade = null,
        CancellationToken ct = default) where T : class, IArchivable;

    /// <summary>Archived rows for the current tenant, for the Archive view.</summary>
    Task<List<T>> GetArchivedAsync<T>(CancellationToken ct = default) where T : class, IArchivable;

    /// <summary>Count of archived rows for the current tenant — for the Archive tab badge.</summary>
    Task<int> CountArchivedAsync<T>(CancellationToken ct = default) where T : class, IArchivable;

    /// <summary>
    /// Loads a single row ignoring the archive filter (tenant filter still applies).
    /// Use when you need to inspect an archived row without going through the operations above.
    /// </summary>
    Task<T?> FindIncludingArchivedAsync<T>(object id, CancellationToken ct = default) where T : class;
}
