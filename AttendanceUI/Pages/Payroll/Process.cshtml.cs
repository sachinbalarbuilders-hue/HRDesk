using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;
using AttendanceUI.Services;

namespace AttendanceUI.Pages.Payroll
{
    public class ProcessModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly PayrollService _payrollService;

        public ProcessModel(BiometricAttendanceDbContext context, PayrollService payrollService)
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

        public IList<EmployeeListItem> AvailableEmployees { get; set; } = default!;
        public IList<PayrollMaster> PayrollRecords { get; set; } = default!;
        public string? Message { get; set; }

        public decimal TotalNetPayout { get; set; }
        public int ProcessedCount { get; set; }
        public decimal TotalManualAdjustments { get; set; }
        public decimal TotalManualDeductions { get; set; }

        public async Task OnGetAsync()
        {
            await LoadDataAsync();
        }

        public async Task<IActionResult> OnPostProcessSelectedAsync()
        {
            if (EmployeeIdsToProcess == null || !EmployeeIdsToProcess.Any())
            {
                Message = "Please select at least one employee to process";
                await LoadDataAsync();
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

            await LoadDataAsync();
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

        private async Task LoadDataAsync()
        {
            // Load existing payroll records
            PayrollRecords = await _context.PayrollMasters
                .Include(p => p.Employee)
                .Where(p => p.Month == TargetProcessMonth)
                .OrderBy(p => p.Employee!.EmployeeName)
                .ToListAsync();

            // Calculate High Level Summaries
            TotalNetPayout = PayrollRecords.Sum(p => p.NetSalary);
            ProcessedCount = PayrollRecords.Count;
            
            // Total manual adjustments (Earnings - Deductions) from the PayrollDetails
            var payrollIds = PayrollRecords.Select(p => p.Id).ToList();
            var allManualDetails = await _context.PayrollDetails
                .Where(d => payrollIds.Contains(d.PayrollId) && d.Remarks == "Manual adjustment")
                .ToListAsync();

            TotalManualAdjustments = allManualDetails
                .Where(d => d.ComponentType == "Earning").Sum(d => d.Amount);
            
            TotalManualDeductions = allManualDetails
                .Where(d => d.ComponentType == "Deduction").Sum(d => d.Amount);

            // Load available employees: Active staff OR anyone who has records (Attendance or Payroll) for this month
            int targetYear = int.Parse(TargetProcessMonth.Substring(0, 4));
            int targetMonth = int.Parse(TargetProcessMonth.Substring(5, 2));

            var employees = await _context.Employees
                .Include(e => e.Department)
                .Where(e => e.Status == "active" || e.Status == "Active" ||
                            _context.DailyAttendance.Any(a => a.EmployeeId == e.EmployeeId && a.RecordDate.Year == targetYear && a.RecordDate.Month == targetMonth) ||
                            _context.PayrollMasters.Any(p => p.EmployeeId == e.EmployeeId && p.Month == TargetProcessMonth))
                .ToListAsync();

            AvailableEmployees = new List<EmployeeListItem>();

            foreach (var emp in employees)
            {
                // Correct Gross Salary Logic: Only sum Earning components
                var salaryStructure = await _context.EmployeeSalaryStructures
                    .Include(s => s.SalaryComponent)
                    .Where(s => s.EmployeeId == emp.EmployeeId && s.IsActive)
                    .ToListAsync();

                var grossSalary = salaryStructure
                    .Where(s => s.SalaryComponent?.ComponentType == "Earning")
                    .Sum(s => s.Amount);

                var alreadyProcessed = PayrollRecords.FirstOrDefault(p => p.EmployeeId == emp.EmployeeId);
                var adjustments = new List<ManualAdjustment>();
                if (alreadyProcessed != null)
                {
                    var details = await _context.PayrollDetails
                        .Where(d => d.PayrollId == alreadyProcessed.Id && d.Remarks == "Manual adjustment")
                        .ToListAsync();

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

                AvailableEmployees.Add(new EmployeeListItem
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
        }
    }
}
