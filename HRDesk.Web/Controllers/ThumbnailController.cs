using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace HRDesk.Web.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ThumbnailController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ThumbnailController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet]
    public IActionResult GetThumbnail(string? filename, int width = 150, int height = 150)
    {
        if (string.IsNullOrWhiteSpace(filename))
        {
            return BadRequest("Filename is required.");
        }

        // Prevent directory traversal attacks
        var sanitizedFilename = Path.GetFileName(filename);

        var photoDir = _configuration.GetValue<string>("EmployeePhotoPath");
        if (string.IsNullOrWhiteSpace(photoDir))
        {
            return NotFound("Photo directory not configured.");
        }

        var fullPath = Path.Combine(photoDir, sanitizedFilename);
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound();
        }

        var thumbDir = Path.Combine(photoDir, "Thumbnails");
        if (!Directory.Exists(thumbDir))
        {
            Directory.CreateDirectory(thumbDir);
        }

        var thumbPath = Path.Combine(thumbDir, $"{width}x{height}_{sanitizedFilename}");

        // If thumbnail already exists, serve it instantly from the disk cache
        if (System.IO.File.Exists(thumbPath))
        {
            return PhysicalFile(thumbPath, GetMimeType(thumbPath));
        }

        try
        {
            // If thumbnail doesn't exist, generate it in memory and save to disk cache
            using (var image = Image.Load(fullPath))
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(width, height),
                    Mode = ResizeMode.Crop
                }));

                image.Save(thumbPath);
            }

            return PhysicalFile(thumbPath, GetMimeType(thumbPath));
        }
        catch (Exception)
        {
            // If anything goes wrong, safely fallback to serving the original file
            return PhysicalFile(fullPath, GetMimeType(fullPath));
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
