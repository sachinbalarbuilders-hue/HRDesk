using System;
using System.Linq;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

public class CompOffService
{
    private readonly BiometricAttendanceDbContext _db;

    public CompOffService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Create a draft comp off request when employee punches IN on a weekoff
    /// </summary>
    public async Task<CompOffRequest?> CreateDraftRequestAsync(int employeeId, DateOnly workedDate, TimeOnly inTime, int? shiftId)
    {
        // Check if request already exists
        var existing = await _db.CompOffRequests
            .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.WorkedDate == workedDate);

        if (existing != null)
            return existing; // Already exists

        var request = new CompOffRequest
        {
            EmployeeId = employeeId,
            WorkedDate = workedDate,
            ShiftId = shiftId,
            InTime = inTime,
            Status = "Draft"
        };

        _db.CompOffRequests.Add(request);
        await _db.SaveChangesAsync();

        return request;
    }

    /// <summary>
    /// Update comp off request with OUT punch and calculate comp off days
    /// </summary>
    public async Task<CompOffRequest?> UpdateWithOutPunchAsync(int employeeId, DateOnly workedDate, TimeOnly outTime)
    {
        var request = await _db.CompOffRequests
            .Include(r => r.Shift)
            .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.WorkedDate == workedDate);

        if (request == null || request.InTime == null)
            return null;

        // Fix: If already processed (Approved/Rejected), do not modify it during auto-processing
        if (request.Status == "Approved" || request.Status == "Rejected")
            return request;

        request.OutTime = outTime;

        // Calculate work minutes
        var inDateTime = workedDate.ToDateTime(request.InTime.Value);
        var outDateTime = workedDate.ToDateTime(outTime);
        
        // Handle overnight shifts
        if (outTime < request.InTime.Value)
            outDateTime = outDateTime.AddDays(1);

        var workMinutes = (int)(outDateTime - inDateTime).TotalMinutes;
        request.WorkMinutes = workMinutes;

        // Calculate comp off days based on shift duration
        if (request.Shift != null)
        {
            // Convert WorkingHours (decimal) to minutes
            var shiftDurationMinutes = (int)(request.Shift.WorkingHours * 60);
            var halfDayMinutes = shiftDurationMinutes / 2; // Half of actual working hours

            if (workMinutes >= shiftDurationMinutes)
            {
                request.CompOffDays = 1.0m; // Full comp off
            }
            else if (workMinutes >= halfDayMinutes)
            {
                request.CompOffDays = 0.5m; // Half comp off
            }
            else
            {
                request.CompOffDays = 0.0m; // No comp off
            }
        }
        else
        {
            // Default: 8 hours = full, 4 hours = half
            if (workMinutes >= 480)
                request.CompOffDays = 1.0m;
            else if (workMinutes >= 240)
                request.CompOffDays = 0.5m;
            else
                request.CompOffDays = 0.0m;
        }

        // Always set status to Pending for admin review
    request.Status = "Pending";

    request.UpdatedAt = DateTime.Now;
    await _db.SaveChangesAsync();

    return request;
}
    

    /// <summary>
    /// Approve comp off request and add to leave balance
    /// </summary>
    public async Task ApproveRequestAsync(int requestId, string approvedBy)
    {
        var request = await _db.CompOffRequests
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null || request.Status != "Pending")
            throw new InvalidOperationException("Request not found or not in pending status");

        if (request.CompOffDays == null || request.CompOffDays <= 0)
            throw new InvalidOperationException("Invalid comp off days");

        // Get Comp Off leave type
        var compOffLeaveType = await _db.LeaveTypes
            .FirstOrDefaultAsync(lt => lt.Code == "CO");

        if (compOffLeaveType == null)
            throw new InvalidOperationException("Comp Off leave type not found");

        // Use custom leave year logic (Nov-Oct)
        int leaveYear = AttendanceProcessorService.GetLeaveYear(request.WorkedDate);

        // Get or create leave allocation for this employee
        var allocation = await _db.LeaveAllocations
            .FirstOrDefaultAsync(a => a.EmployeeId == request.EmployeeId && 
                                     a.LeaveTypeId == compOffLeaveType.Id &&
                                     a.Year == leaveYear);

        if (allocation == null)
        {
            // Create new allocation
            allocation = new LeaveAllocation
            {
                EmployeeId = request.EmployeeId,
                LeaveTypeId = compOffLeaveType.Id,
                Year = leaveYear,
                TotalAllocated = 0,
                OpeningBalance = 0,
                UsedCount = 0
            };
            _db.LeaveAllocations.Add(allocation);
        }

        // Add comp off days to balance
        allocation.TotalAllocated += request.CompOffDays.Value;

        // Update request status
        request.Status = "Approved";
        request.ApprovedBy = approvedBy;
        request.ApprovedDate = DateTime.Now;
        // 90 days validity from worked date
        request.ExpiryDate = request.WorkedDate.AddDays(90); 
        request.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Create and approve a manual comp off credit (no punches required)
    /// </summary>
    public async Task CreateManualCreditAsync(int employeeId, DateOnly workedDate, decimal days, string approvedBy, string remarks)
    {
        // 1. Check if request already exists for this date
        var existing = await _db.CompOffRequests
            .FirstOrDefaultAsync(r => r.EmployeeId == employeeId && r.WorkedDate == workedDate);

        if (existing != null)
            throw new InvalidOperationException($"A Comp-Off request already exists for this employee on {workedDate}");

        // 2. Create the request directly as Pending
        var request = new CompOffRequest
        {
            EmployeeId = employeeId,
            WorkedDate = workedDate,
            CompOffDays = days,
            Status = "Pending",
            RejectionReason = remarks, // Use as remarks for manual adjustment
            RequestDate = DateTime.Now,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.CompOffRequests.Add(request);
        await _db.SaveChangesAsync();

        // 3. Approve it using the existing logic (handles balance update and expiry)
        await ApproveRequestAsync(request.Id, approvedBy);
    }

    /// <summary>
    /// Calculate current valid (unexpired) comp off balance
    /// </summary>
    public async Task<decimal> GetValidBalanceAsync(int employeeId, DateOnly onDate)
    {
        // 1. Get total used comp off days (from allocations across ALL years)
        var totalUsed = await _db.LeaveAllocations
            .Include(a => a.LeaveType)
            .Where(a => a.EmployeeId == employeeId && a.LeaveType.Code == "CO")
            .SumAsync(a => (decimal?)a.UsedCount) ?? 0;
            
        // 2. Get all approved comp offs to calculate balance using FIFO
        var allApproved = await _db.CompOffRequests
            .Where(r => r.EmployeeId == employeeId && r.Status == "Approved")
            .OrderBy(r => r.WorkedDate)
            .ToListAsync();
            
        decimal remainingUsed = totalUsed;
        decimal availableUnexpired = 0;
        
        foreach (var req in allApproved)
        {
            decimal days = req.CompOffDays ?? 0;
            
            if (remainingUsed >= days)
            {
                remainingUsed -= days;
            }
            else
            {
                // This credit is partially or fully unused
                decimal unusedInThisReq = days - remainingUsed;
                remainingUsed = 0;
                
                // Expiry ignored as per request
                availableUnexpired += unusedInThisReq;
            }
        }

        return availableUnexpired;
    }

    /// <summary>
    /// Reject comp off request
    /// </summary>
    public async Task RejectRequestAsync(int requestId, string rejectedBy, string reason)
    {
        var request = await _db.CompOffRequests
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null || request.Status != "Pending")
            throw new InvalidOperationException("Request not found or not in pending status");

        request.Status = "Rejected";
        request.ApprovedBy = rejectedBy;
        request.ApprovedDate = DateTime.Now;
        request.RejectionReason = reason;
        request.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
    }
}
