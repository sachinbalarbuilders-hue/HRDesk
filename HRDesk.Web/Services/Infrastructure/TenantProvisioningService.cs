using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HRDesk.Web.Constants;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Services.Infrastructure;

public class TenantProvisioningService : ITenantProvisioningService
{
    private readonly BiometricAttendanceDbContext _db;
    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "api", "admin", "app", "auth", "login", "register", "dashboard",
        "settings", "system", "superadmin", "root", "test", "demo", "portal", "hrdesk"
    };

    public TenantProvisioningService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public async Task<bool> IsSlugAvailableAsync(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug)) return false;

        var cleaned = slug.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(cleaned, @"^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$"))
            return false;

        if (ReservedSlugs.Contains(cleaned))
            return false;

        _db.BypassTenantId = true;
        var exists = await _db.Organizations
            .IgnoreQueryFilters()
            .AnyAsync(o => o.Code != null && o.Code.ToLower() == cleaned);

        return !exists;
    }

    public async Task<ProvisioningResult> ProvisionTenantAsync(TenantRegistrationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CompanyName))
            return new ProvisioningResult(false, "Company name is required.", null, null, null);

        var slug = (dto.WorkspaceSlug ?? "").Trim().ToLowerInvariant();
        if (!await IsSlugAvailableAsync(slug))
            return new ProvisioningResult(false, "The selected workspace slug is not available. Please choose a different slug.", null, null, null);

        var email = (dto.AdminEmail ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return new ProvisioningResult(false, "A valid administrator email is required.", null, null, null);

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            return new ProvisioningResult(false, "Password must be at least 6 characters.", null, null, null);

        _db.BypassTenantId = true;

        var userExists = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username.ToLower() == email);

        if (userExists)
            return new ProvisioningResult(false, $"An account with email '{email}' already exists.", null, null, null);

        using var tx = await _db.Database.BeginTransactionAsync();

        try
        {
            // 1. Create Organization
            var org = new Organization
            {
                Name = dto.CompanyName.Trim(),
                Code = slug,
                IsActive = true,
                CreatedAt = DateTime.Now
            };
            _db.Organizations.Add(org);
            await _db.SaveChangesAsync();

            // 2. Create Default Primary Branch
            var branchCode = slug.Length > 4 ? slug.Substring(0, 4).ToUpperInvariant() + "-HO" : slug.ToUpperInvariant() + "-HO";
            var branch = new Branch
            {
                OrganizationId = org.Id,
                Name = "Head Office",
                Code = branchCode,
                City = !string.IsNullOrWhiteSpace(dto.HeadOfficeCity) ? dto.HeadOfficeCity.Trim() : "Headquarters",
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.Branches.Add(branch);
            await _db.SaveChangesAsync();

            // 3. Seed Core Departments
            var deptMgmt = new Department { DepartmentName = "Management", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var deptHr = new Department { DepartmentName = "Human Resources", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var deptEng = new Department { DepartmentName = "Engineering & IT", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var deptOps = new Department { DepartmentName = "Operations", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var deptSales = new Department { DepartmentName = "Sales & Marketing", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };

            _db.Departments.AddRange(deptMgmt, deptHr, deptEng, deptOps, deptSales);
            await _db.SaveChangesAsync();

            // 4. Seed Standard Designations
            var desigDir = new Designation { DesignationName = "Managing Director", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var desigHr = new Designation { DesignationName = "HR Manager", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var desigLead = new Designation { DesignationName = "Team Lead", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var desigEng = new Designation { DesignationName = "Software Engineer", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };
            var desigExec = new Designation { DesignationName = "Executive", OrganizationId = org.Id, BranchId = branch.Id, Status = "active" };

            _db.Designations.AddRange(desigDir, desigHr, desigLead, desigEng, desigExec);
            await _db.SaveChangesAsync();

            // 5. Seed Default Work Shift
            var shift = new Shift
            {
                OrganizationId = org.Id,
                BranchId = branch.Id,
                ShiftName = "General Day Shift",
                ShiftCode = "GS",
                StartTime = new TimeOnly(9, 30),
                EndTime = new TimeOnly(18, 30),
                LunchBreakStart = new TimeOnly(13, 0),
                LunchBreakEnd = new TimeOnly(14, 0),
                LunchBreakDuration = 60,
                WorkingHours = 9.0m,
                LateComingGraceMinutes = 15,
                EarlyLeaveGraceMinutes = 15,
                ColorCode = "#4F46E5",
                Status = "Active"
            };
            _db.Shifts.Add(shift);
            await _db.SaveChangesAsync();

            // 6. Seed Standard Leave Types
            var ltPl = new LeaveType { Name = "Paid Leave", Code = "PL", DefaultYearlyQuota = 18, IsPaid = true, Status = "Active", OrganizationId = org.Id, BranchId = branch.Id, TextColor = "#15803d", BackgroundColor = "#dcfce7" };
            var ltSl = new LeaveType { Name = "Sick Leave", Code = "SL", DefaultYearlyQuota = 12, IsPaid = true, Status = "Active", OrganizationId = org.Id, BranchId = branch.Id, TextColor = "#b91c1c", BackgroundColor = "#fee2e2" };
            var ltCo = new LeaveType { Name = "Comp Off", Code = "CO", DefaultYearlyQuota = 0, IsPaid = true, Status = "Active", OrganizationId = org.Id, BranchId = branch.Id, TextColor = "#c2410c", BackgroundColor = "#ffedd5" };
            var ltLwp = new LeaveType { Name = "Leave Without Pay", Code = "LWP", DefaultYearlyQuota = 0, IsPaid = false, Status = "Active", OrganizationId = org.Id, BranchId = branch.Id, TextColor = "#4b5563", BackgroundColor = "#f3f4f6" };

            _db.LeaveTypes.AddRange(ltPl, ltSl, ltCo, ltLwp);
            await _db.SaveChangesAsync();

            // 7. Seed Master Roles & Permissions
            var adminRole = new Role
            {
                OrganizationId = org.Id,
                Name = "Administrator",
                Description = "Full access to all modules and configurations",
                IsSystemRole = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.Roles.Add(adminRole);
            await _db.SaveChangesAsync();

            foreach (var perm in AppPermissions.All)
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    RoleId = adminRole.Id,
                    OrganizationId = org.Id,
                    PermissionKey = perm.Key,
                    Scope = AppPermissions.Scopes.All
                });
            }

            var managerRole = new Role
            {
                OrganizationId = org.Id,
                Name = "Manager",
                Description = "Manage team members, attendance, and leave requests",
                IsSystemRole = false,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.Roles.Add(managerRole);

            var empRole = new Role
            {
                OrganizationId = org.Id,
                Name = "Employee",
                Description = "Self-service access for punch logs and leaves",
                IsSystemRole = false,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _db.Roles.Add(empRole);
            await _db.SaveChangesAsync();

            // 8. Create Administrator Employee Profile
            var adminEmp = new Employee
            {
                EmployeeId = 1,
                OrganizationId = org.Id,
                BranchId = branch.Id,
                DepartmentId = deptMgmt.Id,
                DesignationId = desigDir.Id,
                EmployeeName = dto.AdminFullName.Trim(),
                WorkEmail = email,
                Phone = dto.AdminPhone?.Trim(),
                JoiningDate = DateOnly.FromDateTime(DateTime.Today),
                Weekoff = "Sunday",
                AttendanceType = "Biometric",
                Status = "active",
                VerificationId = Guid.NewGuid()
            };
            _db.Employees.Add(adminEmp);
            await _db.SaveChangesAsync();

            // 9. Create Administrator User Account
            var adminUser = new User
            {
                Username = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password, workFactor: 12),
                FullName = dto.AdminFullName.Trim(),
                Role = "Admin",
                RoleId = adminRole.Id,
                EmployeeId = adminEmp.EmployeeId,
                BranchId = branch.Id,
                OrganizationId = org.Id,
                IsActive = true
            };
            _db.Users.Add(adminUser);
            await _db.SaveChangesAsync();

            // 10. Seed Default Employee Prefix Settings (EMP#001)
            _db.SystemSettings.AddRange(
                new SystemSetting { OrganizationId = org.Id, BranchId = branch.Id, SettingKey = "Employee_Prefix_Series", SettingValue = "EMP", Description = "Employee Code Series Prefix", UpdatedAt = DateTime.Now },
                new SystemSetting { OrganizationId = org.Id, BranchId = branch.Id, SettingKey = "Employee_Prefix_Connector", SettingValue = "#", Description = "Employee Code Connector / Delimiter", UpdatedAt = DateTime.Now },
                new SystemSetting { OrganizationId = org.Id, BranchId = branch.Id, SettingKey = "Employee_Prefix_Padding", SettingValue = "3", Description = "Employee Code Sequence Padding Length", UpdatedAt = DateTime.Now },
                new SystemSetting { OrganizationId = org.Id, BranchId = branch.Id, SettingKey = "Employee_Prefix_StartSeq", SettingValue = "1", Description = "Employee Code Starting Sequence", UpdatedAt = DateTime.Now }
            );
            await _db.SaveChangesAsync();

            // 11. Assign 14-Day Free Trial on Growth Plan
            var growthPlan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == "growth")
                ?? await _db.SubscriptionPlans.FirstOrDefaultAsync();

            if (growthPlan != null)
            {
                _db.TenantSubscriptions.Add(new TenantSubscription
                {
                    OrganizationId = org.Id,
                    PlanId = growthPlan.Id,
                    Status = "Trialing",
                    BillingCycle = "Monthly",
                    TrialEndsAt = DateTime.Now.AddDays(14),
                    ValidUntil = DateTime.Now.AddDays(14),
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
                await _db.SaveChangesAsync();
            }

            await tx.CommitAsync();

            return new ProvisioningResult(true, null, org, adminUser, branch);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return new ProvisioningResult(false, $"Provisioning failed: {ex.Message}", null, null, null);
        }
    }
}
