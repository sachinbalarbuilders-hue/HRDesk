using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public class DeviceCommunicationService : IDeviceCommunicationService
{
    private readonly IConfiguration _configuration;
    private readonly BiometricAttendanceDbContext _db;
    private readonly ICurrentTenantProvider _tenantProvider;

    public DeviceCommunicationService(IConfiguration configuration, BiometricAttendanceDbContext db, ICurrentTenantProvider tenantProvider)
    {
        _configuration = configuration;
        _db = db;
        _tenantProvider = tenantProvider;
    }

    private bool IsCloudMode => _configuration["Biometric:Mode"]?.Equals("Cloud", StringComparison.OrdinalIgnoreCase) == true;

    private async Task<(bool Success, string? ErrorMessage)> QueueCommandAsync(string action, int? employeeId = null, string? employeeName = null, bool? enabled = null)
    {
        var command = new DeviceCommand
        {
            OrganizationId = _tenantProvider.TenantId,
            Action = action,
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            Enabled = enabled,
            Status = "Pending"
        };
        _db.DeviceCommands.Add(command);
        await _db.SaveChangesAsync();
        return (true, "Command queued for cloud delivery");
    }

    private async Task<(bool Success, string? ErrorMessage)> ExecuteNamedPipeAsync(object requestObject, int connectTimeout = 60000, int readTimeoutMs = 60000)
    {
        const string pipeName = PipeConstants.PipeName;
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(connectTimeout);
            await connectTask;
            if (!client.IsConnected) return (false, "Failed to connect to device service");

            var reqJson = JsonSerializer.Serialize(requestObject);

            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            await writer.FlushAsync();

            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            
            if (completed != readTask) return (false, "Timed out waiting for device service response");

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine)) return (false, "Empty response from device service");

            try
            {
                using var doc = JsonDocument.Parse(responseLine);
                var root = doc.RootElement;
                bool success = false;
                if (root.TryGetProperty("Success", out var succProp) || root.TryGetProperty("success", out succProp))
                {
                    success = (succProp.ValueKind == JsonValueKind.True);
                }

                string? message = null;
                if (root.TryGetProperty("Message", out var msgProp) || root.TryGetProperty("message", out msgProp))
                {
                    message = msgProp.GetString();
                }
                else if (root.TryGetProperty("error", out var errProp) && errProp.ValueKind == JsonValueKind.String)
                {
                    message = errProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(message)) message = responseLine;

                return (success, message);
            }
            catch (JsonException)
            {
                return (false, responseLine);
            }
        }
        catch (TimeoutException)
        {
            return (false, "Timed out connecting to device service");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Success, string? ErrorMessage)> SetNameInMachineAsync(int employeeId, string employeeName)
    {
        if (IsCloudMode) return await QueueCommandAsync("SetName", employeeId, employeeName);
        return await ExecuteNamedPipeAsync(new { Action = "SetName", EmployeeId = employeeId, EmployeeName = employeeName });
    }

    public async Task<(bool Success, string? ErrorMessage)> EnableUserAsync(int employeeId, bool enabled)
    {
        if (IsCloudMode) return await QueueCommandAsync("EnableUser", employeeId, null, enabled);
        return await ExecuteNamedPipeAsync(new { Action = "EnableUser", EmployeeId = employeeId, Enabled = enabled });
    }

    public async Task<(bool Success, string? ErrorMessage)> DeleteUserAsync(int employeeId)
    {
        if (IsCloudMode) return await QueueCommandAsync("DeleteUser", employeeId);
        return await ExecuteNamedPipeAsync(new { Action = "DeleteUser", EmployeeId = employeeId });
    }

    public async Task<(bool Success, string? ErrorMessage)> UpdateDeviceConfigAsync(string ip, int port, int machineNum, int? commKey = 0)
    {
        if (IsCloudMode) return (true, "Configuration saved in cloud");
        return await ExecuteNamedPipeAsync(new { Action = "UpdateConfig", EmployeeId = 0, IpAddress = ip, Port = port, MachineNumber = machineNum, CommKey = commKey });
    }

    public async Task<(bool Success, string? ErrorMessage)> UpdateSyncIntervalAsync(int syncIntervalMinutes)
    {
        if (IsCloudMode) return (true, "Sync interval saved in cloud");
        return await ExecuteNamedPipeAsync(new { Action = "UpdateSyncInterval", EmployeeId = 0, IntervalMinutes = syncIntervalMinutes }, connectTimeout: 10000, readTimeoutMs: 10000);
    }
}
