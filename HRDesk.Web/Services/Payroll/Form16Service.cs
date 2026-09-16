using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Payroll;

public record Form16EmployerDto(
    string Name,
    string? Address,
    string? Pan,
    string? Tan,
    string SignatoryName,
    string SignatoryDesignation,
    string? SignatoryFatherName
);

public record Form16EmployeeDto(
    int EmployeeId,
    string EmployeeCode,
    string Name,
    string? Pan,
    string? Address,
    string? Department,
    string? Designation,
    DateOnly? JoiningDate,
    string TaxRegime
);

public record Form16DeductionItemDto(
    string Section,
    string Description,
    decimal GrossAmount,
    decimal DeductibleAmount
);

public record Form16PartBDto(
    string CertificateNumber,
    string AssessmentYear,
    string FinancialYear,
    string PeriodFrom,
    string PeriodTo,
    Form16EmployerDto Employer,
    Form16EmployeeDto Employee,
    
    // 1. Gross Salary u/s 17
    decimal SalarySec17_1,
    decimal PerquisitesSec17_2,
    decimal ProfitsInLieuSec17_3,
    decimal TotalCurrentEmployerSalary,
    decimal PreviousEmployerSalary,
    decimal GrossSalaryTotal,
    
    // 2. Allowances exempt u/s 10
    decimal HraExemptionSec10_13A,
    decimal OtherExemptionsSec10,
    decimal TotalExemptionsSec10,
    
    // 3. Balance (1 - 2)
    decimal BalanceSalary,
    
    // 4. Deductions u/s 16
    decimal StandardDeductionSec16_ia,
    decimal EntertainmentAllowanceSec16_ii,
    decimal TaxOnEmploymentSec16_iii,
    decimal TotalDeductionsSec16,
    
    // 5. Income chargeable under head 'Salaries' (3 - 4)
    decimal IncomeChargeableSalaries,
    
    // 6. Other Income / House Property
    decimal HousePropertyLossSec24_b,
    decimal OtherIncomeReported,
    
    // 7. Gross Total Income (5 + 6)
    decimal GrossTotalIncome,
    
    // 8. Deductions under Chapter VI-A
    List<Form16DeductionItemDto> ChapterVIA_Deductions,
    decimal TotalChapterVIA_Deductions,
    
    // 9. Total Taxable Income (7 - 8, rounded u/s 288A)
    decimal TotalTaxableIncome,
    
    // 10. Tax Computation
    List<TaxSlabBreakdown> SlabBreakdown,
    decimal TaxOnTotalIncome,
    decimal Section87ARebate,
    decimal TaxAfterRebate,
    decimal HealthAndEducationCess,
    decimal TotalTaxPayable,
    decimal Section89Relief,
    decimal NetTaxPayable,
    
    // 11. TDS summary
    decimal TdsDeductedCurrentEmployer,
    decimal TdsDeductedPreviousEmployer,
    decimal TotalTdsDeducted,
    decimal TaxPayableOrRefundable,
    
    // Status & Metadata
    bool IsDraft,
    string GeneratedAt,
    string Place
);

public class Form16Service
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly TaxComputationService _taxComputationService;

    public Form16Service(
        BiometricAttendanceDbContext db,
        TaxComputationService taxComputationService)
    {
        _db = db;
        _taxComputationService = taxComputationService;
    }

    /// <summary>
    /// Generates Form 16 Part B statutory data for an employee for a specific Financial Year.
    /// </summary>
    public async Task<Form16PartBDto?> GeneratePartBAsync(int employeeId, int organizationId, string? financialYear = null)
    {
        var fy = string.IsNullOrWhiteSpace(financialYear)
            ? TaxComputationService.GetFinancialYear(DateOnly.FromDateTime(DateTime.Today))
            : financialYear.Trim();

        // Parse FY e.g. "2026-2027" -> 2026, 2027
        int startYear, endYear;
        var parts = fy.Split('-');
        if (parts.Length == 2 && int.TryParse(parts[0], out var sY) && int.TryParse(parts[1], out var eY))
        {
            startYear = sY;
            endYear = eY;
        }
        else
        {
            var now = DateTime.Today;
            startYear = now.Month >= 4 ? now.Year : now.Year - 1;
            endYear = startYear + 1;
            fy = $"{startYear}-{endYear}";
        }

        string assessmentYear = $"{endYear}-{endYear + 1}";

        // 1. Fetch Employee
        var employee = await _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .Include(e => e.Organization)
                .ThenInclude(o => o!.Company)
            .FirstOrDefaultAsync(e => e.EmployeeId == employeeId && e.OrganizationId == organizationId);

        if (employee == null) return null;

        // 2. Fetch Organization & System Settings
        var org = employee.Organization;
        var settings = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId &&
                        (s.SettingKey.StartsWith("Company_") || s.SettingKey.StartsWith("Employee_Prefix_")))
            .ToListAsync();

        string GetSetting(string key, string fallback = "") =>
            settings.FirstOrDefault(s => s.SettingKey == key)?.SettingValue ?? fallback;

        // Formatted Employee Code
        var series = settings.FirstOrDefault(s => s.BranchId == employee.BranchId && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Series")?.SettingValue
            ?? "EMP";
        var connector = settings.FirstOrDefault(s => s.BranchId == employee.BranchId && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Connector")?.SettingValue
            ?? "#";
        var padding = int.TryParse(
            settings.FirstOrDefault(s => s.BranchId == employee.BranchId && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue
            ?? settings.FirstOrDefault(s => s.BranchId == null && s.SettingKey == "Employee_Prefix_Padding")?.SettingValue, out var pp) ? pp : 3;

        var cleanSeries = series.Trim();
        string employeeCode = cleanSeries.EndsWith('#') || cleanSeries.EndsWith('-') || cleanSeries.EndsWith('_') || cleanSeries.EndsWith('/')
            ? $"{cleanSeries}{employee.EmployeeId.ToString($"D{padding}")}"
            : $"{cleanSeries}{connector}{employee.EmployeeId.ToString($"D{padding}")}";

        // Employer Info
        var employer = new Form16EmployerDto(
            Name: org?.Name ?? "Organization",
            Address: org?.Address ?? org?.Company?.HeadquartersAddress ?? "India",
            Pan: org?.Company?.Pan ?? GetSetting("Company_PAN", "AAACP1234F"),
            Tan: GetSetting("Company_TAN", "BLR0123456"),
            SignatoryName: GetSetting("Company_Signatory_Name", "Authorized Signatory"),
            SignatoryDesignation: GetSetting("Company_Signatory_Designation", "Authorized Officer / Head of HR"),
            SignatoryFatherName: GetSetting("Company_Signatory_Father_Name", "")
        );

        // Employee Info
        var employeeDto = new Form16EmployeeDto(
            EmployeeId: employee.EmployeeId,
            EmployeeCode: employeeCode,
            Name: employee.EmployeeName,
            Pan: !string.IsNullOrWhiteSpace(employee.PanNumber) ? employee.PanNumber : "PANNOTAVBL",
            Address: employee.CurrentAddress ?? employee.PermanentAddress ?? "-",
            Department: employee.Department?.DepartmentName ?? "-",
            Designation: employee.Designation?.DesignationName ?? "-",
            JoiningDate: employee.JoiningDate,
            TaxRegime: "New" // updated below if declaration found
        );

        // 3. Fetch IT Declaration
        var declaration = await _db.EmployeeTaxDeclarations
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.FinancialYear == fy);

        string regime = declaration?.TaxRegime ?? "New";
        employeeDto = employeeDto with { TaxRegime = regime };

        // 4. Period with Employer
        var fyStartDate = new DateOnly(startYear, 4, 1);
        var fyEndDate = new DateOnly(endYear, 3, 31);

        var periodFromDate = (employee.JoiningDate.HasValue && employee.JoiningDate.Value > fyStartDate)
            ? employee.JoiningDate.Value
            : fyStartDate;

        var periodToDate = (employee.ResignationDate.HasValue && employee.ResignationDate.Value < fyEndDate)
            ? employee.ResignationDate.Value
            : fyEndDate;

        string periodFrom = periodFromDate.ToString("dd/MM/yyyy");
        string periodTo = periodToDate.ToString("dd/MM/yyyy");

        // 5. Gather Salary & Payroll Figures
        var startMonthStr = $"{startYear:D4}-04";
        var endMonthStr = $"{endYear:D4}-03";

        var payrolls = await _db.PayrollMasters
            .AsNoTracking()
            .Where(p => p.EmployeeId == employeeId &&
                        p.OrganizationId == organizationId &&
                        string.Compare(p.Month, startMonthStr) >= 0 &&
                        string.Compare(p.Month, endMonthStr) <= 0 &&
                        p.Status != "Void")
            .ToListAsync();

        decimal actualTdsDeducted = payrolls.Sum(p => p.TDS ?? 0m);
        decimal processedGross = payrolls.Sum(p => p.TotalEarnings);
        decimal processedPt = payrolls.Sum(p => p.ProfessionalTax ?? 0m);

        decimal processedBasic = 0m;
        decimal processedHra = 0m;

        if (payrolls.Any())
        {
            var pIds = payrolls.Select(p => p.Id).ToList();
            var details = await _db.PayrollDetails
                .AsNoTracking()
                .Where(d => pIds.Contains(d.PayrollId))
                .ToListAsync();

            processedBasic = details
                .Where(d => d.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase))
                .Sum(d => d.Amount);

            processedHra = details
                .Where(d => d.ComponentName.Contains("HRA", StringComparison.OrdinalIgnoreCase) ||
                            d.ComponentName.Contains("House Rent", StringComparison.OrdinalIgnoreCase))
                .Sum(d => d.Amount);
        }

        // Active CTC structure
        var ctc = await _db.EmployeeCTCs
            .AsNoTracking()
            .Include(c => c.PayGroup)
            .ThenInclude(pg => pg!.Components)
            .FirstOrDefaultAsync(c => c.EmployeeId == employeeId && c.EffectiveTo == null);

        decimal annualGross = 0m;
        decimal annualBasic = 0m;
        decimal annualHra = 0m;
        decimal annualPt = 0m;

        int processedMonths = payrolls.Count;

        if (processedMonths >= 12)
        {
            annualGross = processedGross;
            annualBasic = processedBasic;
            annualHra = processedHra;
            annualPt = processedPt;
        }
        else if (processedMonths > 0 && ctc != null)
        {
            // Partially processed FY: blend actuals with remaining months
            int remainingMonths = Math.Max(0, 12 - processedMonths);
            decimal monthlyCtc = ctc.AnnualCTC / 12m;
            decimal monthlyBasic = monthlyCtc * 0.40m;
            decimal monthlyHra = monthlyCtc * 0.20m;
            decimal monthlyPt = 200m;

            if (ctc.PayGroup?.Components != null && ctc.PayGroup.Components.Any())
            {
                var breakdown = Controllers.Api.PayGroupsApiController.ComputeCTCBreakdown(ctc.AnnualCTC, ctc.PayGroup.Components.ToList());
                var basicComp = breakdown.FirstOrDefault(b => b.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase));
                if (basicComp != null) monthlyBasic = basicComp.Amount;

                var hraComp = breakdown.FirstOrDefault(b => b.ComponentName.Contains("HRA", StringComparison.OrdinalIgnoreCase) ||
                                                            b.ComponentName.Contains("House Rent", StringComparison.OrdinalIgnoreCase));
                if (hraComp != null) monthlyHra = hraComp.Amount;
            }

            annualGross = processedGross + (monthlyCtc * remainingMonths);
            annualBasic = processedBasic + (monthlyBasic * remainingMonths);
            annualHra = processedHra + (monthlyHra * remainingMonths);
            annualPt = processedPt + (monthlyPt * remainingMonths);
        }
        else if (ctc != null)
        {
            // Pure projection from active CTC
            annualGross = ctc.AnnualCTC;
            annualBasic = annualGross * 0.40m;
            annualHra = annualGross * 0.20m;
            annualPt = 2400m;

            if (ctc.PayGroup?.Components != null && ctc.PayGroup.Components.Any())
            {
                var breakdown = Controllers.Api.PayGroupsApiController.ComputeCTCBreakdown(annualGross, ctc.PayGroup.Components.ToList());
                var basicComp = breakdown.FirstOrDefault(b => b.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase));
                if (basicComp != null) annualBasic = basicComp.Amount * 12m;

                var hraComp = breakdown.FirstOrDefault(b => b.ComponentName.Contains("HRA", StringComparison.OrdinalIgnoreCase) ||
                                                            b.ComponentName.Contains("House Rent", StringComparison.OrdinalIgnoreCase));
                if (hraComp != null) annualHra = hraComp.Amount * 12m;
            }
        }
        else
        {
            // Fallback from processed if no CTC record
            annualGross = processedGross;
            annualBasic = processedBasic;
            annualHra = processedHra;
            annualPt = processedPt;
        }

        // Previous employer salary
        decimal previousEmployerGross = declaration?.PreviousEmployerGross ?? 0m;
        decimal previousEmployerTds = declaration?.PreviousEmployerTDS ?? 0m;

        decimal salarySec17_1 = annualGross;
        decimal perquisitesSec17_2 = 0m;
        decimal profitsInLieuSec17_3 = 0m;
        decimal totalCurrentEmployerSalary = salarySec17_1 + perquisitesSec17_2 + profitsInLieuSec17_3;
        decimal grossSalaryTotal = totalCurrentEmployerSalary + previousEmployerGross;

        // 6. Deductions and Tax Computation
        RegimeTaxResult taxResult;
        decimal hraExemption = 0m;
        decimal stdDeduction = 0m;
        decimal ptDeduction = 0m;
        decimal housePropertyLoss = 0m;
        decimal otherIncome = declaration?.OtherIncome ?? 0m;

        var deductionsList = new List<Form16DeductionItemDto>();

        if (regime.Equals("Old", StringComparison.OrdinalIgnoreCase))
        {
            taxResult = _taxComputationService.ComputeOldRegimeTax(annualGross, annualBasic, annualHra, declaration);
            hraExemption = taxResult.HraExemption;
            stdDeduction = 50000m;
            ptDeduction = annualPt;
            housePropertyLoss = taxResult.Section24Deduction;

            // Chapter VI-A schedule
            if (declaration != null)
            {
                // 80C
                decimal total80c = declaration.Sec80C_EPF + declaration.Sec80C_PPF + declaration.Sec80C_ELSS +
                                   declaration.Sec80C_LifeInsurance + declaration.Sec80C_TuitionFees +
                                   declaration.Sec80C_HomeLoanPrincipal + declaration.Sec80C_Other;

                if (total80c > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80C",
                        Description: "Life Insurance, EPF, PPF, ELSS, Tuition Fees, Housing Principal",
                        GrossAmount: total80c,
                        DeductibleAmount: Math.Min(150000m, total80c)
                    ));
                }

                // 80CCD(1B) NPS
                if (declaration.Sec80CCD_NPS > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80CCD(1B)",
                        Description: "Contribution to National Pension System (NPS)",
                        GrossAmount: declaration.Sec80CCD_NPS,
                        DeductibleAmount: Math.Min(50000m, declaration.Sec80CCD_NPS)
                    ));
                }

                // 80D
                decimal selfLimit = 25000m;
                decimal selfGross = declaration.Sec80D_SelfFamily + Math.Min(5000m, declaration.Sec80D_PreventiveCheckup);
                decimal parentLimit = declaration.Sec80D_ParentsSeniorCitizen ? 50000m : 25000m;
                decimal parentGross = declaration.Sec80D_Parents;
                decimal total80dGross = selfGross + parentGross;
                decimal total80dDeductible = Math.Min(selfLimit, selfGross) + Math.Min(parentLimit, parentGross);

                if (total80dGross > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80D",
                        Description: "Health Insurance Premiums & Preventive Health Checkup",
                        GrossAmount: total80dGross,
                        DeductibleAmount: total80dDeductible
                    ));
                }

                // 80E
                if (declaration.Sec80E_EducationLoanInterest > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80E",
                        Description: "Interest on loan taken for Higher Education",
                        GrossAmount: declaration.Sec80E_EducationLoanInterest,
                        DeductibleAmount: declaration.Sec80E_EducationLoanInterest
                    ));
                }

                // 80G
                if (declaration.Sec80G_Donations > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80G",
                        Description: "Donations to specified charitable funds and institutions",
                        GrossAmount: declaration.Sec80G_Donations,
                        DeductibleAmount: declaration.Sec80G_Donations
                    ));
                }

                // 80TTA
                if (declaration.Sec80TTA_SavingsInterest > 0)
                {
                    deductionsList.Add(new Form16DeductionItemDto(
                        Section: "80TTA",
                        Description: "Interest on deposits in savings account",
                        GrossAmount: declaration.Sec80TTA_SavingsInterest,
                        DeductibleAmount: Math.Min(10000m, declaration.Sec80TTA_SavingsInterest)
                    ));
                }
            }
        }
        else
        {
            // New Regime (Sec 115BAC)
            taxResult = _taxComputationService.ComputeNewRegimeTax(annualGross, declaration);
            hraExemption = 0m;
            stdDeduction = 75000m;
            ptDeduction = 0m; // Not eligible in 115BAC
            housePropertyLoss = 0m; // Not set off against salary in 115BAC
        }

        decimal totalExemptionsSec10 = hraExemption;
        decimal balanceSalary = Math.Max(0m, grossSalaryTotal - totalExemptionsSec10);
        decimal totalDeductionsSec16 = stdDeduction + ptDeduction;
        decimal incomeChargeableSalaries = Math.Max(0m, balanceSalary - totalDeductionsSec16);
        decimal grossTotalIncome = Math.Max(0m, incomeChargeableSalaries + otherIncome - housePropertyLoss);
        decimal totalChapterVIA = deductionsList.Sum(d => d.DeductibleAmount);
        decimal netTaxableIncome = Math.Max(0m, grossTotalIncome - totalChapterVIA);
        netTaxableIncome = Math.Round(netTaxableIncome / 10m, 0) * 10m; // u/s 288A

        decimal totalTdsDeducted = actualTdsDeducted + previousEmployerTds;
        decimal taxPayableOrRefundable = taxResult.TotalAnnualTax - totalTdsDeducted;

        bool isDraft = processedMonths < 12;
        string certNum = $"F16/{startYear}-{endYear.ToString()[2..]}/{employeeCode}";
        string place = org?.Address?.Split(',').LastOrDefault()?.Trim() ?? "Bengaluru";

        return new Form16PartBDto(
            CertificateNumber: certNum,
            AssessmentYear: assessmentYear,
            FinancialYear: fy,
            PeriodFrom: periodFrom,
            PeriodTo: periodTo,
            Employer: employer,
            Employee: employeeDto,
            SalarySec17_1: salarySec17_1,
            PerquisitesSec17_2: perquisitesSec17_2,
            ProfitsInLieuSec17_3: profitsInLieuSec17_3,
            TotalCurrentEmployerSalary: totalCurrentEmployerSalary,
            PreviousEmployerSalary: previousEmployerGross,
            GrossSalaryTotal: grossSalaryTotal,
            HraExemptionSec10_13A: hraExemption,
            OtherExemptionsSec10: 0m,
            TotalExemptionsSec10: totalExemptionsSec10,
            BalanceSalary: balanceSalary,
            StandardDeductionSec16_ia: stdDeduction,
            EntertainmentAllowanceSec16_ii: 0m,
            TaxOnEmploymentSec16_iii: ptDeduction,
            TotalDeductionsSec16: totalDeductionsSec16,
            IncomeChargeableSalaries: incomeChargeableSalaries,
            HousePropertyLossSec24_b: housePropertyLoss,
            OtherIncomeReported: otherIncome,
            GrossTotalIncome: grossTotalIncome,
            ChapterVIA_Deductions: deductionsList,
            TotalChapterVIA_Deductions: totalChapterVIA,
            TotalTaxableIncome: netTaxableIncome,
            SlabBreakdown: taxResult.SlabBreakdown,
            TaxOnTotalIncome: taxResult.TaxBeforeRebate,
            Section87ARebate: taxResult.Section87ARebate,
            TaxAfterRebate: taxResult.TaxAfterRebate,
            HealthAndEducationCess: taxResult.HealthAndEducationCess,
            TotalTaxPayable: taxResult.TotalAnnualTax,
            Section89Relief: 0m,
            NetTaxPayable: taxResult.TotalAnnualTax,
            TdsDeductedCurrentEmployer: actualTdsDeducted,
            TdsDeductedPreviousEmployer: previousEmployerTds,
            TotalTdsDeducted: totalTdsDeducted,
            TaxPayableOrRefundable: taxPayableOrRefundable,
            IsDraft: isDraft,
            GeneratedAt: DateTime.Now.ToString("dd-MMM-yyyy HH:mm"),
            Place: place
        );
    }
}
