using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Attributes;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers;

[ApiController]
[Route("api/device-api")]
[ApiKeyAuth] // Secures these endpoints using the X-Api-Key header
public class DeviceApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;

    public DeviceApiController(BiometricAttendanceDbContext db, ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var config = await _db.DeviceConfigurations.FirstOrDefaultAsync();
        if (config == null) return NotFound("No device configuration found.");

        var intervalSetting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.SettingKey == "SyncIntervalMinutes");
        int syncInterval = 5;
        if (intervalSetting != null && int.TryParse(intervalSetting.SettingValue, out var mins))
        {
            syncInterval = mins;
        }

        return Ok(new
        {
            config.IpAddress,
            config.Port,
            config.MachineNumber,
            config.CommKey,
            SyncIntervalMinutes = syncInterval
        });
    }

    [HttpGet("commands/pending")]
    public async Task<IActionResult> GetPendingCommands()
    {
        var commands = await _db.DeviceCommands
            .Where(c => c.Status == "Pending")
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Action,
                c.EmployeeId,
                c.EmployeeName,
                c.Enabled
            })
            .ToListAsync();

        return Ok(commands);
    }

    public class CommandResultRequest
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
    }

    [HttpPost("commands/{id}/result")]
    public async Task<IActionResult> UpdateCommandResult(int id, [FromBody] CommandResultRequest request)
    {
        var command = await _db.DeviceCommands.FindAsync(id);
        if (command == null) return NotFound();

        command.Status = request.Success ? "Completed" : "Failed";
        command.ErrorMessage = request.ErrorMessage;
        command.CompletedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok();
    }

    public class AttendanceLogRequest
    {
        public int EmployeeId { get; set; }
        public int MachineNumber { get; set; }
        public DateTime PunchTime { get; set; }
        public int VerifyMode { get; set; }
        public string? VerifyType { get; set; }
    }

    [HttpPost("logs")]
    public async Task<IActionResult> PushLogs([FromBody] List<AttendanceLogRequest> logs)
    {
        if (logs == null || !logs.Any()) return BadRequest("No logs provided.");

        var newLogs = logs.Select(l => new AttendanceLog
        {
            OrganizationId = _tenantProvider.TenantId,
            EmployeeId = l.EmployeeId,
            MachineNumber = l.MachineNumber,
            PunchTime = l.PunchTime,
            VerifyMode = l.VerifyMode,
            VerifyType = l.VerifyType,
            SyncedAt = DateTime.Now,
            CreatedAt = DateTime.Now
        }).ToList();

        _db.AttendanceLogs.AddRange(newLogs);
        await _db.SaveChangesAsync();

        return Ok(new { inserted = newLogs.Count });
    }
}
