namespace HRDesk.Web.Services.AI;

/// <summary>
/// The type of head movement the challenge requires.
/// Only TURN_LEFT and TURN_RIGHT are used in v1 — they produce the clearest
/// nose-offset landmark signal and are unambiguous to perform and to detect.
/// </summary>
public enum ChallengeType
{
    TurnLeft,
    TurnRight,
}

/// <summary>
/// The result of verifying temporal head movement across a frame sequence.
/// </summary>
public sealed record MotionVerificationResult(
    bool    IsVerified,
    string? FailReason,
    /// <summary>Per-frame nose-offset values (for calibration logging).</summary>
    float[] FrameOffsets
);

public interface IFaceMotionService
{
    /// <summary>
    /// Verifies that a sequence of raw JPEG frames demonstrates the required
    /// head movement for the given challenge type.
    ///
    /// Security contract (fail-closed):
    ///   - Returns IsVerified=false on any exception or if face is undetectable
    ///     in any frame.
    ///   - Never returns IsVerified=true based on client-supplied flags.
    ///   - Does NOT retain any frame data after analysis.
    ///
    /// Algorithm (YuNet landmark-based nose-offset):
    ///   Frame 0 = baseline (face centered, before movement)
    ///   Frames 1–N = movement window
    ///
    ///   TURN_LEFT  → nose moves right of eye midpoint → noseOffset increases
    ///   TURN_RIGHT → nose moves left  of eye midpoint → noseOffset decreases
    ///
    ///   noseOffset = (nose_x − eyeMid_x) / interEyeDistance   (signed, normalised)
    ///   Required: max(|peak − baseline|) ≥ MinTurnDelta (configurable, default 0.15)
    ///
    /// Why 0.15: A genuine 20–25° head turn shifts the nose ~15–25% of the
    /// inter-eye distance. A static photo has delta = 0. The 0.15 threshold
    /// requires meaningful motion while tolerating natural head sway (~0.02–0.05).
    /// </summary>
    Task<MotionVerificationResult> VerifyMotionAsync(
        IReadOnlyList<byte[]> frameBytes,
        ChallengeType         challengeType,
        float                 minTurnDelta = 0.15f);
}
