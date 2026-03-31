using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Attendance;

public class ProcessModel : PageModel
{
    private readonly AttendanceProcessorService _processor;
    private readonly ILogger<ProcessModel> _logger;
    private readonly BiometricAttendanceDbContext _db;

    public ProcessModel(AttendanceProcessorService processor, ILogger<ProcessModel> logger, BiometricAttendanceDbContext db)
    {
        _processor = processor;
        _logger = logger;
        _db = db;
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
                    _logger.LogInformation($"Cleared {futureRecords.Count} attendance records after {ToDate}");
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
                // Process all employees
                var activeAll = await _db.Employees
                    .Where(e => (e.Status == "active" || e.Status == "Active") && (e.JoiningDate == null || e.JoiningDate <= ToDate))
                    .ToListAsync();

                for (var d = FromDate; d <= ToDate; d = d.AddDays(1))
                {
                    foreach (var emp in activeAll)
                    {
                        if (emp.JoiningDate == null || emp.JoiningDate <= d)
                        {
                            await _processor.ProcessDailyAttendanceAsync(d, emp.EmployeeId);
                        }
                    }
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
