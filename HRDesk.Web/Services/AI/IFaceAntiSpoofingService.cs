namespace HRDesk.Web.Services.AI;

public sealed record AntiSpoofResult(
    bool    IsSuccess,
    bool    IsLive,
    float   LiveScore,       // Fused score: (V2 + V1SE) / 2
    float   LiveScoreV2,     // MiniFASNetV2 individual live probability (0 when unavailable)
    float   LiveScoreV1SE,   // MiniFASNetV1SE individual live probability (0 when unavailable)
    string? Reason
);

public interface IFaceAntiSpoofingService
{
    /// <summary>
    /// True only when both MiniFASNetV2 and MiniFASNetV1SE ONNX sessions are
    /// successfully loaded. Fail-closed: face punches are blocked when false.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>
    /// Runs the two-model MiniFASNet fusion pipeline and returns a liveness result.
    /// Fail-closed: returns IsSuccess=false, IsLive=false on any error or
    /// unavailability. The caller must treat IsSuccess=false as a hard block.
    /// </summary>
    Task<AntiSpoofResult> CheckLivenessAsync(byte[] imageBytes, float livenessThreshold = 0.60f);
}
