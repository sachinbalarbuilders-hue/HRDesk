using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/settings/statutory")]
[Authorize]
public class StatutorySettingsApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;

    public StatutorySettingsApiController(
        BiometricAttendanceDbContext db,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _tenantProvider = tenantProvider;
    }

    [HttpGet]
    public async Task<IActionResult> GetStatutorySettings()
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var settings = await _db.SystemSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.OrganizationId == orgId && s.SettingKey.StartsWith("Statutory_"))
            .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue ?? "");

        return Ok(new
        {
            pfEmployeeRate  = settings.GetValueOrDefault("Statutory_PfEmployeeRate", "12"),
            pfEmployerRate  = settings.GetValueOrDefault("Statutory_PfEmployerRate", "12"),
            esiEmployeeRate = settings.GetValueOrDefault("Statutory_EsiEmployeeRate", "0.75"),
            esiEmployerRate = settings.GetValueOrDefault("Statutory_EsiEmployerRate", "3.25"),
            esiGrossCeiling = settings.GetValueOrDefault("Statutory_EsiGrossCeiling", "21000")
        });
    }

    public record StatutorySettingsDto(
        decimal PfEmployeeRate,
        decimal PfEmployerRate,
        decimal EsiEmployeeRate,
        decimal EsiEmployerRate,
        decimal EsiGrossCeiling
    );

    [HttpPost]
    public async Task<IActionResult> SaveStatutorySettings([FromBody] StatutorySettingsDto dto)
    {
        if (!string.Equals(User.FindFirst("IsPlatformUser")?.Value, "true", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
            return Forbid();

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        var keysToSave = new Dictionary<string, string>
        {
            ["Statutory_PfEmployeeRate"]  = dto.PfEmployeeRate.ToString(),
            ["Statutory_PfEmployerRate"]  = dto.PfEmployerRate.ToString(),
            ["Statutory_EsiEmployeeRate"] = dto.EsiEmployeeRate.ToString(),
            ["Statutory_EsiEmployerRate"] = dto.EsiEmployerRate.ToString(),
            ["Statutory_EsiGrossCeiling"] = dto.EsiGrossCeiling.ToString()
        };

        var existingSettings = await _db.SystemSettings
            .IgnoreQueryFilters()
            .Where(s => s.OrganizationId == orgId && s.SettingKey.StartsWith("Statutory_"))
            .ToListAsync();

        foreach (var kvp in keysToSave)
        {
            var existing = existingSettings.FirstOrDefault(s => s.SettingKey == kvp.Key);
            if (existing != null)
            {
                existing.SettingValue = kvp.Value;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = orgId,
                    SettingKey = kvp.Key,
                    SettingValue = kvp.Value,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Statutory settings saved successfully." });
    }
}
