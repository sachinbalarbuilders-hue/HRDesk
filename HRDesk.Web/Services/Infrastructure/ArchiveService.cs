using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Services;

namespace HRDesk.Web.Services.Infrastructure;

/// <summary>
/// Generic implementation of the archive-then-delete lifecycle. See <see cref="IArchiveService"/>
/// for the contract and the UI rules this backs.
///
/// Audit logging is handled automatically by the DbContext SaveChanges pipeline, which relabels
/// an ArchivedAt change as Action="ARCHIVE" / "RESTORE" and a row removal as Action="DELETE".
/// This service adds a structured log line on top for operational traceability.
/// </summary>
public class ArchiveService : IArchiveService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<ArchiveService> _logger;

    public ArchiveService(
        BiometricAttendanceDbContext db,
        IHttpContextAccessor http,
        ILogger<ArchiveService> logger)
    {
        _db = db;
        _http = http;
        _logger = logger;
    }

    private string CurrentUser => _http.HttpContext?.User?.Identity?.Name ?? "System";

    // ── Archive ──────────────────────────────────────────────────────────────

    public async Task<ArchiveResult> ArchiveAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        var entity = await FindIncludingArchivedAsync<T>(id, ct);
        if (entity == null)
            return ArchiveResult.Fail($"{Label<T>()} not found.", ArchiveResult.NotFound);

        if (entity.ArchivedAt != null)
        {
            return ArchiveResult.Ok($"{Label<T>()} is already archived.");
        }
        else
        {
            var prop = entity.GetType().GetProperty("Status") ?? entity.GetType().GetProperty("IsActive");
            var status = prop?.GetValue(entity);
            bool isLegacyArchived = (status is string s && (s.Equals("inactive", StringComparison.OrdinalIgnoreCase) || s.Equals("archived", StringComparison.OrdinalIgnoreCase))) ||
                                    (status is bool b && b == false);
                                    
            if (isLegacyArchived)
            {
                // It's a legacy record, we can safely overwrite it to formally archive it
                // We don't return early here, we let the formal archive process complete.
            }
        }

        var blocked = guard?.Invoke(entity);
        if (blocked != null)
            return ArchiveResult.Fail(blocked, ArchiveResult.Blocked);

        entity.ArchivedAt = DateTime.UtcNow;
        entity.ArchivedBy = CurrentUser;

        if (entity is Employee empArchive)
        {
            empArchive.Status = "inactive";
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "[Archive] ARCHIVE {Entity} id={Id} by={User}", typeof(T).Name, id, CurrentUser);

        return ArchiveResult.Ok($"{Label<T>()} moved to archive.");
    }

    // ── Restore ──────────────────────────────────────────────────────────────

    public async Task<ArchiveResult> RestoreAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        var entity = await FindIncludingArchivedAsync<T>(id, ct);
        if (entity == null)
            return ArchiveResult.Fail($"{Label<T>()} not found.", ArchiveResult.NotFound);

        if (entity.ArchivedAt == null)
        {
            var prop = entity.GetType().GetProperty("Status") ?? entity.GetType().GetProperty("IsActive");
            var status = prop?.GetValue(entity);
            bool isLegacyArchived = (status is string s && (s.Equals("inactive", StringComparison.OrdinalIgnoreCase) || s.Equals("archived", StringComparison.OrdinalIgnoreCase))) ||
                                    (status is bool b && b == false);

            if (!isLegacyArchived)
            {
                return ArchiveResult.Ok($"{Label<T>()} is already active.");
            }
            else
            {
                // Fix legacy record by activating it
                if (prop?.PropertyType == typeof(string)) prop.SetValue(entity, "Active");
                else if (prop?.PropertyType == typeof(bool)) prop.SetValue(entity, true);
            }
        }

        var blocked = guard?.Invoke(entity);
        if (blocked != null)
            return ArchiveResult.Fail(blocked, ArchiveResult.Blocked);

        entity.ArchivedAt = null;
        entity.ArchivedBy = null;

        if (entity is Employee empRestore)
        {
            empRestore.Status = "active";
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "[Archive] RESTORE {Entity} id={Id} by={User}", typeof(T).Name, id, CurrentUser);

        return ArchiveResult.Ok($"{Label<T>()} restored.");
    }

    // ── Permanent delete ─────────────────────────────────────────────────────

    public async Task<ArchiveResult> PermanentDeleteAsync<T>(
        object id,
        Func<T, string?>? guard = null,
        Func<T, Task>? cascade = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        var entity = await FindIncludingArchivedAsync<T>(id, ct);
        if (entity == null)
            return ArchiveResult.Fail($"{Label<T>()} not found.", ArchiveResult.NotFound);

        // Core safety rule: hard delete is only reachable from the Archive view.
        if (entity.ArchivedAt == null)
        {
            // Allow legacy inactive records that haven't been migrated to ArchivedAt
            var prop = entity.GetType().GetProperty("Status") ?? entity.GetType().GetProperty("IsActive");
            var status = prop?.GetValue(entity);
            bool isLegacyArchived = (status is string s && (s.Equals("inactive", StringComparison.OrdinalIgnoreCase) || s.Equals("archived", StringComparison.OrdinalIgnoreCase))) ||
                                    (status is bool b && b == false);

            if (!isLegacyArchived)
            {
                return ArchiveResult.Fail(
                    $"{Label<T>()} must be archived before it can be permanently deleted.",
                    ArchiveResult.NotArchived);
            }
        }

        var blocked = guard?.Invoke(entity);
        if (blocked != null)
            return ArchiveResult.Fail(blocked, ArchiveResult.Blocked);

        // FKs are Restrict-only across the model, so dependents must be cleared explicitly.
        if (cascade != null)
            await cascade(entity);

        _db.Set<T>().Remove(entity);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex,
                "[Archive] PERMANENT DELETE blocked by FK constraint {Entity} id={Id}", typeof(T).Name, id);
            return ArchiveResult.Fail(
                $"Cannot permanently delete this {Label<T>().ToLowerInvariant()} because other records still reference it.",
                ArchiveResult.Blocked);
        }

        _logger.LogWarning(
            "[Archive] PERMANENT DELETE {Entity} id={Id} by={User}", typeof(T).Name, id, CurrentUser);

        return ArchiveResult.Ok($"{Label<T>()} permanently deleted.");
    }

    // ── Bulk Operations ──────────────────────────────────────────────────────

    public async Task<BulkArchiveResult> BulkArchiveAsync<T>(
        IEnumerable<object> ids,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        int success = 0;
        int fail = 0;
        var msgs = new List<string>();

        foreach (var id in ids)
        {
            var res = await ArchiveAsync<T>(id, guard, ct);
            if (res.Success)
                success++;
            else
            {
                fail++;
                msgs.Add($"ID {id}: {res.Message}");
            }
        }

        return BulkArchiveResult.Create(success, fail, msgs);
    }

    public async Task<BulkArchiveResult> BulkRestoreAsync<T>(
        IEnumerable<object> ids,
        Func<T, string?>? guard = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        int success = 0;
        int fail = 0;
        var msgs = new List<string>();

        foreach (var id in ids)
        {
            var res = await RestoreAsync<T>(id, guard, ct);
            if (res.Success)
                success++;
            else
            {
                fail++;
                msgs.Add($"ID {id}: {res.Message}");
            }
        }

        return BulkArchiveResult.Create(success, fail, msgs);
    }

    public async Task<BulkArchiveResult> BulkPermanentDeleteAsync<T>(
        IEnumerable<object> ids,
        Func<T, string?>? guard = null,
        Func<T, Task>? cascade = null,
        CancellationToken ct = default) where T : class, IArchivable
    {
        int success = 0;
        int fail = 0;
        var msgs = new List<string>();

        foreach (var id in ids)
        {
            var res = await PermanentDeleteAsync<T>(id, guard, cascade, ct);
            if (res.Success)
                success++;
            else
            {
                fail++;
                msgs.Add($"ID {id}: {res.Message}");
            }
        }

        return BulkArchiveResult.Create(success, fail, msgs);
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    public async Task<List<T>> GetArchivedAsync<T>(CancellationToken ct = default)
        where T : class, IArchivable
    {
        var previous = _db.BypassArchiveFilter;
        _db.BypassArchiveFilter = true;
        try
        {
            // Tenant filter still applies — only the archive predicate is lifted.
            return await _db.Set<T>()
                .AsNoTracking()
                .Where(e => e.ArchivedAt != null)
                .OrderByDescending(e => e.ArchivedAt)
                .ToListAsync(ct);
        }
        finally
        {
            _db.BypassArchiveFilter = previous;
        }
    }

    public async Task<int> CountArchivedAsync<T>(CancellationToken ct = default)
        where T : class, IArchivable
    {
        var previous = _db.BypassArchiveFilter;
        _db.BypassArchiveFilter = true;
        try
        {
            return await _db.Set<T>().CountAsync(e => e.ArchivedAt != null, ct);
        }
        finally
        {
            _db.BypassArchiveFilter = previous;
        }
    }

    public async Task<T?> FindIncludingArchivedAsync<T>(object id, CancellationToken ct = default)
        where T : class
    {
        var previous = _db.BypassArchiveFilter;
        _db.BypassArchiveFilter = true;
        try
        {
            if (typeof(T) == typeof(Employee))
            {
                if (id is Guid g)
                    return await _db.Employees.FirstOrDefaultAsync(e => e.PublicId == g, ct) as T;
                if (id is string s && Guid.TryParse(s, out var parsedGuid))
                    return await _db.Employees.FirstOrDefaultAsync(e => e.PublicId == parsedGuid, ct) as T;
                if (id is int intId)
                    return await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == intId, ct) as T;
                if (id is string s2 && int.TryParse(s2, out var parsedInt))
                    return await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == parsedInt, ct) as T;
            }

            if (typeof(T) == typeof(Branch))
            {
                if (id is Guid g)
                    return await _db.Branches.FirstOrDefaultAsync(b => b.PublicId == g, ct) as T;
                if (id is string s && Guid.TryParse(s, out var parsedGuid))
                    return await _db.Branches.FirstOrDefaultAsync(b => b.PublicId == parsedGuid, ct) as T;
                if (id is int intId)
                    return await _db.Branches.FirstOrDefaultAsync(b => b.Id == intId, ct) as T;
                if (id is string s2 && int.TryParse(s2, out var parsedInt))
                    return await _db.Branches.FirstOrDefaultAsync(b => b.Id == parsedInt, ct) as T;
            }

            var entityType = _db.Model.FindEntityType(typeof(T));
            var pk = entityType?.FindPrimaryKey();
            
            if (pk != null && pk.Properties.Count > 1 && typeof(IMustHaveTenant).IsAssignableFrom(typeof(T)))
            {
                int tenantId = _http.HttpContext?.RequestServices.GetService<ICurrentTenantProvider>()?.TenantId ?? 0;
                var keyValues = new object[pk.Properties.Count];
                for (int i = 0; i < pk.Properties.Count; i++)
                {
                    if (pk.Properties[i].Name == "OrganizationId") 
                        keyValues[i] = tenantId;
                    else 
                        keyValues[i] = id;
                }
                return await _db.Set<T>().FindAsync(keyValues, ct);
            }

            // FindAsync respects the tenant filter, so cross-tenant access stays blocked.
            return await _db.Set<T>().FindAsync(new[] { id }, ct);
        }
        finally
        {
            _db.BypassArchiveFilter = previous;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Turns "SalaryStructureTemplate" into "Salary structure template" for messages.</summary>
    private static string Label<T>()
    {
        var name = typeof(T).Name;
        var sb = new System.Text.StringBuilder(name.Length + 8);
        for (int i = 0; i < name.Length; i++)
        {
            if (i > 0 && char.IsUpper(name[i]) && !char.IsUpper(name[i - 1]))
                sb.Append(' ').Append(char.ToLowerInvariant(name[i]));
            else
                sb.Append(name[i]);
        }
        return sb.ToString();
    }
}
