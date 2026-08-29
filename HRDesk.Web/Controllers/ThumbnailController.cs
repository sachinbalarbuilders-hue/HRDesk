using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using Microsoft.Extensions.Caching.Memory;

namespace HRDesk.Web.Controllers;

[Route("api/[controller]")]
[Route("[controller]")]
[ApiController]
[AllowAnonymous]
public class ThumbnailController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly HRDesk.Web.Data.BiometricAttendanceDbContext _db;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private readonly HRDesk.Web.Services.ICurrentTenantProvider _tenantProvider;
    private readonly ILogger<ThumbnailController> _logger;

    public ThumbnailController(IConfiguration configuration, 
        HRDesk.Web.Data.BiometricAttendanceDbContext db, 
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache,
        HRDesk.Web.Services.ICurrentTenantProvider tenantProvider,
        ILogger<ThumbnailController> logger)
    {
        _configuration = configuration;
        _db = db;
        _cache = cache;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetThumbnail(int? employeeId, int width = 150, int height = 150)
    {
        if (employeeId == null)
        {
            return BadRequest("Employee ID is required.");
        }

        byte[]? photoBytes = null;
        string? contentType = null;

        // Fetch using ADO.NET since PhotoData is [NotMapped] in EF Core to prevent global hang issues
        var connection = _db.Database.GetDbConnection();
        bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
        if (wasClosed) await connection.OpenAsync();

        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT PhotoData, PhotoContentType FROM employees WHERE employee_id = @id AND (@org = 0 OR organization_id = @org)";
            
            var idParam = cmd.CreateParameter();
            idParam.ParameterName = "@id";
            idParam.Value = employeeId.Value;
            cmd.Parameters.Add(idParam);
            
            var orgParam = cmd.CreateParameter();
            orgParam.ParameterName = "@org";
            orgParam.Value = _tenantProvider.TenantId;
            cmd.Parameters.Add(orgParam);

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                if (!reader.IsDBNull(0))
                {
                    photoBytes = (byte[])reader["PhotoData"];
                    contentType = reader.IsDBNull(1) ? "image/jpeg" : (string)reader["PhotoContentType"];
                }
            }
            else
            {
                return NotFound("Employee not found.");
            }
        }
        finally
        {
            if (wasClosed) await connection.CloseAsync();
        }

        if (photoBytes == null)
        {
            return NotFound("No photo found.");
        }

        var cacheKey = $"thumb_{_tenantProvider.TenantId}_{employeeId}_{width}_{height}";
        if (_cache.TryGetValue(cacheKey, out byte[]? cachedBytes))
        {
            Response.Headers["Cache-Control"] = "no-cache";
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
                
                _cache.Set(cacheKey, finalBytes, TimeSpan.FromDays(1));
                Response.Headers["Cache-Control"] = "no-cache";
                return File(finalBytes, "image/jpeg");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate thumbnail for employee {EmployeeId}, serving original image.", employeeId);
            // If anything goes wrong with resizing, safely fallback to serving the original bytes
            return File(photoBytes, contentType ?? "image/jpeg");
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
