using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ThumbnailController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HRDesk.Web.Data.BiometricAttendanceDbContext _db;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private readonly HRDesk.Web.Services.ICurrentTenantProvider _tenantProvider;

    public ThumbnailController(IConfiguration configuration, 
        HRDesk.Web.Data.BiometricAttendanceDbContext db, 
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache,
        HRDesk.Web.Services.ICurrentTenantProvider tenantProvider)
    {
        _configuration = configuration;
        _db = db;
        _cache = cache;
        _tenantProvider = tenantProvider;
    }

    [HttpGet]
    public async Task<IActionResult> GetThumbnail(int? employeeId, int width = 150, int height = 150)
    {
        if (employeeId == null)
        {
            return BadRequest("Employee ID is required.");
        }

        // Use a projection to avoid loading the full Employee entity (composite key issue with FindAsync)
        var photo = await _db.Employees
            .Where(e => e.EmployeeId == employeeId)
            .Select(e => new { e.PhotoData, e.PhotoContentType })
            .FirstOrDefaultAsync();

        if (photo == null)
        {
            return NotFound("Employee not found.");
        }

        byte[]? photoBytes = photo.PhotoData;

        if (photoBytes == null)
        {
            return NotFound("No photo found.");
        }

        var cacheKey = $"thumb_{_tenantProvider.TenantId}_{employeeId}_{width}_{height}";
        if (_cache.TryGetValue(cacheKey, out byte[]? cachedBytes))
        {
            return File(cachedBytes!, "image/jpeg");
        }

        try
        {
            using (var ms = new MemoryStream(photoBytes))
            using (var image = Image.Load(ms))
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(width, height),
                    Mode = ResizeMode.Crop
                }));

                var outStream = new MemoryStream();
                image.SaveAsJpeg(outStream);
                var finalBytes = outStream.ToArray();
                
                _cache.Set(cacheKey, finalBytes, TimeSpan.FromDays(1)); // Cache for 1 day
                return File(finalBytes, "image/jpeg");
            }
        }
        catch (Exception)
        {
            // If anything goes wrong with resizing, safely fallback to serving the original bytes
            return File(photoBytes, photo.PhotoContentType ?? "image/jpeg");
        }
    }

    private string GetMimeType(string fileName)
    {
        var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(fileName, out var contentType))
        {
            contentType = "application/octet-stream";
        }
        return contentType;
    }
}
