import re

with open(r"C:\Users\Admin\HRDesk\Z903AttendanceService\Z903AttendanceService\AttendanceService.cs", "r", encoding="utf-8") as f:
    content = f.read()

# Add fields
content = content.replace("private DatabaseService _databaseService;",
                          "private DatabaseService _databaseService;\n        private ApiClient _apiClient;\n        private bool _isCloudMode;\n        private DeviceConfigDto _cloudConfig;")

# OnStart
old_onstart = """                // Initialize database service with logger
                try
                {
                    _databaseService = new DatabaseService(LogMessage);
                    
                    // Test connection with detailed result
                    var connectionResult = _databaseService.TestConnectionDetailed();
                    if (connectionResult.Success)
                    {
                        LogMessage($"Database connection successful. Server: {connectionResult.ServerVersion}");
                        
                        // Initialize tables silently
                        InitializeDatabaseTables();

                        // Load initial device configuration
                        LoadDeviceConfiguration();
                    }
                    else
                    {
                        LogMessage($"WARNING: Database connection failed: {connectionResult.Message}");
                        LogMessage("Service will continue but data won't be saved.");
                    }
                }
                catch (Exception dbEx)
                {
                    LogMessage($"Database initialization error: {dbEx.Message}");
                    LogMessage("WARNING: Service will continue without database functionality.");
                }

                _syncInterval = TimeSpan.FromMinutes(_databaseService.GetSyncIntervalMinutes());
                LogMessage($"Sync interval set to {_syncInterval.TotalMinutes} minutes.");"""

new_onstart = """                _isCloudMode = System.Configuration.ConfigurationManager.AppSettings["OperationMode"]?.Equals("Cloud", StringComparison.OrdinalIgnoreCase) == true;
                LogMessage($"Operation Mode: {(_isCloudMode ? "Cloud" : "Offline")}");

                if (_isCloudMode)
                {
                    _apiClient = new ApiClient(LogMessage);
                    try
                    {
                        _cloudConfig = _apiClient.GetConfigAsync().GetAwaiter().GetResult();
                        _syncInterval = TimeSpan.FromMinutes(_cloudConfig?.Port > 0 ? 5 : 5); // Default to 5
                        LogMessage($"Cloud Config loaded. Machine: {_cloudConfig?.MachineNumber}, IP: {_cloudConfig?.IpAddress}");
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"WARNING: Failed to load cloud config on start: {ex.Message}");
                        _syncInterval = TimeSpan.FromMinutes(5);
                    }
                }
                else
                {
                    try
                    {
                        _databaseService = new DatabaseService(LogMessage);
                        var connectionResult = _databaseService.TestConnectionDetailed();
                        if (connectionResult.Success)
                        {
                            LogMessage($"Database connection successful. Server: {connectionResult.ServerVersion}");
                            InitializeDatabaseTables();
                            LoadDeviceConfiguration();
                        }
                        else
                        {
                            LogMessage($"WARNING: Database connection failed: {connectionResult.Message}");
                        }
                    }
                    catch (Exception dbEx) { LogMessage($"Database initialization error: {dbEx.Message}"); }
                    
                    try { _syncInterval = TimeSpan.FromMinutes(_databaseService.GetSyncIntervalMinutes()); } catch { }
                }
                LogMessage($"Sync interval set to {_syncInterval.TotalMinutes} minutes.");"""
content = content.replace(old_onstart, new_onstart)

# PipeServer
old_pipe = """                // Start named pipe server for internal IPC (UI/backend -> this service)
                try
                {
                    _pipeServer = new NamedPipeServer(PipeConstants.PipeName, LogMessage, _databaseService, this);
                    _pipeServer.Start();
                    LogMessage("Named pipe server active.");
                }
                catch (Exception ex)
                {
                    LogMessage($"Failed to start named pipe server: {ex.Message}");
                }"""
new_pipe = """                if (!_isCloudMode)
                {
                    try
                    {
                        _pipeServer = new NamedPipeServer(PipeConstants.PipeName, LogMessage, _databaseService, this);
                        _pipeServer.Start();
                        LogMessage("Named pipe server active.");
                    }
                    catch (Exception ex) { LogMessage($"Failed to start named pipe server: {ex.Message}"); }
                }"""
content = content.replace(old_pipe, new_pipe)

# TrySyncAttendance
old_trysync = """            try
            {
                var configs = _databaseService.GetDeviceConfigurations();
                if (configs == null || configs.Count == 0)
                {
                    LogMessage("No devices configured for sync.");
                    return;
                }

                LogMessage($"[SYNC] Multi-device sync started for {configs.Count} devices.");
                foreach (var config in configs)
                {
                    try
                    {
                        SyncDevice(config);
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"ERROR syncing device {config.IpAddress} (ID={config.Id}): {ex.Message}");
                    }
                }
                LogMessage("[SYNC] Multi-device sync cycle completed.");
            }"""

new_trysync = """            try
            {
                if (_isCloudMode)
                {
                    // Refresh config and process commands
                    try
                    {
                        _cloudConfig = _apiClient.GetConfigAsync().GetAwaiter().GetResult();
                        var pendingCommands = _apiClient.GetPendingCommandsAsync().GetAwaiter().GetResult();
                        if (pendingCommands != null && pendingCommands.Count > 0)
                        {
                            LogMessage($"Found {pendingCommands.Count} pending cloud commands.");
                            var deviceService = new BiometricDeviceService(LogMessage);
                            foreach(var cmd in pendingCommands)
                            {
                                bool success = false;
                                string err = null;
                                try {
                                    if (cmd.Action == "SetName") success = deviceService.SetUserInMachine(cmd.EmployeeId.Value, cmd.EmployeeName);
                                    else if (cmd.Action == "EnableUser") success = deviceService.EnableUser(cmd.EmployeeId.Value, cmd.Enabled.Value);
                                    else if (cmd.Action == "DeleteUser") success = deviceService.DeleteUser(cmd.EmployeeId.Value);
                                    else success = true;
                                } catch(Exception cmdEx) { err = cmdEx.Message; }
                                
                                _apiClient.UpdateCommandResultAsync(cmd.Id, success, err).GetAwaiter().GetResult();
                            }
                        }
                        
                        if (_cloudConfig != null) SyncDevice(_cloudConfig);
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"Cloud Sync Cycle Error: {ex.Message}");
                    }
                }
                else
                {
                    var configs = _databaseService?.GetDeviceConfigurations();
                    if (configs == null || configs.Count == 0) return;
                    foreach (var config in configs) SyncDevice(config);
                }
            }"""
content = content.replace(old_trysync, new_trysync)

# SyncDevice saving
old_save = """                        // Database Save
                        if (_databaseService != null && records.Count > 0)
                        {
                            try
                            {
                                int inserted = _databaseService.InsertBulkAttendanceRecords(records.ToArray());
                                recordsInserted = inserted;
                                recordsSkipped = records.Count - inserted;
                                
                                if (latestRecordTime > DateTime.MinValue)
                                    _databaseService.UpdateLastSyncedTime(config.Id, deviceIp, latestRecordTime, "success", recordsInserted);
                            }
                            catch (Exception dbEx) { syncStatus = "failed"; errorMessage = dbEx.Message; }
                        }
                        else if (records.Count == 0 && recordsRetrieved > 0 && latestRecordTime > DateTime.MinValue)
                        {
                            _databaseService?.UpdateLastSyncedTime(config.Id, deviceIp, latestRecordTime, "success", 0);
                        }"""

new_save = """                        // Database Save
                        if (_isCloudMode)
                        {
                            if (records.Count > 0)
                            {
                                try
                                {
                                    bool pushed = _apiClient.PushLogsAsync(records).GetAwaiter().GetResult();
                                    if (pushed) recordsInserted = records.Count;
                                }
                                catch (Exception cloudEx) { syncStatus = "failed"; errorMessage = cloudEx.Message; }
                            }
                        }
                        else
                        {
                            if (_databaseService != null && records.Count > 0)
                            {
                                try
                                {
                                    int inserted = _databaseService.InsertBulkAttendanceRecords(records.ToArray());
                                    recordsInserted = inserted;
                                    recordsSkipped = records.Count - inserted;
                                    
                                    if (latestRecordTime > DateTime.MinValue)
                                        _databaseService.UpdateLastSyncedTime(config.Id, deviceIp, latestRecordTime, "success", recordsInserted);
                                }
                                catch (Exception dbEx) { syncStatus = "failed"; errorMessage = dbEx.Message; }
                            }
                            else if (records.Count == 0 && recordsRetrieved > 0 && latestRecordTime > DateTime.MinValue)
                            {
                                _databaseService?.UpdateLastSyncedTime(config.Id, deviceIp, latestRecordTime, "success", 0);
                            }
                        }"""
content = content.replace(old_save, new_save)


with open(r"C:\Users\Admin\HRDesk\Z903AttendanceService\Z903AttendanceService\AttendanceService.cs", "w", encoding="utf-8") as f:
    f.write(content)

print("Done refactoring AttendanceService.cs")
