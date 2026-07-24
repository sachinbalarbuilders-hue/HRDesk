using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Masters;

public class DeviceSettingsModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public DeviceSettingsModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public List<DeviceConfiguration> Devices { get; set; } = new();

    [BindProperty]
    public DeviceConfiguration NewDevice { get; set; } = new();

    [TempData]
    public string? Message { get; set; }

    [TempData]
    public bool IsError { get; set; }
 
    [BindProperty]
    public int SyncIntervalMinutes { get; set; }

    public async Task OnGetAsync()
    {
        Devices = await _db.DeviceConfigurations.ToListAsync();
 
        var intervalSetting = await _db.SystemSettings
            .FirstOrDefaultAsync(s => s.SettingKey == "SyncIntervalMinutes");
        
        if (intervalSetting != null && int.TryParse(intervalSetting.SettingValue, out int mins))
        {
            SyncIntervalMinutes = mins;
        }
        else
        {
            SyncIntervalMinutes = 5; // Default if missing
        }
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

        _db.DeviceConfigurations.Add(NewDevice);
        await _db.SaveChangesAsync();

        Message = "Device added successfully.";
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
            Message = "Device removed.";
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateDeviceAsync(int id, string name, string ip, int port, int machine, int commKey)
    {
        var device = await _db.DeviceConfigurations.FindAsync(id);
        if (device != null)
        {
            device.Name = name;
            device.IpAddress = ip;
            device.Port = port;
            device.MachineNumber = machine;
            device.CommKey = commKey;
            await _db.SaveChangesAsync();

            // Notify device service about the change (pick this machine to update)
            await Services.WindowsServiceClient.UpdateDeviceConfigAsync(ip, port, machine, commKey);
            
            Message = "Device settings updated.";
            IsError = false;
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostTestConnectionAsync(int id)
    {
        var device = await _db.DeviceConfigurations.FindAsync(id);
        if (device == null) return RedirectToPage();

        var (success, errorMessage) = await Services.WindowsServiceClient.UpdateDeviceConfigAsync(device.IpAddress, device.Port, device.MachineNumber, device.CommKey);
        
        bool isConnectionFailure = !success || (!string.IsNullOrEmpty(errorMessage) && errorMessage.Contains("connection failed", StringComparison.OrdinalIgnoreCase));

        if (!isConnectionFailure)
        {
            Message = $"Device '{device.Name}' connection successful. Service Response: {errorMessage}";
            IsError = false;
        }
        else
        {
            Message = $"Failed to connect to device '{device.Name}': {errorMessage}";
            IsError = true;
        }

        await OnGetAsync();
        return Page();
    }
 
    public async Task<IActionResult> OnPostUpdateSyncIntervalAsync()
    {
        var setting = await _db.SystemSettings
            .FirstOrDefaultAsync(s => s.SettingKey == "SyncIntervalMinutes");
        
        if (setting == null)
        {
            setting = new SystemSetting
            {
                SettingKey = "SyncIntervalMinutes",
                Description = "Frequency of attendance sync in minutes"
            };
            _db.SystemSettings.Add(setting);
        }
 
        setting.SettingValue = SyncIntervalMinutes.ToString();
        setting.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
 
        // Notify Service
        var (success, response) = await Services.WindowsServiceClient.UpdateSyncIntervalAsync(SyncIntervalMinutes);
        
        if (success)
        {
            Message = "Sync interval updated successfully.";
            IsError = false;
        }
        else
        {
            Message = $"Interval saved in DB, but Service notification failed: {response}";
            IsError = true;
        }
 
        return RedirectToPage();
    }
}
