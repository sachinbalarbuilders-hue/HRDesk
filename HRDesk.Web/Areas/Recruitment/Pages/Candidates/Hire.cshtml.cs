using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HRDesk.Web.Areas.Recruitment.Pages.Candidates;

[Authorize]
public class HireModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public HireModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    [BindProperty]
    public Candidate Candidate { get; set; } = default!;

    [BindProperty]
    public Employee Employee { get; set; } = default!;

    public SelectList Departments { get; set; } = default!;
    public SelectList Designations { get; set; } = default!;

    public async Task<IActionResult> OnGetAsync(int? id)
    {
        if (id == null) return NotFound();

        var candidate = await _context.Candidates.FirstOrDefaultAsync(m => m.CandidateId == id);
        if (candidate == null || candidate.Status == "Hired") return NotFound();
        
        Candidate = candidate;
        
        // Pre-fill employee details
        var existingIds = await _context.Employees.Select(e => e.EmployeeId).ToListAsync();
        int nextId = 1;
        while (existingIds.Contains(nextId))
        {
            nextId++;
        }
        
        Employee = new Employee
        {
            EmployeeId = nextId,
            EmployeeName = Candidate.CandidateName,
            Phone = Candidate.Phone,
            JoiningDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = "Active"
        };

        Departments = new SelectList(await _context.Departments.ToListAsync(), "Id", "DepartmentName");
        Designations = new SelectList(await _context.Designations.ToListAsync(), "Id", "DesignationName");

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var candidateToUpdate = await _context.Candidates.FindAsync(Candidate.CandidateId);
        if (candidateToUpdate == null || candidateToUpdate.Status == "Hired") return NotFound();

        // Check if EmployeeId already exists
        bool exists = await _context.Employees.AnyAsync(e => e.EmployeeId == Employee.EmployeeId && e.OrganizationId == candidateToUpdate.OrganizationId);
        if (exists)
        {
            ModelState.AddModelError("Employee.EmployeeId", $"Employee ID {Employee.EmployeeId} is already assigned to another employee.");
            Departments = new SelectList(await _context.Departments.ToListAsync(), "Id", "DepartmentName");
            Designations = new SelectList(await _context.Designations.ToListAsync(), "Id", "DesignationName");
            return Page();
        }

        // Create the new employee
        Employee.OrganizationId = candidateToUpdate.OrganizationId;
        
        _context.Employees.Add(Employee);
        
        await _context.SaveChangesAsync(); // Save to database

        // Link and update candidate
        candidateToUpdate.HiredEmployeeId = Employee.EmployeeId;
        candidateToUpdate.Status = "Hired";
        candidateToUpdate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return RedirectToPage("./Index");
    }
}
