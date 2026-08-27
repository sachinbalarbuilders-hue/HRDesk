using System;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace HRDesk.Web.Services.AI;

/// <summary>
/// Lightweight, heuristic image-quality check performed before running the
/// face-recognition or anti-spoofing pipelines.
///
/// A failing result means "please retake the photo" — it is NOT a fraud
/// or spoofing signal.  Callers should prompt the user to retry with better
/// lighting or a steadier hand.
/// </summary>
public static class FaceQualityValidator
{
    public sealed record FaceQualityResult(
        bool    IsAcceptable,
        string? FailReason,
        string? UserMessage
    );

    // -----------------------------------------------------------------------
    // Thresholds
    // -----------------------------------------------------------------------

    private const int   MinDimension       = 80;    // pixels — smaller images lack detail
    private const float MinBrightness      = 25f;   // luma (0-255) — too dark
    private const float MaxBrightness      = 240f;  // luma (0-255) — overexposed
    private const float MinBlurScore       = 30f;   // Laplacian variance — too blurry
    private const int   BrightnessResample = 64;    // downsample size for brightness pass
    private const int   BlurResample       = 128;   // downsample size for blur pass

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /// <summary>
    /// Validates the quality of <paramref name="imageBytes"/>.
    /// Checks are applied in order; the first failure is returned immediately.
    ///
    /// Checks performed:
    ///   1. Minimum size (80×80)
    ///   2. Brightness (BT.601 luma on a 64×64 downsample, mean 25-240)
    ///   3. Blur (Laplacian variance on a 128×128 greyscale downsample, >= 30)
    /// </summary>
    public static FaceQualityResult Validate(byte[] imageBytes)
    {
        try
        {
            using var image = Image.Load<L8>(imageBytes);  // load as greyscale for efficiency

            // ── 1. Minimum size ────────────────────────────────────────────
            if (image.Width < MinDimension || image.Height < MinDimension)
            {
                return new FaceQualityResult(
                    IsAcceptable: false,
                    FailReason:   $"Image too small ({image.Width}x{image.Height}; minimum {MinDimension}x{MinDimension})",
                    UserMessage:  "Photo resolution is too low. Please move closer to the camera and try again.");
            }

            // ── 2. Brightness check (BT.601 luma on a 64×64 downsample) ───
            // Re-load as Rgb24 for proper luma weighting
            using var colorImage = Image.Load<Rgb24>(imageBytes);

            float meanLuma = ComputeMeanLuma(colorImage, BrightnessResample);

            if (meanLuma < MinBrightness)
            {
                return new FaceQualityResult(
                    IsAcceptable: false,
                    FailReason:   $"Image too dark (luma={meanLuma:F1}; minimum={MinBrightness})",
                    UserMessage:  "Photo is too dark. Please move to a brighter area or turn on more lights.");
            }

            if (meanLuma > MaxBrightness)
            {
                return new FaceQualityResult(
                    IsAcceptable: false,
                    FailReason:   $"Image overexposed (luma={meanLuma:F1}; maximum={MaxBrightness})",
                    UserMessage:  "Photo is overexposed. Please avoid pointing directly at bright lights.");
            }

            // ── 3. Blur check (Laplacian variance on 128×128 greyscale) ───
            float blurScore = ComputeLaplacianVariance(image, BlurResample);

            if (blurScore < MinBlurScore)
            {
                return new FaceQualityResult(
                    IsAcceptable: false,
                    FailReason:   $"Image too blurry (Laplacian variance={blurScore:F1}; minimum={MinBlurScore})",
                    UserMessage:  "Photo is blurry. Please hold the camera steady and try again.");
            }

            return new FaceQualityResult(
                IsAcceptable: true,
                FailReason:   null,
                UserMessage:  null);
        }
        catch (Exception ex)
        {
            // Treat unreadable images as unacceptable
            return new FaceQualityResult(
                IsAcceptable: false,
                FailReason:   $"Could not decode image: {ex.Message}",
                UserMessage:  "Could not read the photo. Please try again.");
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /// <summary>
    /// Computes the mean BT.601 luma of <paramref name="image"/> after
    /// downsampling to <paramref name="size"/>×<paramref name="size"/>.
    /// BT.601: Y = 0.299·R + 0.587·G + 0.114·B
    /// </summary>
    private static float ComputeMeanLuma(Image<Rgb24> image, int size)
    {
        using var small = image.Clone(ctx => ctx.Resize(size, size));

        double sum = 0;
        int    n   = size * size;

        small.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < size; x++)
                {
                    var px = row[x];
                    sum += 0.299 * px.R + 0.587 * px.G + 0.114 * px.B;
                }
            }
        });

        return (float)(sum / n);
    }

    /// <summary>
    /// Estimates sharpness by computing the variance of the discrete
    /// Laplacian applied to a <paramref name="size"/>×<paramref name="size"/>
    /// greyscale downsample of <paramref name="image"/>.
    ///
    /// Higher variance = sharper image.  A blurry image smooths out edges,
    /// resulting in low Laplacian variance.
    ///
    /// 3×3 Laplacian kernel (approximation):
    ///   0  1  0
    ///   1 -4  1
    ///   0  1  0
    /// </summary>
    private static float ComputeLaplacianVariance(Image<L8> image, int size)
    {
        using var small = image.Clone(ctx => ctx.Resize(size, size));

        // Copy greyscale values into a flat array for easy neighbour access
        byte[] pixels = new byte[size * size];
        small.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < size; x++)
                    pixels[y * size + x] = row[x].PackedValue;
            }
        });

        // Apply Laplacian, skip 1-pixel border
        float sum  = 0f;
        float sum2 = 0f;
        int   count = 0;

        for (int y = 1; y < size - 1; y++)
        {
            for (int x = 1; x < size - 1; x++)
            {
                float lap =
                    -4f * pixels[y       * size + x    ] +
                           pixels[(y - 1) * size + x    ] +
                           pixels[(y + 1) * size + x    ] +
                           pixels[y       * size + x - 1] +
                           pixels[y       * size + x + 1];

                sum  += lap;
                sum2 += lap * lap;
                count++;
            }
        }

        if (count == 0) return 0f;

        float mean     = sum / count;
        float variance = sum2 / count - mean * mean;
        return variance;
    }
}
