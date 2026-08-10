using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Attendance;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HRDesk.Web.Pages.Masters;

public class DeviceSettingsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly HRDesk.Web.Services.IDeviceCommunicationService _deviceService;
    private readonly ITeamOfficeSyncService _teamOfficeService;
    private readonly IConfiguration _config;

    public DeviceSettingsModel(
        BiometricAttendanceDbContext db,
        HRDesk.Web.Services.IDeviceCommunicationService deviceService,
        ITeamOfficeSyncService teamOfficeService,
        IConfiguration config)
    {
        _db = db;
        _deviceService = deviceService;
        _teamOfficeService = teamOfficeService;
        _config = config;
    }

    [TempData]
    public string? Message { get; set; }

    [TempData]
    public bool IsError { get; set; }

    // Sync Mode: "Cloud" or "Local"
    [BindProperty]
    public string SyncMode { get; set; } = "Cloud";

    // Cloud Credentials (stored in system_settings DB table, not hardcoded)
    [BindProperty]
    public bool CloudEnabled { get; set; } = true;

    [BindProperty]
    public string CorporateId { get; set; } = "";

    [BindProperty]
    public string Username { get; set; } = "";

    [BindProperty]
    public string Password { get; set; } = "";

    [BindProperty]
    public string BaseUrl { get; set; } = "https://api.etimeoffice.com/api";

    [BindProperty]
    public int CloudSyncInterval { get; set; } = 5;

    // Local Terminals List & Add
    public List<DeviceConfiguration> Devices { get; set; } = new();

    [BindProperty]
    public DeviceConfiguration NewDevice { get; set; } = new();

    [BindProperty]
    public int SyncIntervalMinutes { get; set; } = 10;

    // Biometric / HiveStaff Mappings
    public List<(int Id, string BiometricCode, int EmployeeId, string EmployeeName, string? Notes)> CodeMappings { get; set; } = new();
    public List<Employee> ActiveEmployees { get; set; } = new();

    [BindProperty]
    public string NewBiometricCode { get; set; } = "";

    [BindProperty]
    public int NewMappingEmployeeId { get; set; }

    [BindProperty]
    public string? NewMappingNotes { get; set; }

    // Metrics / Status
    public string? LastSyncTime { get; set; }
    public string? LastSyncedRecord { get; set; }
    public int TotalCloudLogsCount { get; set; }

    public async Task OnGetAsync()
    {
        Devices = await _db.DeviceConfigurations.AsNoTracking().ToListAsync();

        ActiveEmployees = await _db.Employees
            .AsNoTracking()
            .Where(e => e.Status == "active")
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();

        var rawMappings = await _db.BiometricEmployeeMappings
            .AsNoTracking()
            .ToListAsync();

        var empMap = await _db.Employees
            .AsNoTracking()
            .ToDictionaryAsync(e => e.EmployeeId, e => e.EmployeeName);

        CodeMappings = rawMappings
            .Select(m => (
                m.Id,
                m.BiometricCode,
                m.EmployeeId,
                empMap.TryGetValue(m.EmployeeId, out var name) ? name : $"Emp #{m.EmployeeId}",
                m.Notes
            ))
            .OrderBy(m => m.BiometricCode)
            .ToList();

        var dbSettings = await _db.SystemSettings
            .AsNoTracking()
            .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue);

        var toSection = _config.GetSection("TeamOfficeApi");

        // Sync Mode
        SyncMode = dbSettings.GetValueOrDefault("Biometric_SyncMode", "Cloud");

        // Cloud settings
        CorporateId = dbSettings.GetValueOrDefault("TeamOffice_CorporateId", toSection["CorporateId"] ?? "Tbalar1121");
        Username = dbSettings.GetValueOrDefault("TeamOffice_Username", toSection["Username"] ?? "Tbalar1121");
        Password = ""; // Never expose stored password to browser DOM / Inspect Element
        BaseUrl = dbSettings.GetValueOrDefault("TeamOffice_BaseUrl", toSection["BaseUrl"] ?? "https://api.etimeoffice.com/api");

        if (dbSettings.TryGetValue("TeamOffice_Enabled", out var enStr) && bool.TryParse(enStr, out var enVal))
            CloudEnabled = enVal;
        else
            CloudEnabled = toSection.GetValue<bool>("Enabled", true);

        if (dbSettings.TryGetValue("TeamOffice_SyncIntervalMinutes", out var cIntStr) && int.TryParse(cIntStr, out var cInt))
            CloudSyncInterval = cInt;
        else
            CloudSyncInterval = toSection.GetValue<int>("SyncIntervalMinutes", 5);

        // Local LAN Sync Interval
        if (dbSettings.TryGetValue("SyncIntervalMinutes", out var lIntStr) && int.TryParse(lIntStr, out var lInt))
            SyncIntervalMinutes = lInt;
        else
            SyncIntervalMinutes = 10;

        // Metrics
        LastSyncTime = dbSettings.GetValueOrDefault("TeamOffice_LastSyncTime", "Never");
        LastSyncedRecord = dbSettings.GetValueOrDefault("TeamOffice_MaxRecord", "082026$0");
        TotalCloudLogsCount = await _db.AttendanceLogs.CountAsync(l => l.VerifyType == "Cloud Sync");
    }

    public async Task<IActionResult> OnPostSaveCloudSettingsAsync()
    {
        await SaveOrUpdateSettingAsync("Biometric_SyncMode", SyncMode, "Biometric operation mode: Cloud, Local, or Hybrid");
        await SaveOrUpdateSettingAsync("TeamOffice_Enabled", CloudEnabled.ToString(), "TeamOffice Cloud Sync Active Flag");
        await SaveOrUpdateSettingAsync("TeamOffice_CorporateId", CorporateId?.Trim() ?? "", "TeamOffice Corporate ID");
        await SaveOrUpdateSettingAsync("TeamOffice_Username", Username?.Trim() ?? "", "TeamOffice Username");
        if (!string.IsNullOrWhiteSpace(Password))
        {
            await SaveOrUpdateSettingAsync("TeamOffice_Password", Password.Trim(), "TeamOffice Password");
        }
        await SaveOrUpdateSettingAsync("TeamOffice_BaseUrl", BaseUrl?.Trim() ?? "https://api.etimeoffice.com/api", "TeamOffice API Base URL");
        await SaveOrUpdateSettingAsync("TeamOffice_SyncIntervalMinutes", CloudSyncInterval.ToString(), "Cloud polling interval in minutes");

        await _db.SaveChangesAsync();

        Message = "TeamOffice Cloud credentials and settings saved successfully.";
        IsError = false;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteCloudSettingsAsync()
    {
        var settingsToDelete = await _db.SystemSettings
            .Where(s => s.SettingKey.StartsWith("TeamOffice_"))
            .ToListAsync();

        if (settingsToDelete.Any())
        {
            _db.SystemSettings.RemoveRange(settingsToDelete);
        }

        await SaveOrUpdateSettingAsync("Biometric_SyncMode", "Local", "Biometric operation mode");
        await SaveOrUpdateSettingAsync("TeamOffice_Enabled", "False", "TeamOffice Cloud Sync Active Flag");
        await SaveOrUpdateSettingAsync("TeamOffice_CorporateId", "", "TeamOffice Corporate ID");
        await SaveOrUpdateSettingAsync("TeamOffice_Username", "", "TeamOffice Username");
        await SaveOrUpdateSettingAsync("TeamOffice_Password", "", "TeamOffice Password");

        await _db.SaveChangesAsync();

        Message = "TeamOffice Cloud integration removed and credentials cleared.";
        IsError = false;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostAddDeviceAsync()
    {
        if (string.IsNullOrEmpty(NewDevice.Name) || string.IsNullOrEmpty(NewDevice.IpAddress))
        {
            Message = "Name and IP Address are required.";
            IsError = true;
            await OnGetAsync();
            return Page();
        }

        NewDevice.OrganizationId = 1;
        _db.DeviceConfigurations.Add(NewDevice);

        if (SyncIntervalMinutes > 0)
        {
            await SaveOrUpdateSettingAsync("SyncIntervalMinutes", SyncIntervalMinutes.ToString(), "Local Windows Service Sync Interval");
        }

        await _db.SaveChangesAsync();

        if (SyncIntervalMinutes > 0)
        {
            await _deviceService.UpdateSyncIntervalAsync(SyncIntervalMinutes);
        }

        Message = $"Terminal '{NewDevice.Name}' added successfully.";
        IsError = false;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteDeviceAsync(int id)
    {
        var device = await _db.DeviceConfigurations.FindAsync(id);
        if (device != null)
        {
            _db.DeviceConfigurations.Remove(device);
            await _db.SaveChangesAsync();
            Message = $"Terminal '{device.Name}' removed.";
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateDeviceAsync(int id, string name, string ip, int port, int machine, int commKey, int syncInterval = 10)
    {
        var device = await _db.DeviceConfigurations.FindAsync(id);
        if (device != null)
        {
            device.Name = name;
            device.IpAddress = ip;
            device.Port = port;
            device.MachineNumber = machine;
            device.CommKey = commKey;

            if (syncInterval > 0)
            {
                await SaveOrUpdateSettingAsync("SyncIntervalMinutes", syncInterval.ToString(), "Local Windows Service Sync Interval");
            }

            await _db.SaveChangesAsync();

            await _deviceService.UpdateDeviceConfigAsync(ip, port, machine, commKey);
            if (syncInterval > 0)
            {
                await _deviceService.UpdateSyncIntervalAsync(syncInterval);
            }

            Message = $"Terminal '{device.Name}' updated successfully.";
            IsError = false;
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostTestConnectionAsync(int id)
    {
        var device = await _db.DeviceConfigurations.FindAsync(id);
        if (device == null) return RedirectToPage();

        var (success, errorMessage) = await _deviceService.UpdateDeviceConfigAsync(device.IpAddress, device.Port, device.MachineNumber, device.CommKey ?? 0);
        bool isFailure = !success || (!string.IsNullOrEmpty(errorMessage) && errorMessage.Contains("connection failed", StringComparison.OrdinalIgnoreCase));

        if (!isFailure)
        {
            Message = $"Terminal '{device.Name}' connection successful ({device.IpAddress}:{device.Port}).";
            IsError = false;
        }
        else
        {
            Message = $"Failed to connect to '{device.Name}' ({device.IpAddress}:{device.Port}): {errorMessage}";
            IsError = true;
        }

        await OnGetAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostUpdateSyncIntervalAsync()
    {
        await SaveOrUpdateSettingAsync("SyncIntervalMinutes", SyncIntervalMinutes.ToString(), "Local Windows Service Sync Interval");
        await _db.SaveChangesAsync();

        var (success, response) = await _deviceService.UpdateSyncIntervalAsync(SyncIntervalMinutes);
        Message = success ? "LAN sync interval updated successfully." : $"Interval saved in DB. Notification: {response}";
        IsError = !success;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostTestCloudApiAsync()
    {
        var (success, message) = await _teamOfficeService.TestConnectionAsync(
            !string.IsNullOrWhiteSpace(CorporateId) ? CorporateId : null,
            !string.IsNullOrWhiteSpace(Username) ? Username : null,
            !string.IsNullOrWhiteSpace(Password) ? Password : null
        );
        Message = message;
        IsError = !success;
        await OnGetAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostSyncNowAsync()
    {
        var (newLogs, message, success) = await _teamOfficeService.SyncLatestPunchesAsync();
        Message = message;
        IsError = !success;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostSyncRangeAsync(DateOnly fromDate, DateOnly toDate)
    {
        if (fromDate > toDate)
        {
            Message = "From date cannot be after To date.";
            IsError = true;
            return RedirectToPage();
        }

        var (newLogs, message, success) = await _teamOfficeService.SyncDateRangePunchesAsync(fromDate, toDate);
        Message = message;
        IsError = !success;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostAddCodeMappingAsync()
    {
        if (string.IsNullOrWhiteSpace(NewBiometricCode) || NewMappingEmployeeId <= 0)
        {
            Message = "Biometric Code and Employee are required.";
            IsError = true;
            await OnGetAsync();
            return Page();
        }

        string code = NewBiometricCode.Trim().ToUpperInvariant();
        var existing = await _db.BiometricEmployeeMappings
            .FirstOrDefaultAsync(m => m.BiometricCode == code);

        if (existing != null)
        {
            existing.EmployeeId = NewMappingEmployeeId;
            existing.Notes = NewMappingNotes;
            existing.UpdatedAt = DateTime.Now;
            Message = $"Mapping for '{code}' updated to Employee #{NewMappingEmployeeId}.";
        }
        else
        {
            _db.BiometricEmployeeMappings.Add(new BiometricEmployeeMapping
            {
                OrganizationId = 1,
                BiometricCode = code,
                EmployeeId = NewMappingEmployeeId,
                Notes = NewMappingNotes,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            });
            Message = $"Mapping for '{code}' added successfully.";
        }

        await _db.SaveChangesAsync();
        IsError = false;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteCodeMappingAsync(int id)
    {
        var mapping = await _db.BiometricEmployeeMappings.FindAsync(id);
        if (mapping != null)
        {
            _db.BiometricEmployeeMappings.Remove(mapping);
            await _db.SaveChangesAsync();
            Message = $"Mapping for '{mapping.BiometricCode}' removed.";
        }
        return RedirectToPage();
    }

    private async Task SaveOrUpdateSettingAsync(string key, string value, string description)
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.SettingKey == key);
        if (setting == null)
        {
            setting = new SystemSetting
            {
                SettingKey = key,
                SettingValue = value,
                Description = description,
                UpdatedAt = DateTime.Now
            };
            _db.SystemSettings.Add(setting);
        }
        else
        {
            setting.SettingValue = value;
            setting.UpdatedAt = DateTime.Now;
        }
    }
}
