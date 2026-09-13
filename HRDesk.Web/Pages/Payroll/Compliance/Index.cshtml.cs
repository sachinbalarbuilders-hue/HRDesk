using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services.Payroll;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Payroll.Compliance;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IStatutoryService _statutoryService;

    public IndexModel(BiometricAttendanceDbContext db, IStatutoryService statutoryService)
    {
        _db = db;
        _statutoryService = statutoryService;
    }

    [BindProperty(SupportsGet = true)]
    public string Month { get; set; } = "";

    [BindProperty(SupportsGet = true)]
    public int? PayGroupId { get; set; }

    [BindProperty(SupportsGet = true)]
    public string ActiveTab { get; set; } = "ecr";

    public List<SelectListItem> MonthOptions { get; set; } = new();
    public SelectList PayGroupOptions { get; set; } = default!;

    public List<EcrMemberRecord> EcrRecords { get; set; } = new();
    public decimal TotalEcrGross => EcrRecords.Sum(r => r.GrossWages);
    public decimal TotalEcrEpfWages => EcrRecords.Sum(r => r.EpfWages);
    public decimal TotalEcrEeShare => EcrRecords.Sum(r => r.EeShare);
    public decimal TotalEcrErEps => EcrRecords.Sum(r => r.ErEpsShare);
    public decimal TotalEcrErEpf => EcrRecords.Sum(r => r.ErEpfShare);
    public decimal TotalEcrRemittance => TotalEcrEeShare + TotalEcrErEps + TotalEcrErEpf;

    public List<EsicReturnRecord> EsicRecords { get; set; } = new();
    public decimal TotalEsicWages => EsicRecords.Sum(r => r.TotalWages);
    public decimal TotalEsicEeShare => EsicRecords.Sum(r => r.EmployeeContribution);
    public decimal TotalEsicErShare => EsicRecords.Sum(r => r.EmployerContribution);
    public decimal TotalEsicRemittance => TotalEsicEeShare + TotalEsicErShare;

    public PtSummaryReport PtReport { get; set; } = new();

    public async Task OnGetAsync()
    {
        await LoadFiltersAsync();

        if (string.IsNullOrWhiteSpace(Month))
        {
            Month = MonthOptions.FirstOrDefault()?.Value ?? DateTime.Today.ToString("yyyy-MM");
        }

        EcrRecords = await _statutoryService.GetEcrRecordsAsync(Month, PayGroupId);
        EsicRecords = await _statutoryService.GetEsicRecordsAsync(Month, PayGroupId);
        PtReport = await _statutoryService.GetPtSummaryAsync(Month, PayGroupId);
    }

    public async Task<IActionResult> OnGetDownloadEcrAsync(string month, int? payGroupId)
    {
        if (string.IsNullOrWhiteSpace(month))
        {
            month = DateTime.Today.ToString("yyyy-MM");
        }

        var ecrText = await _statutoryService.GenerateEcrTextFileAsync(month, payGroupId);
        var bytes = Encoding.UTF8.GetBytes(ecrText);
        var fileName = $"ECR_{month.Replace("-", "")}_{DateTime.Now:yyyyMMddHHmmss}.txt";

        return File(bytes, "text/plain", fileName);
    }

    public async Task<IActionResult> OnGetDownloadEsicCsvAsync(string month, int? payGroupId)
    {
        if (string.IsNullOrWhiteSpace(month))
        {
            month = DateTime.Today.ToString("yyyy-MM");
        }

        var records = await _statutoryService.GetEsicRecordsAsync(month, payGroupId);
        var sb = new StringBuilder();
        sb.AppendLine("IP Number,IP Name,No of Days for which wages paid,Total Monthly Wages,Employee Contribution,Employer Contribution,Reason Code");

        foreach (var r in records)
        {
            sb.AppendLine($"\"{r.IpNumber}\",\"{r.IpName}\",{r.PaidDays},{r.TotalWages:0.00},{r.EmployeeContribution:0.00},{r.EmployerContribution:0.00},{r.ReasonCode}");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"ESIC_MonthlyReturn_{month.Replace("-", "")}_{DateTime.Now:yyyyMMddHHmmss}.csv";

        return File(bytes, "text/csv", fileName);
    }

    private async Task LoadFiltersAsync()
    {
        var distinctMonths = await _db.PayrollMasters
            .Select(p => p.Month)
            .Distinct()
            .OrderByDescending(m => m)
            .ToListAsync();

        if (!distinctMonths.Any())
        {
            distinctMonths.Add(DateTime.Today.ToString("yyyy-MM"));
            distinctMonths.Add(DateTime.Today.AddMonths(-1).ToString("yyyy-MM"));
        }

        MonthOptions = distinctMonths.Select(m =>
        {
            if (DateTime.TryParse(m + "-01", out var dt))
            {
                return new SelectListItem { Value = m, Text = dt.ToString("MMMM yyyy") };
            }
            return new SelectListItem { Value = m, Text = m };
        }).ToList();

        var payGroups = await _db.PayGroups
            .AsNoTracking()
            .Where(p => p.Status == "active")
            .OrderBy(p => p.Name)
            .ToListAsync();

        PayGroupOptions = new SelectList(payGroups, nameof(PayGroup.Id), nameof(PayGroup.Name));
    }
}
