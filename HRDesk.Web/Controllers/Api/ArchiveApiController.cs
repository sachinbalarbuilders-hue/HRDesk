using HRDesk.Web.Constants;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace HRDesk.Web.Controllers.Api;

/// <summary>
/// Shared archive-lifecycle endpoints for every registered entity. One controller, no per-module
/// duplication — the entity is selected by the {entity} route slug via <see cref="ArchivableRegistry"/>.
///
///   POST   /api/archive/{entity}/{id}          → archive   (what "Delete" calls from the main list)
///   POST   /api/archive/{entity}/{id}/restore  → restore   ("Restore" button in the Archive view)
///   DELETE /api/archive/{entity}/{id}          → hard delete ("Delete" from inside the Archive view)
///   GET    /api/archive/{entity}               → archived rows for the Archive view
///   GET    /api/archive/{entity}/count         → archived count for the Archive tab badge
///
/// The frontend uses ONE button component labelled "Delete" in both places; only the endpoint it
/// hits differs depending on which view it is rendered in.
/// </summary>
[ApiController]
[Route("api/archive")]
[Authorize]
public class ArchiveController : ControllerBase
{
    private readonly IArchiveService _archive;
    private readonly IPermissionService _permissionService;

    public ArchiveController(IArchiveService archive, IPermissionService permissionService)
    {
        _archive = archive;
        _permissionService = permissionService;
    }

    // ── POST /api/archive/{entity}/{id} — soft delete ────────────────────────

    [HttpPost("{entity}/{id}")]
    public Task<IActionResult> Archive(string entity, string id)
        => Invoke(entity, id, nameof(IArchiveService.ArchiveAsync));

    // ── POST /api/archive/{entity}/{id}/restore ──────────────────────────────

    [HttpPost("{entity}/{id}/restore")]
    public Task<IActionResult> Restore(string entity, string id)
        => Invoke(entity, id, nameof(IArchiveService.RestoreAsync));

    // ── DELETE /api/archive/{entity}/{id} — hard delete ──────────────────────

    [HttpDelete("{entity}/{id}")]
    public Task<IActionResult> PermanentDelete(string entity, string id)
        => Invoke(entity, id, nameof(IArchiveService.PermanentDeleteAsync));

    // ── BULK OPERATIONS ──────────────────────────────────────────────────────

    public class BulkArchiveRequest
    {
        public List<string> Ids { get; set; } = new();
    }

    [HttpPost("{entity}/bulk-archive")]
    public Task<IActionResult> BulkArchive(string entity, [FromBody] BulkArchiveRequest request)
        => InvokeBulk(entity, request?.Ids, nameof(IArchiveService.BulkArchiveAsync));

    [HttpPost("{entity}/bulk-restore")]
    public Task<IActionResult> BulkRestore(string entity, [FromBody] BulkArchiveRequest request)
        => InvokeBulk(entity, request?.Ids, nameof(IArchiveService.BulkRestoreAsync));

    [HttpPost("{entity}/bulk-delete")]
    public Task<IActionResult> BulkPermanentDelete(string entity, [FromBody] BulkArchiveRequest request)
        => InvokeBulk(entity, request?.Ids, nameof(IArchiveService.BulkPermanentDeleteAsync));

    // ── GET /api/archive/{entity} — archive view ─────────────────────────────

    [HttpGet("{entity}")]
    public async Task<IActionResult> GetArchived(string entity)
    {
        if (!ArchivableRegistry.TryResolve(entity, out var reg))
            return NotFound(new { message = $"Unknown archivable entity '{entity}'." });

        if (!await _permissionService.HasPermissionAsync(User, reg.ViewPermission) &&
            !await _permissionService.HasPermissionAsync(User, reg.DeletePermission))
            return Forbid();

        var task = (Task)typeof(IArchiveService)
            .GetMethod(nameof(IArchiveService.GetArchivedAsync))!
            .MakeGenericMethod(reg.EntityType)
            .Invoke(_archive, new object?[] { CancellationToken.None })!;

        await task;
        var rows = task.GetType().GetProperty("Result")!.GetValue(task);

        return Ok(rows);
    }

    // ── GET /api/archive/{entity}/count ──────────────────────────────────────

    [HttpGet("{entity}/count")]
    public async Task<IActionResult> GetArchivedCount(string entity)
    {
        if (!ArchivableRegistry.TryResolve(entity, out var reg))
            return NotFound(new { message = $"Unknown archivable entity '{entity}'." });

        if (!await _permissionService.HasPermissionAsync(User, reg.ViewPermission) &&
            !await _permissionService.HasPermissionAsync(User, reg.DeletePermission))
            return Forbid();

        var task = (Task)typeof(IArchiveService)
            .GetMethod(nameof(IArchiveService.CountArchivedAsync))!
            .MakeGenericMethod(reg.EntityType)
            .Invoke(_archive, new object?[] { CancellationToken.None })!;

        await task;
        var count = (int)task.GetType().GetProperty("Result")!.GetValue(task)!;

        return Ok(new { entity = reg.Slug, archivedCount = count });
    }

    // ── GET /api/archive — list what is registered (useful for debugging) ────

    [HttpGet]
    public IActionResult GetRegistry() => Ok(
        ArchivableRegistry.All.Select(e => new { e.Slug, entity = e.EntityType.Name, e.DisplayName }));

    // ── Shared reflection dispatcher ─────────────────────────────────────────

    /// <summary>
    /// Resolves the slug → entity type, checks the permission, coerces the id to the PK's CLR type,
    /// then invokes the requested generic IArchiveService method.
    /// </summary>
    private async Task<IActionResult> Invoke(string entity, string rawId, string methodName)
    {
        if (!ArchivableRegistry.TryResolve(entity, out var reg))
            return NotFound(new { message = $"Unknown archivable entity '{entity}'." });

        if (!await _permissionService.HasPermissionAsync(User, reg.DeletePermission))
            return Forbid();

        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("SuperAdmin");
        if (!isSuperAdmin)
        {
            var def = AppPermissions.All.FirstOrDefault(d => d.Key == reg.DeletePermission);
            if (def != null && def.SupportsScope && methodName == nameof(IArchiveService.PermanentDeleteAsync))
            {
                var deleteScope = await _permissionService.GetPermissionScopeAsync(User, reg.DeletePermission);
                if (deleteScope != "Permanent Delete" && deleteScope != "Bulk Delete" && deleteScope != "All")
                {
                    return StatusCode(403, new { message = "You do not have permission to permanently delete records." });
                }
            }
        }

        if (!TryCoerceId(rawId, out var id))
            return BadRequest(new { message = $"Invalid id '{rawId}'." });

        var method = typeof(IArchiveService)
            .GetMethods()
            .First(m => m.Name == methodName && m.IsGenericMethodDefinition)
            .MakeGenericMethod(reg.EntityType);

        // Fill every parameter after `id` with its default (null guard / null cascade / default ct).
        var parameters = method.GetParameters();
        var args = new object?[parameters.Length];
        args[0] = id;
        for (int i = 1; i < parameters.Length; i++)
            args[i] = parameters[i].ParameterType == typeof(CancellationToken)
                ? CancellationToken.None
                : null;

        var task = (Task)method.Invoke(_archive, args)!;
        await task;

        var result = (ArchiveResult)task.GetType().GetProperty("Result")!.GetValue(task)!;

        if (result.Success)
            return Ok(new { success = true, message = result.Message });

        return result.ErrorCode switch
        {
            ArchiveResult.NotFound => NotFound(new { success = false, message = result.Message }),
            _ => BadRequest(new { success = false, message = result.Message, code = result.ErrorCode })
        };
    }

    private async Task<IActionResult> InvokeBulk(string entity, List<string>? rawIds, string methodName)
    {
        if (!ArchivableRegistry.TryResolve(entity, out var reg))
            return NotFound(new { message = $"Unknown archivable entity '{entity}'." });

        if (!await _permissionService.HasPermissionAsync(User, reg.DeletePermission))
            return Forbid();

        var isSuperAdmin = string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) || User.IsInRole("SuperAdmin");
        if (!isSuperAdmin)
        {
            var def = AppPermissions.All.FirstOrDefault(d => d.Key == reg.DeletePermission);
            if (def != null && def.SupportsScope)
            {
                var deleteScope = await _permissionService.GetPermissionScopeAsync(User, reg.DeletePermission);
                if (methodName == nameof(IArchiveService.BulkPermanentDeleteAsync))
                {
                    if (deleteScope != "Bulk Delete" && deleteScope != "Permanent Delete" && deleteScope != "All")
                    {
                        return StatusCode(403, new { message = "You do not have permission to permanently delete records in bulk." });
                    }
                }
                else if (methodName == nameof(IArchiveService.BulkArchiveAsync) || methodName == nameof(IArchiveService.BulkRestoreAsync))
                {
                    if (deleteScope != "Bulk Delete" && deleteScope != "Permanent Delete" && deleteScope != "All")
                    {
                        return StatusCode(403, new { message = "You do not have permission to perform bulk delete/restore operations." });
                    }
                }
            }
        }

        if (rawIds == null || rawIds.Count == 0)
            return BadRequest(new { message = "No IDs provided." });

        var coercedIds = new List<object>();
        foreach (var raw in rawIds)
        {
            if (TryCoerceId(raw, out var id))
                coercedIds.Add(id);
        }

        if (coercedIds.Count == 0)
            return BadRequest(new { message = "No valid IDs provided." });

        var method = typeof(IArchiveService)
            .GetMethods()
            .First(m => m.Name == methodName && m.IsGenericMethodDefinition)
            .MakeGenericMethod(reg.EntityType);

        var parameters = method.GetParameters();
        var args = new object?[parameters.Length];
        args[0] = coercedIds;
        for (int i = 1; i < parameters.Length; i++)
            args[i] = parameters[i].ParameterType == typeof(CancellationToken)
                ? CancellationToken.None
                : null;

        var task = (Task)method.Invoke(_archive, args)!;
        await task;

        var result = (BulkArchiveResult)task.GetType().GetProperty("Result")!.GetValue(task)!;

        return Ok(new
        {
            success = result.AllSucceeded,
            successCount = result.SuccessCount,
            failureCount = result.FailureCount,
            messages = result.Messages,
            message = $"{result.SuccessCount} record(s) processed successfully" + (result.FailureCount > 0 ? $", {result.FailureCount} failed." : ".")
        });
    }

    /// <summary>Accepts both integer PKs and Guid PKs (Branch, Role, Employee use Guid publicIds).</summary>
    private static bool TryCoerceId(string raw, out object id)
    {
        if (int.TryParse(raw, out var i)) { id = i; return true; }
        if (Guid.TryParse(raw, out var g)) { id = g; return true; }
        id = null!;
        return false;
    }
}
