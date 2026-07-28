using System;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public interface ICompOffService
{
    Task<CompOffRequest?> CreateDraftRequestAsync(int employeeId, DateOnly workedDate, TimeOnly inTime, int? shiftId);
    Task<CompOffRequest?> UpdateWithOutPunchAsync(int employeeId, DateOnly workedDate, TimeOnly outTime);
    Task ApproveRequestAsync(int requestId, string approvedBy);
    Task CreateManualCreditAsync(int employeeId, DateOnly workedDate, decimal days, string approvedBy, string remarks);
    Task<decimal> GetValidBalanceAsync(int employeeId, DateOnly onDate);
    Task RejectRequestAsync(int requestId, string rejectedBy, string reason);
}
