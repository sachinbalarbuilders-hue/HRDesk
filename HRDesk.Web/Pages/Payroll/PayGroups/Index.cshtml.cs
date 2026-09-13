using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Payroll.PayGroups;

public sealed class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public sealed class PayGroupItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Code { get; set; } = "";
        public string? Description { get; set; }
        public string PaymentFrequency { get; set; } = "Monthly";
        public int CutoffDay { get; set; } = 30;
        public string Status { get; set; } = "active";
        public int EmployeeCount { get; set; }
        public int PayrollRunCount { get; set; }
        public bool HasRealPayrollRuns { get; set; }
    }

    public sealed class EmployeeSelectionItem
    {
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = "";
        public string DepartmentName { get; set; } = "";
        public string DesignationName { get; set; } = "";
        public int? PayGroupId { get; set; }
        public string CurrentPayGroupCode { get; set; } = "";
    }

    [BindProperty(SupportsGet = true)]
    public string Tab { get; set; } = "active";

    public IReadOnlyList<PayGroupItem> PayGroups { get; private set; } = Array.Empty<PayGroupItem>();
    public IReadOnlyList<PayGroupItem> ActivePayGroups { get; private set; } = Array.Empty<PayGroupItem>();
    public IReadOnlyList<PayGroupItem> ArchivedPayGroups { get; private set; } = Array.Empty<PayGroupItem>();
    public IReadOnlyList<EmployeeSelectionItem> AllEmployees { get; private set; } = Array.Empty<EmployeeSelectionItem>();

    [BindProperty]
    public PayGroupForm Input { get; set; } = new();

    [BindProperty]
    public int AssignPayGroupId { get; set; }

    [BindProperty]
    public List<int> SelectedEmployeeIds { get; set; } = new();

    public sealed class PayGroupForm
    {
        public int? Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = "";

        [Required]
        [StringLength(20)]
        public string Code { get; set; } = "";

        [StringLength(250)]
        public string? Description { get; set; }

        [Required]
        [StringLength(20)]
        public string PaymentFrequency { get; set; } = "Monthly";

        [Range(1, 31)]
        public int CutoffDay { get; set; } = 30;

        public string Status { get; set; } = "active";
    }

    public async Task OnGetAsync()
    {
        await LoadDataAsync();
    }

    private async Task LoadDataAsync()
    {
        var groups = await _db.PayGroups
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync();

        var empCounts = await _db.Employees
            .AsNoTracking()
            .Where(e => e.PayGroupId != null && (e.Status == "Active" || e.Status == "active"))
            .GroupBy(e => e.PayGroupId!.Value)
            .Select(g => new { PayGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PayGroupId, x => x.Count);

        var allRuns = await _db.PayrollRuns
            .AsNoTracking()
            .Select(r => new { r.PayGroupId, r.Status, r.TotalEmployees, r.NetPayout })
            .ToListAsync();

        var runStats = allRuns
            .GroupBy(r => r.PayGroupId)
            .ToDictionary(
                g => g.Key,
                g => new {
                    TotalRuns = g.Count(),
                    RealRuns = g.Count(r => r.Status != "Draft" || r.TotalEmployees > 0 || r.NetPayout > 0)
                });

        PayGroups = groups.Select(g =>
        {
            var stats = runStats.GetValueOrDefault(g.Id);
            return new PayGroupItem
            {
                Id = g.Id,
                Name = g.Name,
                Code = g.Code,
                Description = g.Description,
                PaymentFrequency = g.PaymentFrequency,
                CutoffDay = g.CutoffDay,
                Status = g.Status,
                EmployeeCount = empCounts.GetValueOrDefault(g.Id, 0),
                PayrollRunCount = stats?.TotalRuns ?? 0,
                HasRealPayrollRuns = (stats?.RealRuns ?? 0) > 0
            };
        }).ToList();

        ActivePayGroups = PayGroups
            .Where(p => !string.Equals(p.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();

        ArchivedPayGroups = PayGroups
            .Where(p => string.Equals(p.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var activeEmployees = await _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.PayGroup)
            .Where(e => e.Status == "Active" || e.Status == "active")
            .OrderBy(e => e.EmployeeName)
            .ToListAsync();

        AllEmployees = activeEmployees.Select(e => new EmployeeSelectionItem
        {
            EmployeeId = e.EmployeeId,
            EmployeeName = e.EmployeeName,
            DepartmentName = e.Department?.DepartmentName ?? "General",
            DesignationName = e.Designation?.DesignationName ?? "Staff",
            PayGroupId = e.PayGroupId,
            CurrentPayGroupCode = e.PayGroup?.Code ?? ""
        }).ToList();
    }

    public async Task<IActionResult> OnPostSaveAsync()
    {
        ModelState.Remove(nameof(AssignPayGroupId));
        ModelState.Remove(nameof(SelectedEmployeeIds));
        ModelState.Remove(nameof(Tab));

        if (string.IsNullOrWhiteSpace(Input.Name))
        {
            ModelState.AddModelError("Input.Name", "Group Name is required.");
        }

        if (string.IsNullOrWhiteSpace(Input.Code))
        {
            ModelState.AddModelError("Input.Code", "Code is required.");
        }

        if (Input.CutoffDay < 1 || Input.CutoffDay > 31)
        {
            Input.CutoffDay = 30;
        }

        if (!ModelState.IsValid)
        {
            var errors = string.Join("; ", ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => $"{x.Key}: {string.Join(", ", x.Value!.Errors.Select(e => e.ErrorMessage))}"));
            TempData["ErrorMessage"] = $"Could not save Pay Group: {errors}";
            ViewData["ShowSaveModal"] = true;
            await LoadDataAsync();
            return Page();
        }

        if (Input.Id.HasValue && Input.Id.Value > 0)
        {
            var existing = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == Input.Id.Value);
            if (existing is null) return NotFound();

            var codeUpper = Input.Code.Trim().ToUpper();
            var codeExists = await _db.PayGroups.AnyAsync(p => p.Id != Input.Id.Value && p.Code == codeUpper);
            if (codeExists)
            {
                ModelState.AddModelError("Input.Code", $"A Pay Group with code '{codeUpper}' already exists.");
                TempData["ErrorMessage"] = $"A Pay Group with code '{codeUpper}' already exists. Please choose a different unique code.";
                ViewData["ShowSaveModal"] = true;
                await LoadDataAsync();
                return Page();
            }

            existing.Name = Input.Name.Trim();
            existing.Code = codeUpper;
            existing.Description = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim();
            existing.PaymentFrequency = string.IsNullOrWhiteSpace(Input.PaymentFrequency) ? "Monthly" : Input.PaymentFrequency;
            existing.CutoffDay = Input.CutoffDay;
            existing.Status = string.IsNullOrWhiteSpace(Input.Status) ? "active" : Input.Status;
        }
        else
        {
            var codeUpper = Input.Code.Trim().ToUpper();
            var exists = await _db.PayGroups.AnyAsync(p => p.Code == codeUpper);
            if (exists)
            {
                ModelState.AddModelError("Input.Code", $"A Pay Group with code '{codeUpper}' already exists.");
                TempData["ErrorMessage"] = $"A Pay Group with code '{codeUpper}' already exists. Please choose a different unique code.";
                ViewData["ShowSaveModal"] = true;
                await LoadDataAsync();
                return Page();
            }

            var group = new PayGroup
            {
                Name = Input.Name.Trim(),
                Code = codeUpper,
                Description = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim(),
                PaymentFrequency = string.IsNullOrWhiteSpace(Input.PaymentFrequency) ? "Monthly" : Input.PaymentFrequency,
                CutoffDay = Input.CutoffDay,
                Status = string.IsNullOrWhiteSpace(Input.Status) ? "active" : Input.Status,
                CreatedAt = DateTime.UtcNow
            };
            _db.PayGroups.Add(group);
        }

        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Pay Group '{Input.Name.Trim()}' saved successfully.";
        return RedirectToPage(new { Tab = "active" });
    }

    public async Task<IActionResult> OnPostAssignEmployeesAsync()
    {
        var group = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == AssignPayGroupId);
        if (group is null) return NotFound();

        var selectedIds = SelectedEmployeeIds ?? new List<int>();

        var employeesToUpdate = await _db.Employees
            .Where(e => (e.Status == "Active" || e.Status == "active") && (e.PayGroupId == AssignPayGroupId || selectedIds.Contains(e.EmployeeId)))
            .ToListAsync();

        int newlyAssigned = 0;
        int unassigned = 0;

        foreach (var emp in employeesToUpdate)
        {
            if (selectedIds.Contains(emp.EmployeeId))
            {
                if (emp.PayGroupId != AssignPayGroupId)
                {
                    emp.PayGroupId = AssignPayGroupId;
                    newlyAssigned++;
                }
            }
            else if (emp.PayGroupId == AssignPayGroupId)
            {
                emp.PayGroupId = null;
                unassigned++;
            }
        }

        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Updated staff for '{group.Name}': {selectedIds.Count} employees assigned ({newlyAssigned} added, {unassigned} unassigned).";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostToggleStatusAsync(int id)
    {
        var group = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == id);
        if (group is null) return NotFound();

        group.Status = string.Equals(group.Status, "active", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Pay Group '{group.Name}' marked as {group.Status}.";
        return RedirectToPage(new { Tab = Tab });
    }

    public async Task<IActionResult> OnPostArchiveAsync(int id)
    {
        var group = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == id);
        if (group is null) return NotFound();

        group.Status = "archived";
        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Pay Group '{group.Name}' moved to Archive.";
        return RedirectToPage(new { Tab = "active" });
    }

    public async Task<IActionResult> OnPostRestoreAsync(int id)
    {
        var group = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == id);
        if (group is null) return NotFound();

        group.Status = "active";
        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Pay Group '{group.Name}' restored successfully.";
        return RedirectToPage(new { Tab = "archived" });
    }

    public async Task<IActionResult> OnPostPermanentDeleteAsync(int id)
    {
        var group = await _db.PayGroups.FirstOrDefaultAsync(p => p.Id == id);
        if (group is null) return NotFound();

        var assignedCount = await _db.Employees.CountAsync(e => e.PayGroupId == id);
        if (assignedCount > 0)
        {
            TempData["ErrorMessage"] = $"Cannot delete '{group.Name}': {assignedCount} employee(s) are still assigned to it. Reassign them first.";
            return RedirectToPage(new { Tab = "archived" });
        }

        var runs = await _db.PayrollRuns.Where(r => r.PayGroupId == id).ToListAsync();
        var realRunsCount = runs.Count(r => r.Status != "Draft" || r.TotalEmployees > 0 || r.NetPayout > 0);

        if (realRunsCount > 0)
        {
            TempData["ErrorMessage"] = $"'{group.Name}' has {realRunsCount} historical payroll run(s) on record. For statutory and financial audit compliance, pay groups with payroll history cannot be deleted and must remain archived.";
            return RedirectToPage(new { Tab = "archived" });
        }

        // Clean up empty auto-generated draft placeholders (0 employees, 0 payout)
        if (runs.Count > 0)
        {
            _db.PayrollRuns.RemoveRange(runs);
        }

        _db.PayGroups.Remove(group);
        await _db.SaveChangesAsync();
        TempData["SuccessMessage"] = $"Pay Group '{group.Name}' permanently deleted.";
        return RedirectToPage(new { Tab = "archived" });
    }
}
