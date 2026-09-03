using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.AI;

/// <summary>
/// Issues and validates one-time face liveness challenges.
///
/// Challenge lifecycle:
///   1. Issue()   → creates a random GUID, stores ChallengeEntry in IMemoryCache with TTL
///   2. Flutter   → displays instruction, captures frames, sends (challengeId + frames[]) to PunchIn
///   3. Consume() → validates binding (employee + punchType), marks used, returns ChallengeType
///   4. PunchIn   → runs FaceMotionService.VerifyMotionAsync on the frames
///
/// Replay protection:
///   - ChallengeId is a cryptographically random GUID (128-bit, ~10³⁸ search space)
///   - TTL = 30 seconds (configurable via FaceVerification:ChallengeTtlSeconds)
///   - One-time use: Consume() sets IsUsed=true; second call returns null
///   - Bound to (employeeId, punchType): challenge for emp-A cannot be used for emp-B
///   - IMemoryCache is per-process; challenges do not survive server restarts (acceptable
///     since TTL is 30 s — any live challenge simply expires naturally on restart)
/// </summary>
public enum ChallengeType
{
    TurnLeft,
    TurnRight,
}

public sealed record FaceChallenge(
    string        ChallengeId,
    ChallengeType ChallengeType,
    string        Instruction,
    DateTimeOffset ExpiresAt,
    int           FrameCount,
    int           IntervalMs
);

public sealed class FaceChallengeService
{
    // Cache key prefix keeps challenge entries isolated from other cache data
    private const string Prefix = "FaceChallenge:";

    // Default config values — overridden by FaceVerification:* in appsettings
    private const int DefaultTtlSeconds  = 30;
    private const int DefaultFrameCount  = 5;
    private const int DefaultIntervalMs  = 500;

    private static readonly ChallengeType[] ChallengeTypes =
    {
        ChallengeType.TurnLeft,
        ChallengeType.TurnRight,
    };

    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;
    private readonly ILogger<FaceChallengeService> _logger;

    // ThreadLocal Random for challenge type selection (System.Random is not thread-safe)
    [ThreadStatic]
    private static Random? _rng;
    private static Random Rng => _rng ??= new Random();

    public FaceChallengeService(
        IMemoryCache cache,
        IConfiguration config,
        ILogger<FaceChallengeService> logger)
    {
        _cache  = cache;
        _config = config;
        _logger = logger;
    }

    // -----------------------------------------------------------------------
    // Issue
    // -----------------------------------------------------------------------

    public FaceChallenge Issue(int employeeId, string punchType)
    {
        int ttl        = _config.GetValue("FaceVerification:ChallengeTtlSeconds", DefaultTtlSeconds);
        int frameCount = _config.GetValue("FaceVerification:ChallengeFrameCount",  DefaultFrameCount);
        int intervalMs = _config.GetValue("FaceVerification:ChallengeIntervalMs",  DefaultIntervalMs);

        var type       = ChallengeTypes[Rng.Next(ChallengeTypes.Length)];
        var id         = Guid.NewGuid().ToString("N"); // 32 hex chars, no dashes
        var expiresAt  = DateTimeOffset.UtcNow.AddSeconds(ttl);
        var instruction = type == ChallengeType.TurnLeft
            ? "Slowly turn your head to the LEFT"
            : "Slowly turn your head to the RIGHT";

        var entry = new ChallengeEntry(
            ChallengeId:  id,
            ChallengeType: type,
            EmployeeId:   employeeId,
            PunchType:    punchType.Trim().ToLowerInvariant(),
            IssuedAt:     DateTimeOffset.UtcNow,
            IsUsed:       false
        );

        _cache.Set(
            Prefix + id,
            entry,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpiration = expiresAt,
                Priority = CacheItemPriority.Low,
            });

        _logger.LogInformation(
            "[FaceChallenge] Issued challenge {Id} type={Type} empId={EmpId} punchType={PunchType} ttl={Ttl}s",
            id, type, employeeId, punchType, ttl);

        return new FaceChallenge(
            ChallengeId:   id,
            ChallengeType: type,
            Instruction:   instruction,
            ExpiresAt:     expiresAt,
            FrameCount:    frameCount,
            IntervalMs:    intervalMs);
    }

    // -----------------------------------------------------------------------
    // Consume
    // -----------------------------------------------------------------------

    public FaceChallenge? Consume(string challengeId, int employeeId, string punchType)
    {
        if (string.IsNullOrWhiteSpace(challengeId))
        {
            _logger.LogWarning("[FaceChallenge] Consume called with null/empty challengeId.");
            return null;
        }

        var key = Prefix + challengeId;

        if (!_cache.TryGetValue<ChallengeEntry>(key, out var entry) || entry is null)
        {
            _logger.LogWarning(
                "[FaceChallenge] Unknown or expired challengeId={Id} empId={EmpId}",
                challengeId, employeeId);
            return null;
        }

        // ── Replay check ────────────────────────────────────────────────────
        if (entry.IsUsed)
        {
            _logger.LogWarning(
                "[FaceChallenge] REPLAY ATTEMPT — challengeId={Id} already used. empId={EmpId}",
                challengeId, employeeId);
            return null;
        }

        // ── Binding check ────────────────────────────────────────────────────
        if (entry.EmployeeId != employeeId ||
            entry.PunchType   != punchType.Trim().ToLowerInvariant())
        {
            _logger.LogWarning(
                "[FaceChallenge] Binding mismatch. " +
                "Issued for emp={IssuedEmp}/{IssuedPunch}, attempted by emp={AttemptedEmp}/{AttemptedPunch}. " +
                "challengeId={Id}",
                entry.EmployeeId, entry.PunchType,
                employeeId, punchType, challengeId);
            return null;
        }

        // ── Mark used (one-time token) — update cache in place ───────────────
        var used = entry with { IsUsed = true };
        // Preserve the original TTL by re-setting with the remaining window
        var remaining = entry.IssuedAt.AddSeconds(
            _config.GetValue("FaceVerification:ChallengeTtlSeconds", DefaultTtlSeconds))
            - DateTimeOffset.UtcNow;
        if (remaining > TimeSpan.Zero)
        {
            _cache.Set(key, used,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = remaining,
                    Priority = CacheItemPriority.Low,
                });
        }
        else
        {
            _cache.Remove(key);
        }

        int frameCount = _config.GetValue("FaceVerification:ChallengeFrameCount", DefaultFrameCount);
        int intervalMs = _config.GetValue("FaceVerification:ChallengeIntervalMs",  DefaultIntervalMs);

        var instruction = entry.ChallengeType == ChallengeType.TurnLeft
            ? "Slowly turn your head to the LEFT"
            : "Slowly turn your head to the RIGHT";

        _logger.LogInformation(
            "[FaceChallenge] Consumed challenge {Id} type={Type} empId={EmpId}",
            challengeId, entry.ChallengeType, employeeId);

        return new FaceChallenge(
            ChallengeId:   challengeId,
            ChallengeType: entry.ChallengeType,
            Instruction:   instruction,
            ExpiresAt:     entry.IssuedAt.AddSeconds(
                               _config.GetValue("FaceVerification:ChallengeTtlSeconds", DefaultTtlSeconds)),
            FrameCount:    frameCount,
            IntervalMs:    intervalMs);
    }

    // -----------------------------------------------------------------------
    // Private record — only lives in the cache, never sent to client
    // -----------------------------------------------------------------------

    private sealed record ChallengeEntry(
        string        ChallengeId,
        ChallengeType ChallengeType,
        int           EmployeeId,
        string        PunchType,
        DateTimeOffset IssuedAt,
        bool          IsUsed
    );
}
