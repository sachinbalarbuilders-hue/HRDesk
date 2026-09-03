using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Services.Attendance;

public class TeamOfficeSyncService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<TeamOfficeSyncService> _logger;
    private readonly AttendanceProcessorService _processor;
    private readonly ICurrentTenantProvider _tenantProvider;

    public TeamOfficeSyncService(
        BiometricAttendanceDbContext db,
        HttpClient httpClient,
        IConfiguration config,
        ILogger<TeamOfficeSyncService> logger,
        AttendanceProcessorService processor,
        ICurrentTenantProvider tenantProvider)
    {
        _db = db;
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
        _processor = processor;
        _tenantProvider = tenantProvider;
    }

    private (string baseUrl, string corpId, string username, string password, bool enabled) GetApiConfig()
    {
        var section = _config.GetSection("TeamOfficeApi");

        var dbSettings = _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.SettingKey.StartsWith("TeamOffice_"))
            .ToDictionary(s => s.SettingKey, s => s.SettingValue);

        string baseUrl = (dbSettings.TryGetValue("TeamOffice_BaseUrl", out var bUrl) && !string.IsNullOrWhiteSpace(bUrl))
            ? bUrl.TrimEnd('/')
            : (section["BaseUrl"]?.TrimEnd('/') ?? "https://api.etimeoffice.com/api");

        string corpId = (dbSettings.TryGetValue("TeamOffice_CorporateId", out var cId) && !string.IsNullOrWhiteSpace(cId))
            ? cId
            : (section["CorporateId"] ?? "Tbalar1121");

        string username = (dbSettings.TryGetValue("TeamOffice_Username", out var uName) && !string.IsNullOrWhiteSpace(uName))
            ? uName
            : (section["Username"] ?? "Tbalar1121");

        string password = (dbSettings.TryGetValue("TeamOffice_Password", out var pass) && !string.IsNullOrWhiteSpace(pass))
            ? pass
            : (section["Password"] ?? "Balar@123");

        string syncMode = _db.SystemSettings
            .AsNoTracking()
            .FirstOrDefault(s => s.SettingKey == "Biometric_SyncMode")?.SettingValue ?? "Hybrid";

        bool enabled = true;
        if (string.Equals(syncMode, "Local", StringComparison.OrdinalIgnoreCase))
        {
            enabled = false;
        }
        else if (dbSettings.TryGetValue("TeamOffice_Enabled", out var enStr) && bool.TryParse(enStr, out var enBool))
        {
            enabled = enBool;
        }
        else
        {
            enabled = section.GetValue<bool>("Enabled", true);
        }

        return (baseUrl, corpId, username, password, enabled);
    }

    private AuthenticationHeaderValue CreateBasicAuthHeader(string corpId, string username, string password)
    {
        string rawAuth = $"{corpId}:{username}:{password}:true";
        string base64Auth = Convert.ToBase64String(Encoding.UTF8.GetBytes(rawAuth));
        return new AuthenticationHeaderValue("Basic", base64Auth);
    }

    public async Task<(bool success, string message)> TestConnectionAsync(
        string? corpId = null,
        string? username = null,
        string? password = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var config = GetApiConfig();
            string finalCorpId = !string.IsNullOrWhiteSpace(corpId) ? corpId : config.corpId;
            string finalUser = !string.IsNullOrWhiteSpace(username) ? username : config.username;
            string finalPass = !string.IsNullOrWhiteSpace(password) ? password : config.password;

            string testUrl = $"{config.baseUrl}/DownloadPunchDataMCID?Empcode=ALL&FromDate={DateTime.Today:dd/MM/yyyy}_00:00&ToDate={DateTime.Today:dd/MM/yyyy}_23:59";
            
            using var request = new HttpRequestMessage(HttpMethod.Get, testUrl);
            request.Headers.Authorization = CreateBasicAuthHeader(finalCorpId, finalUser, finalPass);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return (false, $"HTTP Error {(int)response.StatusCode}: {response.ReasonPhrase}");
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("Error", out var errProp) && errProp.GetBoolean())
            {
                string msg = doc.RootElement.TryGetProperty("Msg", out var msgProp) ? msgProp.GetString() ?? "Unknown error" : "Error returned from API";
                return (false, msg);
            }

            int recordsCount = 0;
            if (doc.RootElement.TryGetProperty("PunchData", out var dataProp) && dataProp.ValueKind == JsonValueKind.Array)
            {
                recordsCount = dataProp.GetArrayLength();
            }

            return (true, $"Connection successful! Retrieved {recordsCount} punches for today.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TeamOffice TestConnection failed.");
            return (false, ex.Message);
        }
    }

    public async Task<(int newLogs, string message, bool success)> SyncLatestPunchesAsync(CancellationToken cancellationToken = default)
    {
        var config = GetApiConfig();
        if (!config.enabled)
        {
            return (0, "TeamOffice API sync is disabled in configuration.", false);
        }

        try
        {
            // 1. Retrieve last saved record token
            var lastRecordSetting = await _db.SystemSettings
                .FirstOrDefaultAsync(s => s.SettingKey == "TeamOffice_MaxRecord", cancellationToken);

            string currentMonthTag = DateTime.Today.ToString("MMyyyy");
            string? lastRecordParam = lastRecordSetting?.SettingValue;

            if (string.IsNullOrWhiteSpace(lastRecordParam) || !lastRecordParam.StartsWith(currentMonthTag))
            {
                lastRecordParam = $"{currentMonthTag}$0";
            }

            string requestUrl = $"{config.baseUrl}/DownloadLastPunchData?Empcode=ALL&LastRecord={lastRecordParam}";
            _logger.LogInformation("Syncing TeamOffice punches with LastRecord: {LastRecord}", lastRecordParam);

            using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
            request.Headers.Authorization = CreateBasicAuthHeader(config.corpId, config.username, config.password);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return (0, $"TeamOffice API responded with status {(int)response.StatusCode}", false);
            }

            var jsonContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var apiResult = JsonSerializer.Deserialize<TeamOfficeLastPunchResponse>(jsonContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (apiResult == null || apiResult.Error)
            {
                return (0, apiResult?.Msg ?? "Failed to deserialize API response", false);
            }

            var punches = apiResult.PunchData ?? new List<TeamOfficePunchItem>();
            int insertedCount = 0;
            var affectedDates = new HashSet<DateOnly>();

            if (punches.Any())
            {
                insertedCount = await InsertPunchesAsync(punches, affectedDates, cancellationToken);
            }

            // Update MaxRecord token in system settings
            if (!string.IsNullOrWhiteSpace(apiResult.MaxRecord))
            {
                if (lastRecordSetting == null)
                {
                    lastRecordSetting = new SystemSetting
                    {
                        SettingKey = "TeamOffice_MaxRecord",
                        SettingValue = apiResult.MaxRecord,
                        Description = "Cursor for TeamOffice DownloadLastPunchData API",
                        UpdatedAt = DateTime.Now
                    };
                    _db.SystemSettings.Add(lastRecordSetting);
                }
                else
                {
                    lastRecordSetting.SettingValue = apiResult.MaxRecord;
                    lastRecordSetting.UpdatedAt = DateTime.Now;
                }

                // Also update last sync time
                var lastSyncSetting = await _db.SystemSettings
                    .FirstOrDefaultAsync(s => s.SettingKey == "TeamOffice_LastSyncTime", cancellationToken);
                if (lastSyncSetting == null)
                {
                    lastSyncSetting = new SystemSetting
                    {
                        SettingKey = "TeamOffice_LastSyncTime",
                        SettingValue = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        Description = "Timestamp of last successful TeamOffice cloud sync",
                        UpdatedAt = DateTime.Now
                    };
                    _db.SystemSettings.Add(lastSyncSetting);
                }
                else
                {
                    lastSyncSetting.SettingValue = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    lastSyncSetting.UpdatedAt = DateTime.Now;
                }

                await _db.SaveChangesAsync(cancellationToken);
            }

            // Auto-process daily attendance for affected dates ONLY if new punches were inserted
            if (insertedCount > 0 && affectedDates.Any())
            {
                foreach (var date in affectedDates)
                {
                    try
                    {
                        await _processor.ProcessDailyAttendanceAsync(date, null);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to auto-process daily attendance for date {Date}", date);
                    }
                }
            }

            string resultMsg = $"Sync completed: {insertedCount} new punches imported out of {punches.Count} received from TeamOffice Cloud.";
            _logger.LogInformation(resultMsg);
            return (insertedCount, resultMsg, true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TeamOffice SyncLatestPunchesAsync exception occurred.");
            return (0, ex.Message, false);
        }
    }

    public async Task<(int newLogs, string message, bool success)> SyncDateRangePunchesAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        var config = GetApiConfig();
        try
        {
            string fromStr = $"{fromDate:dd/MM/yyyy}_00:00";
            string toStr = $"{toDate:dd/MM/yyyy}_23:59";
            string requestUrl = $"{config.baseUrl}/DownloadPunchDataMCID?Empcode=ALL&FromDate={fromStr}&ToDate={toStr}";

            using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
            request.Headers.Authorization = CreateBasicAuthHeader(config.corpId, config.username, config.password);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return (0, $"TeamOffice API responded with status {(int)response.StatusCode}", false);
            }

            var jsonContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var apiResult = JsonSerializer.Deserialize<TeamOfficeRangePunchResponse>(jsonContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (apiResult == null || apiResult.Error)
            {
                return (0, apiResult?.Msg ?? "Failed to fetch range data", false);
            }

            var punches = apiResult.PunchData ?? new List<TeamOfficePunchItem>();
            int insertedCount = 0;
            var affectedDates = new HashSet<DateOnly>();

            if (punches.Any())
            {
                insertedCount = await InsertPunchesAsync(punches, affectedDates, cancellationToken);
            }

            // Auto-process daily attendance for affected dates ONLY if new punches were inserted
            if (insertedCount > 0 && affectedDates.Any())
            {
                foreach (var date in affectedDates)
                {
                    try
                    {
                        await _processor.ProcessDailyAttendanceAsync(date, null);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to auto-process daily attendance for date {Date}", date);
                    }
                }
            }

            return (insertedCount, $"Imported {insertedCount} punches for period {fromDate:dd/MM/yyyy} to {toDate:dd/MM/yyyy}.", true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TeamOffice SyncDateRangePunchesAsync exception.");
            return (0, ex.Message, false);
        }
    }

    private async Task<int> InsertPunchesAsync(
        List<TeamOfficePunchItem> punches,
        HashSet<DateOnly> affectedDates,
        CancellationToken cancellationToken)
    {
        if (punches == null || punches.Count == 0) return 0;

        int orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        DateTime now = DateTime.Now;

        // 1. Preload custom biometric code mappings (e.g. EMP#001 -> 123)
        var codeMappings = await _db.BiometricEmployeeMappings
            .AsNoTracking()
            .Where(m => m.OrganizationId == orgId)
            .ToDictionaryAsync(m => m.BiometricCode.Trim().ToUpperInvariant(), m => m.EmployeeId, cancellationToken);

        // 2. Preload existing employee IDs to avoid FK checks
        var existingEmpIds = new HashSet<int>(
            await _db.Employees
                .AsNoTracking()
                .Where(e => e.OrganizationId == orgId)
                .Select(e => e.EmployeeId)
                .ToListAsync(cancellationToken)
        );

        // 3. Parse and filter valid punches in memory
        var validPunches = new List<(int empId, DateTime punchTime, int machineNo)>();
        DateTime minPunch = DateTime.MaxValue;
        DateTime maxPunch = DateTime.MinValue;

        foreach (var p in punches)
        {
            if (string.IsNullOrWhiteSpace(p.Empcode)) continue;

            int? empId = null;
            string rawCode = p.Empcode.Trim().ToUpperInvariant();

            // 1. Exact match with branch prefix (e.g., "EMP#001" vs "EMPV#001")
            if (codeMappings.TryGetValue(rawCode, out int mappedId))
            {
                empId = mappedId;
            }
            // 2. Pure numerical machine ID fallback (e.g. "123")
            else if (int.TryParse(rawCode, out int directId))
            {
                empId = directId;
            }

            if (!empId.HasValue || !existingEmpIds.Contains(empId.Value)) continue;

            DateTime? punchTime = ParsePunchDate(p.PunchDate);
            if (!punchTime.HasValue) continue;

            int machineNo = 1;
            if (!string.IsNullOrEmpty(p.Mcid) && int.TryParse(p.Mcid, out int m))
                machineNo = m;

            validPunches.Add((empId.Value, punchTime.Value, machineNo));

            if (punchTime.Value < minPunch) minPunch = punchTime.Value;
            if (punchTime.Value > maxPunch) maxPunch = punchTime.Value;
        }

        if (validPunches.Count == 0) return 0;

        // 3. Fetch existing punch signatures by minute (bridges Cloud :00s vs Local LAN exact seconds)
        var existingPunchSignatures = new HashSet<string>(
            await _db.AttendanceLogs
                .AsNoTracking()
                .Where(l => l.OrganizationId == orgId && l.PunchTime >= minPunch.AddMinutes(-1) && l.PunchTime <= maxPunch.AddMinutes(1))
                .Select(l => l.EmployeeId + "_" + l.PunchTime.ToString("yyyyMMddHHmm"))
                .ToListAsync(cancellationToken)
        );

        // 4. Filter only brand new punches
        var newPunchesToInsert = new List<AttendanceLog>();
        var seenInBatch = new HashSet<string>();

        foreach (var (empId, punchTime, machineNo) in validPunches)
        {
            string sigMinute = empId + "_" + punchTime.ToString("yyyyMMddHHmm");
            if (!existingPunchSignatures.Contains(sigMinute) && seenInBatch.Add(sigMinute))
            {
                newPunchesToInsert.Add(new AttendanceLog
                {
                    OrganizationId = orgId,
                    EmployeeId = empId,
                    MachineNumber = machineNo,
                    PunchTime = punchTime,
                    VerifyMode = 1,
                    VerifyType = "Cloud Sync",
                    SyncedAt = now,
                    CreatedAt = now
                });
                affectedDates.Add(DateOnly.FromDateTime(punchTime));
            }
        }

        if (newPunchesToInsert.Count == 0) return 0;

        // 5. Bulk batch insert via EF Core in fast chunks
        const int batchSize = 250;
        for (int i = 0; i < newPunchesToInsert.Count; i += batchSize)
        {
            var chunk = newPunchesToInsert.Skip(i).Take(batchSize);
            _db.AttendanceLogs.AddRange(chunk);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return newPunchesToInsert.Count;
    }

    public static int? ParseEmployeeId(string? empCode)
    {
        if (string.IsNullOrWhiteSpace(empCode)) return null;

        // Only parse if pure integer; never strip branch prefixes like EMPV# vs EMP#
        if (int.TryParse(empCode.Trim(), out int directId)) return directId;

        return null;
    }

    public static DateTime? ParsePunchDate(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return null;

        string[] formats = new[]
        {
            "dd/MM/yyyy HH:mm:ss",
            "dd/MM/yyyy HH:mm",
            "yyyy-MM-dd HH:mm:ss",
            "dd-MM-yyyy HH:mm:ss",
            "yyyy/MM/dd HH:mm:ss"
        };

        if (DateTime.TryParseExact(dateStr.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime dt))
        {
            return dt;
        }

        if (DateTime.TryParse(dateStr.Trim(), out DateTime fallbackDt))
        {
            return fallbackDt;
        }

        return null;
    }
}

public class TeamOfficeLastPunchResponse
{
    public bool Error { get; set; }
    public string? Msg { get; set; }
    public bool IsAdmin { get; set; }
    public List<TeamOfficePunchItem>? PunchData { get; set; }
    public string? MaxRecord { get; set; }
    public string? TableName { get; set; }
}

public class TeamOfficeRangePunchResponse
{
    public bool Error { get; set; }
    public string? Msg { get; set; }
    public bool IsAdmin { get; set; }
    public List<TeamOfficePunchItem>? PunchData { get; set; }
}

public class TeamOfficePunchItem
{
    public string? Name { get; set; }
    public string? Empcode { get; set; }
    public string? PunchDate { get; set; }
    public int? ID { get; set; }
    public string? Mcid { get; set; }
    public string? Table { get; set; }
    public string? EmpcardNo { get; set; }
}
