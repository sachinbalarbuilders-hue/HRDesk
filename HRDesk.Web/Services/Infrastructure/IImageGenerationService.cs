using System.Threading.Tasks;

namespace HRDesk.Web.Services
{
    public interface IImageGenerationService
    {
        Task<byte[]> GenerateCelebrationPosterAsync(string employeeName, string eventType, byte[]? photoBytes);
    }
}
