using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRDesk.Web.Services;

public interface ILoanService
{
    int CalculateInstallmentCount(decimal loanAmount, decimal emiAmount);
    Task GenerateInstallmentScheduleAsync(int loanId);
    Task<decimal> ProcessInstallmentPaymentAsync(int loanId, string month, int? payrollId = null);
    Task<List<(decimal Amount, string TypeName)>> GetPendingInstallmentsWithDetailsAsync(int employeeId, string month);
    Task ApproveLoanAsync(int loanId, string approvedBy);
    Task DeleteLoanAsync(int loanId);
    Task ForecloseLoanAsync(int loanId, string foreclosedBy, string remark, bool includeCurrentMonth = true);
}
