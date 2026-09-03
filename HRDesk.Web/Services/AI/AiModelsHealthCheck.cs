using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace HRDesk.Web.Services.AI;

/// <summary>
/// Health check that reports the load status of all three AI model sessions:
///   - MiniFASNetV2        (spoof_v2_2.7_80x80.onnx)
///   - MiniFASNetV1SE      (spoof_v1se_4.0_80x80.onnx)
///   - ArcFace recognition (face_recognition.onnx)
///
/// Returns Healthy only when all three models are loaded.
/// Returns Degraded with a per-model description when any model is missing.
///
/// Exposed at GET /health — poll this endpoint after copying the ONNX model
/// files to App_Data/models/ to confirm the server is ready to accept face punches.
///
/// Note: IFaceAntiSpoofingService.IsAvailable returns true only when BOTH
/// MiniFASNetV2 and MiniFASNetV1SE sessions are loaded (fail-closed by design).
/// Because the interface does not distinguish which individual spoof model is
/// missing, both spoof labels share the same status string.
/// </summary>
public sealed class AiModelsHealthCheck : IHealthCheck
{
    private readonly FaceAntiSpoofingService _antiSpoofing;
    private readonly FaceRecognitionService  _recognition;

    public AiModelsHealthCheck(
        FaceAntiSpoofingService antiSpoofing,
        FaceRecognitionService  recognition)
    {
        _antiSpoofing = antiSpoofing;
        _recognition  = recognition;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken  cancellationToken = default)
    {
        bool spoofOk = _antiSpoofing.IsAvailable;
        bool faceOk  = _recognition.IsModelAvailable;

        string spoofStatus  = spoofOk ? "OK" : "MISSING";
        string faceStatus   = faceOk  ? "OK" : "MISSING";

        var description =
            $"spoof_v2_2.7_80x80.onnx: {spoofStatus} | " +
            $"spoof_v1se_4.0_80x80.onnx: {spoofStatus} | " +
            $"face_recognition.onnx: {faceStatus}";

        var data = new Dictionary<string, object>
        {
            ["spoof_v2"]    = spoofStatus,
            ["spoof_v1se"]  = spoofStatus,
            ["recognition"] = faceStatus,
        };

        if (spoofOk && faceOk)
        {
            return Task.FromResult(
                HealthCheckResult.Healthy("All AI models loaded.", data));
        }

        return Task.FromResult(
            HealthCheckResult.Degraded(description, data: data));
    }
}
