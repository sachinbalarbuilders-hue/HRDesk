using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Leaves.Types;

public class IndexModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public IndexModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public List<LeaveType> LeaveTypes { get; set; } = new();
    public List<Employee> Employees { get; set; } = new();

    public async Task OnGetAsync()
    {
        LeaveTypes = await _db.LeaveTypes
            .AsNoTracking()
            .Include(lt => lt.EligibleEmployees)
            .OrderBy(lt => lt.Name)
            .ToListAsync();
            
        Employees = await _db.Employees.Where(e => e.Status == "active").OrderBy(e => e.EmployeeName).ToListAsync();
    }

    [BindProperty]
    public LeaveType NewLeaveType { get; set; } = new();

    [BindProperty]
    public LeaveType EditLeaveType { get; set; } = new();

    [BindProperty]
    public List<int> SelectedEmployeeIds { get; set; } = new();

    public async Task<IActionResult> OnPostAddAsync()
    {
        ModelState.Clear();
        if (!TryValidateModel(NewLeaveType, nameof(NewLeaveType)))
        {
            await OnGetAsync();
            return Page();
        }

        _db.LeaveTypes.Add(NewLeaveType);
        await _db.SaveChangesAsync();

        // Save Assignments
        if (SelectedEmployeeIds != null && SelectedEmployeeIds.Any())
        {
            foreach (var empId in SelectedEmployeeIds)
            {
                _db.LeaveTypeEligibilities.Add(new LeaveTypeEligibility 
                { 
                    EmployeeId = empId, 
                    LeaveTypeId = NewLeaveType.Id 
                });
            }
            await _db.SaveChangesAsync();
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostEditAsync()
    {
        ModelState.Clear();
        if (!TryValidateModel(EditLeaveType, nameof(EditLeaveType)))
        {
            await OnGetAsync();
            return Page();
        }

        var type = await _db.LeaveTypes.AsNoTracking().Include(lt => lt.EligibleEmployees).FirstOrDefaultAsync(lt => lt.Id == EditLeaveType.Id);
        if (type != null)
        {
            type.Code = EditLeaveType.Code;
            type.Name = EditLeaveType.Name;
            type.DefaultYearlyQuota = EditLeaveType.DefaultYearlyQuota;
            type.IsPaid = EditLeaveType.IsPaid;
            type.ApplicableAfterProbation = EditLeaveType.ApplicableAfterProbation;
            type.AllowCarryForward = EditLeaveType.AllowCarryForward;
            type.Status = EditLeaveType.Status;

            // Sync Assignments
            _db.LeaveTypeEligibilities.RemoveRange(type.EligibleEmployees);
            
            if (SelectedEmployeeIds != null && SelectedEmployeeIds.Any())
            {
                foreach (var empId in SelectedEmployeeIds)
                {
                    _db.LeaveTypeEligibilities.Add(new LeaveTypeEligibility 
                    { 
                        EmployeeId = empId, 
                        LeaveTypeId = type.Id 
                    });
                }
            }
            
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var type = await _db.LeaveTypes.FindAsync(id);
        if (type != null)
        {
            _db.LeaveTypes.Remove(type);
            await _db.SaveChangesAsync();
        }
        return RedirectToPage();
    }
}
