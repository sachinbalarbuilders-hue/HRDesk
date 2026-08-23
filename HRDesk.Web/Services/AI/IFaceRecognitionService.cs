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
}
