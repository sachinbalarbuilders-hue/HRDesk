using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using HRDesk.Web.Data;
using HRDesk.Web.Models;

namespace HRDesk.Web.Pages.Regularizations
{
    public class IndexModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly HRDesk.Web.Services.IAttendanceProcessorService _processor;

        public IndexModel(BiometricAttendanceDbContext context, HRDesk.Web.Services.IAttendanceProcessorService processor)
        {
            _context = context;
            _processor = processor;
        }

        public PaginatedList<AttendanceRegularization> RegularizationRequests { get;set; } = default!;

        [BindProperty(SupportsGet = true)]
        public int PageSize { get; set; } = 50;

        [BindProperty(SupportsGet = true)]
        public string? SearchTerm { get; set; }

        public async Task OnGetAsync(int pageNum = 1)
        {
            if (_context.AttendanceRegularizations != null)
            {
                var baseQuery = _context.AttendanceRegularizations.AsNoTracking();

                if (!string.IsNullOrWhiteSpace(SearchTerm))
                {
                    var searchLower = SearchTerm.ToLower();
                    baseQuery = baseQuery.Where(r => 
                        (r.Employee != null && r.Employee.EmployeeName.ToLower().Contains(searchLower)) ||
                        (r.Reason != null && r.Reason.ToLower().Contains(searchLower))
                    );
                }

                if (pageNum < 1) pageNum = 1;

                var totalCount = await baseQuery.CountAsync();

                var pagedIds = await baseQuery
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => r.Id)
                    .Skip((pageNum - 1) * PageSize)
                    .Take(PageSize)
                    .ToListAsync();

                var items = await _context.AttendanceRegularizations.AsNoTracking()
                    .Where(r => pagedIds.Contains(r.Id))
                    .Include(r => r.Employee)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();
                    
                RegularizationRequests = new PaginatedList<AttendanceRegularization>(items, totalCount, pageNum, PageSize);
            }
        }

        public async Task<IActionResult> OnPostApproveAsync(string ids)
        {
            if (string.IsNullOrEmpty(ids)) return RedirectToPage();
            
            var idList = ids.Split(',').Select(int.Parse).ToList();
            var requests = await _context.AttendanceRegularizations
                .Where(r => idList.Contains(r.Id) && r.Status == "Pending")
                .ToListAsync();

            foreach (var req in requests)
            {
                req.Status = "Approved";
                req.ApprovedBy = User.Identity?.Name ?? "Admin";
                req.ApproveDate = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            // Re-process attendance from the request date until the end of that month
            var affected = requests.Select(r => new { r.RequestDate, r.EmployeeId }).Distinct().ToList();
            foreach (var item in affected)
            {
                var endOfMonth = new DateOnly(item.RequestDate.Year, item.RequestDate.Month, DateTime.DaysInMonth(item.RequestDate.Year, item.RequestDate.Month));
                for (var d = item.RequestDate; d <= endOfMonth; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, item.EmployeeId);
                }
            }

            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostRejectAsync(string ids)
        {
            if (string.IsNullOrEmpty(ids)) return RedirectToPage();

            var idList = ids.Split(',').Select(int.Parse).ToList();
            var requests = await _context.AttendanceRegularizations
                .Where(r => idList.Contains(r.Id) && r.Status == "Pending")
                .ToListAsync();

            foreach (var req in requests)
            {
                req.Status = "Rejected";
                req.ApprovedBy = User.Identity?.Name ?? "Admin";
                req.ApproveDate = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostDeleteAsync(int id)
        {
            var req = await _context.AttendanceRegularizations.FindAsync(id);
            if (req != null)
            {
                _context.AttendanceRegularizations.Remove(req);
                await _context.SaveChangesAsync();
                
                // Re-process attendance from the request date until the end of that month
                var endOfMonth = new DateOnly(req.RequestDate.Year, req.RequestDate.Month, DateTime.DaysInMonth(req.RequestDate.Year, req.RequestDate.Month));
                for (var d = req.RequestDate; d <= endOfMonth; d = d.AddDays(1))
                {
                    await _processor.ProcessDailyAttendanceAsync(d, req.EmployeeId);
                }
            }
            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostDeleteGroupAsync(string ids)
        {
            if (string.IsNullOrEmpty(ids)) return RedirectToPage();

            var idList = ids.Split(',').Select(int.Parse).ToList();
            var requests = await _context.AttendanceRegularizations
                .Where(r => idList.Contains(r.Id))
                .ToListAsync();

            if (requests.Any())
            {
                foreach (var req in requests)
                {
                    // Aggressively find and reset the manual override for this employee/date
                    var attendance = await _context.DailyAttendance
                        .FirstOrDefaultAsync(d => d.EmployeeId == req.EmployeeId && d.RecordDate == req.RequestDate);
                    
                    if (attendance != null)
                    {
                        attendance.ApplicationNumber = null;
                        attendance.Remarks = "Manual override reverted";
                        attendance.WorkMinutes = 0; // Explicit reset
                        attendance.InTime = null;
                        attendance.OutTime = null;
                        attendance.UpdatedAt = DateTime.Now;
                    }

                    _context.AttendanceRegularizations.Remove(req);
                }

                await _context.SaveChangesAsync();
                
                // Re-process attendance from the request date until the end of that month
                var affected = requests.Select(r => new { r.RequestDate, r.EmployeeId }).Distinct().ToList();
                foreach (var item in affected)
                {
                    var endOfMonth = new DateOnly(item.RequestDate.Year, item.RequestDate.Month, DateTime.DaysInMonth(item.RequestDate.Year, item.RequestDate.Month));
                    for (var d = item.RequestDate; d <= endOfMonth; d = d.AddDays(1))
                    {
                        await _processor.ProcessDailyAttendanceAsync(d, item.EmployeeId);
                    }
                }
            }
            return RedirectToPage();
        }
    }
}
