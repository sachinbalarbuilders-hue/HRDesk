using System;
using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace Z903AttendanceService
{
    internal class PipeRequest
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; }
    }

    internal class PipeResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
    }

    internal class NamedPipeServer
    {
        private readonly string _pipeName;
        private readonly Action<string> _logger;
        private readonly DatabaseService _databaseService;
        private readonly AttendanceService _service;
        private Thread _listenerThread;
        private volatile bool _running;

        public NamedPipeServer(string pipeName = PipeConstants.PipeName, Action<string> logger = null, DatabaseService databaseService = null, AttendanceService service = null)
        {
            _pipeName = pipeName;
            _logger = logger;
            _databaseService = databaseService;
            _service = service;
        }

        private void Log(string message)
        {
            try { _logger?.Invoke($"[NamedPipeServer] {message}"); } catch { }
        }

        /// <summary>
        /// Gets all device configurations from the database.
        /// Returns a list with a single default entry if DB is unavailable.
        /// </summary>
        private System.Collections.Generic.List<DeviceConfigDto> GetAllDevices()
        {
            if (_databaseService != null)
            {
                try
                {
                    var configs = _databaseService.GetDeviceConfigurations();
                    if (configs != null && configs.Count > 0)
                        return configs;
                }
                catch (Exception ex)
                {
                    Log($"WARNING: Failed to get device configurations: {ex.Message}");
                }
            }

            // Fallback: return a single default device from static config
            return new System.Collections.Generic.List<DeviceConfigDto>
            {
                new DeviceConfigDto
                {
                    Id = 0,
                    IpAddress = BiometricDeviceService.DeviceConfig.IpAddress,
                    Port = BiometricDeviceService.DeviceConfig.Port,
                    MachineNumber = BiometricDeviceService.DeviceConfig.MachineNumber,
                    CommKey = BiometricDeviceService.DeviceConfig.CommKey
                }
            };
        }

        /// <summary>
        /// Executes a device operation on ALL configured devices and returns a combined response.
        /// </summary>
        private PipeResponse ExecuteOnAllDevices(string operationName, Action<BiometricDeviceService, DeviceConfigDto> operation)
        {
            var devices = GetAllDevices();
            Log($"[MULTI-DEVICE] Executing '{operationName}' on {devices.Count} device(s)...");

            int successCount = 0;
            int failCount = 0;
            var errors = new System.Collections.Generic.List<string>();

            foreach (var device in devices)
            {
                try
                {
                    var deviceService = new BiometricDeviceService(Log);
                    operation(deviceService, device);
                    successCount++;
                    Log($"[MULTI-DEVICE] '{operationName}' succeeded on device {device.IpAddress} (ID={device.Id})");
                }
                catch (Exception ex)
                {
                    failCount++;
                    string errMsg = $"Device {device.IpAddress} (ID={device.Id}): {ex.Message}";
                    errors.Add(errMsg);
                    Log($"[MULTI-DEVICE] '{operationName}' FAILED on device {device.IpAddress} (ID={device.Id}): {ex.Message}");
                }
            }

            if (failCount == 0)
            {
                return new PipeResponse { Success = true, Message = $"{operationName} succeeded on all {successCount} device(s)." };
            }
            else if (successCount > 0)
            {
                return new PipeResponse { Success = true, Message = $"{operationName}: {successCount} succeeded, {failCount} failed. Errors: {string.Join("; ", errors)}" };
            }
            else
            {
                return new PipeResponse { Success = false, Message = $"{operationName} failed on all {failCount} device(s). Errors: {string.Join("; ", errors)}" };
            }
        }

        public void Start()
        {
            if (_running) return;
            _running = true;
            _listenerThread = new Thread(ListenLoop) { IsBackground = true };
            _listenerThread.Start();
        }

        public void Stop()
        {
            _running = false;
            try
            {
                _listenerThread?.Join(1000);
            }
            catch { }
            Log("Stopped");
        }

        private void ListenLoop()
        {
            while (_running)
            {
                try
                {
                    // Configure pipe security to allow local user processes to connect.
                    var pipeSecurity = new PipeSecurity();
                    // Grant full read/write to Everyone (local-only usage). Alternatively, use Builtin Users.
                    pipeSecurity.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.WorldSid, null), PipeAccessRights.ReadWrite, AccessControlType.Allow));

                    using (var server = new NamedPipeServerStream(
                        _pipeName,
                        PipeDirection.InOut,
                        NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Message,
                        PipeOptions.Asynchronous,
                        0,
                        0,
                        pipeSecurity))
                    {
                        server.WaitForConnection();
                        Log("Client connected.");

                        // Read a single newline-delimited JSON line from the client using StreamReader (UTF-8)
                        string requestJson = string.Empty;
                        try
                        {
                            using (var reader = new StreamReader(server, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 4096, leaveOpen: true))
                            {
                                var line = reader.ReadLineAsync().GetAwaiter().GetResult();
                                if (line == null)
                                {
                                    Log("ERROR: Received null request line");
                                    requestJson = string.Empty;
                                }
                                else
                                {
                                    requestJson = line.Trim();
                                    if (requestJson.Length > 0 && requestJson[0] == '\uFEFF')
                                        requestJson = requestJson.Substring(1);

                                    var requestSummary = requestJson.Length > 200 ? requestJson.Substring(0, 200) + "..." : requestJson;
                                    Log($"Command received: {requestSummary}");
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Log("ERROR: " + ex.ToString());
                            requestJson = string.Empty;
                        }

                        PipeResponse resp;
                        try
                        {
                            // Parse action type
                            var actionMatch = Regex.Match(requestJson, "\"Action\"\\s*:\\s*\"([^\"]+)\"");
                            string action = actionMatch.Success ? actionMatch.Groups[1].Value : "SetName";
                            
                            // Simple JSON parsing using regex (sufficient for expected small payload)
                            var idMatch = Regex.Match(requestJson, "\"EmployeeId\"\\s*:\\s*(\\d+)");
                            var nameMatch = Regex.Match(requestJson, "\"EmployeeName\"\\s*:\\s*\"([^\"]*)\"");
                            var enabledMatch = Regex.Match(requestJson, "\"Enabled\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);

                            if (!idMatch.Success)
                            {
                                throw new Exception("Missing EmployeeId in request");
                            }

                            int employeeId = int.Parse(idMatch.Groups[1].Value);
                            string employeeName = nameMatch.Success ? nameMatch.Groups[1].Value : string.Empty;
                            bool enabled = enabledMatch.Success ? enabledMatch.Groups[1].Value.ToLower() == "true" : true;

                            switch (action.ToLower())
                            {
                                case "setname":
                                    resp = ExecuteOnAllDevices("SetUser", (svc, dev) =>
                                        svc.SetUserInMachine(employeeId, employeeName, dev.IpAddress, dev.Port, dev.MachineNumber, dev.CommKey));
                                    break;
                                    
                                case "enableuser":
                                    resp = ExecuteOnAllDevices(enabled ? "EnableUser" : "DisableUser", (svc, dev) =>
                                        svc.SetUserEnabled(employeeId, enabled, dev.IpAddress, dev.Port, dev.MachineNumber, dev.CommKey));
                                    break;
                                    
                                case "deleteuser":
                                    resp = ExecuteOnAllDevices("DeleteUser", (svc, dev) =>
                                        svc.DeleteUser(employeeId, dev.IpAddress, dev.Port, dev.MachineNumber, dev.CommKey));
                                    break;

                                 case "updateconfig":
                                    // Parse additional config fields
                                    var ipMatch = Regex.Match(requestJson, "\"IpAddress\"\\s*:\\s*\"([^\"]+)\"");
                                    var portMatch = Regex.Match(requestJson, "\"Port\"\\s*:\\s*(\\d+)");
                                    var machineMatch = Regex.Match(requestJson, "\"MachineNumber\"\\s*:\\s*(\\d+)");
                                    var commKeyMatch = Regex.Match(requestJson, "\"CommKey\"\\s*:\\s*(\\d+)");

                                    string ip = ipMatch.Success ? ipMatch.Groups[1].Value : string.Empty;
                                    int port = portMatch.Success ? int.Parse(portMatch.Groups[1].Value) : 0;
                                    int machineNum = machineMatch.Success ? int.Parse(machineMatch.Groups[1].Value) : 1;
                                    int commKey = commKeyMatch.Success ? int.Parse(commKeyMatch.Groups[1].Value) : 0;

                                    if(string.IsNullOrEmpty(ip) || port == 0) 
                                    {
                                         resp = new PipeResponse { Success = false, Message = "Invalid IP or Port. Update failed." };
                                         break;
                                    }

                                    // Update static fallback config
                                    BiometricDeviceService.DeviceConfig.Update(ip, port, machineNum, commKey);
                                    Log($"Device configuration context updated: IP={ip}, Port={port}, Machine={machineNum}");

                                    // Verify connection immediately using provided params
                                    var deviceService = new BiometricDeviceService(Log);
                                    string connErr;
                                    bool connOk = deviceService.TestConnection(out connErr, ip, port, machineNum, commKey);
                                    if (connOk)
                                    {
                                        resp = new PipeResponse { Success = true, Message = "Configuration updated and connection verified." };
                                    }
                                    else
                                    {
                                        resp = new PipeResponse { Success = true, Message = $"Configuration saved, BUT connection failed: {connErr}" };
                                    }
                                    break;
                                    
                                 case "updatesyncinterval":
                                    var intervalMatch = Regex.Match(requestJson, "\"IntervalMinutes\"\\s*:\\s*(\\d+)");
                                    if (intervalMatch.Success)
                                    {
                                        int mins = int.Parse(intervalMatch.Groups[1].Value);
                                        _service?.UpdateInterval(mins);
                                        resp = new PipeResponse { Success = true, Message = $"Sync interval updated to {mins} minutes." };
                                    }
                                    else
                                    {
                                        resp = new PipeResponse { Success = false, Message = "Missing IntervalMinutes parameter." };
                                    }
                                    break;
                                    
                                default:
                                    throw new Exception($"Unknown action: {action}");
                            }
                        }
                        catch (Exception ex)
                        {
                            resp = new PipeResponse { Success = false, Message = ex.Message };
                        }

                        // Write response as JSON
                        try
                        {
                            string respJson = $"{{\"Success\":{(resp.Success ? "true" : "false")},\"Message\":\"{EscapeJson(resp.Message)}\"}}";
                            var outBytes = Encoding.UTF8.GetBytes(respJson);
                            server.Write(outBytes, 0, outBytes.Length);
                            server.Flush();
                            server.WaitForPipeDrain();
                            Log("Response written successfully.");
                        }
                        catch (Exception ex)
                        {
                            Log("ERROR: " + ex.ToString());
                        }

                        try { server.Disconnect(); } catch (Exception ex) { Log("ERROR: " + ex.ToString()); }
                    }
                }
                catch (Exception ex)
                {
                    Log("ERROR: " + ex.ToString());
                    Thread.Sleep(500);
                }
            }
        }

        private string EscapeJson(string s)
        {
            if (s == null) return string.Empty;
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
