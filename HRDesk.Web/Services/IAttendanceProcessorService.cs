using System;
using System.Threading.Tasks;

namespace HRDesk.Web.Services;

public interface IAttendanceProcessorService
{
    Task ProcessDailyAttendanceAsync(DateOnly date, int? employeeId = null);
}
