using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Payroll;

public record TaxSlabBreakdown(string SlabRange, decimal RatePercent, decimal TaxableAmount, decimal TaxAmount);

public record RegimeTaxResult(
    string Regime,
    decimal GrossIncome,
    decimal StandardDeduction,
    decimal HraExemption,
    decimal Section80CDeduction,
    decimal Section80DDeduction,
    decimal Section80CCDDeduction,
    decimal Section24Deduction,
    decimal OtherDeductions,
    decimal TotalDeductionsAndExemptions,
    decimal NetTaxableIncome,
    List<TaxSlabBreakdown> SlabBreakdown,
    decimal TaxBeforeRebate,
    decimal Section87ARebate,
    decimal TaxAfterRebate,
    decimal HealthAndEducationCess,
    decimal TotalAnnualTax,
    decimal EstimatedMonthlyTds
);

public record TaxComparisonResult(
    int EmployeeId,
    string EmployeeName,
    string FinancialYear,
    string SelectedRegime,
    RegimeTaxResult NewRegime,
    RegimeTaxResult OldRegime,
    string RecommendedRegime,
    decimal TaxDifference
);

public class TaxComputationService
{
    private readonly BiometricAttendanceDbContext _db;

    public TaxComputationService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Gets the standard financial year string for a given date (e.g. Date in Sep 2026 => "2026-2027").
    /// In India, FY starts 1-April and ends 31-March.
    /// </summary>
    public static string GetFinancialYear(DateOnly date)
    {
        int startYear = date.Month >= 4 ? date.Year : date.Year - 1;
        return $"{startYear}-{startYear + 1}";
    }

    public static string GetFinancialYear(int year, int month)
    {
        int startYear = month >= 4 ? year : year - 1;
        return $"{startYear}-{startYear + 1}";
    }

    /// <summary>
    /// Computes side-by-side tax comparison (New vs Old regime) for an employee.
    /// </summary>
    public TaxComparisonResult CompareRegimes(
        int employeeId,
        string employeeName,
        string financialYear,
        decimal annualGross,
        decimal annualBasic,
        decimal annualHraComponent,
        EmployeeTaxDeclaration? declaration)
    {
        var newRegimeResult = ComputeNewRegimeTax(annualGross, declaration);
        var oldRegimeResult = ComputeOldRegimeTax(annualGross, annualBasic, annualHraComponent, declaration);

        string recommended = newRegimeResult.TotalAnnualTax <= oldRegimeResult.TotalAnnualTax ? "New" : "Old";
        decimal diff = Math.Abs(newRegimeResult.TotalAnnualTax - oldRegimeResult.TotalAnnualTax);
        string selected = declaration?.TaxRegime ?? "New";

        return new TaxComparisonResult(
            EmployeeId: employeeId,
            EmployeeName: employeeName,
            FinancialYear: financialYear,
            SelectedRegime: selected,
            NewRegime: newRegimeResult,
            OldRegime: oldRegimeResult,
            RecommendedRegime: recommended,
            TaxDifference: diff
        );
    }

    /// <summary>
    /// New Tax Regime (Section 115BAC) for FY 2024-25 / 2025-26 / 2026-27:
    /// Standard deduction: ₹75,000.
    /// Slabs: 0-3L (0%), 3L-7L (5%), 7L-10L (10%), 10L-12L (15%), 12L-15L (20%), >15L (30%).
    /// Section 87A rebate: zero tax if taxable income <= ₹7,00,000.
    /// </summary>
    public RegimeTaxResult ComputeNewRegimeTax(decimal annualGross, EmployeeTaxDeclaration? decl)
    {
        decimal otherIncome = decl?.OtherIncome ?? 0m;
        decimal gross = annualGross + otherIncome;
        decimal stdDeduction = 75000m; // Updated standard deduction for New Regime

        decimal taxable = Math.Max(0, gross - stdDeduction);
        taxable = Math.Round(taxable / 10m, 0) * 10m; // Rounded to nearest ₹10

        var slabs = new List<TaxSlabBreakdown>();
        decimal tax = 0m;

        // Slab 1: 0 to 3,00,000 @ 0%
        decimal slab1 = Math.Min(taxable, 300000m);
        slabs.Add(new TaxSlabBreakdown("₹0 – ₹3,00,000", 0m, slab1, 0m));

        // Slab 2: 3,00,001 to 7,00,000 @ 5%
        if (taxable > 300000m)
        {
            decimal slab2 = Math.Min(taxable - 300000m, 400000m);
            decimal slab2Tax = slab2 * 0.05m;
            tax += slab2Tax;
            slabs.Add(new TaxSlabBreakdown("₹3,00,001 – ₹7,00,000", 5m, slab2, slab2Tax));
        }

        // Slab 3: 7,00,001 to 10,00,000 @ 10%
        if (taxable > 700000m)
        {
            decimal slab3 = Math.Min(taxable - 700000m, 300000m);
            decimal slab3Tax = slab3 * 0.10m;
            tax += slab3Tax;
            slabs.Add(new TaxSlabBreakdown("₹7,00,001 – ₹10,00,000", 10m, slab3, slab3Tax));
        }

        // Slab 4: 10,00,001 to 12,00,000 @ 15%
        if (taxable > 1000000m)
        {
            decimal slab4 = Math.Min(taxable - 1000000m, 200000m);
            decimal slab4Tax = slab4 * 0.15m;
            tax += slab4Tax;
            slabs.Add(new TaxSlabBreakdown("₹10,00,001 – ₹12,00,000", 15m, slab4, slab4Tax));
        }

        // Slab 5: 12,00,001 to 15,00,000 @ 20%
        if (taxable > 1200000m)
        {
            decimal slab5 = Math.Min(taxable - 1200000m, 300000m);
            decimal slab5Tax = slab5 * 0.20m;
            tax += slab5Tax;
            slabs.Add(new TaxSlabBreakdown("₹12,00,001 – ₹15,00,000", 20m, slab5, slab5Tax));
        }

        // Slab 6: > 15,00,000 @ 30%
        if (taxable > 1500000m)
        {
            decimal slab6 = taxable - 1500000m;
            decimal slab6Tax = slab6 * 0.30m;
            tax += slab6Tax;
            slabs.Add(new TaxSlabBreakdown("Above ₹15,00,000", 30m, slab6, slab6Tax));
        }

        // Section 87A Rebate for New Regime (taxable <= 7L => full rebate)
        decimal rebate = 0m;
        if (taxable <= 700000m)
        {
            rebate = tax;
        }
        else if (taxable <= 727777m)
        {
            // Marginal relief: tax payable cannot exceed taxable income minus ₹7,00,000
            decimal maxTax = taxable - 700000m;
            if (tax > maxTax)
            {
                rebate = tax - maxTax;
            }
        }

        decimal netTax = Math.Max(0m, tax - rebate);
        decimal cess = Math.Round(netTax * 0.04m, 2);
        decimal totalAnnualTax = Math.Round(netTax + cess, 0);

        return new RegimeTaxResult(
            Regime: "New",
            GrossIncome: gross,
            StandardDeduction: stdDeduction,
            HraExemption: 0m,
            Section80CDeduction: 0m,
            Section80DDeduction: 0m,
            Section80CCDDeduction: 0m,
            Section24Deduction: 0m,
            OtherDeductions: 0m,
            TotalDeductionsAndExemptions: stdDeduction,
            NetTaxableIncome: taxable,
            SlabBreakdown: slabs,
            TaxBeforeRebate: tax,
            Section87ARebate: rebate,
            TaxAfterRebate: netTax,
            HealthAndEducationCess: cess,
            TotalAnnualTax: totalAnnualTax,
            EstimatedMonthlyTds: Math.Round(totalAnnualTax / 12m, 0)
        );
    }

    /// <summary>
    /// Old Tax Regime:
    /// Standard deduction: ₹50,000.
    /// HRA Exemption under Sec 10(13A).
    /// Section 80C (up to ₹1.5L), 80D (Health up to ₹25k/₹50k), 80CCD(1B) (NPS up to ₹50k),
    /// Section 24(b) (Home loan interest up to ₹2L), etc.
    /// Slabs: 0-2.5L (0%), 2.5L-5L (5%), 5L-10L (20%), >10L (30%).
    /// 87A rebate if taxable <= ₹5,00,000.
    /// </summary>
    public RegimeTaxResult ComputeOldRegimeTax(
        decimal annualGross,
        decimal annualBasic,
        decimal annualHraComponent,
        EmployeeTaxDeclaration? decl)
    {
        decimal otherIncome = decl?.OtherIncome ?? 0m;
        decimal gross = annualGross + otherIncome;
        decimal stdDeduction = 50000m;

        // 1. HRA Exemption (Sec 10(13A))
        decimal hraExemption = 0m;
        if (decl != null && decl.AnnualRentPaid > 0 && annualHraComponent > 0)
        {
            decimal rentPaid = decl.AnnualRentPaid;
            decimal tenPercentBasic = annualBasic * 0.10m;
            decimal rentMinusTenPercent = Math.Max(0m, rentPaid - tenPercentBasic);
            decimal cityPercentBasic = string.Equals(decl.RentalCityType, "Metro", StringComparison.OrdinalIgnoreCase)
                ? annualBasic * 0.50m
                : annualBasic * 0.40m;

            hraExemption = Math.Min(annualHraComponent, Math.Min(rentMinusTenPercent, cityPercentBasic));
        }

        // 2. Section 80C (Capped at ₹1,50,000)
        decimal total80C = 0m;
        if (decl != null)
        {
            total80C = decl.Sec80C_EPF + decl.Sec80C_PPF + decl.Sec80C_ELSS + decl.Sec80C_LifeInsurance +
                       decl.Sec80C_TuitionFees + decl.Sec80C_HomeLoanPrincipal + decl.Sec80C_Other;
        }
        decimal sec80C = Math.Min(150000m, total80C);

        // 3. Section 80D (Health Insurance)
        decimal sec80D = 0m;
        if (decl != null)
        {
            decimal selfLimit = 25000m;
            decimal selfAmount = Math.Min(selfLimit, decl.Sec80D_SelfFamily + Math.Min(5000m, decl.Sec80D_PreventiveCheckup));
            decimal parentLimit = decl.Sec80D_ParentsSeniorCitizen ? 50000m : 25000m;
            decimal parentAmount = Math.Min(parentLimit, decl.Sec80D_Parents);
            sec80D = selfAmount + parentAmount;
        }

        // 4. Section 80CCD(1B) (NPS - up to ₹50,000)
        decimal sec80CCD = decl != null ? Math.Min(50000m, decl.Sec80CCD_NPS) : 0m;

        // 5. Section 24(b) (Home Loan Interest - up to ₹2,00,000)
        decimal sec24 = decl != null ? Math.Min(200000m, decl.Sec24_HomeLoanInterest) : 0m;

        // 6. Other Deductions (80E, 80G, 80TTA up to 10k)
        decimal otherDeductions = 0m;
        if (decl != null)
        {
            otherDeductions = decl.Sec80E_EducationLoanInterest + decl.Sec80G_Donations + Math.Min(10000m, decl.Sec80TTA_SavingsInterest);
        }

        decimal totalDeductions = stdDeduction + hraExemption + sec80C + sec80D + sec80CCD + sec24 + otherDeductions;
        decimal taxable = Math.Max(0m, gross - totalDeductions);
        taxable = Math.Round(taxable / 10m, 0) * 10m; // Round to nearest ₹10

        var slabs = new List<TaxSlabBreakdown>();
        decimal tax = 0m;

        // Slab 1: 0 to 2,50,000 @ 0%
        decimal slab1 = Math.Min(taxable, 250000m);
        slabs.Add(new TaxSlabBreakdown("₹0 – ₹2,50,000", 0m, slab1, 0m));

        // Slab 2: 2,50,001 to 5,00,000 @ 5%
        if (taxable > 250000m)
        {
            decimal slab2 = Math.Min(taxable - 250000m, 250000m);
            decimal slab2Tax = slab2 * 0.05m;
            tax += slab2Tax;
            slabs.Add(new TaxSlabBreakdown("₹2,50,001 – ₹5,00,000", 5m, slab2, slab2Tax));
        }

        // Slab 3: 5,00,001 to 10,00,000 @ 20%
        if (taxable > 500000m)
        {
            decimal slab3 = Math.Min(taxable - 500000m, 500000m);
            decimal slab3Tax = slab3 * 0.20m;
            tax += slab3Tax;
            slabs.Add(new TaxSlabBreakdown("₹5,00,001 – ₹10,00,000", 20m, slab3, slab3Tax));
        }

        // Slab 4: > 10,00,000 @ 30%
        if (taxable > 1000000m)
        {
            decimal slab4 = taxable - 1000000m;
            decimal slab4Tax = slab4 * 0.30m;
            tax += slab4Tax;
            slabs.Add(new TaxSlabBreakdown("Above ₹10,00,000", 30m, slab4, slab4Tax));
        }

        // Section 87A Rebate for Old Regime (taxable <= 5L => full rebate)
        decimal rebate = 0m;
        if (taxable <= 500000m)
        {
            rebate = tax;
        }

        decimal netTax = Math.Max(0m, tax - rebate);
        decimal cess = Math.Round(netTax * 0.04m, 2);
        decimal totalAnnualTax = Math.Round(netTax + cess, 0);

        return new RegimeTaxResult(
            Regime: "Old",
            GrossIncome: gross,
            StandardDeduction: stdDeduction,
            HraExemption: hraExemption,
            Section80CDeduction: sec80C,
            Section80DDeduction: sec80D,
            Section80CCDDeduction: sec80CCD,
            Section24Deduction: sec24,
            OtherDeductions: otherDeductions,
            TotalDeductionsAndExemptions: totalDeductions,
            NetTaxableIncome: taxable,
            SlabBreakdown: slabs,
            TaxBeforeRebate: tax,
            Section87ARebate: rebate,
            TaxAfterRebate: netTax,
            HealthAndEducationCess: cess,
            TotalAnnualTax: totalAnnualTax,
            EstimatedMonthlyTds: Math.Round(totalAnnualTax / 12m, 0)
        );
    }

    /// <summary>
    /// Computes exact monthly TDS to deduct during payroll execution.
    /// Projects annual taxable gross taking into account actual payrolls already processed in the current FY,
    /// remaining months in the FY, and prior TDS already deducted.
    /// </summary>
    public async Task<(decimal MonthlyTds, decimal AnnualTax, string Regime)> ComputeMonthlyTdsAsync(
        int employeeId,
        int organizationId,
        int year,
        int month,
        decimal currentMonthGross,
        decimal currentMonthBasic,
        decimal currentMonthHra)
    {
        string fy = GetFinancialYear(year, month);

        // 1. Fetch active approved declaration for this FY (if any)
        var declaration = await _db.EmployeeTaxDeclarations
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.EmployeeId == employeeId &&
                                      d.FinancialYear == fy &&
                                      d.Status == "Approved");

        string regime = declaration?.TaxRegime ?? "New";

        // 2. Determine position within Financial Year
        // In India: April (month 4) is FY month 1, March (month 3) is FY month 12
        int fyMonthIndex = month >= 4 ? (month - 3) : (month + 9);
        int remainingMonths = Math.Max(1, 13 - fyMonthIndex);

        // 3. Find prior processed payrolls in this same financial year
        int fyStartYear = month >= 4 ? year : (year - 1);
        int fyEndYear = fyStartYear + 1;
        var startMonthStr = $"{fyStartYear:D4}-04";
        var currentMonthStr = $"{year:D4}-{month:D2}";

        var priorPayrolls = await _db.PayrollMasters
            .AsNoTracking()
            .Where(p => p.EmployeeId == employeeId &&
                        p.OrganizationId == organizationId &&
                        string.Compare(p.Month, startMonthStr) >= 0 &&
                        string.Compare(p.Month, currentMonthStr) < 0 &&
                        p.Status != "Void")
            .ToListAsync();

        decimal priorGross = priorPayrolls.Sum(p => p.TotalEarnings);
        decimal priorTds = priorPayrolls.Sum(p => p.TDS ?? 0m);

        if (declaration?.PreviousEmployerTDS > 0)
        {
            priorTds += declaration.PreviousEmployerTDS;
        }

        decimal priorBasic = 0m;
        decimal priorHra = 0m;
        // Prior details for Basic & HRA if available
        if (priorPayrolls.Any())
        {
            var priorIds = priorPayrolls.Select(p => p.Id).ToList();
            var priorDetails = await _db.PayrollDetails
                .AsNoTracking()
                .Where(d => priorIds.Contains(d.PayrollId))
                .ToListAsync();

            priorBasic = priorDetails
                .Where(d => d.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase))
                .Sum(d => d.Amount);

            priorHra = priorDetails
                .Where(d => d.ComponentName.Contains("HRA", StringComparison.OrdinalIgnoreCase) ||
                            d.ComponentName.Contains("House Rent", StringComparison.OrdinalIgnoreCase))
                .Sum(d => d.Amount);
        }

        // Projected Annual figures
        decimal projectedAnnualGross = priorGross + (currentMonthGross * remainingMonths);
        if (declaration?.PreviousEmployerGross > 0)
        {
            projectedAnnualGross += declaration.PreviousEmployerGross;
        }

        decimal projectedAnnualBasic = priorBasic + (currentMonthBasic * remainingMonths);
        decimal projectedAnnualHra = priorHra + (currentMonthHra * remainingMonths);

        RegimeTaxResult taxResult = regime == "Old"
            ? ComputeOldRegimeTax(projectedAnnualGross, projectedAnnualBasic, projectedAnnualHra, declaration)
            : ComputeNewRegimeTax(projectedAnnualGross, declaration);

        decimal remainingTax = Math.Max(0m, taxResult.TotalAnnualTax - priorTds);
        decimal monthlyTds = Math.Round(remainingTax / remainingMonths, 0);

        return (monthlyTds, taxResult.TotalAnnualTax, regime);
    }
}
