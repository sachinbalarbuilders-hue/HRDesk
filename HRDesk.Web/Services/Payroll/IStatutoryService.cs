using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Payroll;

public record PfCalculationResult(
    decimal PfWages,
    decimal EmployeePf,
    decimal EmployerEps,
    decimal EmployerEpf,
    decimal EmployerEdli,
    decimal EmployerAdmin
);

public record EsicCalculationResult(
    decimal EsicWages,
    decimal EmployeeEsic,
    decimal EmployerEsic,
    bool IsEligible
);

public record PtCalculationResult(
    decimal GrossWages,
    decimal PtAmount
);

public class EcrMemberRecord
{
    public string Uan { get; set; } = "";
    public string MemberName { get; set; } = "";
    public decimal GrossWages { get; set; }
    public decimal EpfWages { get; set; }
    public decimal EpsWages { get; set; }
    public decimal EdliWages { get; set; }
    public decimal EeShare { get; set; }
    public decimal ErEpsShare { get; set; }
    public decimal ErEpfShare { get; set; }
    public int NcpDays { get; set; } // Non-contributing period (unpaid days)
    public decimal RefundOfAdvances { get; set; } = 0;
}

public class EsicReturnRecord
{
    public string IpNumber { get; set; } = "";
    public string IpName { get; set; } = "";
    public int PaidDays { get; set; }
    public decimal TotalWages { get; set; }
    public decimal EmployeeContribution { get; set; }
    public decimal EmployerContribution { get; set; }
    public string ReasonCode { get; set; } = "0"; // 0 = normal
}

public class PtSummaryRecord
{
    public string SlabDescription { get; set; } = "";
    public decimal RatePerEmployee { get; set; }
    public int EmployeeCount { get; set; }
    public decimal TotalTaxAmount { get; set; }
}

public class PtSummaryReport
{
    public string Month { get; set; } = "";
    public int TotalEmployees { get; set; }
    public decimal TotalGrossWages { get; set; }
    public decimal TotalTaxPayable { get; set; }
    public List<PtSummaryRecord> Slabs { get; set; } = new();
}

public interface IStatutoryService
{
    PfCalculationResult CalculatePf(Employee employee, decimal earnedBasic);
    EsicCalculationResult CalculateEsic(Employee employee, decimal earnedGross, decimal fullMonthlyGross);
    PtCalculationResult CalculatePt(Employee employee, decimal earnedGross);
    
    Task<List<EcrMemberRecord>> GetEcrRecordsAsync(string month, int? payGroupId = null);
    Task<string> GenerateEcrTextFileAsync(string month, int? payGroupId = null);
    Task<List<EsicReturnRecord>> GetEsicRecordsAsync(string month, int? payGroupId = null);
    Task<PtSummaryReport> GetPtSummaryAsync(string month, int? payGroupId = null);
}
