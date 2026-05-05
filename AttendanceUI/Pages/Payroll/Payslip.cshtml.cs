using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using AttendanceUI.Data;
using AttendanceUI.Models;

namespace AttendanceUI.Pages.Payroll
{
    public class PayslipModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public PayslipModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        public PayrollMaster Payroll { get; set; } = default!;
        public List<PayrollDetail> Earnings { get; set; } = new();
        public List<PayrollDetail> Deductions { get; set; } = new();
        public string LeaveBreakdownDisplay { get; set; } = "";
        public string MonthDisplay { get; set; } = "";

        public async Task<IActionResult> OnGetAsync(int id)
        {
            var query = _context.PayrollMasters.AsQueryable();

            var record = await query
                .Include(p => p.Employee!)
                    .ThenInclude(e => e.Department!)
                .Include(p => p.Employee!)
                    .ThenInclude(e => e.Designation!)
                .Include(p => p.PayrollDetails)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (record == null)
            {
                return NotFound();
            }

            Payroll = record;

            // Prepare Leave Breakdown Display
            // Prepare Leave Breakdown Display
            LeaveBreakdownDisplay = $", PL:{Payroll.PaidLeaves:0.#}";

            // Safe Month Parsing
            try
            {
                MonthDisplay = DateTime.ParseExact(Payroll.Month, "yyyy-MM", null).ToString("MMMM yyyy");
            }
            catch
            {
                MonthDisplay = Payroll.Month; // Fallback
            }

            Earnings = Payroll.PayrollDetails
                .Where(d => d.ComponentType == "Earning")
                .OrderByDescending(d => d.ComponentName != null && d.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase))
                .ThenBy(d => d.ComponentName)
                .ToList();

            Deductions = Payroll.PayrollDetails
                .Where(d => d.ComponentType == "Deduction")
                .OrderBy(d => d.ComponentName)
                .ToList();

            // Fetch payroll IDs for history features (Top 6)
            var allHistoryIds = await _context.PayrollMasters
                .Where(p => p.EmployeeId == Payroll.EmployeeId)
                .OrderByDescending(p => p.Month)
                .Take(6)
                .Select(p => p.Id)
                .ToListAsync();

            HistoryIds = string.Join(",", allHistoryIds);
            History3Ids = string.Join(",", allHistoryIds.Take(3));

            NetSalaryInWords = NumberToWords((int)Payroll.NetSalary);

            return Page();
        }

        public string HistoryIds { get; set; } = "";
        public string History3Ids { get; set; } = "";

        public string NetSalaryInWords { get; set; } = "";

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

            if ((number / 10000000) > 0)
            {
                words += NumberToWordsInternal(number / 10000000) + " Crore ";
                number %= 10000000;
            }

            if ((number / 100000) > 0)
            {
                words += NumberToWordsInternal(number / 100000) + " Lakh ";
                number %= 100000;
            }

            if ((number / 1000) > 0)
            {
                words += NumberToWordsInternal(number / 1000) + " Thousand ";
                number %= 1000;
            }

            if ((number / 100) > 0)
            {
                words += NumberToWordsInternal(number / 100) + " Hundred ";
                number %= 100;
            }

            if (number > 0)
            {
                if (words != "") words += "and ";

                var unitsMap = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
                var tensMap = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

                if (number < 20)
                    words += unitsMap[number];
                else
                {
                    words += tensMap[number / 10];
                    if ((number % 10) > 0)
                        words += "-" + unitsMap[number % 10];
                }
            }

            return words.Trim();
        }
    }
}
