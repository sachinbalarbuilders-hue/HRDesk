using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using System.Linq;
using AttendanceUI.Services;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;

namespace AttendanceUI.Pages;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public IndexModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    public int TotalEmployees { get; set; }
    public int PresentToday { get; set; }
    public int OnLeaveToday { get; set; }
    public int LateToday { get; set; }

    public List<DeviceStatusViewModel> MachineStatuses { get; set; } = new();

    public async Task OnGetAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);

        // 1. Total Active Employees
        TotalEmployees = await _context.Employees.CountAsync(e => e.Status == "active");

        // 2. Present Today
        PresentToday = await _context.DailyAttendance
            .Where(da => da.RecordDate == today && da.InTime != null)
            .CountAsync();

        // 3. On Leave Today (Approved Leaves)
        OnLeaveToday = await _context.LeaveApplications
            .Where(l => l.Status == "Approved" && l.StartDate <= today && l.EndDate >= today)
            .CountAsync();

        // 4. Late Today
        LateToday = await _context.DailyAttendance
            .Where(da => da.RecordDate == today && da.IsLate)
            .CountAsync();

        // 4. Machine Statuses (Based on dedicated DeviceSyncStates table)
        var configs = await _context.DeviceConfigurations.AsNoTracking().ToListAsync();
        foreach (var cfg in configs)
        {
            var syncState = await _context.DeviceSyncStates
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.DeviceId == cfg.Id);

            MachineStatuses.Add(new DeviceStatusViewModel
            {
                Id = cfg.Id,
                Name = cfg.Name,
                IpAddress = cfg.IpAddress,
                LastSync = syncState?.LastSyncedTime,
                RecordsSynced = syncState?.RecordsSynced ?? 0,
                StatusClass = DetermineStatusClass(syncState?.LastSyncedTime ?? default)
            });
        }
    }

    private string DetermineStatusClass(DateTime lastSync)
    {
        if (lastSync == default) return "status-unknown";
        
        var diff = DateTime.Now - lastSync;
        if (diff.TotalMinutes <= 5) return "status-online status-pulse";
        if (diff.TotalMinutes <= 20) return "status-warning";
        return "status-offline";
    }

    public async Task<JsonResult> OnGetCheckConnectionAsync(int id)
    {
        var device = await _context.DeviceConfigurations.FindAsync(id);
        if (device == null) return new JsonResult(new { success = false, message = "Device not found" });

        var (success, message) = await WindowsServiceClient.UpdateDeviceConfigAsync(device.IpAddress, device.Port, device.MachineNumber, device.CommKey);
        return new JsonResult(new { success, message });
    }

    public class DeviceStatusViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string IpAddress { get; set; } = "";
        public DateTime? LastSync { get; set; }
        public int RecordsSynced { get; set; }
        public string StatusClass { get; set; } = "status-unknown";
    }
}
