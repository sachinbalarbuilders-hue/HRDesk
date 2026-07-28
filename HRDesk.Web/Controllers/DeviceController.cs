using System.Threading.Tasks;
using HRDesk.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers;

[ApiController]
[Route("api/device")]
public sealed class DeviceController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;

    public DeviceController(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    // POST /api/device/set-user/{employeeId}
    [HttpPost("set-user/{employeeId}")]
    [Authorize]
    public async Task<IActionResult> SetUser(int employeeId)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (employee is null)
        {
            return NotFound("Employee not found");
        }

        // Call Windows service via WindowsServiceClient which uses named pipe IPC.
        var (success, errorMessage) = await Services.WindowsServiceClient.SetNameInMachineAsync(employee.EmployeeId, employee.EmployeeName ?? string.Empty);

        if (success)
        {
            employee.DeviceSynced = 1;
            employee.DeviceSyncError = null;
            await _db.SaveChangesAsync();
            return Ok("Employee successfully registered in machine");
        }

        employee.DeviceSynced = 0;
        employee.DeviceSyncError = errorMessage;
        await _db.SaveChangesAsync();
        return StatusCode(500, errorMessage ?? "Unknown error from device service");
    }
}
