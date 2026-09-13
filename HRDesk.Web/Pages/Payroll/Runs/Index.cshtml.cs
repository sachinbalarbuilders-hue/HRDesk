using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Payroll.Runs;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public IndexModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    [BindProperty(SupportsGet = true)]
    public string? TargetMonth { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? PayGroupId { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? StatusFilter { get; set; }

    public List<PayrollRun> Runs { get; private set; } = new();
    public List<PayGroup> PayGroups { get; private set; } = new();

    public int TotalRunsCount { get; private set; }
    public decimal TotalNetDisbursed { get; private set; }
    public int TotalPendingApproval { get; private set; }
    public int TotalApproved { get; private set; }

    public IActionResult OnGet()
    {
        return RedirectToPage("/Payroll/Process", new {
            ActiveTab = "history",
            HistoryMonth = TargetMonth,
            HistoryPayGroupId = PayGroupId,
            HistoryStatusFilter = StatusFilter
        });
    }
}
