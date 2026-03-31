using System;
using System.Configuration;
using System.Data;
using MySql.Data.MySqlClient;
using System.Collections.Generic;

namespace Z903AttendanceService
{
    public class AttendanceRecord
    {
        public int EmployeeId { get; set; }
        public int MachineNumber { get; set; }
        public DateTime PunchTime { get; set; }
        public int VerifyMode { get; set; }
        public string VerifyType { get; set; }
        public DateTime SyncedAt { get; set; }
    }

    public class DeviceConfigDto
    {
        public int Id { get; set; }
        public string IpAddress { get; set; }
        public int Port { get; set; }
        public int MachineNumber { get; set; }
        public int CommKey { get; set; }
    }

    public class ConnectionTestResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string ServerVersion { get; set; }
        public Exception Error { get; set; }
    }


    public class DatabaseService
    {
        /// <summary>
        /// Delegate to BiometricDeviceService for registering an employee in the biometric machine.
        /// DatabaseService should not call SDK directly; Windows Service owns SDK logic.
        /// </summary>
        [Obsolete("Use BiometricDeviceService.SetUserInMachine in Windows Service instead.")]
        public void SetUserInMachine(int employeeId, string employeeName)
        {
            var deviceService = new BiometricDeviceService(Log);
            deviceService.SetUserInMachine(employeeId, employeeName);
        }
    
    
        private readonly string _connectionString;
        private readonly Action<string> _logger;

        // Timeout settings (in seconds)
        private const int ConnectionTimeout = 15;
        private const int CommandTimeout = 30;

        public DatabaseService() : this(null)
        {
        }

        public DatabaseService(Action<string> logger)
        {
            _logger = logger;

            string baseConnectionString = ConfigurationManager.ConnectionStrings["AttendanceDB"]?.ConnectionString;
            if (string.IsNullOrWhiteSpace(baseConnectionString))
            {
                throw new InvalidOperationException("AttendanceDB connection string is not configured.");
            }

            // Ensure connection timeout is set in connection string
            var builder = new MySqlConnectionStringBuilder(baseConnectionString)
            {
                ConnectionTimeout = ConnectionTimeout
            };
            _connectionString = builder.ConnectionString;
        }

        private void Log(string message)
        {
            _logger?.Invoke($"[DatabaseService] {message}");
        }

        public bool TestConnection()
        {
            var result = TestConnectionDetailed();
            return result.Success;
        }

        public ConnectionTestResult TestConnectionDetailed()
        {
            var result = new ConnectionTestResult();
            var startTime = DateTime.Now;

            try
            {

                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();

                    if (connection.State == ConnectionState.Open)
                    {
                        result.Success = true;
                        result.ServerVersion = connection.ServerVersion;
                        result.Message = $"Connected successfully in {(DateTime.Now - startTime).TotalMilliseconds:F0}ms. Server: {connection.ServerVersion}";
                        
                        // Test with a simple query to verify full connectivity
                        using (MySqlCommand cmd = new MySqlCommand("SELECT 1", connection))
                        {
                            cmd.CommandTimeout = CommandTimeout;
                            cmd.ExecuteScalar();
                        }

                        Log(result.Message);
                    }
                    else
                    {
                        result.Success = false;
                        result.Message = $"Connection state is {connection.State}, expected Open.";
                        Log($"WARNING: {result.Message}");
                    }
                }
            }
            catch (MySqlException ex)
            {
                result.Success = false;
                result.Error = ex;
                result.Message = $"MySQL Error ({ex.Number}): {ex.Message}";

                // Provide helpful messages for common errors
                switch (ex.Number)
                {
                    case 0:
                        result.Message += " - Cannot connect to server. Check if MySQL is running and the host/port are correct.";
                        break;
                    case 1042:
                        result.Message += " - Unable to connect to any of the specified MySQL hosts.";
                        break;
                    case 1045:
                        result.Message += " - Access denied. Check username and password.";
                        break;
                    case 1049:
                        result.Message += " - Unknown database. The database does not exist.";
                        break;
                }

                Log($"ERROR: {result.Message}");
            }
            catch (TimeoutException ex)
            {
                result.Success = false;
                result.Error = ex;
                result.Message = $"Connection timeout after {ConnectionTimeout}s. Server may be slow or unreachable.";
                Log($"ERROR: {result.Message}");
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Error = ex;
                result.Message = $"Unexpected error: {ex.GetType().Name} - {ex.Message}";
                Log($"ERROR: {result.Message}");
            }

            return result;
        }

        private MySqlCommand CreateCommand(MySqlConnection connection, string sql, MySqlTransaction transaction = null)
        {
            var command = new MySqlCommand(sql, connection, transaction)
            {
                CommandTimeout = CommandTimeout
            };
            return command;
        }

        /// <summary>
        /// Creates the attendance_logs table with proper unique constraint.
        /// This ensures no duplicate punch records.
        /// </summary>
        public void CreateAttendanceLogsTable()
        {
            const string sql = @"
                CREATE TABLE IF NOT EXISTS attendance_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    machine_number INT NOT NULL,
                    punch_time DATETIME NOT NULL,
                    verify_mode INT,
                    verify_type VARCHAR(50),
                    synced_at DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_employee_punch (employee_id, machine_number, punch_time),
                    INDEX idx_punch_time (punch_time),
                    INDEX idx_employee_id (employee_id),
                    INDEX idx_synced_at (synced_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to create attendance_logs table: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Creates the device_sync_state table to track last sync time per device.
        /// This enables incremental sync instead of full sync.
        /// </summary>
        public void CreateDeviceSyncStateTable()
        {
            const string sql = @"
                CREATE TABLE IF NOT EXISTS device_sync_state (
                    device_id INT PRIMARY KEY,
                    device_ip VARCHAR(50) NOT NULL,
                    last_synced_time DATETIME NULL,
                    last_sync_status VARCHAR(20),
                    records_synced INT DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to create device_sync_state table: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Gets the last synced time for a device. Returns null if never synced.
        /// </summary>
        public DateTime? GetLastSyncedTime(int deviceId)
        {
            const string sql = "SELECT last_synced_time FROM device_sync_state WHERE device_id = @DeviceId";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.Parameters.AddWithValue("@DeviceId", deviceId);
                        var result = command.ExecuteScalar();
                        
                        if (result == null || result == DBNull.Value)
                        {
                            Log($"No previous sync time found for device {deviceId}. Will perform full sync.");
                            return null;
                        }
                        
                        DateTime lastSync = (DateTime)result;
                        Log($"Last sync time for device {deviceId}: {lastSync:yyyy-MM-dd HH:mm:ss}");
                        return lastSync;
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"WARNING: Failed to get last sync time for device {deviceId}: {ex.Message}");
                return null; // Return null to trigger full sync on error
            }
        }

        /// <summary>
        /// Updates the sync state after a successful sync.
        /// Only call this AFTER records are successfully committed to database.
        /// </summary>
        public void UpdateLastSyncedTime(int deviceId, string deviceIp, DateTime syncTime, string status, int recordsSynced)
        {
            const string sql = @"
                INSERT INTO device_sync_state (device_id, device_ip, last_synced_time, last_sync_status, records_synced)
                VALUES (@DeviceId, @DeviceIp, @SyncTime, @Status, @RecordsSynced)
                ON DUPLICATE KEY UPDATE 
                    device_ip = @DeviceIp,
                    last_synced_time = @SyncTime,
                    last_sync_status = @Status,
                    records_synced = @RecordsSynced,
                    updated_at = NOW()";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.Parameters.AddWithValue("@DeviceId", deviceId);
                        command.Parameters.AddWithValue("@DeviceIp", deviceIp);
                        command.Parameters.AddWithValue("@SyncTime", syncTime);
                        command.Parameters.AddWithValue("@Status", status);
                        command.Parameters.AddWithValue("@RecordsSynced", recordsSynced);
                        command.ExecuteNonQuery();
                        Log($"Updated sync state for device {deviceId}: {status}, {recordsSynced} records, time={syncTime:yyyy-MM-dd HH:mm:ss}");
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"ERROR: Failed to update sync state for device {deviceId}: {ex.Message}");
                // Don't throw - this shouldn't fail the sync
            }
        }

        public bool InsertAttendanceRecord(AttendanceRecord record)
        {
            const string sql = @"
                INSERT INTO attendance_logs (employee_id, machine_number, punch_time, verify_mode, verify_type, synced_at)
                VALUES (@EmployeeId, @MachineNumber, @PunchTime, @VerifyMode, @VerifyType, @SyncedAt)
                ON DUPLICATE KEY UPDATE synced_at = VALUES(synced_at)";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.Parameters.AddWithValue("@EmployeeId", record.EmployeeId);
                        command.Parameters.AddWithValue("@MachineNumber", record.MachineNumber);
                        command.Parameters.AddWithValue("@PunchTime", record.PunchTime);
                        command.Parameters.AddWithValue("@VerifyMode", record.VerifyMode);
                        command.Parameters.AddWithValue("@VerifyType", record.VerifyType);
                        command.Parameters.AddWithValue("@SyncedAt", record.SyncedAt);

                        int rowsAffected = command.ExecuteNonQuery();
                        return rowsAffected > 0;
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"ERROR: Insert failed for EmployeeId {record.EmployeeId}: {ex.Message}");
                throw new Exception($"Database insert failed: {ex.Message}", ex);
            }
        }

        public int InsertBulkAttendanceRecords(AttendanceRecord[] records)
        {
            if (records == null || records.Length == 0)
                return 0;

            const string sql = @"
                INSERT INTO attendance_logs (employee_id, machine_number, punch_time, verify_mode, verify_type, synced_at)
                VALUES (@EmployeeId, @MachineNumber, @PunchTime, @VerifyMode, @VerifyType, @SyncedAt)
                ON DUPLICATE KEY UPDATE synced_at = VALUES(synced_at)";

            int insertedCount = 0;
            Log($"Starting bulk insert of {records.Length} records...");

            using (MySqlConnection connection = new MySqlConnection(_connectionString))
            {
                connection.Open();
                using (MySqlTransaction transaction = connection.BeginTransaction())
                {
                    try
                    {
                        foreach (AttendanceRecord record in records)
                        {
                            using (MySqlCommand command = CreateCommand(connection, sql, transaction))
                            {
                                command.Parameters.AddWithValue("@EmployeeId", record.EmployeeId);
                                command.Parameters.AddWithValue("@MachineNumber", record.MachineNumber);
                                command.Parameters.AddWithValue("@PunchTime", record.PunchTime);
                                command.Parameters.AddWithValue("@VerifyMode", record.VerifyMode);
                                command.Parameters.AddWithValue("@VerifyType", record.VerifyType);
                                command.Parameters.AddWithValue("@SyncedAt", record.SyncedAt);

                                if (command.ExecuteNonQuery() > 0)
                                    insertedCount++;
                            }
                        }

                        transaction.Commit();
                        Log($"Bulk insert completed: {insertedCount}/{records.Length} records inserted.");
                        return insertedCount;
                    }
                    catch (Exception ex)
                    {
                        transaction.Rollback();
                        Log($"ERROR: Bulk insert failed, transaction rolled back: {ex.Message}");
                        throw;
                    }
                }
            }
        }

        public void LogSyncHistory(DateTime syncStarted, DateTime syncCompleted, int recordsRetrieved, 
            int recordsInserted, int recordsSkipped, string status, string errorMessage = null)
        {
            const string sql = @"
                INSERT INTO sync_log (sync_started, sync_completed, records_retrieved, records_inserted, 
                                      records_skipped, status, error_message)
                VALUES (@SyncStarted, @SyncCompleted, @RecordsRetrieved, @RecordsInserted, 
                        @RecordsSkipped, @Status, @ErrorMessage)";

            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        command.Parameters.AddWithValue("@SyncStarted", syncStarted);
                        command.Parameters.AddWithValue("@SyncCompleted", syncCompleted);
                        command.Parameters.AddWithValue("@RecordsRetrieved", recordsRetrieved);
                        command.Parameters.AddWithValue("@RecordsInserted", recordsInserted);
                        command.Parameters.AddWithValue("@RecordsSkipped", recordsSkipped);
                        command.Parameters.AddWithValue("@Status", status);
                        command.Parameters.AddWithValue("@ErrorMessage", errorMessage ?? (object)DBNull.Value);

                        command.ExecuteNonQuery();
                        Log($"Sync history logged: {status}, {recordsInserted} inserted.");
                    }
                }
            }
            catch (Exception ex)
            {
                // Suppress sync log errors to prevent service failure, but log it
                Log($"WARNING: Failed to log sync history: {ex.Message}");
            }
        }

        public List<DeviceConfigDto> GetDeviceConfigurations()
        {
            var list = new List<DeviceConfigDto>();
            const string sql = "SELECT Id, IpAddress, Port, MachineNumber, CommKey FROM DeviceConfigurations";
            try
            {
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        using (var reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                int commKeyIndex = 4;
                                int commKey = 0;
                                if (!reader.IsDBNull(commKeyIndex))
                                {
                                    commKey = reader.GetInt32(commKeyIndex);
                                }

                                list.Add(new DeviceConfigDto
                                {
                                    Id = reader.GetInt32(0),
                                    IpAddress = reader.GetString(1),
                                    Port = reader.GetInt32(2),
                                    MachineNumber = reader.GetInt32(3),
                                    CommKey = commKey
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"WARNING: Failed to read DeviceConfigurations: {ex.Message}");
            }
            return list;
        }
        public int GetSyncIntervalMinutes()
        {
            try
            {
                const string sql = "SELECT setting_value FROM system_settings WHERE setting_key = 'SyncIntervalMinutes'";
                using (MySqlConnection connection = new MySqlConnection(_connectionString))
                {
                    connection.Open();
                    using (MySqlCommand command = CreateCommand(connection, sql))
                    {
                        var result = command.ExecuteScalar();
                        if (result != null && result != DBNull.Value && int.TryParse(result.ToString(), out int minutes))
                        {
                            return minutes;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"WARNING: Failed to read SyncIntervalMinutes from system_settings: {ex.Message}");
            }
            return 5; // Default fallback
        }
    }
}
