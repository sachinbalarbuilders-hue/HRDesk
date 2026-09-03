using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/recruitment")]
[Authorize]
public class RecruitmentApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _context;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    public RecruitmentApiController(
        BiometricAttendanceDbContext context,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _archive = archive;
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

    // =========================================================================
    // 1. OVERVIEW METRICS
    // =========================================================================
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var candidates = await _context.Candidates.AsNoTracking().ToListAsync();
        var interviews = await _context.InterviewSchedules
            .Include(i => i.Candidate)
            .AsNoTracking()
            .ToListAsync();

        var today = DateTime.UtcNow.Date;
        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        var endOfWeek = startOfWeek.AddDays(7);

        var totalCandidates = candidates.Count;
        var sourcedCount = candidates.Count(c => c.Status == "Sourced");
        var screeningCount = candidates.Count(c => c.Status == "Screening");
        var interviewCount = candidates.Count(c => c.Status == "Interview");
        var offeredCount = candidates.Count(c => c.Status == "Offered");
        var hiredCount = candidates.Count(c => c.Status == "Hired");
        var rejectedCount = candidates.Count(c => c.Status == "Rejected");

        var interviewsThisWeek = interviews.Count(i => i.InterviewDateTime.Date >= startOfWeek && i.InterviewDateTime.Date <= endOfWeek);
        var upcomingInterviewsCount = interviews.Count(i => i.InterviewDateTime >= DateTime.UtcNow && i.Status == "Scheduled");

        var positions = candidates
            .Where(c => !string.IsNullOrEmpty(c.AppliedFor))
            .GroupBy(c => c.AppliedFor)
            .Select(g => new
            {
                position = g.Key,
                totalApplicants = g.Count(),
                active = g.Count(c => c.Status != "Hired" && c.Status != "Rejected"),
                hired = g.Count(c => c.Status == "Hired")
            })
            .OrderByDescending(p => p.totalApplicants)
            .ToList();

        return Ok(new
        {
            totalCandidates,
            pipeline = new
            {
                sourced = sourcedCount,
                screening = screeningCount,
                interview = interviewCount,
                offered = offeredCount,
                hired = hiredCount,
                rejected = rejectedCount
            },
            interviewsThisWeek,
            upcomingInterviewsCount,
            positions
        });
    }

    // =========================================================================
    // 2. CANDIDATES LIST & FILTERING
    // =========================================================================
    [HttpGet("candidates")]
    public async Task<IActionResult> GetCandidates(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? position,
        [FromQuery] string archiveStatus = "active",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _context.BypassArchiveFilter = true;
        }

        var query = _context.Candidates
            .Include(c => c.HiredEmployee)
            .AsNoTracking();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(c => c.ArchivedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.CandidateName.ToLower().Contains(s) ||
                (c.Email != null && c.Email.ToLower().Contains(s)) ||
                (c.Phone != null && c.Phone.Contains(s)) ||
                c.AppliedFor.ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(position))
        {
            query = query.Where(c => c.AppliedFor == position);
        }

        var totalCount = await query.CountAsync();

        var candidates = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.CandidateId,
                c.CandidateName,
                c.Email,
                c.Phone,
                c.AppliedFor,
                c.Status,
                c.Source,
                c.CurrentSalary,
                c.ExpectedSalary,
                c.ApplicationDate,
                c.Notes,
                hasResume = c.ResumeData != null && c.ResumeData.Length > 0,
                c.ResumeFileName,
                c.HiredEmployeeId,
                hiredEmployeeName = c.HiredEmployee != null ? c.HiredEmployee.EmployeeName : null,
                c.CreatedAt,
                archivedAt = c.ArchivedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items = candidates,
            page,
            pageSize,
            totalCount,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    // =========================================================================
    // 3. CANDIDATE DETAILS & TIMELINE
    // =========================================================================
    [HttpGet("candidates/{id}")]
    public async Task<IActionResult> GetCandidateDetails(int id)
    {
        var candidate = await _context.Candidates
            .Include(c => c.HiredEmployee)
                .ThenInclude(e => e!.Department)
            .Include(c => c.HiredEmployee)
                .ThenInclude(e => e!.Designation)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CandidateId == id);

        if (candidate == null)
            return NotFound(new { message = "Candidate not found." });

        var interviews = await _context.InterviewSchedules
            .Where(i => i.CandidateId == id)
            .OrderByDescending(i => i.InterviewDateTime)
            .AsNoTracking()
            .Select(i => new
            {
                i.Id,
                i.InterviewDateTime,
                i.InterviewType,
                i.Round,
                i.InterviewerName,
                i.InterviewerPhone,
                i.Location,
                i.Status,
                i.Result,
                i.Feedback,
                i.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            candidate = new
            {
                candidate.CandidateId,
                candidate.CandidateName,
                candidate.Email,
                candidate.Phone,
                candidate.AppliedFor,
                candidate.Status,
                candidate.Source,
                candidate.CurrentSalary,
                candidate.ExpectedSalary,
                candidate.ApplicationDate,
                candidate.Notes,
                hasResume = candidate.ResumeData != null && candidate.ResumeData.Length > 0,
                candidate.ResumeFileName,
                candidate.HiredEmployeeId,
                hiredEmployee = candidate.HiredEmployee != null ? new
                {
                    candidate.HiredEmployee.EmployeeId,
                    candidate.HiredEmployee.EmployeeName,
                    candidate.HiredEmployee.JoiningDate,
                    department = candidate.HiredEmployee.Department?.DepartmentName,
                    designation = candidate.HiredEmployee.Designation?.DesignationName
                } : null,
                candidate.CreatedAt,
                candidate.UpdatedAt
            },
            interviews
        });
    }

    // =========================================================================
    // 4. CREATE CANDIDATE
    // =========================================================================
    public record CreateCandidateRequest(
        string CandidateName,
        string? Email,
        string? Phone,
        string AppliedFor,
        string? Source,
        decimal? CurrentSalary,
        decimal? ExpectedSalary,
        DateOnly? ApplicationDate,
        string? Notes,
        string? ResumeBase64,
        string? ResumeFileName,
        string? ResumeContentType
    );

    [HttpPost("candidates")]
    public async Task<IActionResult> CreateCandidate([FromBody] CreateCandidateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CandidateName))
            return BadRequest(new { message = "Candidate name is required." });

        if (string.IsNullOrWhiteSpace(request.AppliedFor))
            return BadRequest(new { message = "Position applied for is required." });

        byte[]? resumeBytes = null;
        if (!string.IsNullOrEmpty(request.ResumeBase64))
        {
            try
            {
                var cleanBase64 = request.ResumeBase64.Contains(",")
                    ? request.ResumeBase64.Substring(request.ResumeBase64.IndexOf(",") + 1)
                    : request.ResumeBase64;
                resumeBytes = Convert.FromBase64String(cleanBase64);
            }
            catch {}
        }

        var candidate = new Candidate
        {
            OrganizationId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1,
            CandidateName = request.CandidateName.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            AppliedFor = request.AppliedFor.Trim(),
            Status = "Sourced",
            Source = request.Source?.Trim() ?? "Direct Portal",
            CurrentSalary = request.CurrentSalary,
            ExpectedSalary = request.ExpectedSalary,
            ApplicationDate = request.ApplicationDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Notes = request.Notes?.Trim(),
            ResumeData = resumeBytes,
            ResumeFileName = request.ResumeFileName,
            ResumeContentType = request.ResumeContentType ?? "application/pdf",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Candidates.Add(candidate);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Candidate created successfully.",
            candidateId = candidate.CandidateId
        });
    }

    // =========================================================================
    // 5. UPDATE CANDIDATE DETAILS
    // =========================================================================
    public record UpdateCandidateRequest(
        string CandidateName,
        string? Email,
        string? Phone,
        string AppliedFor,
        string? Source,
        decimal? CurrentSalary,
        decimal? ExpectedSalary,
        DateOnly? ApplicationDate,
        string? Notes
    );

    [HttpPut("candidates/{id}")]
    public async Task<IActionResult> UpdateCandidate(int id, [FromBody] UpdateCandidateRequest request)
    {
        var candidate = await _context.Candidates.FindAsync(id);
        if (candidate == null)
            return NotFound(new { message = "Candidate not found." });

        candidate.CandidateName = request.CandidateName.Trim();
        candidate.Email = request.Email?.Trim();
        candidate.Phone = request.Phone?.Trim();
        candidate.AppliedFor = request.AppliedFor.Trim();
        candidate.Source = request.Source?.Trim();
        candidate.CurrentSalary = request.CurrentSalary;
        candidate.ExpectedSalary = request.ExpectedSalary;
        if (request.ApplicationDate.HasValue) candidate.ApplicationDate = request.ApplicationDate.Value;
        candidate.Notes = request.Notes?.Trim();
        candidate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Candidate updated successfully." });
    }

    // =========================================================================
    // 6. UPDATE STAGE (PATCH /status)
    // =========================================================================
    public record UpdateStageRequest(string Status);

    [HttpPatch("candidates/{id}/status")]
    public async Task<IActionResult> UpdateCandidateStatus(int id, [FromBody] UpdateStageRequest request)
    {
        var validStatuses = new[] { "Sourced", "Screening", "Interview", "Offered", "Hired", "Rejected" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest(new { message = "Invalid candidate stage." });

        var candidate = await _context.Candidates.FindAsync(id);
        if (candidate == null)
            return NotFound(new { message = "Candidate not found." });

        candidate.Status = request.Status;
        candidate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Candidate moved to {request.Status}." });
    }

    // =========================================================================
    // 7. 1-CLICK HIRE CANDIDATE -> EMPLOYEE
    // =========================================================================
    public record HireCandidateRequest(
        int? EmployeeId,
        int? DepartmentId,
        int? DesignationId,
        int? ReportingManagerId,
        DateOnly? JoiningDate,
        int? ProbationDays,
        string? Weekoff
    );

    [HttpPost("candidates/{id}/hire")]
    public async Task<IActionResult> HireCandidate(int id, [FromBody] HireCandidateRequest request)
    {
        var candidate = await _context.Candidates.FindAsync(id);
        if (candidate == null)
            return NotFound(new { message = "Candidate not found." });

        if (candidate.Status == "Hired" && candidate.HiredEmployeeId.HasValue)
            return BadRequest(new { message = "Candidate is already hired as an employee." });

        int targetEmpId = request.EmployeeId ?? 0;
        if (targetEmpId <= 0)
        {
            var existingIds = await _context.Employees.Select(e => e.EmployeeId).ToListAsync();
            targetEmpId = 1;
            while (existingIds.Contains(targetEmpId))
            {
                targetEmpId++;
            }
        }
        else
        {
            bool exists = await _context.Employees.AnyAsync(e => e.EmployeeId == targetEmpId);
            if (exists)
                return BadRequest(new { message = $"Employee ID #{targetEmpId} is already assigned." });
        }

        var joiningDate = request.JoiningDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly? probEnd = null;
        if (request.ProbationDays.HasValue && request.ProbationDays.Value > 0)
        {
            probEnd = joiningDate.AddDays(request.ProbationDays.Value);
        }

        var newEmployee = new Employee
        {
            EmployeeId = targetEmpId,
            OrganizationId = candidate.OrganizationId > 0 ? candidate.OrganizationId : 1,
            EmployeeName = candidate.CandidateName,
            Phone = candidate.Phone,
            DepartmentId = request.DepartmentId,
            DesignationId = request.DesignationId,
            ReportingManagerId = request.ReportingManagerId,
            JoiningDate = joiningDate,
            ProbationStart = joiningDate,
            ProbationEnd = probEnd,
            Weekoff = request.Weekoff ?? "Sunday",
            Status = "active"
        };

        _context.Employees.Add(newEmployee);

        candidate.HiredEmployeeId = targetEmpId;
        candidate.Status = "Hired";
        candidate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"{candidate.CandidateName} hired successfully as Employee #{targetEmpId}.",
            employeeId = targetEmpId
        });
    }

    // =========================================================================
    // 8. DOWNLOAD CANDIDATE RESUME
    // =========================================================================
    [HttpGet("candidates/{id}/resume")]
    public async Task<IActionResult> DownloadResume(int id)
    {
        var candidate = await _context.Candidates.AsNoTracking().FirstOrDefaultAsync(c => c.CandidateId == id);
        if (candidate == null || candidate.ResumeData == null || candidate.ResumeData.Length == 0)
            return NotFound(new { message = "Resume document not available." });

        var fileName = candidate.ResumeFileName ?? $"{candidate.CandidateName.Replace(" ", "_")}_Resume.pdf";
        var contentType = candidate.ResumeContentType ?? "application/pdf";

        return File(candidate.ResumeData, contentType, fileName);
    }

    // =========================================================================
    // 9. DELETE CANDIDATE
    // =========================================================================
    [HttpDelete("candidates/{id}")]
    public async Task<IActionResult> DeleteCandidate(int id, [FromQuery] bool permanent = false)
    {
        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<Candidate>(id));

        return FromArchive(await _archive.PermanentDeleteAsync<Candidate>(id, cascade: async _ =>
        {
            var interviews = await _context.InterviewSchedules.Where(i => i.CandidateId == id).ToListAsync();
            _context.InterviewSchedules.RemoveRange(interviews);
        }));
    }

    [HttpPost("candidates/{id}/restore")]
    public async Task<IActionResult> RestoreCandidate(int id)
        => FromArchive(await _archive.RestoreAsync<Candidate>(id));

    // =========================================================================
    // 10. INTERVIEW SCHEDULES
    // =========================================================================
    [HttpGet("interviews")]
    public async Task<IActionResult> GetInterviews(
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string archiveStatus = "active")
    {
        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase) || archiveStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            _context.BypassArchiveFilter = true;
        }

        var query = _context.InterviewSchedules
            .Include(i => i.Candidate)
            .AsNoTracking();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(i => i.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(i => i.ArchivedAt == null);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(i => i.Status == status);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(i => i.InterviewDateTime >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(i => i.InterviewDateTime <= toDate.Value);
        }

        var interviews = await query
            .OrderBy(i => i.InterviewDateTime)
            .Select(i => new
            {
                i.Id,
                i.CandidateId,
                candidateName = i.Candidate != null ? i.Candidate.CandidateName : "Unknown",
                appliedFor = i.Candidate != null ? i.Candidate.AppliedFor : "",
                candidatePhone = i.Candidate != null ? i.Candidate.Phone : "",
                candidateEmail = i.Candidate != null ? i.Candidate.Email : "",
                i.InterviewDateTime,
                i.InterviewType,
                i.Round,
                i.InterviewerName,
                i.InterviewerPhone,
                i.Location,
                i.Status,
                i.Result,
                i.Feedback,
                i.CreatedAt,
                archivedAt = i.ArchivedAt
            })
            .ToListAsync();

        return Ok(interviews);
    }

    // =========================================================================
    // 11. SCHEDULE INTERVIEW
    // =========================================================================
    public record ScheduleInterviewRequest(
        int CandidateId,
        DateTime InterviewDateTime,
        string InterviewType,
        string Round,
        string InterviewerName,
        string? InterviewerPhone,
        string? Location
    );

    [HttpPost("interviews")]
    public async Task<IActionResult> ScheduleInterview([FromBody] ScheduleInterviewRequest request)
    {
        var candidate = await _context.Candidates.FindAsync(request.CandidateId);
        if (candidate == null)
            return NotFound(new { message = "Candidate not found." });

        var interview = new InterviewSchedule
        {
            OrganizationId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1,
            CandidateId = request.CandidateId,
            InterviewDateTime = request.InterviewDateTime,
            InterviewType = request.InterviewType ?? "In-Person",
            Round = request.Round ?? "Round 1",
            InterviewerName = request.InterviewerName.Trim(),
            InterviewerPhone = request.InterviewerPhone?.Trim(),
            Location = request.Location?.Trim(),
            Status = "Scheduled",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.InterviewSchedules.Add(interview);

        // Advance candidate status to 'Interview' if currently 'Sourced' or 'Screening'
        if (candidate.Status == "Sourced" || candidate.Status == "Screening")
        {
            candidate.Status = "Interview";
            candidate.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Interview scheduled successfully.",
            interviewId = interview.Id
        });
    }

    // =========================================================================
    // 12. RECORD INTERVIEW FEEDBACK & RESULT
    // =========================================================================
    public record InterviewFeedbackRequest(
        string Status, // Completed, Cancelled, No Show
        string? Result, // Pass, Fail, Hold
        string? Feedback
    );

    [HttpPut("interviews/{id}")]
    public async Task<IActionResult> UpdateInterview(int id, [FromBody] InterviewFeedbackRequest request)
    {
        var interview = await _context.InterviewSchedules.FindAsync(id);
        if (interview == null)
            return NotFound(new { message = "Interview schedule not found." });

        interview.Status = request.Status ?? "Completed";
        interview.Result = request.Result;
        interview.Feedback = request.Feedback?.Trim();
        interview.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Interview feedback saved." });
    }

    // =========================================================================
    // 13. CANCEL / DELETE INTERVIEW
    // =========================================================================
    [HttpDelete("interviews/{id}")]
    public async Task<IActionResult> DeleteInterview(int id, [FromQuery] bool permanent = false)
    {
        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<InterviewSchedule>(id));

        return FromArchive(await _archive.PermanentDeleteAsync<InterviewSchedule>(id));
    }

    [HttpPost("interviews/{id}/restore")]
    public async Task<IActionResult> RestoreInterview(int id)
        => FromArchive(await _archive.RestoreAsync<InterviewSchedule>(id));
}
