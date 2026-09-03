using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace HRDesk.Web.Services.AI;

/// <summary>
/// Verifies temporal head movement across a captured frame sequence using the
/// YuNet 5-point facial landmarks already available in IFaceRecognitionService.
///
/// Landmark layout (index order from DetectFaceLandmarks):
///   0,1  = right eye  (x, y)
///   2,3  = left eye   (x, y)
///   4,5  = nose       (x, y)
///   6,7  = right mouth corner
///   8,9  = left mouth corner
///
/// Motion metric — normalised nose horizontal offset:
///   eyeMid_x   = (rightEye_x + leftEye_x) / 2
///   eyeDist    = |leftEye_x − rightEye_x|          (inter-eye distance)
///   noseOffset = (nose_x − eyeMid_x) / eyeDist     (range roughly −1 to +1)
///
///   noseOffset ≈  0.00  → facing forward
///   noseOffset > +0.15  → turned LEFT  (nose appears right of centre)
///   noseOffset < −0.15  → turned RIGHT (nose appears left of centre)
///
/// Why this metric:
///   It is rotation-invariant to face size (normalised by inter-eye distance),
///   robust to zoom changes, and requires only the 5 landmarks YuNet already
///   detects — no additional model needed.
/// </summary>
public sealed record MotionVerificationResult(
    bool    IsVerified,
    string? FailReason,
    float[] FrameOffsets
);

public sealed class FaceMotionService
{
    private readonly FaceRecognitionService _recognition;
    private readonly ILogger<FaceMotionService> _logger;

    // Landmark array indices
    private const int IdxRightEyeX = 0;
    private const int IdxRightEyeY = 1;
    private const int IdxLeftEyeX  = 2;
    private const int IdxLeftEyeY  = 3;
    private const int IdxNoseX     = 4;
    // IdxNoseY = 5 — reserved for LOOK_UP/LOOK_DOWN in future

    // Minimum inter-eye pixel distance (in normalised 640px detector space)
    // to consider a detection reliable. Prevents noise from tiny / distant faces.
    private const float MinInterEyeDistance = 15f;

    public FaceMotionService(
        FaceRecognitionService recognition,
        ILogger<FaceMotionService> logger)
    {
        _recognition = recognition;
        _logger      = logger;
    }

    public async Task<MotionVerificationResult> VerifyMotionAsync(
        IReadOnlyList<byte[]> frameBytes,
        ChallengeType         challengeType,
        float                 minTurnDelta = 0.15f)
    {
        if (frameBytes == null || frameBytes.Count < 2)
        {
            return Fail("Insufficient frames supplied (minimum 2 required).");
        }

        try
        {
            return await Task.Run(() => Verify(frameBytes, challengeType, minTurnDelta));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FaceMotion] Unexpected error during motion verification.");
            return Fail($"Internal error: {ex.Message}");
        }
    }

    // -----------------------------------------------------------------------
    // Core analysis — runs on thread pool
    // -----------------------------------------------------------------------

    private MotionVerificationResult Verify(
        IReadOnlyList<byte[]> frameBytes,
        ChallengeType         challengeType,
        float                 minTurnDelta)
    {
        var offsets = new float[frameBytes.Count];

        for (int i = 0; i < frameBytes.Count; i++)
        {
            var lm = ExtractLandmarks(frameBytes[i]);
            if (lm == null)
            {
                return Fail($"Face not detected in frame {i}. Please ensure good lighting and keep your face visible.");
            }

            float rightEyeX = lm[IdxRightEyeX];
            float leftEyeX  = lm[IdxLeftEyeX];
            float noseX      = lm[IdxNoseX];

            float eyeMidX    = (rightEyeX + leftEyeX) / 2f;
            float interEyeDist = MathF.Abs(leftEyeX - rightEyeX);

            if (interEyeDist < MinInterEyeDistance)
            {
                return Fail($"Face too small or too far from camera in frame {i}. Please move closer.");
            }

            offsets[i] = (noseX - eyeMidX) / interEyeDist;
        }

        // ── Check temporal movement ──────────────────────────────────────────
        // Frame 0 is the baseline (face centred before movement).
        // We look for the maximum delta from baseline in the correct direction.
        float baseline = offsets[0];
        float maxDelta = 0f;

        for (int i = 1; i < offsets.Length; i++)
        {
            float delta = challengeType switch
            {
                ChallengeType.TurnLeft  =>  offsets[i] - baseline,  // positive = nose moved right = turned left
                ChallengeType.TurnRight => baseline - offsets[i],   // positive = nose moved left  = turned right
                _                       => 0f
            };

            if (delta > maxDelta)
                maxDelta = delta;
        }

        Console.WriteLine(
            $"[MOTION] challenge={challengeType} baseline={baseline:F3} " +
            $"offsets=[{string.Join(",", offsets.Select(o => o.ToString("F3")))}] " +
            $"maxDelta={maxDelta:F3} required={minTurnDelta:F3} " +
            $"verified={maxDelta >= minTurnDelta}");

        if (maxDelta < minTurnDelta)
        {
            string dir = challengeType == ChallengeType.TurnLeft ? "left" : "right";
            return Fail(
                $"Insufficient head movement detected. " +
                $"Please turn your head clearly to the {dir} and hold for a moment. " +
                $"(delta={maxDelta:F3}, required={minTurnDelta:F3})");
        }

        return new MotionVerificationResult(
            IsVerified:   true,
            FailReason:   null,
            FrameOffsets: offsets);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /// <summary>
    /// Extracts 5-point landmarks from a single JPEG frame using YuNet.
    /// Returns null when detection fails or no face is found.
    /// Frame data is not retained after this call.
    /// </summary>
    private float[]? ExtractLandmarks(byte[] frameBytes)
    {
        try
        {
            return _recognition.DetectFaceLandmarks(frameBytes);
        }
        catch
        {
            return null;
        }
    }

    private static MotionVerificationResult Fail(string reason) =>
        new(IsVerified: false, FailReason: reason, FrameOffsets: Array.Empty<float>());
}
