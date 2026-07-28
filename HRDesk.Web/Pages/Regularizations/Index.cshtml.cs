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
        private readonly Services.ISequenceService _sequenceService;

        public IndexModel(BiometricAttendanceDbContext context, HRDesk.Web.Services.IAttendanceProcessorService processor, Services.ISequenceService sequenceService)
        {
            _context = context;
            _processor = processor;
            _sequenceService = sequenceService;
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
                var query = _context.AttendanceRegularizations
                    .Include(a => a.Employee)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(SearchTerm))
                {
                    var searchLower = SearchTerm.ToLower();
                    query = query.Where(r => 
                        (r.Employee != null && r.Employee.EmployeeName.ToLower().Contains(searchLower)) ||
                        (r.ApplicationNumber != null && r.ApplicationNumber.ToLower().Contains(searchLower)) ||
                        (r.Reason != null && r.Reason.ToLower().Contains(searchLower))
                    );
                }

                if (pageNum < 1) pageNum = 1;

                var totalCount = await query.CountAsync();

                var items = await query
                    .OrderByDescending(r => r.CreatedAt)
                    .Skip((pageNum - 1) * PageSize)
                    .Take(PageSize)
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

        public async Task<IActionResult> OnPostDeleteAsync(string ids)
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
                    
                    if (attendance != null && (attendance.ApplicationNumber == req.ApplicationNumber))
                    {
                        attendance.ApplicationNumber = null;
                        attendance.Remarks = $"Manual override reverted (Deleted {req.ApplicationNumber ?? "Group Log"})";
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
                    // Auto-resync sequence to close gaps if it was the latest
                    await _sequenceService.ResyncSequenceAsync(item.RequestDate.Year, item.RequestDate.Month);
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
