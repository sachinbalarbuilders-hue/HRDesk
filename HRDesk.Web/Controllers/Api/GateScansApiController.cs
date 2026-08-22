using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/gate-scans")]
[AllowAnonymous]
public class GateScansController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;
    private static bool _tableEnsured = false;
    private static readonly object _lock = new();

    public GateScansController(BiometricAttendanceDbContext db, ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        EnsureTableCreated();
    }

    private void EnsureTableCreated()
    {
        if (_tableEnsured) return;
        lock (_lock)
        {
            if (_tableEnsured) return;
            try
            {
                var sql = @"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'gate_activity_logs')
BEGIN
    CREATE TABLE gate_activity_logs (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT NOT NULL,
        BranchId INT NULL,
        EmployeeId INT NULL,
        EmployeeCode NVARCHAR(50) NOT NULL,
        EmployeeName NVARCHAR(150) NOT NULL,
        DepartmentName NVARCHAR(100) NULL,
        DesignationName NVARCHAR(100) NULL,
        ScanStatus NVARCHAR(30) NOT NULL,
        ScanMode NVARCHAR(30) NOT NULL,
        Reason NVARCHAR(255) NULL,
        ScannedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ScannedBy NVARCHAR(100) NULL
    );

    CREATE INDEX IX_gate_activity_logs_org_scanned ON gate_activity_logs(organization_id, ScannedAt DESC);
END";
                _db.Database.ExecuteSqlRaw(sql);
                _tableEnsured = true;
            }
            catch
            {
                // Silently continue if table already exists or created by migration
            }
        }
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecentLogs([FromQuery] string? organizationId = null)
    {
        var query = _db.GateActivityLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(organizationId))
        {
            if (int.TryParse(organizationId, out int intOrgId))
            {
                query = query.Where(l => l.OrganizationId == intOrgId);
            }
            else if (Guid.TryParse(organizationId, out Guid orgGuid))
            {
                var matchOrg = await _db.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.PublicId == orgGuid);
                if (matchOrg != null)
                {
                    query = query.Where(l => l.OrganizationId == matchOrg.Id);
                }
            }
        }
        else if (_tenantProvider.TenantId > 0 && !User.IsInRole("SuperAdmin") && !User.IsInRole("Super Admin"))
        {
            query = query.Where(l => l.OrganizationId == _tenantProvider.TenantId);
        }

        var logs = await query
            .OrderByDescending(l => l.ScannedAt)
            .Take(50)
            .Select(l => new
            {
                id = l.Id.ToString(),
                employeeId = l.EmployeeId,
                employeeCode = l.EmployeeCode,
                employeeName = l.EmployeeName,
                department = l.DepartmentName,
                designation = l.DesignationName,
                status = l.ScanStatus.ToLower(),
                scanMode = l.ScanMode,
                reason = l.Reason,
                timestamp = l.ScannedAt.ToLocalTime().ToString("hh:mm:ss tt"),
                date = l.ScannedAt.ToLocalTime().ToString("dd MMM yyyy")
            })
            .ToListAsync();

        return Ok(logs);
    }

    [HttpPost("log")]
    public async Task<IActionResult> LogScan([FromBody] LogScanDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.EmployeeCode))
        {
            return BadRequest(new { message = "EmployeeCode is required." });
        }

        int targetOrgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        if (dto.OrganizationId.HasValue && dto.OrganizationId.Value > 0)
        {
            targetOrgId = dto.OrganizationId.Value;
        }

        var userName = User.Identity?.Name ?? "Gate Terminal";

        var log = new GateActivityLog
        {
            OrganizationId = targetOrgId,
            BranchId = dto.BranchId ?? _tenantProvider.BranchId,
            EmployeeId = dto.EmployeeId,
            EmployeeCode = dto.EmployeeCode.Trim(),
            EmployeeName = dto.EmployeeName?.Trim() ?? "Unknown",
            DepartmentName = dto.DepartmentName?.Trim(),
            DesignationName = dto.DesignationName?.Trim(),
            ScanStatus = dto.Status?.ToLower() == "granted" ? "Granted" : "Denied",
            ScanMode = string.IsNullOrWhiteSpace(dto.ScanMode) ? "Camera_QR" : dto.ScanMode,
            Reason = dto.Reason,
            ScannedAt = DateTime.UtcNow,
            ScannedBy = userName
        };

        _db.GateActivityLogs.Add(log);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            id = log.Id,
            message = "Scan logged successfully."
        });
    }

    public record LogScanDto(
        int? EmployeeId,
        string EmployeeCode,
        string? EmployeeName,
        string? DepartmentName,
        string? DesignationName,
        string Status,
        string? ScanMode,
        string? Reason,
        int? BranchId,
        int? OrganizationId
    );
}
