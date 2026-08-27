namespace HRDesk.Web.Services.AI;

/// <summary>
/// Represents a newly issued liveness challenge returned to the client.
/// The client must send ChallengeId back with the frame sequence — it must
/// NOT send any boolean like "challengeCompleted"; the server decides.
/// </summary>
public sealed record FaceChallenge(
    string        ChallengeId,
    ChallengeType ChallengeType,
    /// <summary>Human-readable instruction displayed by the Flutter UI.</summary>
    string        Instruction,
    /// <summary>UTC expiry — client should display a countdown.</summary>
    DateTimeOffset ExpiresAt,
    /// <summary>Number of frames Flutter must capture (e.g. 5).</summary>
    int           FrameCount,
    /// <summary>Interval between frame captures in milliseconds (e.g. 500).</summary>
    int           IntervalMs
);

public interface IFaceChallengeService
{
    /// <summary>
    /// Issues a new random challenge bound to the given employee and punch type.
    /// The challenge is stored in IMemoryCache with a short TTL and must be used
    /// exactly once before expiry.
    /// </summary>
    FaceChallenge Issue(int employeeId, string punchType);

    /// <summary>
    /// Validates a challenge token and returns the challenge details if valid.
    /// Marks the challenge as used so it cannot be replayed.
    ///
    /// Returns null if:
    ///   - challengeId is unknown or expired
    ///   - challenge has already been used (replay attempt)
    ///   - employeeId or punchType does not match the issued challenge
    /// </summary>
    FaceChallenge? Consume(string challengeId, int employeeId, string punchType);
}
