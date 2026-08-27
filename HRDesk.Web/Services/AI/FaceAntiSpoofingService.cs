using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace HRDesk.Web.Services.AI;

/// <summary>
/// Server-side passive liveness / anti-spoofing guard based on two
/// Silent-Face-Anti-Spoofing ONNX models (MiniFASNetV2 + MiniFASNetV1SE).
///
/// The two models are run at their respective scales and their live-class
/// probabilities are averaged (score fusion) before comparing against the
/// caller-supplied threshold.
///
/// Fail-closed: if either model file is missing the service reports
/// IsAvailable=false and every CheckLivenessAsync call returns IsLive=false,
/// so the punch controller can decide whether to block or skip the check.
/// </summary>
public sealed class FaceAntiSpoofingService : IFaceAntiSpoofingService, IDisposable
{
    // Model filenames as copied into App_Data/models/
    private const string ModelV2Name    = "spoof_v2_2.7_80x80.onnx";
    private const string ModelV1SEName  = "spoof_v1se_4.0_80x80.onnx";

    // Corresponding crop scales used by the original paper
    private const float ScaleV2   = 2.7f;
    private const float ScaleV1SE = 4.0f;

    // Both models expect 80x80 NCHW float32 RGB [0,1] input
    private const int InputSize = 80;

    private readonly ILogger<FaceAntiSpoofingService> _logger;
    private readonly IHostEnvironment _env;

    private InferenceSession? _sessionV2;
    private InferenceSession? _sessionV1SE;

    public bool IsAvailable => _sessionV2 != null && _sessionV1SE != null;

    public FaceAntiSpoofingService(
        ILogger<FaceAntiSpoofingService> logger,
        IHostEnvironment env)
    {
        _logger = logger;
        _env    = env;
        InitializeSessions();
    }

    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    private void InitializeSessions()
    {
        try
        {
            var pathV2   = FindModel(ModelV2Name);
            var pathV1SE = FindModel(ModelV1SEName);

            if (pathV2 is null || pathV1SE is null)
            {
                _logger.LogWarning(
                    "[FaceAntiSpoofing] One or both spoof model files not found " +
                    "({V2}, {V1SE}). Liveness checking will be unavailable.",
                    ModelV2Name, ModelV1SEName);
                return;
            }

            var opts = new Microsoft.ML.OnnxRuntime.SessionOptions { InterOpNumThreads = 1, IntraOpNumThreads = 2 };
            _sessionV2   = new InferenceSession(pathV2,   opts);
            _sessionV1SE = new InferenceSession(pathV1SE, opts);

            _logger.LogInformation(
                "[FaceAntiSpoofing] Sessions loaded: V2={V2}, V1SE={V1SE}",
                pathV2, pathV1SE);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FaceAntiSpoofing] Failed to load spoof models.");
        }
    }

    /// <summary>
    /// Looks for <paramref name="fileName"/> in App_Data/models/ relative to
    /// ContentRootPath, then falls back to AppContext.BaseDirectory.
    /// Returns null if the file cannot be found in either location.
    /// </summary>
    private string? FindModel(string fileName)
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "App_Data", "models", fileName),
            Path.Combine(AppContext.BaseDirectory,           "App_Data", "models", fileName),
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
                return path;
        }

        return null;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    public async Task<AntiSpoofResult> CheckLivenessAsync(
        byte[] imageBytes,
        float livenessThreshold = 0.60f)
    {
        if (!IsAvailable)
        {
            return new AntiSpoofResult(
                IsSuccess:    false,
                IsLive:       false,
                LiveScore:    0f,
                LiveScoreV2:  0f,
                LiveScoreV1SE: 0f,
                Reason:       "Spoof models not loaded.");
        }

        try
        {
            var result = await Task.Run(() => RunFusion(imageBytes, livenessThreshold));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FaceAntiSpoofing] Unexpected error during liveness check.");
            return new AntiSpoofResult(
                IsSuccess:    false,
                IsLive:       false,
                LiveScore:    0f,
                LiveScoreV2:  0f,
                LiveScoreV1SE: 0f,
                Reason:       $"Internal error: {ex.Message}");
        }
    }

    // -----------------------------------------------------------------------
    // Core inference pipeline
    // -----------------------------------------------------------------------

    /// <summary>
    /// Runs both models and fuses their live-class scores by simple averaging.
    /// </summary>
    private AntiSpoofResult RunFusion(byte[] imageBytes, float threshold)
    {
        using var image = Image.Load<Rgb24>(imageBytes);

        var bbox = EstimateFaceBbox(image.Width, image.Height);

        float liveV2   = RunModel(_sessionV2!,   image, bbox, ScaleV2);
        float liveV1SE = RunModel(_sessionV1SE!, image, bbox, ScaleV1SE);

        float fused  = (liveV2 + liveV1SE) / 2f;
        bool  isLive = fused >= threshold;

        Console.WriteLine(
            $"[SPOOF] V2={liveV2:F4} V1SE={liveV1SE:F4} " +
            $"fused={fused:F4} threshold={threshold:F4} live={isLive}");

        return new AntiSpoofResult(
            IsSuccess:    true,
            IsLive:       isLive,
            LiveScore:    fused,
            LiveScoreV2:  liveV2,
            LiveScoreV1SE: liveV1SE,
            Reason:       isLive ? null : $"Fused live score {fused:F4} below threshold {threshold:F4}");
    }

    /// <summary>
    /// Crops the image according to the face bounding box + scale factor,
    /// resizes to 80x80, builds an NCHW float32 RGB [0,1] tensor, runs
    /// inference, applies softmax, and returns probs[1] (live class).
    ///
    /// The scale factor enlarges the crop region around the face centre,
    /// matching the multi-scale input strategy used during training.
    /// Scale 2.7 captures a tight face crop; scale 4.0 captures more context.
    /// </summary>
    private static float RunModel(
        InferenceSession session,
        Image<Rgb24> image,
        (int X, int Y, int W, int H) bbox,
        float scale)
    {
        // ── 1. Compute scaled crop ──────────────────────────────────────────
        int cx = bbox.X + bbox.W / 2;
        int cy = bbox.Y + bbox.H / 2;

        // Use the shorter side of the bbox as the base size, then scale it
        int baseSize = Math.Min(bbox.W, bbox.H);
        int cropSize = (int)(baseSize * scale);

        int x0 = Math.Max(0, cx - cropSize / 2);
        int y0 = Math.Max(0, cy - cropSize / 2);
        int x1 = Math.Min(image.Width,  x0 + cropSize);
        int y1 = Math.Min(image.Height, y0 + cropSize);

        int actualW = x1 - x0;
        int actualH = y1 - y0;

        // ── 2. Crop + resize to 80×80 ───────────────────────────────────────
        using var crop = image.Clone(ctx =>
        {
            ctx.Crop(new Rectangle(x0, y0, actualW, actualH));
            ctx.Resize(InputSize, InputSize);
        });

        // ── 3. Build NCHW float32 tensor (RGB, [0,1]) ──────────────────────
        // Shape: [1, 3, 80, 80]
        var tensor = new DenseTensor<float>(new[] { 1, 3, InputSize, InputSize });

        crop.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < InputSize; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < InputSize; x++)
                {
                    var px = row[x];
                    tensor[0, 0, y, x] = px.R / 255f;  // R
                    tensor[0, 1, y, x] = px.G / 255f;  // G
                    tensor[0, 2, y, x] = px.B / 255f;  // B
                }
            }
        });

        // ── 4. Inference ────────────────────────────────────────────────────
        var inputName = session.InputMetadata.Keys.First();
        var inputs = new[] { NamedOnnxValue.CreateFromTensor(inputName, tensor) };

        using var results = session.Run(inputs);
        var logits = results.First().AsEnumerable<float>().ToArray();
        // logits: [spoof, live, unknown]  (3 classes)

        // ── 5. Softmax ──────────────────────────────────────────────────────
        float max   = logits.Max();
        var   exps  = logits.Select(v => MathF.Exp(v - max)).ToArray();
        float sumEx = exps.Sum();
        float[] probs = exps.Select(e => e / sumEx).ToArray();

        // Index 1 is the live class
        return probs[1];
    }

    /// <summary>
    /// Returns a face bounding box heuristic for images that have not been
    /// run through a face detector: centre 60% of the width and 70% of the
    /// height, starting 5% from the top (faces are rarely at the very bottom).
    ///
    /// This is used as a reasonable default when the caller has not pre-cropped
    /// the image.  For higher accuracy, callers can pass a pre-cropped face
    /// region directly.
    /// </summary>
    private static (int X, int Y, int W, int H) EstimateFaceBbox(int imageWidth, int imageHeight)
    {
        int w = (int)(imageWidth  * 0.60f);
        int h = (int)(imageHeight * 0.70f);
        int x = (imageWidth  - w) / 2;
        int y = (int)(imageHeight * 0.05f);
        return (x, y, w, h);
    }

    // -----------------------------------------------------------------------
    // IDisposable
    // -----------------------------------------------------------------------

    public void Dispose()
    {
        _sessionV2?.Dispose();
        _sessionV1SE?.Dispose();
        _sessionV2   = null;
        _sessionV1SE = null;
    }
}
