using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Pages.Payroll
{
    public class BulkPayslipModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public BulkPayslipModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        public List<PayslipBundle> Bundles { get; set; } = new();

        public class PayslipBundle
        {
            public PayrollMaster Payroll { get; set; } = default!;
            public List<PayrollDetail> Earnings { get; set; } = new();
            public List<PayrollDetail> Deductions { get; set; } = new();
            public string MonthDisplay { get; set; } = "";
            public string NetSalaryInWords { get; set; } = "";
        }

        public async Task<IActionResult> OnGetAsync(string ids)
        {
            if (string.IsNullOrEmpty(ids)) return RedirectToPage("/Payroll/Process");

            var idList = ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(s => int.TryParse(s, out var id) ? id : 0)
                            .Where(id => id > 0)
                            .ToList();

            if (!idList.Any()) return RedirectToPage("/Payroll/Process");

            var records = await _context.PayrollMasters
                .Include(p => p.Employee!).ThenInclude(e => e.Department!)
                .Include(p => p.Employee!).ThenInclude(e => e.Designation!)
                .Include(p => p.PayrollDetails)
                .Where(p => idList.Contains(p.Id))
                .ToListAsync();

            // Order by date to keep it chronological
            records = records.OrderBy(r => r.Month).ToList();

            foreach (var record in records)
            {
                var bundle = new PayslipBundle
                {
                    Payroll = record,
                    Earnings = record.PayrollDetails.Where(d => d.ComponentType == "Earning").OrderBy(d => d.ComponentName).ToList(),
                    Deductions = record.PayrollDetails.Where(d => d.ComponentType == "Deduction").OrderBy(d => d.ComponentName).ToList()
                };

                try
                {
                    bundle.MonthDisplay = DateTime.ParseExact(record.Month, "yyyy-MM", null).ToString("MMMM yyyy");
                }
                catch { bundle.MonthDisplay = record.Month; }

                bundle.NetSalaryInWords = NumberToWords((int)record.NetSalary);
                
                Bundles.Add(bundle);
            }

            return Page();
        }

        private string NumberToWords(int number)
        {
            if (number == 0) return "Zero Only";
            if (number < 0) return "Minus " + NumberToWordsInternal(Math.Abs(number)) + " Only";
            return (NumberToWordsInternal(number) + " Only").Trim();
        }

        private string NumberToWordsInternal(int number)
        {
            if (number == 0) return "";
            string words = "";
            if ((number / 10000000) > 0) { words += NumberToWordsInternal(number / 10000000) + " Crore "; number %= 10000000; }
            if ((number / 100000) > 0) { words += NumberToWordsInternal(number / 100000) + " Lakh "; number %= 100000; }
            if ((number / 1000) > 0) { words += NumberToWordsInternal(number / 1000) + " Thousand "; number %= 1000; }
            if ((number / 100) > 0) { words += NumberToWordsInternal(number / 100) + " Hundred "; number %= 100; }
            if (number > 0)
            {
                if (words != "") words += "and ";
                var unitsMap = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
                var tensMap = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };
                if (number < 20) words += unitsMap[number];
                else { words += tensMap[number / 10]; if ((number % 10) > 0) words += "-" + unitsMap[number % 10]; }
            }
            return words.Trim();
        }
    }
}
