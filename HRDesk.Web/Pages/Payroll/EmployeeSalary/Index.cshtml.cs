using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Pages.Payroll.EmployeeSalary
{
    public class IndexModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public IndexModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        public class EmployeeSalaryViewModel
        {
            public int EmployeeId { get; set; }
            public string EmployeeName { get; set; } = "";
            public string Department { get; set; } = "";
            public decimal BasicSalary { get; set; }
            public decimal SpecialAllowance { get; set; }
            public decimal TotalSalary { get; set; }
            public bool HasSalary { get; set; }
        }

        public IList<EmployeeSalaryViewModel> Employees { get; set; } = default!;

        public async Task OnGetAsync()
        {
            var employees = await _context.Employees
                .Include(e => e.Department)
                .Where(e => e.Status == "Active")
                .ToListAsync();

            var salaryComponents = await _context.SalaryComponents
                .Where(c => c.IsActive)
                .ToListAsync();

            var basicComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "BASIC");
            var specialComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "SPECIAL");

            Employees = new List<EmployeeSalaryViewModel>();

            var empIds = employees.Select(e => e.EmployeeId).ToList();
            var allStructures = await _context.EmployeeSalaryStructures
                .Where(s => empIds.Contains(s.EmployeeId) && s.IsActive)
                .ToListAsync();
            var structuresByEmp = allStructures.GroupBy(s => s.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var emp in employees)
            {
                var salaryStructure = structuresByEmp.GetValueOrDefault(emp.EmployeeId, new List<EmployeeSalaryStructure>());

                var basic = salaryStructure.FirstOrDefault(s => s.ComponentId == basicComponent?.Id)?.Amount ?? 0;
                var special = salaryStructure.FirstOrDefault(s => s.ComponentId == specialComponent?.Id)?.Amount ?? 0;

                Employees.Add(new EmployeeSalaryViewModel
                {
                    EmployeeId = emp.EmployeeId,
                    EmployeeName = emp.EmployeeName,
                    Department = emp.Department?.DepartmentName ?? "",
                    BasicSalary = basic,
                    SpecialAllowance = special,
                    TotalSalary = basic + special,
                    HasSalary = basic > 0 || special > 0
                });
            }
        }
    }
}
