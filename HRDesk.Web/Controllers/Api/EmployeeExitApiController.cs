using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/employee-exits")]
[Authorize]
public class EmployeeExitApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly IArchiveService _archive;

    private static bool _tableEnsured = false;
    private static readonly object _tableLock = new();

    public EmployeeExitApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        IArchiveService archive)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _archive = archive;
        EnsureTable();
    }

    private void EnsureTable()
    {
        if (_tableEnsured) return;
        lock (_tableLock)
        {
            if (_tableEnsured) return;
            try
            {
                var sql = @"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employee_exits')
BEGIN
    CREATE TABLE employee_exits (
        id INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT NOT NULL,
        employee_id INT NOT NULL,
        exit_type NVARCHAR(50) NOT NULL,
        initiated_by NVARCHAR(50) NOT NULL,
        resignation_date DATE NOT NULL,
        last_working_date DATE NOT NULL,
        notice_period_days INT NOT NULL DEFAULT 30,
        reason NVARCHAR(100) NOT NULL,
        reason_details NVARCHAR(1000) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'Submitted',
        approved_by_user_id INT NULL,
        approved_by_name NVARCHAR(150) NULL,
        approved_at DATETIME2 NULL,
        remarks NVARCHAR(1000) NULL,
        is_eligible_for_rehire BIT NOT NULL DEFAULT 1,
        handover_status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        clearance_checklist_json NVARCHAR(2000) NULL,
        handover_notes NVARCHAR(1000) NULL,
        exit_interview_completed BIT NOT NULL DEFAULT 0,
        exit_interview_rating INT NULL,
        exit_interview_notes NVARCHAR(2000) NULL,
        settlement_status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        relieved_at DATETIME2 NULL,
        resignation_doc_data VARBINARY(MAX) NULL,
        resignation_doc_filename NVARCHAR(255) NULL,
        resignation_doc_content_type NVARCHAR(100) NULL,
        relieving_letter_data VARBINARY(MAX) NULL,
        relieving_letter_filename NVARCHAR(255) NULL,
        relieving_letter_content_type NVARCHAR(100) NULL,
        experience_letter_data VARBINARY(MAX) NULL,
        experience_letter_filename NVARCHAR(255) NULL,
        experience_letter_content_type NVARCHAR(100) NULL,
        clearance_doc_data VARBINARY(MAX) NULL,
        clearance_doc_filename NVARCHAR(255) NULL,
        clearance_doc_content_type NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        archived_at DATETIME2 NULL,
        archived_by NVARCHAR(150) NULL
    );
END;";
                _db.Database.ExecuteSqlRaw(sql);
                _tableEnsured = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EnsureTable ERROR]: {ex.Message}");
            }
        }
    }

    private IActionResult FromArchive(ArchiveResult result) =>
        result.Success
            ? Ok(new { success = true, message = result.Message })
            : result.ErrorCode == ArchiveResult.NotFound
                ? NotFound(new { success = false, message = result.Message })
                : BadRequest(new { success = false, message = result.Message, code = result.ErrorCode });

    // ── 1. OVERVIEW METRICS ──────────────────────────────────────────────────
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
            return Forbid();

        EnsureTable();
        // Bypass global tenant filter; we apply the org scope manually below.
        _db.BypassTenantId = true;
        _db.BypassArchiveFilter = true;
        var resolvedOrgId = _tenantProvider.TenantId;
        Console.WriteLine($"[ExitOverview] resolvedOrgId={resolvedOrgId}");

        var query = _db.EmployeeExits.AsNoTracking()
            .Where(e => resolvedOrgId == 0 || e.OrganizationId == resolvedOrgId)
            .Where(e => e.ArchivedAt == null);
        var total = await query.CountAsync();
        var pendingApproval = await query.CountAsync(e => e.Status == "Submitted");
        var inNoticePeriod = await query.CountAsync(e => e.Status == "InNoticePeriod" || e.Status == "Approved");
        var clearancePending = await query.CountAsync(e => e.Status == "ClearancePending");
        
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfMonth = new DateOnly(today.Year, today.Month, 1);
        var completedThisMonth = await query.CountAsync(e => e.Status == "Completed" && e.LastWorkingDate >= startOfMonth && e.LastWorkingDate <= today);

        return Ok(new
        {
            total,
            pendingApproval,
            inNoticePeriod,
            clearancePending,
            completedThisMonth
        });
    }

    // ── 2. GET LIST ──────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetExits(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? exitType = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] string archiveStatus = "active",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
            return Forbid();

        EnsureTable();
        // Bypass global tenant+archive filters; we apply org scope manually below.
        _db.BypassTenantId = true;
        _db.BypassArchiveFilter = true;
        var resolvedOrgId = _tenantProvider.TenantId;
        Console.WriteLine($"[ExitList] resolvedOrgId={resolvedOrgId}");

        var query = _db.EmployeeExits
            .Include(e => e.Employee)
                .ThenInclude(emp => emp!.Department)
            .Include(e => e.Employee)
                .ThenInclude(emp => emp!.Designation)
            .AsNoTracking()
            .Where(e => resolvedOrgId == 0 || e.OrganizationId == resolvedOrgId)
            .AsQueryable();

        if (archiveStatus.Equals("archived", StringComparison.OrdinalIgnoreCase))
            query = query.Where(e => e.ArchivedAt != null);
        else if (archiveStatus.Equals("active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(e => e.ArchivedAt == null);

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(e => e.Status.ToLower() == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(exitType) && exitType != "all")
        {
            query = query.Where(e => e.ExitType.ToLower() == exitType.ToLower());
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(e => e.Employee != null && e.Employee.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e =>
                (e.Employee != null && e.Employee.EmployeeName.ToLower().Contains(s)) ||
                (e.Employee != null && e.Employee.EmployeeId.ToString().Contains(s)) ||
                e.Reason.ToLower().Contains(s));
        }

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var rawItems = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.Id,
                e.EmployeeId,
                EmployeeName = e.Employee != null ? e.Employee.EmployeeName : "Unknown",
                EmployeeRawId = e.Employee != null ? e.Employee.EmployeeId : 0,
                EmployeePublicId = e.Employee != null ? e.Employee.PublicId.ToString() : null,
                DepartmentName = e.Employee != null && e.Employee.Department != null ? e.Employee.Department.DepartmentName : null,
                DesignationName = e.Employee != null && e.Employee.Designation != null ? e.Employee.Designation.DesignationName : null,
                PhotoPath = e.Employee != null ? e.Employee.PhotoPath : null,
                e.ExitType,
                e.InitiatedBy,
                e.ResignationDate,
                e.LastWorkingDate,
                e.NoticePeriodDays,
                e.Reason,
                e.ReasonDetails,
                e.Status,
                e.ApprovedByName,
                e.ApprovedAt,
                e.IsEligibleForRehire,
                e.HandoverStatus,
                e.ExitInterviewCompleted,
                e.ExitInterviewRating,
                e.SettlementStatus,
                e.RelievedAt,
                HasResignationDoc = e.ResignationDocData != null && e.ResignationDocData.Length > 0,
                HasRelievingDoc = e.RelievingLetterData != null && e.RelievingLetterData.Length > 0,
                HasExperienceDoc = e.ExperienceLetterData != null && e.ExperienceLetterData.Length > 0,
                HasClearanceDoc = e.ClearanceDocData != null && e.ClearanceDocData.Length > 0,
                e.ArchivedAt,
                e.CreatedAt
            })
            .ToListAsync();

        var items = rawItems.Select(e => new
        {
            e.Id,
            e.EmployeeId,
            employeeName = e.EmployeeName,
            employeeCode = e.EmployeeRawId > 0 ? $"EMP#{e.EmployeeRawId:D3}" : "",
            employeePublicId = e.EmployeePublicId,
            department = e.DepartmentName,
            designation = e.DesignationName,
            photoPath = e.PhotoPath,
            e.ExitType,
            e.InitiatedBy,
            resignationDate = e.ResignationDate.ToString("yyyy-MM-dd"),
            lastWorkingDate = e.LastWorkingDate.ToString("yyyy-MM-dd"),
            e.NoticePeriodDays,
            remainingDays = (e.Status == "InNoticePeriod" || e.Status == "Approved" || e.Status == "Submitted")
                ? (e.LastWorkingDate.DayNumber - today.DayNumber)
                : 0,
            e.Reason,
            e.ReasonDetails,
            e.Status,
            e.ApprovedByName,
            approvedAt = e.ApprovedAt != null ? e.ApprovedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
            e.IsEligibleForRehire,
            e.HandoverStatus,
            e.ExitInterviewCompleted,
            e.ExitInterviewRating,
            e.SettlementStatus,
            relievedAt = e.RelievedAt != null ? e.RelievedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
            hasResignationDoc = e.HasResignationDoc,
            hasRelievingDoc = e.HasRelievingDoc,
            hasExperienceDoc = e.HasExperienceDoc,
            hasClearanceDoc = e.HasClearanceDoc,
            e.ArchivedAt,
            createdAt = e.CreatedAt.ToString("yyyy-MM-dd HH:mm")
        }).ToList();

        return Ok(new
        {
            totalCount,
            totalPages,
            page,
            pageSize,
            items
        });
    }

    // ── 3. GET SINGLE DETAILS ────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetExit(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
            return Forbid();

        EnsureTable();
        _db.BypassTenantId = true;
        _db.BypassArchiveFilter = true;
        var resolvedOrgId = _tenantProvider.TenantId;

        var exit = await _db.EmployeeExits
            .Include(e => e.Employee)
                .ThenInclude(emp => emp!.Department)
            .Include(e => e.Employee)
                .ThenInclude(emp => emp!.Designation)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && (resolvedOrgId == 0 || e.OrganizationId == resolvedOrgId));

        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return Ok(new
        {
            exit.Id,
            exit.EmployeeId,
            employeeName = exit.Employee?.EmployeeName ?? "Unknown",
            employeeCode = exit.Employee != null ? $"EMP#{exit.Employee.EmployeeId:D3}" : "",
            employeePublicId = exit.Employee?.PublicId.ToString(),
            department = exit.Employee?.Department?.DepartmentName,
            designation = exit.Employee?.Designation?.DesignationName,
            phone = exit.Employee?.Phone,
            joiningDate = exit.Employee?.JoiningDate?.ToString("yyyy-MM-dd"),
            exit.ExitType,
            exit.InitiatedBy,
            resignationDate = exit.ResignationDate.ToString("yyyy-MM-dd"),
            lastWorkingDate = exit.LastWorkingDate.ToString("yyyy-MM-dd"),
            exit.NoticePeriodDays,
            remainingDays = (exit.LastWorkingDate.DayNumber - today.DayNumber),
            exit.Reason,
            exit.ReasonDetails,
            exit.Status,
            exit.ApprovedByName,
            approvedAt = exit.ApprovedAt?.ToString("yyyy-MM-dd HH:mm"),
            exit.Remarks,
            exit.IsEligibleForRehire,
            exit.HandoverStatus,
            exit.ClearanceChecklistJson,
            exit.HandoverNotes,
            exit.ExitInterviewCompleted,
            exit.ExitInterviewRating,
            exit.ExitInterviewNotes,
            exit.SettlementStatus,
            relievedAt = exit.RelievedAt?.ToString("yyyy-MM-dd HH:mm"),
            hasResignationDoc = exit.ResignationDocData != null && exit.ResignationDocData.Length > 0,
            resignationDocName = exit.ResignationDocFileName,
            hasRelievingDoc = exit.RelievingLetterData != null && exit.RelievingLetterData.Length > 0,
            relievingDocName = exit.RelievingLetterFileName,
            hasExperienceDoc = exit.ExperienceLetterData != null && exit.ExperienceLetterData.Length > 0,
            experienceDocName = exit.ExperienceLetterFileName,
            hasClearanceDoc = exit.ClearanceDocData != null && exit.ClearanceDocData.Length > 0,
            clearanceDocName = exit.ClearanceDocFileName,
            exit.ArchivedAt
        });
    }

    // ── 4. INITIATE EXIT (Resignation / Termination / Contract End) ───────────
    public record InitiateExitRequest(
        int EmployeeId,
        string ExitType,
        DateOnly? ResignationDate,
        DateOnly? LastWorkingDate,
        int? NoticePeriodDays,
        string Reason,
        string? ReasonDetails,
        bool? IsEligibleForRehire,
        string? DocumentBase64,
        string? DocumentFileName,
        string? DocumentContentType
    );

    [HttpPost("initiate")]
    public async Task<IActionResult> InitiateExit([FromBody] InitiateExitRequest request)
    {
        try
        {
            if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
                return Forbid();

            EnsureTable();

            var employee = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == request.EmployeeId);
            if (employee == null)
                return NotFound(new { message = "Employee not found." });

            var existingPending = await _db.EmployeeExits
                .AnyAsync(e => e.EmployeeId == request.EmployeeId && e.ArchivedAt == null && (e.Status == "Submitted" || e.Status == "InNoticePeriod" || e.Status == "ClearancePending"));
            if (existingPending)
                return BadRequest(new { message = "An active exit request is already in progress for this employee." });

            var noticeDays = request.NoticePeriodDays ?? employee.NoticePeriodDays ?? 30;
            var resDate = request.ResignationDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var lwd = request.LastWorkingDate ?? resDate.AddDays(noticeDays);

            byte[]? docBytes = null;
            if (!string.IsNullOrEmpty(request.DocumentBase64))
            {
                try
                {
                    var clean = request.DocumentBase64.Contains(",")
                        ? request.DocumentBase64.Substring(request.DocumentBase64.IndexOf(",") + 1)
                        : request.DocumentBase64;
                    docBytes = Convert.FromBase64String(clean);
                }
                catch {}
            }

            var isTermination = request.ExitType.Equals("Termination", StringComparison.OrdinalIgnoreCase);

            var exit = new EmployeeExit
            {
                OrganizationId = employee.OrganizationId > 0 ? employee.OrganizationId : 1,
                EmployeeId = employee.EmployeeId,
                ExitType = request.ExitType,
                InitiatedBy = isTermination ? "Admin" : "Employee",
                ResignationDate = resDate,
                LastWorkingDate = lwd,
                NoticePeriodDays = noticeDays,
                Reason = request.Reason,
                ReasonDetails = request.ReasonDetails,
                Status = isTermination ? "InNoticePeriod" : "Submitted",
                IsEligibleForRehire = request.IsEligibleForRehire ?? !isTermination,
                ResignationDocData = docBytes,
                ResignationDocFileName = request.DocumentFileName,
                ResignationDocContentType = request.DocumentContentType ?? "application/pdf",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (isTermination)
            {
                exit.ApprovedByName = User.Identity?.Name ?? "Admin";
                exit.ApprovedAt = DateTime.UtcNow;
            }

            // Update employee's notice and resignation fields
            employee.ResignationDate = resDate;
            employee.LastWorkingDate = lwd;

            _db.EmployeeExits.Add(exit);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = isTermination ? "Employee termination initiated." : "Resignation request submitted successfully.",
                exitId = exit.Id
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EmployeeExitApiController.InitiateExit] ERROR: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"[EmployeeExitApiController.InitiateExit] INNER: {ex.InnerException.Message}");
            }
            return StatusCode(500, new { message = ex.InnerException?.Message ?? ex.Message });
        }
    }

    // ── 5. APPROVE RESIGNATION ───────────────────────────────────────────────
    public record ApproveExitRequest(
        DateOnly? AdjustedLastWorkingDate,
        string? Remarks
    );

    [HttpPut("{id:int}/approve")]
    public async Task<IActionResult> ApproveResignation(int id, [FromBody] ApproveExitRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.Include(e => e.Employee).FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        if (exit.Status != "Submitted")
            return BadRequest(new { message = $"Cannot approve an exit that is in '{exit.Status}' status." });

        if (request.AdjustedLastWorkingDate.HasValue)
        {
            exit.LastWorkingDate = request.AdjustedLastWorkingDate.Value;
            if (exit.Employee != null)
            {
                exit.Employee.LastWorkingDate = request.AdjustedLastWorkingDate.Value;
            }
        }

        exit.Status = "InNoticePeriod";
        exit.ApprovedByName = User.Identity?.Name ?? "Admin";
        exit.ApprovedAt = DateTime.UtcNow;
        exit.Remarks = request.Remarks;
        exit.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { message = "Resignation approved. Employee is now serving notice period." });
    }

    // ── 6. REJECT / WITHDRAW EXIT ────────────────────────────────────────────
    public record RejectExitRequest(string Reason);

    [HttpPut("{id:int}/reject")]
    public async Task<IActionResult> RejectResignation(int id, [FromBody] RejectExitRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.Include(e => e.Employee).FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        exit.Status = "Rejected";
        exit.Remarks = request.Reason;
        exit.UpdatedAt = DateTime.UtcNow;

        if (exit.Employee != null)
        {
            exit.Employee.ResignationDate = null;
            exit.Employee.LastWorkingDate = null;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Resignation request rejected." });
    }

    [HttpPost("{id:int}/withdraw")]
    public async Task<IActionResult> WithdrawResignation(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.Include(e => e.Employee).FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        if (exit.Status == "Completed")
            return BadRequest(new { message = "Cannot withdraw an exit that is already completed." });

        exit.Status = "Withdrawn";
        exit.UpdatedAt = DateTime.UtcNow;

        if (exit.Employee != null)
        {
            exit.Employee.ResignationDate = null;
            exit.Employee.LastWorkingDate = null;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Resignation withdrawn successfully." });
    }

    // ── 7. UPDATE CLEARANCE & EXIT INTERVIEW ──────────────────────────────────
    public record UpdateClearanceRequest(
        string? ClearanceChecklistJson,
        string? HandoverStatus,
        string? HandoverNotes,
        bool? ExitInterviewCompleted,
        int? ExitInterviewRating,
        string? ExitInterviewNotes,
        string? SettlementStatus
    );

    [HttpPut("{id:int}/clearance")]
    public async Task<IActionResult> UpdateClearance(int id, [FromBody] UpdateClearanceRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        if (request.ClearanceChecklistJson != null) exit.ClearanceChecklistJson = request.ClearanceChecklistJson;
        if (request.HandoverStatus != null) exit.HandoverStatus = request.HandoverStatus;
        if (request.HandoverNotes != null) exit.HandoverNotes = request.HandoverNotes;
        if (request.ExitInterviewCompleted.HasValue) exit.ExitInterviewCompleted = request.ExitInterviewCompleted.Value;
        if (request.ExitInterviewRating.HasValue) exit.ExitInterviewRating = request.ExitInterviewRating.Value;
        if (request.ExitInterviewNotes != null) exit.ExitInterviewNotes = request.ExitInterviewNotes;
        if (request.SettlementStatus != null) exit.SettlementStatus = request.SettlementStatus;

        if (exit.Status == "InNoticePeriod" && exit.HandoverStatus == "InProgress")
        {
            exit.Status = "ClearancePending";
        }

        exit.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Clearance and exit interview saved." });
    }

    // ── 8. UPLOAD EXIT DOCUMENTS ─────────────────────────────────────────────
    public record UploadDocumentRequest(
        string DocumentType, // resignation, relieving, experience, clearance
        string DocumentBase64,
        string FileName,
        string? ContentType
    );

    [HttpPost("{id:int}/documents")]
    public async Task<IActionResult> UploadDocument(int id, [FromBody] UploadDocumentRequest request)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        byte[]? docBytes = null;
        try
        {
            var clean = request.DocumentBase64.Contains(",")
                ? request.DocumentBase64.Substring(request.DocumentBase64.IndexOf(",") + 1)
                : request.DocumentBase64;
            docBytes = Convert.FromBase64String(clean);
        }
        catch
        {
            return BadRequest(new { message = "Invalid base64 document format." });
        }

        var ct = request.ContentType ?? "application/pdf";

        switch (request.DocumentType.ToLower())
        {
            case "resignation":
                exit.ResignationDocData = docBytes;
                exit.ResignationDocFileName = request.FileName;
                exit.ResignationDocContentType = ct;
                break;
            case "relieving":
                exit.RelievingLetterData = docBytes;
                exit.RelievingLetterFileName = request.FileName;
                exit.RelievingLetterContentType = ct;
                break;
            case "experience":
                exit.ExperienceLetterData = docBytes;
                exit.ExperienceLetterFileName = request.FileName;
                exit.ExperienceLetterContentType = ct;
                break;
            case "clearance":
                exit.ClearanceDocData = docBytes;
                exit.ClearanceDocFileName = request.FileName;
                exit.ClearanceDocContentType = ct;
                break;
            default:
                return BadRequest(new { message = "Invalid document type. Allowed: resignation, relieving, experience, clearance." });
        }

        exit.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"{request.DocumentType} document uploaded successfully." });
    }

    // ── 9. DOWNLOAD EXIT DOCUMENT ────────────────────────────────────────────
    [HttpGet("{id:int}/documents/{docType}")]
    public async Task<IActionResult> DownloadDocument(int id, string docType)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesView))
            return Forbid();

        _db.BypassArchiveFilter = true;
        var exit = await _db.EmployeeExits.Include(e => e.Employee).FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        byte[]? data = null;
        string? filename = null;
        string? contentType = null;

        switch (docType.ToLower())
        {
            case "resignation":
                data = exit.ResignationDocData;
                filename = exit.ResignationDocFileName ?? $"Resignation_{exit.Employee?.EmployeeName}.pdf";
                contentType = exit.ResignationDocContentType ?? "application/pdf";
                break;
            case "relieving":
                data = exit.RelievingLetterData;
                filename = exit.RelievingLetterFileName ?? $"Relieving_Letter_{exit.Employee?.EmployeeName}.pdf";
                contentType = exit.RelievingLetterContentType ?? "application/pdf";
                break;
            case "experience":
                data = exit.ExperienceLetterData;
                filename = exit.ExperienceLetterFileName ?? $"Experience_Letter_{exit.Employee?.EmployeeName}.pdf";
                contentType = exit.ExperienceLetterContentType ?? "application/pdf";
                break;
            case "clearance":
                data = exit.ClearanceDocData;
                filename = exit.ClearanceDocFileName ?? $"Clearance_Form_{exit.Employee?.EmployeeName}.pdf";
                contentType = exit.ClearanceDocContentType ?? "application/pdf";
                break;
        }

        if (data == null || data.Length == 0)
            return NotFound(new { message = "Requested document not available." });

        return File(data, contentType, filename);
    }

    // ── 10. COMPLETE OFFBOARDING & RELIEVE EMPLOYEE ──────────────────────────
    [HttpPost("{id:int}/complete")]
    public async Task<IActionResult> CompleteExit(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        var exit = await _db.EmployeeExits.Include(e => e.Employee).FirstOrDefaultAsync(e => e.Id == id);
        if (exit == null)
            return NotFound(new { message = "Exit record not found." });

        exit.Status = "Completed";
        exit.HandoverStatus = "Completed";
        exit.RelievedAt = DateTime.UtcNow;
        exit.UpdatedAt = DateTime.UtcNow;

        if (exit.Employee != null)
        {
            exit.Employee.Status = "inactive";
            exit.Employee.LastWorkingDate = exit.LastWorkingDate;
            exit.Employee.ResignationDate = exit.ResignationDate;

            // Deactivate portal login access for this employee
            var empId = exit.Employee.EmployeeId;
            var users = await _db.Users.Where(u => u.EmployeeId == empId).ToListAsync();
            foreach (var u in users)
            {
                u.IsActive = false;
            }
        }

        await _db.SaveChangesAsync();
        _permissionService.ClearCache();

        return Ok(new
        {
            message = $"{exit.Employee?.EmployeeName ?? "Employee"} has been officially relieved and deactivated.",
            status = "Completed"
        });
    }

    // ── 11. DELETE / ARCHIVE ─────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteExit(int id, [FromQuery] bool permanent = false)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesDelete))
            return Forbid();

        if (!permanent)
            return FromArchive(await _archive.ArchiveAsync<EmployeeExit>(id));

        return FromArchive(await _archive.PermanentDeleteAsync<EmployeeExit>(id));
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> RestoreExit(int id)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.EmployeesEdit))
            return Forbid();

        return FromArchive(await _archive.RestoreAsync<EmployeeExit>(id));
    }
}
