using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace HRDesk.Web.Pages.Payroll.EmployeeSalary
{
    public class EditModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public EditModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        [BindProperty]
        public int EmployeeId { get; set; }

        [BindProperty]
        public string EmployeeName { get; set; } = "";

        [BindProperty]
        public decimal BasicSalary { get; set; }

        [BindProperty]
        public decimal SpecialAllowance { get; set; }

        [BindProperty]
        public decimal ProvidentFund { get; set; }

        [BindProperty]
        public decimal ESIC { get; set; }

        [BindProperty]
        public decimal ProfessionalTax { get; set; }

        [BindProperty]
        public bool IsPfEligible { get; set; } = true;

        [BindProperty]
        public bool PfWageCap { get; set; } = true;

        [BindProperty]
        public bool IsEsicEligible { get; set; } = true;

        [BindProperty]
        public bool IsPtEligible { get; set; } = true;

        [BindProperty]
        public string? UanNumber { get; set; }

        [BindProperty]
        public string? EsicNumber { get; set; }

        [BindProperty]
        public string? PanNumber { get; set; }

        [BindProperty]
        [DataType(DataType.Date)]
        public DateTime EffectiveDate { get; set; } = DateTime.Today;

        public class SalaryHistoryItem
        {
            public string ComponentName { get; set; } = "";
            public decimal Amount { get; set; }
            public DateOnly EffectiveFrom { get; set; }
            public DateOnly? EffectiveTo { get; set; }
            public bool IsActive { get; set; }
        }

        public IList<SalaryHistoryItem> SalaryHistory { get; set; } = new List<SalaryHistoryItem>();

        public async Task<IActionResult> OnGetAsync(int id)
        {
            var employee = await _context.Employees.FirstOrDefaultAsync(e => e.EmployeeId == id);
            if (employee == null)
                return NotFound();

            EmployeeId = id;
            EmployeeName = employee.EmployeeName;

            var salaryComponents = await _context.SalaryComponents.ToListAsync();
            var basicComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "BASIC");
            var specialComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "SPECIAL");

            if (basicComponent != null)
            {
                var basic = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == id && s.ComponentId == basicComponent.Id && s.IsActive);
                BasicSalary = basic?.Amount ?? 0;
            }

            if (specialComponent != null)
            {
                var special = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == id && s.ComponentId == specialComponent.Id && s.IsActive);
                SpecialAllowance = special?.Amount ?? 0;
            }

            var pfComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "PF");
            if (pfComponent != null)
            {
                var pf = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == id && s.ComponentId == pfComponent.Id && s.IsActive);
                ProvidentFund = pf?.Amount ?? 0;
            }

            var esicComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "ESIC");
            if (esicComponent != null)
            {
                var esic = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == id && s.ComponentId == esicComponent.Id && s.IsActive);
                ESIC = esic?.Amount ?? 0;
            }

            var ptComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "PT");
            if (ptComponent != null)
            {
                var pt = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == id && s.ComponentId == ptComponent.Id && s.IsActive);
                ProfessionalTax = pt?.Amount ?? 0;
            }

            UanNumber = employee.UanNumber;
            EsicNumber = employee.EsicNumber;
            PanNumber = employee.PanNumber;
            IsPfEligible = employee.IsPfEligible;
            PfWageCap = employee.PfWageCap;
            IsEsicEligible = employee.IsEsicEligible;
            IsPtEligible = employee.IsPtEligible;

            SalaryHistory = await _context.EmployeeSalaryStructures
                .Include(s => s.SalaryComponent)
                .Where(s => s.EmployeeId == id)
                .OrderByDescending(s => s.EffectiveFrom)
                .ThenBy(s => s.SalaryComponent!.ComponentName)
                .Select(s => new SalaryHistoryItem
                {
                    ComponentName = s.SalaryComponent!.ComponentName,
                    Amount = s.Amount,
                    EffectiveFrom = s.EffectiveFrom,
                    EffectiveTo = s.EffectiveTo,
                    IsActive = s.IsActive
                })
                .ToListAsync();

            return Page();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
                return Page();

            var salaryComponents = await _context.SalaryComponents.ToListAsync();
            var basicComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "BASIC");
            var specialComponent = salaryComponents.FirstOrDefault(c => c.ComponentCode == "SPECIAL");

            var effectiveDate = DateOnly.FromDateTime(EffectiveDate);

            async Task ProcessSalaryComponentAsync(int? componentId, decimal amount)
            {
                if (componentId == null) return;
                
                var existing = await _context.EmployeeSalaryStructures
                    .FirstOrDefaultAsync(s => s.EmployeeId == EmployeeId && s.ComponentId == componentId && s.IsActive);

                if (existing != null)
                {
                    if (existing.Amount != amount)
                    {
                        var yesterday = effectiveDate.AddDays(-1);
                        if (existing.EffectiveFrom > yesterday)
                        {
                            existing.Amount = amount;
                        }
                        else
                        {
                            existing.IsActive = false;
                            existing.EffectiveTo = yesterday;

                            _context.EmployeeSalaryStructures.Add(new EmployeeSalaryStructure
                            {
                                EmployeeId = EmployeeId,
                                ComponentId = componentId.Value,
                                Amount = amount,
                                EffectiveFrom = effectiveDate,
                                IsActive = true
                            });
                        }
                    }
                }
                else
                {
                    _context.EmployeeSalaryStructures.Add(new EmployeeSalaryStructure
                    {
                        EmployeeId = EmployeeId,
                        ComponentId = componentId.Value,
                        Amount = amount,
                        EffectiveFrom = effectiveDate,
                        IsActive = true
                    });
                }
            }

            var employee = await _context.Employees.FirstOrDefaultAsync(e => e.EmployeeId == EmployeeId);
            if (employee != null)
            {
                employee.UanNumber = string.IsNullOrWhiteSpace(UanNumber) ? null : UanNumber.Trim();
                employee.EsicNumber = string.IsNullOrWhiteSpace(EsicNumber) ? null : EsicNumber.Trim();
                employee.PanNumber = string.IsNullOrWhiteSpace(PanNumber) ? null : PanNumber.Trim().ToUpperInvariant();
                employee.IsPfEligible = IsPfEligible;
                employee.PfWageCap = PfWageCap;
                employee.IsEsicEligible = IsEsicEligible;
                employee.IsPtEligible = IsPtEligible;
            }

            await ProcessSalaryComponentAsync(basicComponent?.Id, BasicSalary);
            await ProcessSalaryComponentAsync(specialComponent?.Id, SpecialAllowance);
            await ProcessSalaryComponentAsync(salaryComponents.FirstOrDefault(c => c.ComponentCode == "PF")?.Id, ProvidentFund);
            await ProcessSalaryComponentAsync(salaryComponents.FirstOrDefault(c => c.ComponentCode == "ESIC")?.Id, ESIC);
            await ProcessSalaryComponentAsync(salaryComponents.FirstOrDefault(c => c.ComponentCode == "PT")?.Id, ProfessionalTax);

            await _context.SaveChangesAsync();

            return RedirectToPage("./Index");
        }
    }
}

