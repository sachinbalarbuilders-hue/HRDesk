using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AttendanceUI.Services;

public static class WindowsServiceClient
{
    // Attempts to call the Windows Service over a named pipe. The pipe name and
    // message contract are intentionally simple JSON so the service can be adapted.
    // If your service uses a different protocol, replace this implementation.
    public static async Task<(bool Success, string? ErrorMessage)> SetNameInMachineAsync(int employeeId, string employeeName)
    {
        const string pipeName = PipeConstants.PipeName; // centralized pipe name constant
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(60000);
            await connectTask;
            if (!client.IsConnected)
            {
                return (false, "Failed to connect to device service");
            }

            var request = new { Action = "SetName", EmployeeId = employeeId, EmployeeName = employeeName };
            var reqJson = JsonSerializer.Serialize(request);

            // Use explicit writer/reader and ensure we don't dispose the pipe until
            // we've either read a full response or the read timeout elapses.
            // Create reader/writer that do NOT close the underlying pipe when disposed.
            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            // Ensure data is flushed to the pipe so server can read it promptly.
            await writer.FlushAsync();

            // Read single-line JSON response (service should respond similarly)
            const int readTimeoutMs = 60000; // 10s
            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            if (completed != readTask)
            {
                return (false, "Timed out waiting for device service response");
            }

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine))
            {
                return (false, "Empty response from device service");
            }

            try
            {
                using var doc = JsonDocument.Parse(responseLine);
                var root = doc.RootElement;

                // Safely handle absence of expected properties. Do not assume keys exist.
                // Windows service may return PascalCase (Success, Message) or lowercase (success, message)
                bool success = false;
                if (root.TryGetProperty("Success", out var succProp) && (succProp.ValueKind == JsonValueKind.True || succProp.ValueKind == JsonValueKind.False))
                {
                    success = succProp.GetBoolean();
                }
                else if (root.TryGetProperty("success", out succProp) && (succProp.ValueKind == JsonValueKind.True || succProp.ValueKind == JsonValueKind.False))
                {
                    success = succProp.GetBoolean();
                }

                string? message = null;
                if (root.TryGetProperty("Message", out var msgProp) && msgProp.ValueKind == JsonValueKind.String)
                {
                    message = msgProp.GetString();
                }
                else if (root.TryGetProperty("message", out msgProp) && msgProp.ValueKind == JsonValueKind.String)
                {
                    message = msgProp.GetString();
                }
                else if (root.TryGetProperty("error", out var errProp) && errProp.ValueKind == JsonValueKind.String)
                {
                    message = errProp.GetString();
                }

                // If no message property, fallback to raw response text.
                if (string.IsNullOrWhiteSpace(message))
                {
                    message = responseLine;
                }

                return (success, message);
            }
            catch (JsonException)
            {
                // Not JSON — return raw line as message
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

    /// <summary>
    /// Enable or disable a user on the biometric device via the Windows Service.
    /// </summary>
    public static async Task<(bool Success, string? ErrorMessage)> EnableUserAsync(int employeeId, bool enabled)
    {
        const string pipeName = PipeConstants.PipeName;
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(60000);
            await connectTask;
            if (!client.IsConnected)
            {
                return (false, "Failed to connect to device service");
            }

            var request = new { Action = "EnableUser", EmployeeId = employeeId, Enabled = enabled };
            var reqJson = JsonSerializer.Serialize(request);

            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            await writer.FlushAsync();

            const int readTimeoutMs = 60000;
            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            if (completed != readTask)
            {
                return (false, "Timed out waiting for device service response");
            }

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine))
            {
                return (false, "Empty response from device service");
            }

            try
            {
                using var doc = JsonDocument.Parse(responseLine);
                var root = doc.RootElement;

                bool success = false;
                if (root.TryGetProperty("Success", out var succProp) && (succProp.ValueKind == JsonValueKind.True || succProp.ValueKind == JsonValueKind.False))
                {
                    success = succProp.GetBoolean();
                }
                else if (root.TryGetProperty("success", out succProp) && (succProp.ValueKind == JsonValueKind.True || succProp.ValueKind == JsonValueKind.False))
                {
                    success = succProp.GetBoolean();
                }

                string? message = null;
                if (root.TryGetProperty("Message", out var msgProp) && msgProp.ValueKind == JsonValueKind.String)
                {
                    message = msgProp.GetString();
                }
                else if (root.TryGetProperty("message", out msgProp) && msgProp.ValueKind == JsonValueKind.String)
                {
                    message = msgProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(message))
                {
                    message = responseLine;
                }

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

    /// <summary>
    /// Delete a user from the biometric device via the Windows Service.
    /// </summary>
    public static async Task<(bool Success, string? ErrorMessage)> DeleteUserAsync(int employeeId)
    {
        const string pipeName = PipeConstants.PipeName;
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(60000);
            await connectTask;
            if (!client.IsConnected)
            {
                return (false, "Failed to connect to device service");
            }

            var request = new { Action = "DeleteUser", EmployeeId = employeeId };
            var reqJson = JsonSerializer.Serialize(request);

            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            await writer.FlushAsync();

            const int readTimeoutMs = 60000;
            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            
            if (completed != readTask)
            {
                return (false, "Timed out waiting for device service response");
            }

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine))
            {
                return (false, "Empty response from device service");
            }

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

                if (string.IsNullOrWhiteSpace(message))
                {
                    message = responseLine;
                }

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

    /// <summary>
    /// Update the biometric device configuration in the Windows Service.
    /// </summary>
    public static async Task<(bool Success, string? ErrorMessage)> UpdateDeviceConfigAsync(string ipAddress, int port, int machineNumber, int? commKey = 0)
    {
        const string pipeName = PipeConstants.PipeName;
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(60000); // 1 minute timeout to connect
            await connectTask;

            if (!client.IsConnected)
            {
                return (false, "Failed to connect to device service");
            }

            var request = new 
            { 
                Action = "UpdateConfig", 
                EmployeeId = 0, // Dummy ID to satisfy service validation
                IpAddress = ipAddress, 
                Port = port, 
                MachineNumber = machineNumber,
                CommKey = commKey ?? 0
            };
            var reqJson = JsonSerializer.Serialize(request);

            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            await writer.FlushAsync();

            const int readTimeoutMs = 60000;
            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            
            if (completed != readTask)
            {
                return (false, "Timed out waiting for device service response");
            }

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine))
            {
                return (false, "Empty response from device service");
            }

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

                if (string.IsNullOrWhiteSpace(message))
                {
                    message = responseLine;
                }

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
    /// <summary>
    /// Update the attendance sync interval in the Windows Service.
    /// </summary>
    public static async Task<(bool Success, string? ErrorMessage)> UpdateSyncIntervalAsync(int minutes)
    {
        const string pipeName = PipeConstants.PipeName;
        try
        {
            using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            var connectTask = client.ConnectAsync(10000);
            await connectTask;

            if (!client.IsConnected) return (false, "Failed to connect to device service");

            var request = new { Action = "UpdateSyncInterval", EmployeeId = 0, IntervalMinutes = minutes };
            var reqJson = JsonSerializer.Serialize(request);

            using var writer = new StreamWriter(client, Encoding.UTF8, bufferSize: 1024, leaveOpen: true) { AutoFlush = true };
            using var reader = new StreamReader(client, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);

            await writer.WriteLineAsync(reqJson);
            await writer.FlushAsync();

            const int readTimeoutMs = 10000;
            var readTask = reader.ReadLineAsync();
            var completed = await Task.WhenAny(readTask, Task.Delay(readTimeoutMs));
            
            if (completed != readTask) return (false, "Timed out waiting for device service response");

            var responseLine = await readTask;
            if (string.IsNullOrWhiteSpace(responseLine)) return (false, "Empty response from device service");

            using var doc = JsonDocument.Parse(responseLine);
            var root = doc.RootElement;
            bool success = root.TryGetProperty("Success", out var succProp) && succProp.GetBoolean();
            string? message = root.TryGetProperty("Message", out var msgProp) ? msgProp.GetString() : responseLine;

            return (success, message);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
