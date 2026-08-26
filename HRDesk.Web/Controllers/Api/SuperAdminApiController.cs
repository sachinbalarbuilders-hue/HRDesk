using System;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Controllers.Api;

[ApiController]
[Route("api/superadmin")]
[Authorize]
public class SuperAdminApiController : ControllerBase
{
    private readonly BiometricAttendanceDbContext _db;

    public SuperAdminApiController(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    private bool IsAuthorized()
    {
        return User.IsInRole("SuperAdmin") || User.IsInRole("Super Admin");
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetPlatformMetrics()
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;

        var totalTenants = await _db.Organizations.IgnoreQueryFilters().CountAsync();
        var activeTenants = await _db.Organizations.IgnoreQueryFilters().CountAsync(o => o.IsActive);
        var totalEmployees = await _db.Employees.IgnoreQueryFilters().CountAsync(e => e.Status == "active");

        var activeSubs = await _db.TenantSubscriptions
            .IgnoreQueryFilters()
            .Include(s => s.Plan)
            .Where(s => s.Status == "Active")
            .ToListAsync();

        var totalMRR = activeSubs.Sum(s => s.Plan?.PricePerMonth ?? 0);
        var totalARR = totalMRR * 12;

        var allPaidTransactions = await _db.SubscriptionPayments
            .IgnoreQueryFilters()
            .Where(p => p.Status == "Paid")
            .ToListAsync();

        var totalCollectedRevenue = allPaidTransactions.Sum(p => p.Amount + p.TaxAmount);
        var thisMonthRevenue = allPaidTransactions
            .Where(p => p.PaidAt.HasValue && p.PaidAt.Value.Month == DateTime.Now.Month && p.PaidAt.Value.Year == DateTime.Now.Year)
            .Sum(p => p.Amount + p.TaxAmount);

        var planDistribution = await _db.TenantSubscriptions
            .IgnoreQueryFilters()
            .Include(s => s.Plan)
            .GroupBy(s => s.Plan != null ? s.Plan.Name : "Unknown")
            .Select(g => new { planName = g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            totalTenants,
            activeTenants,
            totalEmployees,
            totalMRR,
            totalARR,
            totalCollectedRevenue,
            thisMonthRevenue,
            planDistribution
        });
    }

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;

        var query = _db.Organizations.IgnoreQueryFilters().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(o => o.Name.Contains(s) || (o.Code != null && o.Code.Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
                query = query.Where(o => o.IsActive);
            else if (status.Equals("inactive", StringComparison.OrdinalIgnoreCase))
                query = query.Where(o => !o.IsActive);
        }

        var totalCount = await query.CountAsync();

        var orgs = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var orgIds = orgs.Select(o => o.Id).ToList();

        var subs = await _db.TenantSubscriptions
            .IgnoreQueryFilters()
            .Include(s => s.Plan)
            .Where(s => orgIds.Contains(s.OrganizationId))
            .ToListAsync();

        var empCounts = await _db.Employees
            .IgnoreQueryFilters()
            .Where(e => orgIds.Contains(e.OrganizationId) && e.Status == "active")
            .GroupBy(e => e.OrganizationId)
            .Select(g => new { orgId = g.Key, count = g.Count() })
            .ToDictionaryAsync(g => g.orgId, g => g.count);

        var branchCounts = await _db.Branches
            .IgnoreQueryFilters()
            .Where(b => orgIds.Contains(b.OrganizationId))
            .GroupBy(b => b.OrganizationId)
            .Select(g => new { orgId = g.Key, count = g.Count() })
            .ToDictionaryAsync(g => g.orgId, g => g.count);

        var items = orgs.Select(o =>
        {
            var sub = subs.FirstOrDefault(s => s.OrganizationId == o.Id);
            return new
            {
                id = o.Id,
                publicId = o.PublicId,
                name = o.Name,
                code = o.Code,
                logoUrl = o.LogoUrl,
                primaryColor = o.PrimaryColor,
                customDomain = o.CustomDomain,
                isActive = o.IsActive,
                createdAt = o.CreatedAt,
                planName = sub?.Plan?.Name ?? "Free Starter",
                planCode = sub?.Plan?.Code ?? "FREE_STARTER",
                subscriptionStatus = sub?.Status ?? "Active",
                validUntil = sub?.ValidUntil,
                employeeCount = empCounts.TryGetValue(o.Id, out var ec) ? ec : 0,
                branchCount = branchCounts.TryGetValue(o.Id, out var bc) ? bc : 0,
                maxEmployees = sub?.Plan?.MaxEmployees ?? 10,
                maxBranches = sub?.Plan?.MaxBranches ?? 1
            };
        });

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans()
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;
        var plans = await _db.SubscriptionPlans.IgnoreQueryFilters().Where(p => p.IsActive).ToListAsync();
        return Ok(plans);
    }

    [HttpPost("tenants/{id:int}/extend-trial")]
    public async Task<IActionResult> ExtendTrial(int id, [FromBody] ExtendTrialDto dto)
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;
        var sub = await _db.TenantSubscriptions.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.OrganizationId == id);
        var org = await _db.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == id);
        if (org == null) return NotFound(new { message = "Organization not found." });

        var daysToAdd = dto.Days > 0 ? dto.Days : 14;
        var baseDate = (sub != null && sub.ValidUntil > DateTime.Now) ? sub.ValidUntil : DateTime.Now;
        var newValidUntil = baseDate.AddDays(daysToAdd);

        if (sub != null)
        {
            sub.ValidUntil = newValidUntil;
            sub.Status = "Active";
            sub.UpdatedAt = DateTime.Now;
        }
        else
        {
            var defaultPlan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == "GROWTH_ENTERPRISE") ?? await _db.SubscriptionPlans.FirstAsync();
            sub = new TenantSubscription
            {
                OrganizationId = id,
                PlanId = defaultPlan.Id,
                Status = "Active",
                BillingCycle = "Monthly",
                ValidUntil = newValidUntil,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.TenantSubscriptions.Add(sub);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = id,
            UserName = User.Identity?.Name ?? "SuperAdmin",
            Action = "UPDATE",
            EntityName = "TenantSubscription",
            PrimaryKey = id.ToString(),
            ChangedColumns = "ValidUntil, Status",
            NewValues = $"{{\"ExtendedDays\":{daysToAdd},\"ValidUntil\":\"{newValidUntil:yyyy-MM-dd}\"}}",
            Timestamp = DateTime.Now
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Trial extended by {daysToAdd} days. Valid until {newValidUntil:dd MMM yyyy}.",
            validUntil = newValidUntil
        });
    }

    [HttpPost("tenants/{id:int}/override-plan")]
    public async Task<IActionResult> OverridePlan(int id, [FromBody] OverridePlanDto dto)
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;
        var plan = await _db.SubscriptionPlans.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == dto.PlanId);
        if (plan == null) return NotFound(new { message = "Target subscription plan not found." });

        var sub = await _db.TenantSubscriptions.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.OrganizationId == id);
        if (sub != null)
        {
            sub.PlanId = plan.Id;
            sub.Status = "Active";
            if (sub.ValidUntil < DateTime.Now)
            {
                sub.ValidUntil = DateTime.Now.AddMonths(1);
            }
            sub.UpdatedAt = DateTime.Now;
        }
        else
        {
            sub = new TenantSubscription
            {
                OrganizationId = id,
                PlanId = plan.Id,
                Status = "Active",
                BillingCycle = "Monthly",
                ValidUntil = DateTime.Now.AddMonths(1),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.TenantSubscriptions.Add(sub);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = id,
            UserName = User.Identity?.Name ?? "SuperAdmin",
            Action = "UPDATE",
            EntityName = "TenantSubscription",
            PrimaryKey = id.ToString(),
            ChangedColumns = "PlanId, Status",
            NewValues = $"{{\"OverriddenPlan\":\"{plan.Name}\"}}",
            Timestamp = DateTime.Now
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Successfully assigned plan {plan.Name} to organization." });
    }

    [HttpPost("tenants/{id:int}/toggle-status")]
    public async Task<IActionResult> ToggleTenantStatus(int id)
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;
        var org = await _db.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == id);
        if (org == null) return NotFound(new { message = "Organization not found." });

        org.IsActive = !org.IsActive;

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = id,
            UserName = User.Identity?.Name ?? "SuperAdmin",
            Action = "UPDATE",
            EntityName = "Organization",
            PrimaryKey = id.ToString(),
            ChangedColumns = "IsActive",
            NewValues = $"{{\"IsActive\":{org.IsActive.ToString().ToLower()}}}",
            Timestamp = DateTime.Now
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Organization status set to {(org.IsActive ? "Active" : "Suspended")}.",
            isActive = org.IsActive
        });
    }

    [HttpGet("payments")]
    public async Task<IActionResult> GetAllPayments([FromQuery] int page = 1, [FromQuery] int pageSize = 15)
    {
        if (!IsAuthorized()) return Forbid();

        _db.BypassTenantId = true;

        var query = _db.SubscriptionPayments
            .IgnoreQueryFilters()
            .Include(p => p.Organization)
            .Include(p => p.Plan)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.PublicId,
                p.InvoiceNumber,
                OrganizationName = p.Organization != null ? p.Organization.Name : "Organization",
                PlanName = p.Plan != null ? p.Plan.Name : "Plan",
                p.Amount,
                p.TaxAmount,
                Total = p.Amount + p.TaxAmount,
                p.Currency,
                p.BillingCycle,
                p.PaymentGateway,
                p.Status,
                p.PaidAt,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    // ── Plan Management CRUD ─────────────────────────────────────
    [HttpPost("plans")]
    public async Task<IActionResult> CreatePlan([FromBody] PlanDto dto)
    {
        if (!IsAuthorized()) return Forbid();

        var plan = new SubscriptionPlan
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToLowerInvariant(),
            Description = dto.Description?.Trim() ?? "",
            MaxEmployees = dto.MaxEmployees,
            MaxBranches = dto.MaxBranches,
            HasBiometricsModule = dto.HasBiometricsModule,
            HasPayrollModule = dto.HasPayrollModule,
            HasRecruitmentModule = dto.HasRecruitmentModule,
            HasLoanManagement = dto.HasLoanManagement,
            HasCustomDomain = dto.HasCustomDomain,
            PricePerMonth = dto.PricePerMonth,
            IsActive = true,
            CreatedAt = DateTime.Now
        };

        _db.SubscriptionPlans.Add(plan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Plan created successfully.", id = plan.Id });
    }

    [HttpPut("plans/{id:int}")]
    public async Task<IActionResult> UpdatePlan(int id, [FromBody] PlanDto dto)
    {
        if (!IsAuthorized()) return Forbid();

        var plan = await _db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound(new { message = "Plan not found." });

        plan.Name = dto.Name.Trim();
        plan.Code = dto.Code.Trim().ToLowerInvariant();
        plan.Description = dto.Description?.Trim() ?? "";
        plan.MaxEmployees = dto.MaxEmployees;
        plan.MaxBranches = dto.MaxBranches;
        plan.HasBiometricsModule = dto.HasBiometricsModule;
        plan.HasPayrollModule = dto.HasPayrollModule;
        plan.HasRecruitmentModule = dto.HasRecruitmentModule;
        plan.HasLoanManagement = dto.HasLoanManagement;
        plan.HasCustomDomain = dto.HasCustomDomain;
        plan.PricePerMonth = dto.PricePerMonth;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Plan updated successfully." });
    }

    [HttpDelete("plans/{id:int}")]
    public async Task<IActionResult> DeactivatePlan(int id)
    {
        if (!IsAuthorized()) return Forbid();

        var plan = await _db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound(new { message = "Plan not found." });

        // Don't hard delete — just deactivate (tenants may still reference it)
        plan.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Plan deactivated. It will no longer appear for new subscriptions." });
    }
}

public record ExtendTrialDto(int Days);
public record OverridePlanDto(int PlanId);
public record PlanDto(
    string Name,
    string Code,
    string? Description,
    int MaxEmployees,
    int MaxBranches,
    bool HasBiometricsModule,
    bool HasPayrollModule,
    bool HasRecruitmentModule,
    bool HasLoanManagement,
    bool HasCustomDomain,
    decimal PricePerMonth
);
