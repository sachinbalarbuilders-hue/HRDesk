using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace HRDesk.Web.Services.AI;

public sealed record FaceMatchResult(
    bool IsSuccess,
    bool IsMatch,
    float SimilarityScore,
    string? Message
);

public sealed class FaceRecognitionService : IDisposable
{
    private readonly ILogger<FaceRecognitionService> _logger;
    private readonly IHostEnvironment _env;
    private InferenceSession? _session;
    private string? _inputName;

    // YuNet face detector — used to crop/align just the face region before embedding.
    // Without this, ArcFace embeds the whole selfie (background, framing, lighting) and
    // cannot separate people, so impostors score as high as the genuine employee.
    private InferenceSession? _detectorSession;
    private string? _detectorInputName;
    private const int DetectorSize = 640; // this YuNet export has a fixed 640x640 input
    private static readonly int[] DetectorStrides = { 8, 16, 32 };

    private readonly object _lock = new();
    private bool _initialized;

    public bool IsModelAvailable => _session != null;

    public FaceRecognitionService(ILogger<FaceRecognitionService> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
        InitializeModel();
    }

    private void InitializeModel()
    {
        if (_initialized) return;

        lock (_lock)
        {
            if (_initialized) return;

            try
            {
                var candidatePaths = new[]
                {
                    Path.Combine(_env.ContentRootPath, "App_Data", "models", "face_recognition.onnx"),
                    Path.Combine(AppContext.BaseDirectory, "App_Data", "models", "face_recognition.onnx"),
                    Path.Combine(_env.ContentRootPath, "App_Data", "models", "arcface.onnx"),
                    Path.Combine(AppContext.BaseDirectory, "App_Data", "models", "arcface.onnx")
                };

                var modelPath = candidatePaths.FirstOrDefault(File.Exists);

                if (string.IsNullOrEmpty(modelPath))
                {
                    _logger.LogWarning("Face recognition ONNX model file not found in App_Data/models. Face verification will fallback to on-device trust.");
                    _initialized = true;
                    return;
                }

                var options = new Microsoft.ML.OnnxRuntime.SessionOptions
                {
                    GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
                    IntraOpNumThreads = 2
                };

                _session = new InferenceSession(modelPath, options);
                _inputName = _session.InputMetadata.Keys.FirstOrDefault() ?? "data";

                _logger.LogInformation("Microsoft ONNX Runtime Face Recognition initialized successfully using model at '{Path}' (Input: '{InputName}').",
                    modelPath, _inputName);

                // Load the YuNet face detector (optional — falls back to center crop if missing).
                var detectorCandidates = new[]
                {
                    Path.Combine(_env.ContentRootPath, "App_Data", "models", "face_detection_yunet.onnx"),
                    Path.Combine(AppContext.BaseDirectory, "App_Data", "models", "face_detection_yunet.onnx")
                };
                var detectorPath = detectorCandidates.FirstOrDefault(File.Exists);
                if (!string.IsNullOrEmpty(detectorPath))
                {
                    _detectorSession = new InferenceSession(detectorPath, options);
                    _detectorInputName = _detectorSession.InputMetadata.Keys.FirstOrDefault() ?? "input";
                    _logger.LogInformation("YuNet face detector initialized from '{Path}' (Input: '{InputName}').",
                        detectorPath, _detectorInputName);
                }
                else
                {
                    _logger.LogWarning("YuNet face detector model not found. Face crop/align disabled — verification accuracy will be reduced.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize Microsoft ONNX Runtime Face Recognition session.");
                _session = null;
            }
            finally
            {
                _initialized = true;
            }
        }
    }

    public Task<float[]?> ExtractEmbeddingFromBase64Async(string base64Image)
    {
        if (string.IsNullOrWhiteSpace(base64Image))
            return Task.FromResult<float[]?>(null);

        try
        {
            var cleanBase64 = base64Image;
            var commaIndex = cleanBase64.IndexOf(',');
            if (commaIndex >= 0)
            {
                cleanBase64 = cleanBase64.Substring(commaIndex + 1);
            }

            var bytes = Convert.FromBase64String(cleanBase64);
            return ExtractEmbeddingAsync(bytes);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to decode base64 image for face recognition.");
            return Task.FromResult<float[]?>(null);
        }
    }

    public Task<float[]?> ExtractEmbeddingAsync(byte[] imageBytes)
    {
        if (imageBytes == null || imageBytes.Length == 0 || _session == null || string.IsNullOrEmpty(_inputName))
        {
            return Task.FromResult<float[]?>(null);
        }

        try
        {
            using var image = Image.Load<Rgb24>(imageBytes);

            // Detect 5 facial landmarks and warp the face to the canonical ArcFace 112x112
            // template (eyes/nose/mouth at fixed positions). Alignment is what makes ArcFace
            // discriminate: without it, two different people score ~0.5+; aligned, a different
            // person drops to ~0.1 while the same person stays ~0.9. Falls back to a center
            // crop only when no face is detected.
            var landmarks = DetectFaceLandmarks(image);
            using var face = landmarks != null
                ? image.Clone(x => x.Transform(
                    new Rectangle(0, 0, image.Width, image.Height),
                    BuildAlignmentMatrix(landmarks),
                    new Size(112, 112),
                    KnownResamplers.Bicubic))
                : image.Clone(x => x
                    .Crop(CenterSquare(image.Width, image.Height))
                    .Resize(new ResizeOptions { Size = new Size(112, 112), Mode = ResizeMode.Stretch }));

            // Convert to NCHW Tensor (1, 3, 112, 112). Feed RAW 0-255 RGB values: this ONNX
            // model normalizes internally (its first layers are Sub 127.5 then Mul 1/128), so
            // pre-normalizing here would double-normalize and destroy discrimination.
            var tensor = new DenseTensor<float>(new[] { 1, 3, 112, 112 });

            for (int y = 0; y < 112; y++)
            {
                for (int x = 0; x < 112; x++)
                {
                    var pixel = face[x, y];
                    tensor[0, 0, y, x] = pixel.R;
                    tensor[0, 1, y, x] = pixel.G;
                    tensor[0, 2, y, x] = pixel.B;
                }
            }

            var inputs = new[]
            {
                NamedOnnxValue.CreateFromTensor(_inputName, tensor)
            };

            using var results = _session.Run(inputs);
            var rawEmbedding = results.First().AsEnumerable<float>().ToArray();

            // Apply L2 normalization so dot product equals cosine similarity
            var norm = MathF.Sqrt(rawEmbedding.Sum(v => v * v));
            if (norm > 1e-6f)
            {
                for (int i = 0; i < rawEmbedding.Length; i++)
                {
                    rawEmbedding[i] /= norm;
                }
            }

            return Task.FromResult<float[]?>(rawEmbedding);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during ONNX face embedding extraction.");
            return Task.FromResult<float[]?>(null);
        }
    }

    private static Rectangle CenterSquare(int width, int height)
    {
        int side = Math.Min(width, height);
        int x = (width - side) / 2;
        // Bias slightly upward — faces in selfies tend to sit in the upper-center.
        int y = Math.Max(0, (height - side) / 2 - (int)(side * 0.05));
        if (y + side > height) y = height - side;
        return new Rectangle(x, y, side, side);
    }

    // Canonical ArcFace 5-point template on a 112x112 face:
    // right-eye, left-eye, nose, right-mouth-corner, left-mouth-corner (image coordinates).
    private static readonly float[][] FaceTemplate =
    {
        new[] { 38.2946f, 51.6963f },
        new[] { 73.5318f, 51.5014f },
        new[] { 56.0252f, 71.7366f },
        new[] { 41.5493f, 92.3655f },
        new[] { 70.7299f, 92.2041f },
    };

    /// <summary>
    /// Runs the YuNet detector and returns the 5 facial landmarks (x0,y0,...,x4,y4) of the
    /// highest-confidence face, in the coordinate space of <paramref name="src"/>. Returns
    /// null when no detector is loaded or no face passes the confidence threshold.
    /// </summary>
    private float[]? DetectFaceLandmarks(Image<Rgb24> src)
    {
        if (_detectorSession == null || string.IsNullOrEmpty(_detectorInputName)) return null;

        try
        {
            using var resized = src.Clone(c => c.Resize(new ResizeOptions
            {
                Size = new Size(DetectorSize, DetectorSize),
                Mode = ResizeMode.Stretch
            }));

            var input = new DenseTensor<float>(new[] { 1, 3, DetectorSize, DetectorSize });
            for (int y = 0; y < DetectorSize; y++)
            {
                for (int x = 0; x < DetectorSize; x++)
                {
                    var px = resized[x, y];
                    // YuNet expects BGR channel order with raw 0-255 values (no normalization).
                    input[0, 0, y, x] = px.B;
                    input[0, 1, y, x] = px.G;
                    input[0, 2, y, x] = px.R;
                }
            }

            using var results = _detectorSession.Run(new[]
            {
                NamedOnnxValue.CreateFromTensor(_detectorInputName, input)
            });

            var outputs = results.ToDictionary(r => r.Name, r => r.AsEnumerable<float>().ToArray());

            float sx = (float)src.Width / DetectorSize;
            float sy = (float)src.Height / DetectorSize;

            float bestScore = 0.6f; // minimum detection confidence
            float[]? bestLandmarks = null;

            foreach (var stride in DetectorStrides)
            {
                var cls = outputs.GetValueOrDefault($"cls_{stride}");
                var obj = outputs.GetValueOrDefault($"obj_{stride}");
                var kps = outputs.GetValueOrDefault($"kps_{stride}");
                if (cls == null || obj == null || kps == null) continue;

                int cols = DetectorSize / stride; // feature-map width
                int n = cls.Length;               // number of priors at this stride
                for (int i = 0; i < n; i++)
                {
                    float clsScore = Math.Clamp(cls[i], 0f, 1f);
                    float objScore = Math.Clamp(obj[i], 0f, 1f);
                    float score = MathF.Sqrt(clsScore * objScore);
                    if (score <= bestScore) continue;

                    int r = i / cols;
                    int c = i % cols;
                    // Landmark decode (YuNet): point = (prior + delta) * stride, mapped back to source.
                    var lm = new float[10];
                    for (int k = 0; k < 5; k++)
                    {
                        lm[k * 2] = (c + kps[i * 10 + k * 2]) * stride * sx;
                        lm[k * 2 + 1] = (r + kps[i * 10 + k * 2 + 1]) * stride * sy;
                    }
                    bestScore = score;
                    bestLandmarks = lm;
                }
            }

            return bestLandmarks;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "YuNet face detection failed; falling back to center crop.");
            return null;
        }
    }

    /// <summary>
    /// Builds the affine matrix that warps the detected 5 landmarks onto the canonical
    /// ArcFace template (a least-squares 2D similarity transform: scale + rotation + shift).
    /// </summary>
    private static Matrix3x2 BuildAlignmentMatrix(float[] landmarks)
    {
        // Solve for a, b, tx, ty in:  u = a*x - b*y + tx ,  v = b*x + a*y + ty
        double[,] ata = new double[4, 4];
        double[] atc = new double[4];

        void Accumulate(double[] row, double target)
        {
            for (int i = 0; i < 4; i++)
            {
                for (int j = 0; j < 4; j++) ata[i, j] += row[i] * row[j];
                atc[i] += row[i] * target;
            }
        }

        for (int k = 0; k < 5; k++)
        {
            double x = landmarks[k * 2], y = landmarks[k * 2 + 1];
            double u = FaceTemplate[k][0], v = FaceTemplate[k][1];
            Accumulate(new[] { x, -y, 1.0, 0.0 }, u);
            Accumulate(new[] { y, x, 0.0, 1.0 }, v);
        }

        var s = SolveLinear4(ata, atc);
        double a = s[0], b = s[1], tx = s[2], ty = s[3];
        // System.Numerics.Matrix3x2: x' = x*M11 + y*M21 + M31 ; y' = x*M12 + y*M22 + M32
        return new Matrix3x2((float)a, (float)b, (float)-b, (float)a, (float)tx, (float)ty);
    }

    /// <summary>Solves a 4x4 linear system via Gaussian elimination with partial pivoting.</summary>
    private static double[] SolveLinear4(double[,] m, double[] c)
    {
        const int n = 4;
        var a = (double[,])m.Clone();
        var x = (double[])c.Clone();
        for (int col = 0; col < n; col++)
        {
            int pivot = col;
            for (int r = col + 1; r < n; r++)
                if (Math.Abs(a[r, col]) > Math.Abs(a[pivot, col])) pivot = r;
            for (int j = 0; j < n; j++) (a[col, j], a[pivot, j]) = (a[pivot, j], a[col, j]);
            (x[col], x[pivot]) = (x[pivot], x[col]);

            double diag = a[col, col];
            if (Math.Abs(diag) < 1e-12) diag = 1e-12;
            for (int j = 0; j < n; j++) a[col, j] /= diag;
            x[col] /= diag;

            for (int r = 0; r < n; r++)
            {
                if (r == col) continue;
                double factor = a[r, col];
                for (int j = 0; j < n; j++) a[r, j] -= factor * a[col, j];
                x[r] -= factor * x[col];
            }
        }
        return x;
    }

    public float ComputeSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA == null || vectorB == null || vectorA.Length == 0 || vectorA.Length != vectorB.Length)
        {
            return 0.0f;
        }

        float dot = 0.0f;
        for (int i = 0; i < vectorA.Length; i++)
        {
            dot += vectorA[i] * vectorB[i];
        }

        // Clamp between -1.0 and 1.0
        return Math.Clamp(dot, -1.0f, 1.0f);
    }

    public bool IsMatch(float[] vectorA, float[] vectorB, float threshold = 0.50f)
    {
        var sim = ComputeSimilarity(vectorA, vectorB);
        return sim >= threshold;
    }

    /// <summary>
    /// Public wrapper: runs YuNet on raw image bytes and returns the 5-point
    /// landmark array [rx,ry, lx,ly, nx,ny, rmx,rmy, lmx,lmy] in source
    /// coordinates, or null when no face is detected.
    /// Used by FaceMotionService for temporal movement analysis.
    /// The frame bytes are processed in memory and NOT retained.
    /// </summary>
    public float[]? DetectFaceLandmarks(byte[] imageBytes)
    {
        if (imageBytes == null || imageBytes.Length == 0) return null;
        if (_detectorSession == null) return null;

        try
        {
            using var image = Image.Load<Rgb24>(imageBytes);
            return DetectFaceLandmarks(image);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[YuNet] DetectFaceLandmarks(bytes) failed.");
            return null;
        }
    }

    /// <summary>
    /// Runs YuNet face detection and returns the bounding box (X, Y, W, H) of the
    /// highest-confidence detected face in source-image coordinates, with padding.
    ///
    /// The bbox is derived from the 5 landmark points (min/max extents + 20% padding)
    /// so it covers the full face area rather than just the landmark region.
    ///
    /// Returns null when YuNet is unavailable or no face is detected above confidence 0.6.
    /// Callers should fall back to a center-crop heuristic when null is returned.
    /// </summary>
    public (int X, int Y, int W, int H)? DetectFaceBoundingBox(byte[] imageBytes)
    {
        if (imageBytes == null || imageBytes.Length == 0) return null;
        if (_detectorSession == null) return null;

        try
        {
            using var image = Image.Load<Rgb24>(imageBytes);
            var landmarks = DetectFaceLandmarks(image);
            if (landmarks == null) return null;

            // Compute tight bbox from the 5 landmark points
            float minX = float.MaxValue, minY = float.MaxValue;
            float maxX = float.MinValue, maxY = float.MinValue;

            for (int k = 0; k < 5; k++)
            {
                float lx = landmarks[k * 2];
                float ly = landmarks[k * 2 + 1];
                if (lx < minX) minX = lx;
                if (ly < minY) minY = ly;
                if (lx > maxX) maxX = lx;
                if (ly > maxY) maxY = ly;
            }

            // Expand bbox by 40% each side to include forehead, chin, and ears —
            // this matches the face region that MiniFASNet was trained on.
            float landmarkW = maxX - minX;
            float landmarkH = maxY - minY;
            float side = Math.Max(landmarkW, landmarkH);
            float pad  = side * 0.40f;

            float cx = (minX + maxX) / 2f;
            float cy = (minY + maxY) / 2f;

            int bx = (int)Math.Max(0, cx - side / 2f - pad);
            int by = (int)Math.Max(0, cy - side / 2f - pad * 1.2f); // extra top pad for forehead
            int bx2 = (int)Math.Min(image.Width,  cx + side / 2f + pad);
            int by2 = (int)Math.Min(image.Height, cy + side / 2f + pad);

            int bw = bx2 - bx;
            int bh = by2 - by;

            if (bw < 20 || bh < 20) return null; // degenerate — ignore

            return (bx, by, bw, bh);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[YuNet] DetectFaceBoundingBox failed; anti-spoofing will use heuristic bbox.");
            return null;
        }
    }

    public async Task<FaceMatchResult> CompareFacesAsync(byte[] punchPhotoBytes, byte[] enrolledPhotoBytes, float threshold = 0.50f)
    {
        if (!IsModelAvailable)
        {
            return new FaceMatchResult(false, false, 0f, "Face recognition model is not loaded.");
        }

        var punchEmbedding = await ExtractEmbeddingAsync(punchPhotoBytes);
        if (punchEmbedding == null)
        {
            return new FaceMatchResult(false, false, 0f, "Unable to extract biometric features from punch photo.");
        }

        var enrolledEmbedding = await ExtractEmbeddingAsync(enrolledPhotoBytes);
        if (enrolledEmbedding == null)
        {
            return new FaceMatchResult(false, false, 0f, "Unable to extract biometric features from enrolled profile photo.");
        }

        var similarity = ComputeSimilarity(punchEmbedding, enrolledEmbedding);
        bool isMatch = similarity >= threshold;

        return new FaceMatchResult(
            IsSuccess: true,
            IsMatch: isMatch,
            SimilarityScore: similarity,
            Message: isMatch 
                ? $"Face matched successfully (Similarity: {similarity * 100:F1}%)." 
                : $"Face mismatch detected (Similarity: {similarity * 100:F1}%, required: {threshold * 100:F1}%)."
        );
    }

    public void Dispose()
    {
        _session?.Dispose();
        _session = null;
        _detectorSession?.Dispose();
        _detectorSession = null;
    }
}
