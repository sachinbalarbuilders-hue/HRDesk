using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Payroll;

public sealed class StatutoryService : IStatutoryService
{
    private readonly BiometricAttendanceDbContext _db;

    public StatutoryService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public PfCalculationResult CalculatePf(Employee employee, decimal earnedBasic)
    {
        if (!employee.IsPfEligible || earnedBasic <= 0)
        {
            return new PfCalculationResult(0, 0, 0, 0, 0, 0);
        }

        // Standard statutory wage cap is ₹15,000 basic in India
        decimal wageLimit = employee.PfWageCap ? 15000m : decimal.MaxValue;
        decimal pfWages = Math.Round(Math.Min(earnedBasic, wageLimit), 2);

        // Employee Share: 12% rounded to nearest rupee (EPFO convention)
        decimal eePf = Math.Round(pfWages * 0.12m, 0, MidpointRounding.AwayFromZero);

        // Employer Share: Total 12% split into EPS (8.33% max ₹1,250) + EPF (remaining ~3.67%)
        decimal epsWages = Math.Min(pfWages, 15000m);
        decimal erEps = Math.Min(1250m, Math.Round(epsWages * 0.0833m, 0, MidpointRounding.AwayFromZero));
        decimal erEpf = Math.Max(0m, eePf - erEps);

        // Employer statutory administrative / insurance contributions
        decimal erEdli = Math.Round(epsWages * 0.005m, 0, MidpointRounding.AwayFromZero);
        decimal erAdmin = Math.Round(pfWages * 0.005m, 0, MidpointRounding.AwayFromZero);

        return new PfCalculationResult(pfWages, eePf, erEps, erEpf, erEdli, erAdmin);
    }

    public EsicCalculationResult CalculateEsic(Employee employee, decimal earnedGross, decimal fullMonthlyGross)
    {
        // ESIC Statutory wage ceiling: Gross wage <= ₹21,000 / month
        if (!employee.IsEsicEligible || fullMonthlyGross > 21000m || earnedGross <= 0)
        {
            return new EsicCalculationResult(0, 0, 0, false);
        }

        decimal esicWages = Math.Round(earnedGross, 2);

        // ESIC Act: Contributions rounded up to next higher rupee
        decimal eeEsic = Math.Ceiling(esicWages * 0.0075m);
        decimal erEsic = Math.Ceiling(esicWages * 0.0325m);

        return new EsicCalculationResult(esicWages, eeEsic, erEsic, true);
    }

    public PtCalculationResult CalculatePt(Employee employee, decimal earnedGross)
    {
        if (!employee.IsPtEligible || earnedGross <= 0)
        {
            return new PtCalculationResult(earnedGross, 0);
        }

        // Gujarat Professional Tax slabs (Monthly)
        decimal ptAmount = 0m;
        if (earnedGross >= 12000m)
        {
            ptAmount = 200m;
        }
        else if (earnedGross >= 9000m)
        {
            ptAmount = 150m;
        }
        else if (earnedGross >= 6000m)
        {
            ptAmount = 80m;
        }
        else
        {
            ptAmount = 0m;
        }

        return new PtCalculationResult(earnedGross, ptAmount);
    }

    public async Task<List<EcrMemberRecord>> GetEcrRecordsAsync(string month, int? payGroupId = null)
    {
        var query = _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
                .ThenInclude(e => e!.PayGroup)
            .Where(p => p.Month == month && p.EmployeePf > 0);

        if (payGroupId.HasValue && payGroupId.Value > 0)
        {
            query = query.Where(p => p.Employee != null && p.Employee.PayGroupId == payGroupId.Value);
        }

        var records = await query
            .OrderBy(p => p.Employee != null ? p.Employee.EmployeeName : "")
            .ToListAsync();

        return records.Select(p =>
        {
            var emp = p.Employee;
            var uan = !string.IsNullOrWhiteSpace(emp?.UanNumber) 
                ? emp.UanNumber 
                : (!string.IsNullOrWhiteSpace(emp?.PfNumber) ? emp.PfNumber : $"UAN{p.EmployeeId:D10}");

            var epsWages = Math.Min(p.PfWages, 15000m);

            return new EcrMemberRecord
            {
                Uan = uan,
                MemberName = emp?.EmployeeName?.ToUpper() ?? $"EMPLOYEE {p.EmployeeId}",
                GrossWages = Math.Round(p.TotalEarnings, 0),
                EpfWages = Math.Round(p.PfWages, 0),
                EpsWages = Math.Round(epsWages, 0),
                EdliWages = Math.Round(epsWages, 0),
                EeShare = Math.Round(p.EmployeePf, 0),
                ErEpsShare = Math.Round(p.EmployerEps, 0),
                ErEpfShare = Math.Round(p.EmployerEpf, 0),
                NcpDays = (int)Math.Round(p.UnpaidLeaves, 0),
                RefundOfAdvances = 0
            };
        }).ToList();
    }

    public async Task<string> GenerateEcrTextFileAsync(string month, int? payGroupId = null)
    {
        var records = await GetEcrRecordsAsync(month, payGroupId);
        var sb = new StringBuilder();

        foreach (var r in records)
        {
            // Official EPFO ECR specification: 11 fields separated by #~#
            // 1. UAN
            // 2. Member Name
            // 3. Gross Wages
            // 4. EPF Wages
            // 5. EPS Wages
            // 6. EDLI Wages
            // 7. EE Share (12%)
            // 8. EPS Share (8.33%)
            // 9. ER Share EPF (3.67%)
            // 10. NCP Days (Loss of pay days)
            // 11. Refund of Advances
            sb.AppendLine($"{r.Uan}#~#{r.MemberName}#~#{r.GrossWages:0}#~#{r.EpfWages:0}#~#{r.EpsWages:0}#~#{r.EdliWages:0}#~#{r.EeShare:0}#~#{r.ErEpsShare:0}#~#{r.ErEpfShare:0}#~#{r.NcpDays}#~#{r.RefundOfAdvances:0}");
        }

        return sb.ToString();
    }

    public async Task<List<EsicReturnRecord>> GetEsicRecordsAsync(string month, int? payGroupId = null)
    {
        var query = _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.EmployeeEsic > 0);

        if (payGroupId.HasValue && payGroupId.Value > 0)
        {
            query = query.Where(p => p.Employee != null && p.Employee.PayGroupId == payGroupId.Value);
        }

        var records = await query
            .OrderBy(p => p.Employee != null ? p.Employee.EmployeeName : "")
            .ToListAsync();

        return records.Select(p =>
        {
            var emp = p.Employee;
            var ip = !string.IsNullOrWhiteSpace(emp?.EsicNumber) ? emp.EsicNumber : $"IP{p.EmployeeId:D10}";
            return new EsicReturnRecord
            {
                IpNumber = ip,
                IpName = emp?.EmployeeName?.ToUpper() ?? $"EMPLOYEE {p.EmployeeId}",
                PaidDays = (int)Math.Round(p.PayableDays, 0),
                TotalWages = p.EsicWages,
                EmployeeContribution = p.EmployeeEsic,
                EmployerContribution = p.EmployerEsic,
                ReasonCode = "0"
            };
        }).ToList();
    }

    public async Task<PtSummaryReport> GetPtSummaryAsync(string month, int? payGroupId = null)
    {
        var query = _db.PayrollMasters
            .AsNoTracking()
            .Include(p => p.Employee)
            .Where(p => p.Month == month && p.ProfessionalTax > 0);

        if (payGroupId.HasValue && payGroupId.Value > 0)
        {
            query = query.Where(p => p.Employee != null && p.Employee.PayGroupId == payGroupId.Value);
        }

        var records = await query.ToListAsync();

        var report = new PtSummaryReport
        {
            Month = month,
            TotalEmployees = records.Count,
            TotalGrossWages = records.Sum(r => r.GrossSalary),
            TotalTaxPayable = records.Sum(r => r.ProfessionalTax)
        };

        var slab200 = records.Count(r => r.ProfessionalTax == 200m);
        var slab150 = records.Count(r => r.ProfessionalTax == 150m);
        var slab80 = records.Count(r => r.ProfessionalTax == 80m);

        if (slab200 > 0)
        {
            report.Slabs.Add(new PtSummaryRecord
            {
                SlabDescription = "Gross Salary >= ₹12,000",
                RatePerEmployee = 200m,
                EmployeeCount = slab200,
                TotalTaxAmount = slab200 * 200m
            });
        }

        if (slab150 > 0)
        {
            report.Slabs.Add(new PtSummaryRecord
            {
                SlabDescription = "Gross Salary ₹9,000 – ₹11,999",
                RatePerEmployee = 150m,
                EmployeeCount = slab150,
                TotalTaxAmount = slab150 * 150m
            });
        }

        if (slab80 > 0)
        {
            report.Slabs.Add(new PtSummaryRecord
            {
                SlabDescription = "Gross Salary ₹6,000 – ₹8,999",
                RatePerEmployee = 80m,
                EmployeeCount = slab80,
                TotalTaxAmount = slab80 * 80m
            });
        }

        return report;
    }
}
