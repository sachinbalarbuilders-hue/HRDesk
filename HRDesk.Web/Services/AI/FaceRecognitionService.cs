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

public sealed class FaceRecognitionService : IFaceRecognitionService, IDisposable
{
    private readonly ILogger<FaceRecognitionService> _logger;
    private readonly IHostEnvironment _env;
    private InferenceSession? _session;
    private string? _inputName;
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

            // Resize to standard 112x112 face dimension
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(112, 112),
                Mode = ResizeMode.Crop
            }));

            // Convert to NCHW Tensor (1, 3, 112, 112)
            var tensor = new DenseTensor<float>(new[] { 1, 3, 112, 112 });

            for (int y = 0; y < 112; y++)
            {
                for (int x = 0; x < 112; x++)
                {
                    var pixel = image[x, y];
                    // Standard SFace/ArcFace normalization (RGB values)
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
    }
}
