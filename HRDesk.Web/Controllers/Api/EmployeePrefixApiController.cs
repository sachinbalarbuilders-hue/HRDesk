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
[Route("api/employees")]
[Authorize]
public class EmployeePrefixController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;

    public EmployeePrefixController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("prefix-settings")]
    public async Task<IActionResult> GetPrefixSettings([FromQuery] int? branchId = null)
    {
        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        var settings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch)
            .ToListAsync();

        string series    = settings.FirstOrDefault(s => s.SettingKey == "Employee_Prefix_Series")?.SettingValue    ?? "EMP";
        string connector = settings.FirstOrDefault(s => s.SettingKey == "Employee_Prefix_Connector")?.SettingValue ?? "#";
        int padding      = int.TryParse(settings.FirstOrDefault(s => s.SettingKey == "Employee_Prefix_Padding")?.SettingValue,    out var p)    ? p    : 3;
        int startSeq     = int.TryParse(settings.FirstOrDefault(s => s.SettingKey == "Employee_Prefix_StartSeq")?.SettingValue,   out var sSeq) ? sSeq : 1;

        var maxId = await _db.Employees
            .Where(e => e.OrganizationId == targetOrgId && (targetBranch == null || e.BranchId == targetBranch) && e.EmployeeId < 10000)
            .Select(e => (int?)e.EmployeeId)
            .MaxAsync() ?? 0;

        var nextSeq = Math.Max(maxId + 1, startSeq);

        var preview = $"{series}{connector}{nextSeq.ToString($"D{padding}")}";

        return Ok(new
        {
            seriesCode = series,
            connector = connector,
            paddingDigits = padding,
            startSequence = startSeq,
            nextSequence = nextSeq,
            preview = preview,
            sample1 = $"{series}{connector}{(nextSeq).ToString($"D{padding}")}",
            sample2 = $"{series}{connector}{(nextSeq + 1).ToString($"D{padding}")}",
            sample3 = $"{series}{connector}{(nextSeq + 2).ToString($"D{padding}")}",
        });
    }

    [HttpPost("prefix-settings")]
    public async Task<IActionResult> SavePrefixSettings([FromBody] PrefixSettingsDto dto, [FromQuery] int? branchId = null)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
        {
            return Forbid();
        }

        var targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var targetBranch = branchId ?? _tenantProvider.BranchId;

        async Task UpsertSetting(string key, string value, string desc)
        {
            var existing = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.OrganizationId == targetOrgId && s.BranchId == targetBranch && s.SettingKey == key);
            if (existing != null)
            {
                existing.SettingValue = value;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                _db.SystemSettings.Add(new SystemSetting
                {
                    OrganizationId = targetOrgId,
                    BranchId = targetBranch,
                    SettingKey = key,
                    SettingValue = value,
                    Description = desc,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        var series = string.IsNullOrWhiteSpace(dto.SeriesCode) ? "EMP" : dto.SeriesCode.Trim();
        var connector = dto.Connector ?? "";
        var padding = dto.PaddingDigits > 0 ? dto.PaddingDigits : 3;
        var startSeq = dto.StartSequence > 0 ? dto.StartSequence : 1;

        await UpsertSetting("Employee_Prefix_Series", series, "Employee Code Series Prefix");
        await UpsertSetting("Employee_Prefix_Connector", connector, "Employee Code Connector / Delimiter");
        await UpsertSetting("Employee_Prefix_Padding", padding.ToString(), "Employee Code Sequence Padding Length");
        await UpsertSetting("Employee_Prefix_StartSeq", startSeq.ToString(), "Employee Code Starting Sequence");

        if (targetBranch.HasValue && targetBranch.Value > 0)
        {
            var b = await _db.Branches.FirstOrDefaultAsync(br => br.Id == targetBranch.Value);
            if (b != null)
            {
                b.Code = $"{series}{connector}";
            }
        }

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return Ok(new { success = true, message = "Prefix settings saved successfully." });
    }

    public record PrefixSettingsDto(
        string SeriesCode,
        string Connector,
        int PaddingDigits = 3,
        int StartSequence = 1
    );
}
