using System.Threading.Tasks;

namespace HRDesk.Web.Services;

public interface IDeviceCommunicationService
{
    Task<(bool Success, string? ErrorMessage)> SetNameInMachineAsync(int employeeId, string employeeName);
    Task<(bool Success, string? ErrorMessage)> EnableUserAsync(int employeeId, bool enable);
    Task<(bool Success, string? ErrorMessage)> DeleteUserAsync(int employeeId);
    Task<(bool Success, string? ErrorMessage)> UpdateDeviceConfigAsync(string ip, int port, int machineNum, int? commKey = 0);
    Task<(bool Success, string? ErrorMessage)> UpdateSyncIntervalAsync(int syncIntervalMinutes);
}
