using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Leaves.Allocations;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public List<Employee> Employees { get; set; } = new();
    public List<LeaveType> LeaveTypes { get; set; } = new();
    public PaginatedList<LeaveAllocation> Allocations { get; set; } = default!;
    
    [BindProperty]
    public List<LeaveAllocation> BulkAllocations { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public int Year { get; set; } = AttendanceProcessorService.GetLeaveYear(DateOnly.FromDateTime(DateTime.Now));

    [BindProperty(SupportsGet = true)]
    public string? SearchString { get; set; }

    public async Task OnGetAsync(int pageNum = 1)
    {
        LeaveTypes = await _db.LeaveTypes.AsNoTracking().Include(lt => lt.EligibleEmployees).Where(lt => lt.Status == "Active").ToListAsync();
        Employees = await _db.Employees.AsNoTracking().Where(e => e.Status == "active").Include(e => e.Department).OrderBy(e => e.EmployeeName).ToListAsync();
        
        var query = _db.LeaveAllocations
            .AsNoTracking()
            .Where(la => la.Year == Year && la.Employee != null && la.Employee.Status == "active");

        if (!string.IsNullOrEmpty(SearchString))
        {
            query = query.Where(la => la.Employee!.EmployeeName.Contains(SearchString));
        }
        
        var filteredQuery = query.Where(la => 
            la.LeaveType == null || 
            !la.LeaveType.EligibleEmployees.Any() || 
            la.LeaveType.EligibleEmployees.Any(e => e.EmployeeId == la.EmployeeId)
        ).OrderBy(la => la.Employee!.EmployeeName);

        var count = await filteredQuery.CountAsync();
        
        var pagedIds = await filteredQuery
            .Skip((pageNum - 1) * 50)
            .Take(50)
            .Select(la => la.Id)
            .ToListAsync();

        var pagedItems = await _db.LeaveAllocations
            .AsNoTracking()
            .Include(la => la.Employee)
            .Include(la => la.LeaveType)
            .Where(la => pagedIds.Contains(la.Id))
            .OrderBy(la => la.Employee!.EmployeeName)
            .ToListAsync();

        Allocations = new PaginatedList<LeaveAllocation>(pagedItems, count, pageNum, 50);
    }

    [BindProperty]
    public LeaveAllocation NewAllocation { get; set; } = new();

    [BindProperty]
    public LeaveAllocation EditAllocation { get; set; } = new();

    public async Task<IActionResult> OnPostAddAsync()
    {
        // Check if allocation already exists
        var existing = await _db.LeaveAllocations
            .AnyAsync(la => la.EmployeeId == NewAllocation.EmployeeId && 
                            la.LeaveTypeId == NewAllocation.LeaveTypeId && 
                            la.Year == Year);

        // Eligibility Check
        var lt = await _db.LeaveTypes.Include(lt => lt.EligibleEmployees).FirstOrDefaultAsync(lt => lt.Id == NewAllocation.LeaveTypeId);
        if (lt != null && lt.EligibleEmployees.Any() && !lt.EligibleEmployees.Any(e => e.EmployeeId == NewAllocation.EmployeeId))
        {
            ModelState.AddModelError("", "This employee is not eligible for this leave type.");
            await OnGetAsync();
            return Page();
        }

        if (existing)
        {
            ModelState.AddModelError("", "Allocation already exists for this employee and leave type in this year.");
            await OnGetAsync();
            return Page();
        }

        NewAllocation.Year = Year;
        _db.LeaveAllocations.Add(NewAllocation);
        await _db.SaveChangesAsync();
        return RedirectToPage(new { Year });
    }

    public async Task<IActionResult> OnPostCarryForwardAsync()
    {
        var prevYear = Year - 1;
        var prevAllocations = await _db.LeaveAllocations
            .Include(la => la.LeaveType)
            .Where(la => la.Year == prevYear)
            .ToListAsync();

        if (!prevAllocations.Any())
        {
            TempData["ErrorMessage"] = $"No allocations found for the previous year ({prevYear}) to carry forward.";
            return RedirectToPage(new { Year });
        }

        int count = 0;
        var currentYearAllocations = await _db.LeaveAllocations
            .Where(la => la.Year == Year)
            .ToListAsync();
        var currentYearDict = currentYearAllocations
            .ToDictionary(la => $"{la.EmployeeId}_{la.LeaveTypeId}");

        foreach (var prev in prevAllocations)
        {
            // Find or Create allocation for current year
            var current = currentYearDict.GetValueOrDefault($"{prev.EmployeeId}_{prev.LeaveTypeId}");
            
            // Eligibility Check for Carry Forward
            var hasAssignments = prev.LeaveType?.EligibleEmployees.Any() ?? false;
            var isEligible = !hasAssignments || prev.LeaveType!.EligibleEmployees.Any(e => e.EmployeeId == prev.EmployeeId);
            
            if (!isEligible) continue; // Skip carry forward for ineligible employees

            decimal carryAmount = 0;
            if (prev.LeaveType != null && prev.LeaveType.AllowCarryForward)
            {
                carryAmount = prev.RemainingCount;
            }

            if (current == null)
            {
                // For the next year, we should use the LeaveType's DefaultYearlyQuota 
                // because the previous year might have been a pro-rated joining year.
                decimal nextYearQuota = prev.LeaveType?.DefaultYearlyQuota ?? prev.TotalAllocated;

                current = new LeaveAllocation
                {
                    EmployeeId = prev.EmployeeId,
                    LeaveTypeId = prev.LeaveTypeId,
                    Year = Year,
                    TotalAllocated = nextYearQuota, 
                    OpeningBalance = carryAmount 
                };
                _db.LeaveAllocations.Add(current);
            }
            else
            {
                // Update existing allocation's opening balance
                current.OpeningBalance = carryAmount;
            }
            count++;
        }

        await _db.SaveChangesAsync();
        TempData["Message"] = $"Successfully initialized {Year} based on {prevYear}. Balances carried forward only for eligible leave types.";
        return RedirectToPage(new { Year });
    }

    public async Task<IActionResult> OnPostEditAsync()
    {
        var allocation = await _db.LeaveAllocations.FindAsync(EditAllocation.Id);
        if (allocation == null) return NotFound();

        var totalAvailable = EditAllocation.TotalAllocated + EditAllocation.OpeningBalance;
        if (EditAllocation.UsedCount > totalAvailable)
        {
            TempData["ErrorMessage"] = $"Used Count ({EditAllocation.UsedCount}) cannot exceed Total Available ({totalAvailable} = Quota {EditAllocation.TotalAllocated} + Opening {EditAllocation.OpeningBalance}).";
            return RedirectToPage(new { Year });
        }

        allocation.TotalAllocated = EditAllocation.TotalAllocated;
        allocation.OpeningBalance = EditAllocation.OpeningBalance;
        allocation.UsedCount = EditAllocation.UsedCount;
        allocation.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return RedirectToPage(new { Year });
    }

    public async Task<IActionResult> OnPostInitializeAllAsync()
    {
        var employees = await _db.Employees.Where(e => e.Status == "active").ToListAsync();
        var leaveTypes = await _db.LeaveTypes
            .Include(lt => lt.EligibleEmployees)
            .Where(lt => lt.Status == "Active").ToListAsync();
        int addedCount = 0;

        var existingAllocations = await _db.LeaveAllocations
            .Where(la => la.Year == Year)
            .Select(la => new { la.EmployeeId, la.LeaveTypeId })
            .ToListAsync();
        var existingSet = existingAllocations.Select(a => $"{a.EmployeeId}_{a.LeaveTypeId}").ToHashSet();

        foreach (var emp in employees)
        {
            foreach (var lt in leaveTypes)
            {
                // Eligibility Check
                var hasAssignments = lt.EligibleEmployees.Any();
                var isEligible = !hasAssignments || lt.EligibleEmployees.Any(e => e.EmployeeId == emp.EmployeeId);
                
                if (!isEligible) continue;

                var existing = existingSet.Contains($"{emp.EmployeeId}_{lt.Id}");
                if (!existing)
                {
                    decimal quota = lt.DefaultYearlyQuota;
                    
                    // Apply pro-rata logic only for PAID leaves
                    if (lt.IsPaid)
                    {
                        var effectiveDate = emp.ProbationEnd ?? emp.JoiningDate;
                        if (effectiveDate.HasValue)
                        {
                            quota = AttendanceProcessorService.CalculateProRataQuota(lt.DefaultYearlyQuota, effectiveDate.Value, Year);
                        }
                    }

                    _db.LeaveAllocations.Add(new LeaveAllocation
                    {
                        EmployeeId = emp.EmployeeId,
                        LeaveTypeId = lt.Id,
                        Year = Year,
                        TotalAllocated = quota,
                        OpeningBalance = 0,
                        UsedCount = 0
                    });
                    addedCount++;
                }
            }
        }

        if (addedCount > 0)
        {
            await _db.SaveChangesAsync();
            TempData["Message"] = $"Initialized {addedCount} allocations for {Year}.";
        }
        else
        {
            TempData["ErrorMessage"] = "All active employees already have allocations for this year.";
        }

        return RedirectToPage(new { Year });
    }

    public async Task<IActionResult> OnPostBulkUpdateAsync()
    {
        if (BulkAllocations != null)
        {
            var errors = new System.Collections.Generic.List<string>();
            foreach (var item in BulkAllocations)
            {
                var allocation = await _db.LeaveAllocations
                    .Include(a => a.Employee)
                    .Include(a => a.LeaveType)
                    .FirstOrDefaultAsync(a => a.Id == item.Id);
                if (allocation != null)
                {
                    var totalAvailable = item.TotalAllocated + item.OpeningBalance;
                    if (item.UsedCount > totalAvailable)
                    {
                        errors.Add($"{allocation.Employee?.EmployeeName} / {allocation.LeaveType?.Code}: Used ({item.UsedCount}) > Available ({totalAvailable})");
                        continue; // Skip this row
                    }
                    allocation.TotalAllocated = item.TotalAllocated;
                    allocation.OpeningBalance = item.OpeningBalance;
                    allocation.UsedCount = item.UsedCount;
                    allocation.UpdatedAt = DateTime.Now;
                }
            }
            await _db.SaveChangesAsync();
            if (errors.Any())
            {
                TempData["ErrorMessage"] = "Some rows were skipped: " + string.Join("; ", errors);
            }
            else
            {
                TempData["Message"] = "Successfully updated all allocations.";
            }
        }
        return RedirectToPage(new { Year });
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var allocation = await _db.LeaveAllocations.FindAsync(id);
        if (allocation != null)
        {
            _db.LeaveAllocations.Remove(allocation);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage(new { Year });
    }

    public async Task<JsonResult> OnGetCalculateProRata(int employeeId, decimal yearlyQuota, int year)
    {
        var emp = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        if (emp == null)
        {
            return new JsonResult(new { success = false, message = "Employee not found." });
        }

        var effectiveDate = emp.ProbationEnd ?? emp.JoiningDate;
        if (!effectiveDate.HasValue)
        {
            return new JsonResult(new { success = false, message = "Employee has no joining or probation date." });
        }

        var proRata = AttendanceProcessorService.CalculateProRataQuota(yearlyQuota, effectiveDate.Value, year);
        return new JsonResult(new { success = true, value = proRata, effectiveDate = effectiveDate.Value.ToString("dd MMM yyyy") });
    }

    public async Task<JsonResult> OnGetLeaveTypeDetails(int id)
    {
        var lt = await _db.LeaveTypes.FindAsync(id);
        if (lt == null) return new JsonResult(new { success = false });
        return new JsonResult(new { success = true, quota = lt.DefaultYearlyQuota });
    }
}

