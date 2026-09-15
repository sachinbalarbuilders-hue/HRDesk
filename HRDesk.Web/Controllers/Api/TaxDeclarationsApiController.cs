using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using HRDesk.Web.Services;
using HRDesk.Web.Services.Infrastructure;
using HRDesk.Web.Services.Payroll;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/tax-declarations")]
[Authorize]
public class TaxDeclarationsApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ICurrentTenantProvider _tenantProvider;
    private readonly TaxComputationService _taxService;

    public TaxDeclarationsApiController(
        BiometricAttendanceDbContext db,
        IPermissionService permissionService,
        ICurrentTenantProvider tenantProvider,
        TaxComputationService taxService)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _taxService = taxService;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst("EmployeeId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return int.TryParse(claim?.Value, out var id) ? id : 0;
    }

    private string GetCurrentUserName()
    {
        return User.Identity?.Name ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "HR Admin";
    }

    // ── GET /api/tax-declarations ─────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetDeclarations(
        [FromQuery] string? financialYear,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int? departmentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var fy = string.IsNullOrWhiteSpace(financialYear)
            ? TaxComputationService.GetFinancialYear(DateOnly.FromDateTime(DateTime.Today))
            : financialYear;

        var empQuery = _db.Employees
            .AsNoTracking()
            .Where(e => e.OrganizationId == orgId && e.Status == "Active");

        empQuery = await _permissionService.ApplyEmployeeScopeAsync(empQuery, User, AppPermissions.Keys.PayrollView);

        if (departmentId.HasValue && departmentId.Value > 0)
            empQuery = empQuery.Where(e => e.DepartmentId == departmentId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            empQuery = empQuery.Where(e => e.EmployeeName.ToLower().Contains(s) || e.EmployeeId.ToString().Contains(s));
        }

        var employees = await empQuery
            .Select(e => new
            {
                e.EmployeeId,
                FullName = e.EmployeeName,
                DepartmentName = e.Department != null ? e.Department.DepartmentName : "-",
                DesignationName = e.Designation != null ? e.Designation.DesignationName : "-",
                e.BranchId
            })
            .ToListAsync();

        var empIds = employees.Select(e => e.EmployeeId).ToList();

        var declarations = await _db.EmployeeTaxDeclarations
            .AsNoTracking()
            .Where(d => d.OrganizationId == orgId &&
                        d.FinancialYear == fy &&
                        empIds.Contains(d.EmployeeId))
            .ToListAsync();

        var declMap = declarations.ToDictionary(d => d.EmployeeId);

        // Fetch active CTC records to estimate tax
        var activeCtcs = await _db.EmployeeCTCs
            .AsNoTracking()
            .Where(c => empIds.Contains(c.EmployeeId) && c.EffectiveTo == null)
            .ToDictionaryAsync(c => c.EmployeeId, c => c.AnnualCTC);

        var list = employees.Select(e =>
        {
            declMap.TryGetValue(e.EmployeeId, out var decl);
            activeCtcs.TryGetValue(e.EmployeeId, out var annualCtc);

            var total80C = decl != null ? (decl.Sec80C_EPF + decl.Sec80C_PPF + decl.Sec80C_ELSS + decl.Sec80C_LifeInsurance +
                                          decl.Sec80C_TuitionFees + decl.Sec80C_HomeLoanPrincipal + decl.Sec80C_Other) : 0m;

            var regime = decl?.TaxRegime ?? "New";
            var declStatus = decl?.Status ?? "Not Started";

            return new
            {
                e.EmployeeId,
                EmployeeCode = $"EMP-{e.EmployeeId:D4}",
                e.FullName,
                e.DepartmentName,
                e.DesignationName,
                DeclarationId = decl?.Id,
                FinancialYear = fy,
                TaxRegime = regime,
                Status = declStatus,
                AnnualCTC = annualCtc,
                Total80CDeclared = total80C,
                Total80DDeclared = decl != null ? (decl.Sec80D_SelfFamily + decl.Sec80D_Parents + decl.Sec80D_PreventiveCheckup) : 0m,
                AnnualRentPaid = decl?.AnnualRentPaid ?? 0m,
                HomeLoanInterest = decl?.Sec24_HomeLoanInterest ?? 0m,
                SubmittedAt = decl?.SubmittedAt,
                ApprovedAt = decl?.ApprovedAt,
                ApprovedBy = decl?.ApprovedBy
            };
        });

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            list = list.Where(item => string.Equals(item.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        var fullList = list.ToList();
        var totalCount = fullList.Count;
        var paged = fullList.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var counts = new
        {
            Total = fullList.Count,
            Approved = fullList.Count(x => x.Status == "Approved"),
            Submitted = fullList.Count(x => x.Status == "Submitted"),
            Draft = fullList.Count(x => x.Status == "Draft"),
            NotStarted = fullList.Count(x => x.Status == "Not Started")
        };

        return Ok(new
        {
            data = paged,
            metrics = counts,
            page,
            pageSize,
            total = totalCount
        });
    }

    // ── GET /api/tax-declarations/employee/{employeeId} ──────────────────────
    [HttpGet("employee/{employeeId:int}")]
    public async Task<IActionResult> GetEmployeeDeclaration(int employeeId, [FromQuery] string? financialYear)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var fy = string.IsNullOrWhiteSpace(financialYear)
            ? TaxComputationService.GetFinancialYear(DateOnly.FromDateTime(DateTime.Today))
            : financialYear;

        var employee = await _db.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.EmployeeId == employeeId && e.OrganizationId == orgId);

        if (employee == null) return NotFound(new { message = "Employee not found." });

        var declaration = await _db.EmployeeTaxDeclarations
            .AsNoTracking()
            .Include(d => d.Proofs)
            .FirstOrDefaultAsync(d => d.EmployeeId == employeeId && d.FinancialYear == fy);

        // Fetch salary structure or CTC
        var ctc = await _db.EmployeeCTCs
            .AsNoTracking()
            .Include(c => c.Template)
            .ThenInclude(t => t!.Components)
            .FirstOrDefaultAsync(c => c.EmployeeId == employeeId && c.EffectiveTo == null);

        decimal annualGross = ctc?.AnnualCTC ?? 0m;
        decimal annualBasic = annualGross * 0.40m; // standard 40% fallback
        decimal annualHra = annualGross * 0.20m;   // standard 20% fallback

        if (ctc?.Template?.Components != null && ctc.Template.Components.Any())
        {
            var breakdown = SalaryTemplatesApiController.ComputeCTCBreakdown(annualGross, ctc.Template.Components.ToList());
            var basicItem = breakdown.FirstOrDefault(b => b.ComponentName.Contains("Basic", StringComparison.OrdinalIgnoreCase));
            if (basicItem != null) annualBasic = basicItem.Amount * 12m;

            var hraItem = breakdown.FirstOrDefault(b => b.ComponentName.Contains("HRA", StringComparison.OrdinalIgnoreCase) ||
                                                        b.ComponentName.Contains("House Rent", StringComparison.OrdinalIgnoreCase));
            if (hraItem != null) annualHra = hraItem.Amount * 12m;
        }

        var comparison = _taxService.CompareRegimes(
            employeeId,
            employee.EmployeeName,
            fy,
            annualGross,
            annualBasic,
            annualHra,
            declaration);

        return Ok(new
        {
            employee = new
            {
                employee.EmployeeId,
                EmployeeCode = $"EMP#{employee.EmployeeId:D3}",
                FullName = employee.EmployeeName,
                Department = employee.Department?.DepartmentName,
                Designation = employee.Designation?.DesignationName,
                AnnualCTC = annualGross,
                AnnualBasic = annualBasic,
                AnnualHRA = annualHra
            },
            declaration,
            comparison
        });
    }

    // ── POST /api/tax-declarations ────────────────────────────────────────────
    public record SaveDeclarationDto(
        int EmployeeId,
        string FinancialYear,
        string TaxRegime,
        string Status, // "Draft" or "Submitted"
        decimal Sec80C_EPF,
        decimal Sec80C_PPF,
        decimal Sec80C_ELSS,
        decimal Sec80C_LifeInsurance,
        decimal Sec80C_TuitionFees,
        decimal Sec80C_HomeLoanPrincipal,
        decimal Sec80C_Other,
        decimal Sec80D_SelfFamily,
        decimal Sec80D_Parents,
        bool Sec80D_ParentsSeniorCitizen,
        decimal Sec80D_PreventiveCheckup,
        decimal Sec80CCD_NPS,
        decimal Sec24_HomeLoanInterest,
        string? LenderName,
        string? LenderPAN,
        decimal AnnualRentPaid,
        string? RentalCityType,
        string? LandlordName,
        string? LandlordPAN,
        decimal Sec80E_EducationLoanInterest,
        decimal Sec80G_Donations,
        decimal Sec80TTA_SavingsInterest,
        decimal OtherIncome,
        decimal PreviousEmployerGross,
        decimal PreviousEmployerTDS,
        string? Remarks
    );

    [HttpPost]
    public async Task<IActionResult> SaveDeclaration([FromBody] SaveDeclarationDto dto)
    {
        var orgId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;
        var currentUserId = GetCurrentUserId();

        // Employees can edit their own declaration; HR can edit any
        bool isSelf = currentUserId == dto.EmployeeId;
        bool hasManagePerm = await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary);

        if (!isSelf && !hasManagePerm && !User.IsInRole("Admin"))
            return Forbid();

        var existing = await _db.EmployeeTaxDeclarations
            .FirstOrDefaultAsync(d => d.EmployeeId == dto.EmployeeId &&
                                      d.FinancialYear == dto.FinancialYear &&
                                      d.OrganizationId == orgId);

        if (existing == null)
        {
            existing = new EmployeeTaxDeclaration
            {
                EmployeeId = dto.EmployeeId,
                OrganizationId = orgId,
                FinancialYear = dto.FinancialYear,
                CreatedAt = DateTime.UtcNow
            };
            _db.EmployeeTaxDeclarations.Add(existing);
        }

        existing.TaxRegime = dto.TaxRegime == "Old" ? "Old" : "New";
        existing.Status = dto.Status == "Submitted" ? "Submitted" : "Draft";
        if (dto.Status == "Submitted" && existing.SubmittedAt == null)
        {
            existing.SubmittedAt = DateTime.UtcNow;
        }

        existing.Sec80C_EPF = dto.Sec80C_EPF;
        existing.Sec80C_PPF = dto.Sec80C_PPF;
        existing.Sec80C_ELSS = dto.Sec80C_ELSS;
        existing.Sec80C_LifeInsurance = dto.Sec80C_LifeInsurance;
        existing.Sec80C_TuitionFees = dto.Sec80C_TuitionFees;
        existing.Sec80C_HomeLoanPrincipal = dto.Sec80C_HomeLoanPrincipal;
        existing.Sec80C_Other = dto.Sec80C_Other;

        existing.Sec80D_SelfFamily = dto.Sec80D_SelfFamily;
        existing.Sec80D_Parents = dto.Sec80D_Parents;
        existing.Sec80D_ParentsSeniorCitizen = dto.Sec80D_ParentsSeniorCitizen;
        existing.Sec80D_PreventiveCheckup = dto.Sec80D_PreventiveCheckup;

        existing.Sec80CCD_NPS = dto.Sec80CCD_NPS;
        existing.Sec24_HomeLoanInterest = dto.Sec24_HomeLoanInterest;
        existing.LenderName = dto.LenderName;
        existing.LenderPAN = dto.LenderPAN;

        existing.AnnualRentPaid = dto.AnnualRentPaid;
        existing.RentalCityType = dto.RentalCityType ?? "NonMetro";
        existing.LandlordName = dto.LandlordName;
        existing.LandlordPAN = dto.LandlordPAN;

        existing.Sec80E_EducationLoanInterest = dto.Sec80E_EducationLoanInterest;
        existing.Sec80G_Donations = dto.Sec80G_Donations;
        existing.Sec80TTA_SavingsInterest = dto.Sec80TTA_SavingsInterest;

        existing.OtherIncome = dto.OtherIncome;
        existing.PreviousEmployerGross = dto.PreviousEmployerGross;
        existing.PreviousEmployerTDS = dto.PreviousEmployerTDS;

        existing.Remarks = dto.Remarks;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Declaration saved as {existing.Status}.", declaration = existing });
    }

    // ── PUT /api/tax-declarations/{id}/status ─────────────────────────────────
    public record UpdateStatusDto(string Status, string? Reason);

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        if (!await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary) && !User.IsInRole("Admin"))
            return Forbid();

        var declaration = await _db.EmployeeTaxDeclarations.FindAsync(id);
        if (declaration == null) return NotFound(new { message = "Declaration not found." });

        if (dto.Status == "Approved")
        {
            declaration.Status = "Approved";
            declaration.ApprovedAt = DateTime.UtcNow;
            declaration.ApprovedBy = GetCurrentUserName();
            declaration.RejectionReason = null;
        }
        else if (dto.Status == "Rejected")
        {
            declaration.Status = "Rejected";
            declaration.RejectionReason = dto.Reason ?? "Rejected by HR.";
        }
        else
        {
            declaration.Status = dto.Status;
        }

        declaration.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Declaration marked as {declaration.Status}.", declaration });
    }

    // ── POST /api/tax-declarations/{id}/proofs ────────────────────────────────
    [HttpPost("{id:int}/proofs")]
    public async Task<IActionResult> UploadProof(int id, [FromForm] string proofType, IFormFile file, [FromServices] IWebHostEnvironment env)
    {
        var declaration = await _db.EmployeeTaxDeclarations.FindAsync(id);
        if (declaration == null) return NotFound(new { message = "Declaration not found." });

        // Ensure only the owner or an admin can upload proofs
        var currentUserId = GetCurrentUserId();
        if (declaration.EmployeeId != currentUserId && !User.IsInRole("Admin") && !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
        {
            return Forbid();
        }

        if (file == null || file.Length == 0) return BadRequest(new { message = "No file uploaded." });

        if (file.Length > 5 * 1024 * 1024) return BadRequest(new { message = "File size cannot exceed 5MB." });

        var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png" };
        var fileExtension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        if (string.IsNullOrEmpty(fileExtension) || !allowedExtensions.Contains(fileExtension))
        {
            return BadRequest(new { message = $"File type '{fileExtension}' is not allowed. Accepted: {string.Join(", ", allowedExtensions)}" });
        }

        var allowedMimeTypes = new[] { "application/pdf", "image/jpeg", "image/png" };
        if (!allowedMimeTypes.Contains(file.ContentType?.ToLowerInvariant()))
        {
            return BadRequest(new { message = "Invalid file content type." });
        }

        if (string.IsNullOrWhiteSpace(proofType)) return BadRequest(new { message = "Proof type is required." });

        var uploadsFolder = Path.Combine(env.WebRootPath, "uploads", "tax_proofs", declaration.FinancialYear, declaration.EmployeeId.ToString());
        Directory.CreateDirectory(uploadsFolder);

        var safeFileName = $"{Guid.NewGuid()}{fileExtension}";
        var filePath = Path.Combine(uploadsFolder, safeFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativePath = $"/uploads/tax_proofs/{declaration.FinancialYear}/{declaration.EmployeeId}/{safeFileName}";

        var proof = new EmployeeTaxDeclarationProof
        {
            OrganizationId = declaration.OrganizationId,
            TaxDeclarationId = declaration.Id,
            ProofType = proofType,
            FileName = file.FileName,
            FilePath = relativePath,
            ContentType = file.ContentType
        };

        _db.EmployeeTaxDeclarationProofs.Add(proof);
        
        declaration.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Proof uploaded successfully.", proof });
    }

    // ── DELETE /api/tax-declarations/{id}/proofs/{proofId} ──────────────────
    [HttpDelete("{id:int}/proofs/{proofId:int}")]
    public async Task<IActionResult> DeleteProof(int id, int proofId, [FromServices] IWebHostEnvironment env)
    {
        var declaration = await _db.EmployeeTaxDeclarations.FindAsync(id);
        if (declaration == null) return NotFound(new { message = "Declaration not found." });

        var currentUserId = GetCurrentUserId();
        if (declaration.EmployeeId != currentUserId && !User.IsInRole("Admin") && !await _permissionService.HasPermissionAsync(User, AppPermissions.Keys.PayrollManageSalary))
        {
            return Forbid();
        }

        var proof = await _db.EmployeeTaxDeclarationProofs.FirstOrDefaultAsync(p => p.Id == proofId && p.TaxDeclarationId == id);
        if (proof == null) return NotFound(new { message = "Proof not found." });

        // Delete physical file if exists
        var physicalPath = Path.Combine(env.WebRootPath, proof.FilePath.TrimStart('/'));
        if (System.IO.File.Exists(physicalPath))
        {
            System.IO.File.Delete(physicalPath);
        }

        _db.EmployeeTaxDeclarationProofs.Remove(proof);
        declaration.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Proof deleted successfully." });
    }
}
