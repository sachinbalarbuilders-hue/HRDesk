using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Attributes;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers;

[ApiController]
[Route("api/device-api")]
[AllowAnonymous] // Bypasses the Global Fallback Policy
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

        var connection = _db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        int insertedCount = 0;
        int orgId = _tenantProvider.TenantId;
        DateTime now = DateTime.Now;

        const string sql = @"
            IF NOT EXISTS (SELECT 1 FROM attendance_logs WHERE employee_id = @emp AND punch_time = @time)
            BEGIN
                INSERT INTO attendance_logs (organization_id, employee_id, machine_number, punch_time, verify_mode, verify_type, synced_at, created_at)
                VALUES (@org, @emp, @mach, @time, @vmode, @vtype, @sync, @create)
            END
            ELSE
            BEGIN
                UPDATE attendance_logs SET synced_at = @sync WHERE employee_id = @emp AND punch_time = @time
            END";

        foreach (var log in logs)
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            
            var pOrg = command.CreateParameter(); pOrg.ParameterName = "@org"; pOrg.Value = orgId; command.Parameters.Add(pOrg);
            var pEmp = command.CreateParameter(); pEmp.ParameterName = "@emp"; pEmp.Value = log.EmployeeId; command.Parameters.Add(pEmp);
            var pMach = command.CreateParameter(); pMach.ParameterName = "@mach"; pMach.Value = log.MachineNumber; command.Parameters.Add(pMach);
            var pTime = command.CreateParameter(); pTime.ParameterName = "@time"; pTime.Value = log.PunchTime; command.Parameters.Add(pTime);
            var pMode = command.CreateParameter(); pMode.ParameterName = "@vmode"; pMode.Value = log.VerifyMode; command.Parameters.Add(pMode);
            var pType = command.CreateParameter(); pType.ParameterName = "@vtype"; pType.Value = log.VerifyType ?? (object)DBNull.Value; command.Parameters.Add(pType);
            var pSync = command.CreateParameter(); pSync.ParameterName = "@sync"; pSync.Value = now; command.Parameters.Add(pSync);
            var pCreate = command.CreateParameter(); pCreate.ParameterName = "@create"; pCreate.Value = now; command.Parameters.Add(pCreate);
            
            try
            {
                var result = await command.ExecuteNonQueryAsync();
                if (result > 0) // rows affected > 0 means insert or update succeeded
                    insertedCount++;
            }
            catch (Microsoft.Data.SqlClient.SqlException ex)
            {
                // Ignore foreign key constraint errors (547 in SQL Server)
                if (ex.Number != 547)
                {
                    throw;
                }
            }
        }

        return Ok(new { inserted = insertedCount });
    }
}
