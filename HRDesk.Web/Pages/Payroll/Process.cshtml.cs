using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;

namespace HRDesk.Web.Pages.Payroll
{
    public class ProcessModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly IPayrollService _payrollService;

        public ProcessModel(BiometricAttendanceDbContext context, IPayrollService payrollService)
        {
            _context = context;
            _payrollService = payrollService;
        }

        [BindProperty(SupportsGet = true)]
        public string TargetProcessMonth { get; set; } = DateTime.Now.ToString("yyyy-MM");

        [BindProperty]
        public List<int> EmployeeIdsToProcess { get; set; } = new List<int>();

        [BindProperty]
        public Dictionary<int, string> AdjustmentData { get; set; } = new();

        [BindProperty]
        public bool IncludeLoans { get; set; } = true;

        public class EmployeeListItem
        {
            public int EmployeeId { get; set; }
            public string EmployeeName { get; set; } = "";
            public string Department { get; set; } = "";
            public decimal GrossSalary { get; set; }
            public bool HasSalary { get; set; }
            public bool AlreadyProcessed { get; set; }
            public List<ManualAdjustment> Adjustments { get; set; } = new();
        }

        public PaginatedList<EmployeeListItem> AvailableEmployees { get; set; } = default!;
        public PaginatedList<PayrollMaster> PayrollRecords { get; set; } = default!;
        public string? Message { get; set; }

        public decimal TotalNetPayout { get; set; }
        public int ProcessedCount { get; set; }
        public decimal TotalManualAdjustments { get; set; }
        public decimal TotalManualDeductions { get; set; }

        public async Task OnGetAsync(int pageNum = 1)
        {
            await LoadDataAsync(pageNum);
        }

        public async Task<IActionResult> OnPostProcessSelectedAsync(int pageNum = 1)
        {
            if (EmployeeIdsToProcess == null || !EmployeeIdsToProcess.Any())
            {
                Message = "Please select at least one employee to process";
                await LoadDataAsync(pageNum);
                return Page();
            }

            try
            {
                int successCount = 0;
                foreach (var employeeId in EmployeeIdsToProcess)
                {
                    try
                    {
                        var adjustments = new List<ManualAdjustment>();
                        if (AdjustmentData.ContainsKey(employeeId) && !string.IsNullOrWhiteSpace(AdjustmentData[employeeId]))
                        {
                            adjustments = System.Text.Json.JsonSerializer.Deserialize<List<ManualAdjustment>>(AdjustmentData[employeeId]) ?? new();
                        }

                        await _payrollService.ProcessEmployeePayrollAsync(employeeId, TargetProcessMonth, adjustments, !IncludeLoans);
                        successCount++;
                    }
                    catch (Exception)
                    {
                        continue;
                    }
                }
                Message = $"Successfully processed payroll for {successCount} employee(s)";
            }
            catch (Exception ex)
            {
                Message = $"Error: {ex.Message}";
            }

            await LoadDataAsync(pageNum);
            return Page();
        }

        public async Task<JsonResult> OnGetPayrollDetailsAsync(int id)
        {
            try
            {
                if (id <= 0) return new JsonResult(new List<object>());

                var details = await _context.PayrollDetails
                    .Where(d => d.PayrollId == id)
                    .Select(d => new { d.ComponentName, d.ComponentType, d.Amount, d.Remarks })
                    .ToListAsync();
                
                return new JsonResult(details);
            }
            catch (Exception ex)
            {
                Response.StatusCode = 500;
                return new JsonResult(new { error = ex.Message });
            }
        }

        private async Task LoadDataAsync(int pageNum)
        {
            // Calculate High Level Summaries
            var summaryStats = await _context.PayrollMasters
                .Where(p => p.Month == TargetProcessMonth)
                .GroupBy(p => 1)
                .Select(g => new { TotalNetPayout = g.Sum(x => x.NetSalary), Count = g.Count() })
                .FirstOrDefaultAsync();

            TotalNetPayout = summaryStats?.TotalNetPayout ?? 0;
            ProcessedCount = summaryStats?.Count ?? 0;
            
            // Total manual adjustments (Earnings - Deductions) for the whole month
            var manualAdjStats = await _context.PayrollDetails
                .Where(d => d.PayrollMaster != null && d.PayrollMaster.Month == TargetProcessMonth && d.Remarks == "Manual adjustment")
                .GroupBy(d => d.ComponentType)
                .Select(g => new { Type = g.Key, Total = g.Sum(x => x.Amount) })
                .ToListAsync();

            TotalManualAdjustments = manualAdjStats.Where(x => x.Type == "Earning").Sum(x => x.Total);
            TotalManualDeductions = manualAdjStats.Where(x => x.Type == "Deduction").Sum(x => x.Total);

            // Load available employees: Active staff OR anyone who has records (Attendance or Payroll) for this month
            int targetYear = int.Parse(TargetProcessMonth.Substring(0, 4));
            int targetMonth = int.Parse(TargetProcessMonth.Substring(5, 2));
            var lastDayOfMonth = new DateOnly(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));

            var employeesQuery = _context.Employees
                .Include(e => e.Department)
                .Where(e => ((e.Status == "Active" || e.Status == "active") && (e.JoiningDate == null || e.JoiningDate <= lastDayOfMonth)) || 
                            (_context.DailyAttendance.Any(a => a.EmployeeId == e.EmployeeId && a.RecordDate.Year == targetYear && a.RecordDate.Month == targetMonth && a.Status != "Absent") && (e.LastWorkingDate != null && e.LastWorkingDate >= new DateOnly(targetYear, targetMonth, 1))))
                .OrderBy(e => e.EmployeeName);

            var paginatedEmployees = await PaginatedList<Employee>.CreateAsync(employeesQuery, pageNum, 50);
            
            var employeeIds = paginatedEmployees.Select(e => e.EmployeeId).ToList();
            
            var currentPayrollRecords = await _context.PayrollMasters
                .Where(p => p.Month == TargetProcessMonth && employeeIds.Contains(p.EmployeeId))
                .ToListAsync();
                
            var payrollQuery = _context.PayrollMasters
                .Include(p => p.Employee)
                .Where(p => p.Month == TargetProcessMonth)
                .OrderBy(p => p.Employee!.EmployeeName);
                
            PayrollRecords = await PaginatedList<PayrollMaster>.CreateAsync(payrollQuery, pageNum, 50);
            
            var payrollIds = currentPayrollRecords.Select(p => p.Id).ToList();
            var allManualDetails = await _context.PayrollDetails
                .Where(d => payrollIds.Contains(d.PayrollId) && d.Remarks == "Manual adjustment")
                .ToListAsync();

            var grossSalaries = await _payrollService.GetGrossSalariesBatchAsync(employeeIds, TargetProcessMonth);
            var manualDetailsByPayrollId = allManualDetails.GroupBy(d => d.PayrollId).ToDictionary(g => g.Key, g => g.ToList());

            var employeeListItems = new List<EmployeeListItem>();

            foreach (var emp in paginatedEmployees)
            {
                var grossSalary = grossSalaries.GetValueOrDefault(emp.EmployeeId, 0m);

                var alreadyProcessed = currentPayrollRecords.FirstOrDefault(p => p.EmployeeId == emp.EmployeeId);
                var adjustments = new List<ManualAdjustment>();
                if (alreadyProcessed != null)
                {
                    var details = manualDetailsByPayrollId.GetValueOrDefault(alreadyProcessed.Id, new List<PayrollDetail>());

                    foreach (var detail in details)
                    {
                        adjustments.Add(new ManualAdjustment
                        {
                            Name = detail.ComponentName,
                            Amount = detail.Amount,
                            Type = detail.ComponentType
                        });
                    }
                }

                employeeListItems.Add(new EmployeeListItem
                {
                    EmployeeId = emp.EmployeeId,
                    EmployeeName = emp.EmployeeName,
                    Department = emp.Department?.DepartmentName ?? "",
                    GrossSalary = grossSalary,
                    HasSalary = grossSalary > 0,
                    AlreadyProcessed = alreadyProcessed != null,
                    Adjustments = adjustments
                });
            }
            
            AvailableEmployees = new PaginatedList<EmployeeListItem>(employeeListItems, paginatedEmployees.TotalCount, paginatedEmployees.PageIndex, paginatedEmployees.PageSize);
        }
    }
}
