using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Attendance;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRDesk.Web.Pages.Attendance;

public class ProcessModel : PageModel
{
    private readonly IAttendanceProcessorService _processor;
    private readonly ILogger<ProcessModel> _logger;
    private readonly BiometricAttendanceDbContext _db;
    private readonly ITeamOfficeSyncService _teamOfficeService;

    public ProcessModel(
        IAttendanceProcessorService processor,
        ILogger<ProcessModel> logger,
        BiometricAttendanceDbContext db,
        ITeamOfficeSyncService teamOfficeService)
    {
        _processor = processor;
        _logger = logger;
        _db = db;
        _teamOfficeService = teamOfficeService;
    }

    [BindProperty]
    public DateOnly FromDate { get; set; } = DateOnly.FromDateTime(DateTime.Now);

    [BindProperty]
    public DateOnly ToDate { get; set; } = DateOnly.FromDateTime(DateTime.Now);

    [BindProperty]
    public bool ClearFutureData { get; set; } = false;

    [BindProperty]
    public List<int> EmployeeIds { get; set; } = new();

    public List<Employee> Employees { get; set; } = new();

    [TempData]
    public string Message { get; set; } = "";

    public async Task OnGetAsync()
    {
        Employees = await _db.Employees
            .Where(e => e.Status == "active" || e.Status == "Active")
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();
    }

    public async Task<IActionResult> OnPostSyncCloudLogsAsync()
    {
        var (newLogs, message, success) = await _teamOfficeService.SyncLatestPunchesAsync();
        Message = success ? $"Success: {message}" : $"Error: {message}";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        // Reload employees for the dropdown if we return Page()
        Employees = await _db.Employees
            .Where(e => e.Status == "active" || e.Status == "Active")
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();

        if (FromDate > ToDate)
        {
            Message = "Error: From Date cannot be later than To Date.";
            return Page();
        }

        try
        {
            // Clear future data if requested
            if (ClearFutureData)
            {
                var futureRecords = await _db.DailyAttendance
                    .Where(a => a.RecordDate > ToDate)
                    .ToListAsync();
                
                if (futureRecords.Any())
                {
                    _db.DailyAttendance.RemoveRange(futureRecords);
                    await _db.SaveChangesAsync();
                    _logger.LogInformation("Cleared {Count} attendance records after {ToDate}", futureRecords.Count, ToDate);
                }
            }

            if (EmployeeIds.Any())
            {
                // Process only selected employees
                foreach (var empId in EmployeeIds)
                {
                    for (var d = FromDate; d <= ToDate; d = d.AddDays(1))
                    {
                        await _processor.ProcessDailyAttendanceAsync(d, empId);
                    }
                }
            }
            else
            {
                // Process all employees using the processor's native batch mode
                for (var d = FromDate; d <= ToDate; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, null);
                }
            }
            
            string empName;
            if (EmployeeIds.Any())
            {
                var names = await _db.Employees
                    .Where(e => EmployeeIds.Contains(e.EmployeeId))
                    .Select(e => e.EmployeeName)
                    .ToListAsync();
                empName = string.Join(", ", names);
            }
            else
            {
                empName = "All Employees";
            }
            var clearMsg = ClearFutureData ? " (Future data cleared)" : "";
            Message = $"Success: Attendance processed for {empName} from {FromDate} to {ToDate}.{clearMsg}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing attendance.");
            var msg = ex.Message;
            var inner = ex.InnerException;
            while (inner != null)
            {
                msg += " | Inner: " + inner.Message;
                inner = inner.InnerException;
            }
            Message = $"Error: {msg}";
        }

        return Page();
    }
}
