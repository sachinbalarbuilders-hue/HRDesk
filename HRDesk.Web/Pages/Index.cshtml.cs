using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using System.Linq;
using HRDesk.Web.Services;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;

namespace HRDesk.Web.Pages;

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
    public List<CelebrationViewModel> Celebrations { get; set; } = new();

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

        // 5. Team Celebrations (Birthdays & Work Anniversaries next 30 days)
        var allActiveEmployees = await _context.Employees
            .Where(e => e.Status == "active")
            .ToListAsync();

        var todayDt = DateTime.Today;
        foreach (var emp in allActiveEmployees)
        {
            if (emp.DateOfBirth.HasValue && emp.DateOfBirth.Value.Year > 1900)
            {
                var dob = emp.DateOfBirth.Value.ToDateTime(TimeOnly.MinValue);
                var nextBday = GetNextOccurrence(dob, todayDt);
                var daysLeft = (nextBday - todayDt).Days;
                
                Celebrations.Add(new CelebrationViewModel
                {
                    EmployeeName = emp.EmployeeName,
                    Initials = GetInitials(emp.EmployeeName),
                    PhotoPath = emp.PhotoPath,
                    Type = "Birthday",
                    CelebrationDate = nextBday,
                    DaysLeft = daysLeft
                });
            }

            if (emp.JoiningDate.HasValue && emp.JoiningDate.Value.Year > 1900)
            {
                var doj = emp.JoiningDate.Value.ToDateTime(TimeOnly.MinValue);
                var nextAnniversary = GetNextOccurrence(doj, todayDt);
                if (nextAnniversary.Year > doj.Year)
                {
                    int years = nextAnniversary.Year - doj.Year;
                    var daysLeft = (nextAnniversary - todayDt).Days;
                    
                    Celebrations.Add(new CelebrationViewModel
                    {
                        EmployeeName = emp.EmployeeName,
                        Initials = GetInitials(emp.EmployeeName),
                        PhotoPath = emp.PhotoPath,
                        Type = $"{years}{GetOrdinalSuffix(years)} Work Anniversary",
                        CelebrationDate = nextAnniversary,
                        DaysLeft = daysLeft
                    });
                }
            }
        }
        Celebrations = Celebrations.OrderBy(c => c.DaysLeft).ToList();
    }

    private DateTime GetNextOccurrence(DateTime originalDate, DateTime fromDate)
    {
        int year = fromDate.Year;
        int month = originalDate.Month;
        int day = originalDate.Day;
        if (month == 2 && day == 29 && !DateTime.IsLeapYear(year)) day = 28;
        
        var nextDate = new DateTime(year, month, day);
        if (nextDate < fromDate)
        {
            year++;
            day = originalDate.Day;
            if (month == 2 && day == 29 && !DateTime.IsLeapYear(year)) day = 28;
            nextDate = new DateTime(year, month, day);
        }
        return nextDate;
    }

    private string GetInitials(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return parts[0].Substring(0, 1).ToUpper();
        return (parts[0].Substring(0, 1) + parts[^1].Substring(0, 1)).ToUpper();
    }

    private string GetOrdinalSuffix(int num)
    {
        if (num <= 0) return "";
        switch (num % 100)
        {
            case 11:
            case 12:
            case 13:
                return "th";
        }
        switch (num % 10)
        {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
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

    public class CelebrationViewModel
    {
        public string EmployeeName { get; set; } = "";
        public string Initials { get; set; } = "";
        public string? PhotoPath { get; set; }
        public string Type { get; set; } = ""; 
        public DateTime CelebrationDate { get; set; }
        public int DaysLeft { get; set; }
    }
}
