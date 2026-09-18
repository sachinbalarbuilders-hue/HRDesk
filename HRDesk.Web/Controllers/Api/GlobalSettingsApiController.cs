using System.Linq;
using System.Threading.Tasks;
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
[Route("api/settings/global")]
[Authorize]
public class GlobalSettingsApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IPermissionService _permissionService;

    public GlobalSettingsApiController(
        BiometricAttendanceDbContext db,
        ICurrentTenantProvider tenantProvider,
        IPermissionService permissionService)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _permissionService = permissionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetGlobalSettings()
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var branchId = _tenantProvider.BranchId;

        var timezone = await _db.SystemSettings
            .Where(s => s.OrganizationId == orgId && s.SettingKey == "Organization_TimeZone" && s.BranchId == null)
            .Select(s => s.SettingValue)
            .FirstOrDefaultAsync();

        var exportSetting = await _db.SystemSettings
            .Where(s => s.OrganizationId == orgId && s.SettingKey == "Allowed_Export_EmployeeIds" && s.BranchId == null)
            .Select(s => s.SettingValue)
            .FirstOrDefaultAsync();
            
        int[] allowedExportEmployeeIds = string.IsNullOrWhiteSpace(exportSetting) 
            ? Array.Empty<int>() 
            : exportSetting.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToArray();

        var allowedExportEmployees = await _db.Employees
            .Where(e => allowedExportEmployeeIds.Contains(e.EmployeeId))
            .Select(e => new { e.EmployeeId, e.EmployeeName, e.PhotoPath })
            .ToListAsync();

        return Ok(new
        {
            timeZone = timezone ?? "Asia/Kolkata (UTC+05:30)",
            allowedExportEmployeeIds,
            allowedExportEmployees
        });
    }

    public record UpdateGlobalSettingsDto(string? TimeZone, int[]? AllowedExportEmployeeIds);

    [HttpPut]
    public async Task<IActionResult> UpdateGlobalSettings([FromBody] UpdateGlobalSettingsDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.SystemSettingsEdit))
            return Forbid();

        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        if (dto.TimeZone != null)
        {
            var setting = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == orgId && s.SettingKey == "Organization_TimeZone" && s.BranchId == null);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    OrganizationId = orgId,
                    SettingKey = "Organization_TimeZone",
                    SettingValue = dto.TimeZone,
                    Description = "Global Organization TimeZone"
                };
                _db.SystemSettings.Add(setting);
            }
            else
            {
                setting.SettingValue = dto.TimeZone;
            }
        }

        if (dto.AllowedExportEmployeeIds != null)
        {
            var exportSetting = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == orgId && s.SettingKey == "Allowed_Export_EmployeeIds" && s.BranchId == null);

            var exportSettingValue = string.Join(",", dto.AllowedExportEmployeeIds);

            if (exportSetting == null)
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = orgId,
                    SettingKey = "Allowed_Export_EmployeeIds",
                    SettingValue = exportSettingValue,
                    Description = "List of Employee IDs allowed to Export/Import data"
                });
            }
            else
            {
                exportSetting.SettingValue = exportSettingValue;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Settings updated successfully." });
    }
}
