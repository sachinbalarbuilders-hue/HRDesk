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

        [BindProperty(SupportsGet = true)]
        public int? SelectedPayGroupId { get; set; }

        [BindProperty(SupportsGet = true)]
        public int? SelectedDepartmentId { get; set; }

        [BindProperty]
        public List<int> EmployeeIdsToProcess { get; set; } = new List<int>();

        public Dictionary<int, string> AdjustmentData { get; set; } = new();

        [BindProperty]
        public bool IncludeLoans { get; set; } = true;

        [TempData]
        public string? StatusMessage { get; set; }

        [BindProperty(SupportsGet = true)]
        public string ActiveTab { get; set; } = "worksheet";

        // Runs & Audit Register tab properties
        [BindProperty(SupportsGet = true)]
        public string? HistoryMonth { get; set; }

        [BindProperty(SupportsGet = true)]
        public int? HistoryPayGroupId { get; set; }

        [BindProperty(SupportsGet = true)]
        public string? HistoryStatusFilter { get; set; }

        public List<PayrollRun> HistoricalRuns { get; set; } = new();
        public int TotalRunsCount { get; set; }
        public decimal TotalNetDisbursed { get; set; }
        public int TotalPendingApproval { get; set; }
        public int TotalApproved { get; set; }

        public class PayGroupSummaryDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string Code { get; set; } = "";
            public string Status { get; set; } = "Draft";
            public int TotalEmployees { get; set; }
            public int ProcessedCount { get; set; }
            public decimal TotalNetPayout { get; set; }
        }

        public List<PayGroupSummaryDto> PayGroupsList { get; set; } = new();
        public List<Department> DepartmentsList { get; set; } = new();
        public PayrollRun? CurrentCohortRun { get; set; }
        public bool IsCurrentCohortLocked => CurrentCohortRun != null && (CurrentCohortRun.Status == "Approved" || CurrentCohortRun.Status == "Paid");

        public class EmployeeListItem
        {
            public int EmployeeId { get; set; }
            public string EmployeeName { get; set; } = "";
            public string Department { get; set; } = "";
            public string PayGroupName { get; set; } = "";
            public int? PayGroupId { get; set; }
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
                if (Request.Form.ContainsKey("EmployeeIdsToProcess"))
                {
                    EmployeeIdsToProcess = Request.Form["EmployeeIdsToProcess"]
                        .Select(s => int.TryParse(s, out int id) ? id : 0)
                        .Where(id => id > 0)
                        .ToList();
                }
            }

            if (EmployeeIdsToProcess == null || !EmployeeIdsToProcess.Any())
            {
                Message = "Please select at least one employee to process";
                await LoadDataAsync(pageNum);
                return Page();
            }

            try
            {
                AdjustmentData = new Dictionary<int, string>();
                foreach (var key in Request.Form.Keys)
                {
                    if (key.StartsWith("AdjustmentData[") && key.EndsWith("]"))
                    {
                        var idStr = key.Substring(15, key.Length - 16);
                        if (int.TryParse(idStr, out int empId))
                        {
                            AdjustmentData[empId] = Request.Form[key].ToString();
                        }
                    }
                }

                var allAdjustments = new Dictionary<int, List<ManualAdjustment>>();
                foreach (var employeeId in EmployeeIdsToProcess)
                {
                    if (AdjustmentData.ContainsKey(employeeId) && !string.IsNullOrWhiteSpace(AdjustmentData[employeeId]))
                    {
                        allAdjustments[employeeId] = System.Text.Json.JsonSerializer.Deserialize<List<ManualAdjustment>>(AdjustmentData[employeeId]) ?? new();
                    }
                }

                int successCount = await _payrollService.ProcessBulkEmployeePayrollAsync(EmployeeIdsToProcess, TargetProcessMonth, allAdjustments, !IncludeLoans);
                StatusMessage = $"Successfully processed payroll for {successCount} employee(s)";
                return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId, SelectedDepartmentId, pageNum });
            }
            catch (Exception ex)
            {
                Message = $"Error: {ex.Message}";
                await LoadDataAsync(pageNum);
                return Page();
            }
        }

        public async Task<IActionResult> OnPostProcessPayGroupAsync(int payGroupId, int pageNum = 1)
        {
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");

            SelectedPayGroupId = payGroupId;

            if (payGroupId <= 0)
            {
                StatusMessage = "Please select a valid Pay Group to process.";
                return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId, pageNum });
            }

            try
            {
                int targetYear = int.Parse(TargetProcessMonth.Substring(0, 4));
                int targetMonth = int.Parse(TargetProcessMonth.Substring(5, 2));
                var lastDayOfMonth = new DateOnly(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));

                var empIds = await _context.Employees
                    .AsNoTracking()
                    .Where(e => e.PayGroupId == payGroupId &&
                                (e.Status == "Active" || e.Status == "active") &&
                                (e.JoiningDate == null || e.JoiningDate <= lastDayOfMonth))
                    .Select(e => e.EmployeeId)
                    .ToListAsync();

                if (!empIds.Any())
                {
                    StatusMessage = "No eligible employees found in the selected Pay Group for this month.";
                    return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId, pageNum });
                }

                int successCount = await _payrollService.ProcessBulkEmployeePayrollAsync(empIds, TargetProcessMonth, new(), !IncludeLoans);
                var group = await _context.PayGroups.FindAsync(payGroupId);
                StatusMessage = $"Successfully processed payroll for {successCount} employee(s) in {group?.Name ?? "cohort"}";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error processing Pay Group: {ex.Message}";
            }

            return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId, pageNum });
        }

        public async Task<IActionResult> OnPostSubmitRunAsync(int payGroupId, string? notes, int pageNum = 1)
        {
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");

            SelectedPayGroupId = payGroupId;

            try
            {
                var run = await _payrollService.SubmitPayrollRunAsync(payGroupId, TargetProcessMonth, User?.Identity?.Name ?? "HR Admin", notes);
                StatusMessage = $"Payroll run for {run.PayGroup?.Name ?? "cohort"} submitted for review.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error submitting run: {ex.Message}";
            }

            return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId = payGroupId, pageNum });
        }

        public async Task<IActionResult> OnPostApproveRunAsync(int payGroupId, string? notes, int pageNum = 1)
        {
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");

            SelectedPayGroupId = payGroupId;

            try
            {
                var run = await _payrollService.ApprovePayrollRunAsync(payGroupId, TargetProcessMonth, User?.Identity?.Name ?? "Management", notes);
                StatusMessage = $"Payroll run for {run.PayGroup?.Name ?? "cohort"} approved and locked.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error approving run: {ex.Message}";
            }

            return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId = payGroupId, pageNum });
        }

        public async Task<IActionResult> OnPostMarkPaidRunAsync(int payGroupId, string paymentMethod, string? paymentReference, string? paymentDate, string? notes, int pageNum = 1)
        {
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");

            SelectedPayGroupId = payGroupId;

            try
            {
                DateOnly pDate = DateOnly.TryParse(paymentDate, out var parsed) ? parsed : DateOnly.FromDateTime(DateTime.Now);
                var run = await _payrollService.MarkPayrollRunPaidAsync(payGroupId, TargetProcessMonth, User?.Identity?.Name ?? "Accounts", paymentMethod, paymentReference, pDate, notes);
                StatusMessage = $"Payroll run for {run.PayGroup?.Name ?? "cohort"} marked as Paid & Disbursed.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error recording payout: {ex.Message}";
            }

            return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId = payGroupId, pageNum });
        }

        public async Task<IActionResult> OnPostUnlockRunAsync(int payGroupId, string reason, int pageNum = 1)
        {
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");

            SelectedPayGroupId = payGroupId;

            try
            {
                if (string.IsNullOrWhiteSpace(reason)) reason = "Unlocked by administrator";
                var run = await _payrollService.UnlockPayrollRunAsync(payGroupId, TargetProcessMonth, User?.Identity?.Name ?? "SuperAdmin", reason);
                StatusMessage = $"Payroll run for {run.PayGroup?.Name ?? "cohort"} unlocked and reverted to Draft.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error unlocking run: {ex.Message}";
            }

            return RedirectToPage(new { TargetProcessMonth, SelectedPayGroupId = payGroupId, pageNum });
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
            if (string.IsNullOrWhiteSpace(TargetProcessMonth) || TargetProcessMonth.Length < 7)
            {
                TargetProcessMonth = DateTime.Now.ToString("yyyy-MM");
            }

            // Calculate High Level Summaries
            var summaryStats = await _context.PayrollMasters
                .AsNoTracking()
                .Where(p => p.Month == TargetProcessMonth)
                .GroupBy(p => 1)
                .Select(g => new { TotalNetPayout = g.Sum(x => x.NetSalary), Count = g.Count() })
                .FirstOrDefaultAsync();

            TotalNetPayout = summaryStats?.TotalNetPayout ?? 0;
            ProcessedCount = summaryStats?.Count ?? 0;
            
            // Total manual adjustments (Earnings - Deductions) for the whole month
            var manualAdjStats = await _context.PayrollDetails
                .AsNoTracking()
                .Where(d => d.PayrollMaster != null && d.PayrollMaster.Month == TargetProcessMonth && d.Remarks == "Manual adjustment")
                .GroupBy(d => d.ComponentType)
                .Select(g => new { Type = g.Key, Total = g.Sum(x => x.Amount) })
                .ToListAsync();

            TotalManualAdjustments = manualAdjStats.Where(x => x.Type == "Earning").Sum(x => x.Total);
            TotalManualDeductions = manualAdjStats.Where(x => x.Type == "Deduction").Sum(x => x.Total);

            // Load Pay Groups with Cohort Statistics for the target month
            var allPayGroups = await _context.PayGroups
                .AsNoTracking()
                .Where(p => p.Status == "active")
                .OrderBy(p => p.Name)
                .ToListAsync();

            var activeEmployees = await _context.Employees
                .AsNoTracking()
                .Where(e => (e.Status == "Active" || e.Status == "active"))
                .Select(e => new { e.EmployeeId, e.PayGroupId })
                .ToListAsync();

            var processedInMonth = await _context.PayrollMasters
                .AsNoTracking()
                .Include(p => p.Employee)
                .Where(p => p.Month == TargetProcessMonth)
                .Select(p => new { p.EmployeeId, PayGroupId = p.Employee != null ? p.Employee.PayGroupId : (int?)null, p.NetSalary })
                .ToListAsync();

            var existingRuns = await _context.PayrollRuns
                .AsNoTracking()
                .Where(r => r.Month == TargetProcessMonth)
                .ToDictionaryAsync(r => r.PayGroupId);

            PayGroupsList = allPayGroups.Select(pg => new PayGroupSummaryDto
            {
                Id = pg.Id,
                Name = pg.Name,
                Code = pg.Code,
                Status = existingRuns.TryGetValue(pg.Id, out var r) ? r.Status : (processedInMonth.Any(p => p.PayGroupId == pg.Id) ? "Draft" : "Not Started"),
                TotalEmployees = activeEmployees.Count(e => e.PayGroupId == pg.Id),
                ProcessedCount = processedInMonth.Count(p => p.PayGroupId == pg.Id),
                TotalNetPayout = processedInMonth.Where(p => p.PayGroupId == pg.Id).Sum(p => p.NetSalary)
            }).ToList();

            if (SelectedPayGroupId.HasValue && SelectedPayGroupId.Value > 0)
            {
                CurrentCohortRun = await _payrollService.GetOrCreatePayrollRunAsync(SelectedPayGroupId.Value, TargetProcessMonth);
            }

            // Load Departments for filtering
            DepartmentsList = await _context.Departments
                .AsNoTracking()
                .Where(d => d.Status == "active")
                .OrderBy(d => d.DepartmentName)
                .ToListAsync();

            // Load available employees: Active staff OR anyone who has records (Attendance or Payroll) for this month
            int targetYear = int.Parse(TargetProcessMonth.Substring(0, 4));
            int targetMonth = int.Parse(TargetProcessMonth.Substring(5, 2));
            var startOfMonth = new DateOnly(targetYear, targetMonth, 1);
            var lastDayOfMonth = new DateOnly(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));

            var employeesQuery = _context.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .Include(e => e.PayGroup)
                .Where(e => ((e.Status == "Active" || e.Status == "active") && (e.JoiningDate == null || e.JoiningDate <= lastDayOfMonth)) || 
                            ((e.LastWorkingDate != null && e.LastWorkingDate >= startOfMonth) &&
                             _context.DailyAttendance.Any(a => a.EmployeeId == e.EmployeeId && a.RecordDate >= startOfMonth && a.RecordDate <= lastDayOfMonth && a.Status != "Absent")));

            // Apply Pay Group Filter
            if (SelectedPayGroupId.HasValue && SelectedPayGroupId.Value > 0)
            {
                employeesQuery = employeesQuery.Where(e => e.PayGroupId == SelectedPayGroupId.Value);
            }

            // Apply Department Filter
            if (SelectedDepartmentId.HasValue && SelectedDepartmentId.Value > 0)
            {
                employeesQuery = employeesQuery.Where(e => e.DepartmentId == SelectedDepartmentId.Value);
            }

            employeesQuery = employeesQuery.OrderBy(e => e.EmployeeName);

            var paginatedEmployees = await PaginatedList<Employee>.CreateAsync(employeesQuery, pageNum, 50);
            
            var employeeIds = paginatedEmployees.Select(e => e.EmployeeId).ToList();
            
            var currentPayrollRecords = await _context.PayrollMasters
                .AsNoTracking()
                .Where(p => p.Month == TargetProcessMonth && employeeIds.Contains(p.EmployeeId))
                .ToListAsync();
                
            var payrollQuery = _context.PayrollMasters
                .AsNoTracking()
                .Include(p => p.Employee)
                    .ThenInclude(e => e!.Department)
                .Include(p => p.Employee)
                    .ThenInclude(e => e!.PayGroup)
                .Where(p => p.Month == TargetProcessMonth);

            if (SelectedPayGroupId.HasValue && SelectedPayGroupId.Value > 0)
            {
                payrollQuery = payrollQuery.Where(p => p.Employee != null && p.Employee.PayGroupId == SelectedPayGroupId.Value);
            }

            if (SelectedDepartmentId.HasValue && SelectedDepartmentId.Value > 0)
            {
                payrollQuery = payrollQuery.Where(p => p.Employee != null && p.Employee.DepartmentId == SelectedDepartmentId.Value);
            }
                
            PayrollRecords = await PaginatedList<PayrollMaster>.CreateAsync(payrollQuery.OrderBy(p => p.Employee!.EmployeeName), pageNum, 50);
            
            var payrollIds = currentPayrollRecords.Select(p => p.Id).ToList();
            var allManualDetails = await _context.PayrollDetails
                .AsNoTracking()
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
                    PayGroupName = emp.PayGroup?.Name ?? "Unassigned",
                    PayGroupId = emp.PayGroupId,
                    GrossSalary = grossSalary,
                    HasSalary = grossSalary > 0,
                    AlreadyProcessed = alreadyProcessed != null,
                    Adjustments = adjustments
                });
            }
            
            AvailableEmployees = new PaginatedList<EmployeeListItem>(employeeListItems, paginatedEmployees.TotalCount, paginatedEmployees.PageIndex, paginatedEmployees.PageSize);

            // Load Historical Runs for Runs & Audit Register tab
            var runsQuery = _context.PayrollRuns
                .AsNoTracking()
                .Include(r => r.PayGroup)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(HistoryMonth))
            {
                runsQuery = runsQuery.Where(r => r.Month == HistoryMonth);
            }

            if (HistoryPayGroupId.HasValue && HistoryPayGroupId.Value > 0)
            {
                runsQuery = runsQuery.Where(r => r.PayGroupId == HistoryPayGroupId.Value);
            }

            if (!string.IsNullOrWhiteSpace(HistoryStatusFilter) && HistoryStatusFilter != "all")
            {
                runsQuery = runsQuery.Where(r => r.Status == HistoryStatusFilter);
            }

            HistoricalRuns = await runsQuery
                .OrderByDescending(r => r.Month)
                .ThenBy(r => r.PayGroup != null ? r.PayGroup.Name : "")
                .ToListAsync();

            TotalRunsCount = HistoricalRuns.Count;
            TotalNetDisbursed = HistoricalRuns.Where(r => r.Status == "Paid").Sum(r => r.NetPayout);
            TotalPendingApproval = HistoricalRuns.Count(r => r.Status == "Review");
            TotalApproved = HistoricalRuns.Count(r => r.Status == "Approved");
        }
    }
}
