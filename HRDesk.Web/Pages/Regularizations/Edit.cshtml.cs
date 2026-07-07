using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Pages.Regularizations
{
    public class EditModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;

        public EditModel(BiometricAttendanceDbContext context)
        {
            _context = context;
        }

        [BindProperty]
        public AttendanceRegularization Regularization { get; set; } = default!;

        public async Task<IActionResult> OnGetAsync(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var regularization = await _context.AttendanceRegularizations
                .FirstOrDefaultAsync(m => m.Id == id);

            if (regularization == null)
            {
                return NotFound();
            }

            Regularization = regularization;
            ViewData["EmployeeId"] = new SelectList(_context.Employees, "EmployeeId", "EmployeeName");
            return Page();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
            {
                ViewData["EmployeeId"] = new SelectList(_context.Employees, "EmployeeId", "EmployeeName");
                return Page();
            }

            var existingReg = await _context.AttendanceRegularizations.FindAsync(Regularization.Id);
            if (existingReg == null)
            {
                return NotFound();
            }

            existingReg.EmployeeId = Regularization.EmployeeId;
            existingReg.RequestType = Regularization.RequestType;
            existingReg.RequestDate = Regularization.RequestDate;
            existingReg.Reason = Regularization.Reason;
            existingReg.ApplicationNumber = Regularization.ApplicationNumber;
            existingReg.WaivePenalty = Regularization.WaivePenalty;
            existingReg.PunchTimeIn = Regularization.PunchTimeIn;
            existingReg.PunchTimeOut = Regularization.PunchTimeOut;

            try
            {
                await _context.SaveChangesAsync();
                
                // Re-process attendance if the request was already approved
                if (existingReg.Status == "Approved")
                {
                    var processor = HttpContext.RequestServices.GetRequiredService<HRDesk.Web.Services.AttendanceProcessorService>();
                    await processor.ProcessDailyAttendanceAsync(existingReg.RequestDate, existingReg.EmployeeId);
                }
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await RegularizationExists(Regularization.Id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return RedirectToPage("./Index");
        }

        private async Task<bool> RegularizationExists(int id)
        {
            return await _context.AttendanceRegularizations.AnyAsync(e => e.Id == id);
        }
    }
}
