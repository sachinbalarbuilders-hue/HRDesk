namespace HRDesk.Web.Services.AI;

public sealed record FaceMatchResult(
    bool IsSuccess,
    bool IsMatch,
    float SimilarityScore,
    string? Message
);

public interface IFaceRecognitionService
{
    bool IsModelAvailable { get; }

    Task<float[]?> ExtractEmbeddingAsync(byte[] imageBytes);

    Task<float[]?> ExtractEmbeddingFromBase64Async(string base64Image);

    float ComputeSimilarity(float[] vectorA, float[] vectorB);

    bool IsMatch(float[] vectorA, float[] vectorB, float threshold = 0.50f);

    Task<FaceMatchResult> CompareFacesAsync(byte[] punchPhotoBytes, byte[] enrolledPhotoBytes, float threshold = 0.50f);

    /// <summary>
    /// Runs YuNet face detection on the supplied image and returns the bounding box
    /// (X, Y, W, H) of the highest-confidence detected face in source-image coordinates,
    /// with a padding margin applied so the crop includes some face context.
    /// Returns null when YuNet is not loaded or no face is detected.
    /// Used by <see cref="IFaceAntiSpoofingService"/> to replace the heuristic center-crop.
    /// </summary>
    (int X, int Y, int W, int H)? DetectFaceBoundingBox(byte[] imageBytes);
}
