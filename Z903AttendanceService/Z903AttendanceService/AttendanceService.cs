using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.ServiceProcess;
using System.Threading;
using System.Timers;
using sbxpc;

namespace Z903AttendanceService
{
    public partial class AttendanceService : ServiceBase
    {
        private const string LogDirectory = @"C:\HRServices\Z903AttendanceService\Logs";
        private const string LogFileName = "service.log";
        private const int DefaultMachineNumber = 1;
        private static readonly TimeSpan SyncInterval = TimeSpan.FromMinutes(5);
        private readonly object _logLock = new object();
        private System.Timers.Timer _syncTimer;
        private NamedPipeServer _pipeServer;
        private int _syncInProgress;
        private DatabaseService _databaseService;

        // Retry configuration
        private const int MaxConnectionRetries = 3;
        private const int InitialRetryDelayMs = 2000;  // 2 seconds
        private const int MaxRetryDelayMs = 10000;     // 10 seconds max
        private int _consecutiveFailures = 0;
        private const int MaxConsecutiveFailures = 5;

        public AttendanceService()

        {
            InitializeComponent();
        }

        protected override void OnStart(string[] args)
        {
            try
            {
                LogMessage($"Service starting ({(Environment.Is64BitProcess ? "x64" : "x86")})...");

                // Initialize database service with logger
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

                _syncTimer = new System.Timers.Timer(SyncInterval.TotalMilliseconds)
                {
                    AutoReset = false,
                    Enabled = false
                };
                _syncTimer.Elapsed += OnSyncTimerElapsed;
                _syncTimer.Start();

                // Start named pipe server for internal IPC (UI/backend -> this service)
                try
                {
                    _pipeServer = new NamedPipeServer(PipeConstants.PipeName, LogMessage, _databaseService);
                    _pipeServer.Start();
                    LogMessage("Named pipe server active.");
                }
                catch (Exception ex)
                {
                    LogMessage($"Failed to start named pipe server: {ex.Message}");
                }

            }
            catch (Exception ex)
            {
                LogMessage($"OnStart error: {ex}");
            }
        }

        /// <summary>
        /// Initializes all required database tables on startup.
        /// </summary>
        private void InitializeDatabaseTables()
        {
            try
            {
                _databaseService.CreateAttendanceLogsTable();
            }
            catch (Exception ex)
            {
                LogMessage($"WARNING: Failed to create attendance_logs table: {ex.Message}");
            }

            try
            {
                _databaseService.CreateDeviceSyncStateTable();
            }
            catch (Exception ex)
            {
                LogMessage($"WARNING: Failed to create device_sync_state table: {ex.Message}");
            }

        }

        protected override void OnStop()
        {
            try
            {
                if (_syncTimer != null)
                {
                    _syncTimer.Stop();
                    _syncTimer.Elapsed -= OnSyncTimerElapsed;
                    _syncTimer.Dispose();
                    _syncTimer = null;
                }


                // Ensure device is disconnected on shutdown
                try
                {
                    SBXPCDLL.Disconnect(DefaultMachineNumber);
                    LogMessage("Device disconnected during shutdown.");
                }
                catch (Exception ex)
                {
                    LogMessage($"WARNING: Error disconnecting device during shutdown: {ex.Message}");
                }

                // Stop pipe server
                try
                {
                    _pipeServer?.Stop();
                    LogMessage("Named pipe server stopped.");
                }
                catch (Exception ex)
                {
                    LogMessage($"Error stopping named pipe server: {ex.Message}");
                }

                LogMessage("Service stopped.");
            }
            catch (Exception ex)
            {
                LogMessage($"OnStop error: {ex}");
            }
        }

        private void OnSyncTimerElapsed(object sender, ElapsedEventArgs e)
        {
            try
            {
                TrySyncAttendance();
            }
            catch (Exception ex)
            {
                LogMessage($"Timer error: {ex}");
            }
            finally
            {
                try
                {
                    _syncTimer?.Start();
                }
                catch (Exception ex)
                {
                    LogMessage($"Timer restart error: {ex}");
                }
            }
        }

        private void TrySyncAttendance()
        {
            if (Interlocked.CompareExchange(ref _syncInProgress, 1, 0) != 0)
            {
                LogMessage("Sync skipped because a previous run is still in progress.");
                return;
            }

            try
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
            }
            catch (Exception ex)
            {
                LogMessage($"TrySyncAttendance global error: {ex.Message}");
            }
            finally
            {
                Interlocked.Exchange(ref _syncInProgress, 0);
            }
        }

        private void SyncDevice(DeviceConfigDto config)
        {
            DateTime syncStarted = DateTime.Now;
            int recordsRetrieved = 0;
            int recordsInserted = 0;
            int recordsSkipped = 0;
            int recordsFiltered = 0;
            string syncStatus = "success";
            string errorMessage = null;
            DateTime? lastSyncedTime = null;
            DateTime latestRecordTime = DateTime.MinValue;

            string deviceIp = config.IpAddress;
            int devicePort = config.Port;
            int machineNumber = config.MachineNumber;
            int commKey = config.CommKey;

            try
            {
                LogMessage($"--- Syncing Device: {deviceIp} (ID={config.Id}, Machine={machineNumber}) ---");

                if (_databaseService != null)
                {
                    // Track sync state per machine number (or ID if we prefer, but DB uses device_id which maps to config.Id)
                    lastSyncedTime = _databaseService.GetLastSyncedTime(config.Id);
                }

                if (!Monitor.TryEnter(BiometricDeviceService.SdkLock, TimeSpan.FromSeconds(5)))
                {
                    LogMessage($"Sync skipped for {deviceIp}: SDK lock held by manual operation.");
                    return;
                }

                try
                {
                    if (!BiometricDeviceService.SdkInitialized)
                    {
                        SBXPCDLL.DotNET();
                        BiometricDeviceService.SdkInitialized = true;
                    }

                    if (ConnectWithRetry(deviceIp, devicePort, machineNumber, commKey))
                    {
                        // Check device time
                        if (SBXPCDLL.GetDeviceTime(machineNumber, out int idwYear, out int idwMonth, out int idwDay, out int idwHour, out int idwMinute, out int idwSecond, out int idwDayOfWeek))
                        {
                            LogMessage($"[DEVICE] Time: {idwYear}-{idwMonth:D2}-{idwDay:D2} {idwHour:D2}:{idwMinute:D2}:{idwSecond:D2}");
                        }

                        List<AttendanceRecord> records = new List<AttendanceRecord>();
                        DateTime syncedAt = DateTime.Now;

                        // Stage 1: ReadAllGLogData
                        if (SBXPCDLL.ReadAllGLogData(machineNumber))
                            records = GetRecordsFromDevice(machineNumber, syncedAt, lastSyncedTime, out recordsRetrieved, out recordsFiltered, out latestRecordTime);

                        // Stage 2: Backup (Read Mode 0)
                        if (recordsRetrieved == 0 && SBXPCDLL.ReadGeneralLogData(machineNumber, 0))
                            records = GetRecordsFromDevice(machineNumber, syncedAt, lastSyncedTime, out recordsRetrieved, out recordsFiltered, out latestRecordTime);

                        // Database Save
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

                        LogMessage($"[STATS] Found: {recordsRetrieved}, Filtered: {recordsFiltered}, Saved: {recordsInserted}");
                        try { SBXPCDLL.Disconnect(machineNumber); } catch { }
                    }
                    else
                    {
                        syncStatus = "failed";
                        errorMessage = "Connection failed";
                    }
                }
                finally
                {
                    Monitor.Exit(BiometricDeviceService.SdkLock);
                }
            }
            catch (Exception ex)
            {
                LogMessage($"SyncDevice exception: {ex}");
                syncStatus = "failed";
                errorMessage = ex.Message;
            }
            finally
            {
                if (_databaseService != null)
                {
                    _databaseService.LogSyncHistory(syncStarted, DateTime.Now, recordsRetrieved, 
                        recordsInserted, recordsSkipped, syncStatus, errorMessage);
                }
            }
        }

        private bool ConnectWithRetry(string deviceIp, int devicePort, int machineNumber, int commKey)
        {
            for (int attempt = 1; attempt <= MaxConnectionRetries; attempt++)
            {
                try
                {
                    try { SBXPCDLL.Disconnect(machineNumber); } catch { }
                    Thread.Sleep(500);

                    int connectResult = SBXPCDLL.ConnectTcpipStatus(machineNumber, deviceIp, devicePort, commKey);

                    if (IsSdkSuccess(connectResult)) return true;
                    LogMessage($"Attempt {attempt} failed: {connectResult}");
                }
                catch { }

                if (attempt < MaxConnectionRetries) Thread.Sleep(InitialRetryDelayMs);
            }
            return false;
        }

        private List<AttendanceRecord> GetRecordsFromDevice(int machineNumber, DateTime syncedAt, DateTime? lastSyncedTime, 
            out int totalRetrieved, out int totalFiltered, out DateTime latestFound)
        {
            List<AttendanceRecord> records = new List<AttendanceRecord>();
            totalRetrieved = 0;
            totalFiltered = 0;
            latestFound = DateTime.MinValue;

            while (SBXPCDLL.GetGeneralLogData(machineNumber,
                out int dwTMachineNumber, out int dwEnrollNumber, out int dwEMachineNumber, out int dwVerifyMode,
                out int dwYear, out int dwMonth, out int dwDay, out int dwHour, out int dwMinute, out int dwSecond))
            {
                try
                {
                    DateTime timestamp = new DateTime(dwYear, dwMonth, dwDay, dwHour, dwMinute, dwSecond);
                    totalRetrieved++;
                    if (timestamp > latestFound) latestFound = timestamp;

                    if (lastSyncedTime.HasValue && timestamp <= lastSyncedTime.Value)
                    {
                        totalFiltered++;
                        continue;
                    }

                    records.Add(new AttendanceRecord
                    {
                        EmployeeId = dwEnrollNumber,
                        MachineNumber = machineNumber,
                        PunchTime = timestamp,
                        VerifyMode = dwVerifyMode,
                        VerifyType = DecodeVerifyMode(dwVerifyMode),
                        SyncedAt = syncedAt
                    });
                }
                catch { }
            }
            return records;
        }

        private static bool IsSdkSuccess(int code)
        {
            return code == 0 || code == 1;
        }

        private static string DecodeVerifyMode(int mode)
        {
            switch (mode)
            {
                case 1:
                case 4:
                case 5:
                case 7:
                case 34:
                case 51:
                case 101:
                case 151:
                case 436: return "Fingerprint";

                case 30:
                case 31:
                case 32:
                case 33:
                case 407: return "Face";

                case 2:
                case 15:
                case 52:
                case 102:
                case 152: return "Password";

                case 3:
                case 53:
                case 103:
                case 153: return "Card";

                case 10: return "Hand lock";
                case 11: return "Program lock";
                case 12: return "Program open";
                case 13: return "Program close";
                case 14: return "Auto recover";
                case 20: return "Lock over";
                case 21: return "Illegal open";
                case 22: return "Duress alarm";
                case 23: return "Tampering detected";
                
                default: return $"Mode({mode})";
            }
        }

        private void LogMessage(string message)
        {
            try
            {
                Directory.CreateDirectory(LogDirectory);
                string logPath = Path.Combine(LogDirectory, LogFileName);
                
                if (Environment.UserInteractive)
                {
                    if (message.Contains("[OK]") || message.Contains("SUCCESS")) Console.ForegroundColor = ConsoleColor.Green;
                    else if (message.Contains("[ERROR]") || message.Contains("FAILED")) Console.ForegroundColor = ConsoleColor.Red;
                    else if (message.Contains("[WARN]") || message.Contains("WARNING")) Console.ForegroundColor = ConsoleColor.Yellow;
                    else if (message.Contains("[SYNC]")) Console.ForegroundColor = ConsoleColor.Cyan;
                    else Console.ResetColor();
                }

                string entry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}";

                if (Environment.UserInteractive) Console.Write(entry);

                lock (_logLock)
                {
                    File.AppendAllText(logPath, entry);
                }
                
                if (Environment.UserInteractive) Console.ResetColor();
            }
            catch
            {
                // Suppress logging errors to keep service alive.
            }
        }

        /// <summary>
        /// Loads the last known device configuration from the database.
        /// Ensure service can start even without app.config or incoming pipe command.
        /// </summary>
        private void LoadDeviceConfiguration()
        {
            try 
            {
                var configs = _databaseService.GetDeviceConfigurations();
                var config = configs?.FirstOrDefault();
                if (config != null)
                {
                    BiometricDeviceService.DeviceConfig.Update(config.IpAddress, config.Port, config.MachineNumber, config.CommKey);
                    LogMessage($"Loaded device configuration from DB: IP={config.IpAddress}, Port={config.Port}, Machine={config.MachineNumber}");
                }
                else
                {
                    LogMessage("WARNING: No device configuration found in database. Waiting for user to configure via UI.");
                }
            }
            catch (Exception ex)
            {
                LogMessage($"Failed to load device configuration: {ex.Message}");
            }
        }
    }
}


