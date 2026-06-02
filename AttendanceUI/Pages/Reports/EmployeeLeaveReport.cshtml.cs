using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;
using System.ComponentModel.DataAnnotations;

namespace AttendanceUI.Pages.Reports;

public class EmployeeLeaveReportModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly AttendanceSummaryService _summaryService;

    public EmployeeLeaveReportModel(BiometricAttendanceDbContext context, AttendanceSummaryService summaryService)
    {
        _context = context;
        _summaryService = summaryService;
    }

    [BindProperty(SupportsGet = true)]
    public DateOnly? StartDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public DateOnly? EndDate { get; set; }

    public List<EmployeeLeaveData> ReportData { get; set; } = new();

    public async Task OnGetAsync()
    {
        // Default to current month if not provided
        if (!StartDate.HasValue || !EndDate.HasValue)
        {
            var today = DateTime.Today;
            StartDate = new DateOnly(today.Year, today.Month, 1);
            EndDate = StartDate.Value.AddMonths(1).AddDays(-1);
        }

        var sDate = StartDate.Value;
        var eDate = EndDate.Value;

        var allActiveEmployees = await _context.Employees
            .Include(e => e.Department)
            .Where(e => e.Status == "active")
            .ToListAsync();

        var leaveApps = await _context.LeaveApplications
            .Include(la => la.LeaveType)
            .Where(la => (la.Status == "Approved" || la.Status == "Adjusted") &&
                         la.StartDate <= eDate && la.EndDate >= sDate)
            .ToListAsync();

        foreach (var emp in allActiveEmployees)
        {
            var empLeaves = leaveApps.Where(l => l.EmployeeId == emp.EmployeeId).ToList();
            if (empLeaves.Any())
            {
                decimal totalPaid = empLeaves.Where(l => l.LeaveType != null && l.LeaveType.IsPaid).Sum(l => l.TotalDays);
                decimal totalUnpaid = empLeaves.Where(l => l.LeaveType == null || !l.LeaveType.IsPaid).Sum(l => l.TotalDays);
                
                var breakdownDict = empLeaves
                    .Where(l => l.LeaveType != null)
                    .GroupBy(l => l.LeaveType.Code)
                    .ToDictionary(g => g.Key, g => g.Sum(l => l.TotalDays));
                    
                var breakdown = string.Join(", ", breakdownDict.Select(x => $"{x.Key}: {x.Value}"));

                ReportData.Add(new EmployeeLeaveData
                {
                    EmployeeId = emp.EmployeeId,
                    EmployeeName = emp.EmployeeName,
                    Department = emp.Department?.DepartmentName ?? "N/A",
                    TotalPaidLeaves = totalPaid,
                    TotalUnpaidLeaves = totalUnpaid,
                    Breakdown = breakdown
                });
            }
        }
        
        ReportData = ReportData.OrderBy(r => r.Department).ThenBy(r => r.EmployeeName).ToList();
    }

    public class EmployeeLeaveData
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = "";
        public string Department { get; set; } = "";
        public decimal TotalPaidLeaves { get; set; }
        public decimal TotalUnpaidLeaves { get; set; }
        public string Breakdown { get; set; } = "";
    }
}
