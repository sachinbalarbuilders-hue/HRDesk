using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public interface IPayrollService
{
    Task<AttendanceSummaryResult> GetAttendanceSummaryAsync(int employeeId, string month);
    Task<decimal> GetGrossSalaryAsync(int employeeId, string month);
    Task<Dictionary<int, decimal>> GetGrossSalariesBatchAsync(List<int> employeeIds, string month);
    Task<PayrollMaster> ProcessEmployeePayrollAsync(int employeeId, string month, List<ManualAdjustment>? manualAdjustments = null, bool skipLoans = false);
    Task<int> ProcessBulkEmployeePayrollAsync(List<int> employeeIds, string month, Dictionary<int, List<ManualAdjustment>> adjustments, bool skipLoans = false);
    Task<int> ProcessMonthlyPayrollAsync(string month, bool includeLoans = true);

    // Workflow & Cohort Run Management
    Task<bool> IsCohortLockedAsync(int payGroupId, string month);
    Task<PayrollRun> GetOrCreatePayrollRunAsync(int payGroupId, string month);
    Task<PayrollRun> SyncPayrollRunTotalsAsync(int payGroupId, string month);
    Task<PayrollRun> SubmitPayrollRunAsync(int payGroupId, string month, string submittedBy, string? notes = null);
    Task<PayrollRun> ApprovePayrollRunAsync(int payGroupId, string month, string approvedBy, string? notes = null);
    Task<PayrollRun> MarkPayrollRunPaidAsync(int payGroupId, string month, string paidBy, string paymentMethod, string? reference, DateOnly? paymentDate = null, string? notes = null);
    Task<PayrollRun> UnlockPayrollRunAsync(int payGroupId, string month, string unlockedBy, string reason);
}
