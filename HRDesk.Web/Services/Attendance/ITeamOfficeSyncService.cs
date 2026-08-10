using System;
using System.Threading;
using System.Threading.Tasks;

namespace HRDesk.Web.Services.Attendance;

public interface ITeamOfficeSyncService
{
    Task<(int newLogs, string message, bool success)> SyncLatestPunchesAsync(CancellationToken cancellationToken = default);
    Task<(int newLogs, string message, bool success)> SyncDateRangePunchesAsync(DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default);
    Task<(bool success, string message)> TestConnectionAsync(string? corpId = null, string? username = null, string? password = null, CancellationToken cancellationToken = default);
}
