using HRDesk.Web.Models;
using HRDesk.Web.Areas.Recruitment.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Data;

public sealed class BiometricAttendanceDbContext : DbContext
{
    private readonly HRDesk.Web.Services.ICurrentTenantProvider _tenantProvider;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public BiometricAttendanceDbContext(
        DbContextOptions<BiometricAttendanceDbContext> options,
        HRDesk.Web.Services.ICurrentTenantProvider tenantProvider = null!,
        IHttpContextAccessor httpContextAccessor = null!)
        : base(options)
    {
        _tenantProvider = tenantProvider;
        _httpContextAccessor = httpContextAccessor;
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Branch> Branches => Set<Branch>();

    public DbSet<DeviceCommand> DeviceCommands => Set<DeviceCommand>();

    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();

    public DbSet<DailyAttendance> DailyAttendance => Set<DailyAttendance>();

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();
    public DbSet<Department> Departments => Set<Department>();

    public DbSet<Designation> Designations => Set<Designation>();

    public DbSet<Shift> Shifts => Set<Shift>();

    public DbSet<Holiday> Holidays => Set<Holiday>();
    
    public DbSet<HolidayEmployee> HolidayEmployees => Set<HolidayEmployee>();

    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();

    public DbSet<LeaveAllocation> LeaveAllocations => Set<LeaveAllocation>();

    public DbSet<LeaveApplication> LeaveApplications => Set<LeaveApplication>();
    
    public DbSet<ApplicationSequence> ApplicationSequences => Set<ApplicationSequence>();

    public DbSet<AttendanceRegularization> AttendanceRegularizations => Set<AttendanceRegularization>();

    public DbSet<LoanType> LoanTypes => Set<LoanType>();

    public DbSet<EmployeeLoan> EmployeeLoans => Set<EmployeeLoan>();

    public DbSet<LoanInstallment> LoanInstallments => Set<LoanInstallment>();

    public DbSet<SalaryComponent> SalaryComponents => Set<SalaryComponent>();

    public DbSet<EmployeeSalaryStructure> EmployeeSalaryStructures => Set<EmployeeSalaryStructure>();

    public DbSet<PayrollMaster> PayrollMasters => Set<PayrollMaster>();

    public DbSet<PayrollDetail> PayrollDetails => Set<PayrollDetail>();

    // ── Payroll Phase 1: Pay Groups + CTC Templates ──────────────────────────
    public DbSet<PayGroup> PayGroups => Set<PayGroup>();
    public DbSet<SalaryStructureTemplate> SalaryStructureTemplates => Set<SalaryStructureTemplate>();
    public DbSet<TemplateComponent> TemplateComponents => Set<TemplateComponent>();
    public DbSet<EmployeeCTC> EmployeeCTCs => Set<EmployeeCTC>();
    public DbSet<ProfessionalTaxSlab> ProfessionalTaxSlabs => Set<ProfessionalTaxSlab>();

    public DbSet<CompOffCredit> CompOffCredits { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }
    public DbSet<BiometricEmployeeMapping> BiometricEmployeeMappings { get; set; }

    public DbSet<CompOffRequest> CompOffRequests => Set<CompOffRequest>();

    public DbSet<DeviceConfiguration> DeviceConfigurations => Set<DeviceConfiguration>();

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<DeviceSyncState> DeviceSyncStates => Set<DeviceSyncState>();
    public DbSet<LeaveTypeEligibility> LeaveTypeEligibilities => Set<LeaveTypeEligibility>();
    public DbSet<EmployeeShiftAssignment> EmployeeShiftAssignments => Set<EmployeeShiftAssignment>();
    public DbSet<ShiftRoster> ShiftRosters => Set<ShiftRoster>();
    public DbSet<CelebrationLog> CelebrationLogs => Set<CelebrationLog>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<InterviewSchedule> InterviewSchedules => Set<InterviewSchedule>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<SubscriptionPayment> SubscriptionPayments => Set<SubscriptionPayment>();
    public DbSet<ShiftCycle> ShiftCycles => Set<ShiftCycle>();
    public DbSet<ShiftCycleSlot> ShiftCycleSlots => Set<ShiftCycleSlot>();
    public DbSet<ShiftChangeRequest> ShiftChangeRequests => Set<ShiftChangeRequest>();
    public DbSet<GateActivityLog> GateActivityLogs => Set<GateActivityLog>();
    public DbSet<InAppNotification> InAppNotifications => Set<InAppNotification>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Performance Indexes - Tier 1
        modelBuilder.Entity<DailyAttendance>().HasIndex(d => d.RecordDate);
        modelBuilder.Entity<AttendanceLog>().HasIndex(a => a.PunchTime);
        modelBuilder.Entity<GateActivityLog>().HasIndex(g => new { g.OrganizationId, g.ScannedAt });
        modelBuilder.Entity<InAppNotification>().HasIndex(n => new { n.OrganizationId, n.UserId, n.IsRead, n.CreatedAt });

        // Attendance/roster/leave lookup indexes with INCLUDE columns, used heavily by the
        // monthly attendance matrix and roster views to avoid key-lookup round trips.
        modelBuilder.Entity<ShiftRoster>()
            .HasIndex(s => new { s.RosterDate, s.EmployeeId })
            .HasDatabaseName("IX_shift_roster_date_emp")
            .IncludeProperties(s => new { s.IsWeekOff, s.ShiftId, s.OrganizationId });

        modelBuilder.Entity<DailyAttendance>()
            .HasIndex(d => new { d.RecordDate, d.EmployeeId })
            .HasDatabaseName("IX_daily_attendance_date_emp")
            .IncludeProperties(d => new { d.Status, d.InTime, d.OutTime, d.WorkMinutes, d.IsHalfDay, d.IsLate, d.IsEarly, d.ShiftId, d.OrganizationId });

        modelBuilder.Entity<LeaveApplication>()
            .HasIndex(l => new { l.StartDate, l.EndDate, l.EmployeeId, l.Status })
            .HasDatabaseName("IX_leave_applications_date_emp")
            .IncludeProperties(l => new { l.LeaveTypeId, l.TotalDays, l.Reason, l.OrganizationId });
        
        // Comprehensive Performance Indexes - Tier 2
        modelBuilder.Entity<Employee>().HasIndex(e => e.Status);
        modelBuilder.Entity<LeaveApplication>().HasIndex(l => new { l.StartDate, l.EndDate });
        modelBuilder.Entity<LeaveApplication>().HasIndex(l => l.Status);
        modelBuilder.Entity<PayrollMaster>().HasIndex(p => p.Month);
        modelBuilder.Entity<PayrollMaster>().HasIndex(p => p.Status);
        modelBuilder.Entity<AttendanceRegularization>().HasIndex(a => a.RequestDate);
        modelBuilder.Entity<AttendanceRegularization>().HasIndex(a => a.Status);
        modelBuilder.Entity<CompOffRequest>().HasIndex(c => c.WorkedDate);
        modelBuilder.Entity<CompOffRequest>().HasIndex(c => c.Status);
        modelBuilder.Entity<CompOffCredit>().HasIndex(c => c.WorkDate);
        modelBuilder.Entity<ShiftRoster>().HasIndex(s => s.RosterDate);
        modelBuilder.Entity<Holiday>().HasIndex(h => new { h.StartDate, h.EndDate });
        modelBuilder.Entity<Announcement>().HasIndex(a => new { a.OrganizationId, a.IsActive, a.StartDate, a.EndDate });
        modelBuilder.Entity<ShiftCycle>().HasIndex(c => new { c.OrganizationId, c.IsActive });
        modelBuilder.Entity<ShiftCycleSlot>().HasIndex(s => new { s.CycleId, s.SlotIndex }).IsUnique();
        modelBuilder.Entity<ShiftChangeRequest>().HasIndex(r => new { r.OrganizationId, r.EmployeeId, r.RequestDate });

        // Opaque public-facing identifiers (used in URLs/API responses instead of the
        // internal integer Id) must be unique so they safely resolve back to one row.
        modelBuilder.Entity<Organization>().HasIndex(o => o.PublicId).IsUnique();
        modelBuilder.Entity<Branch>().HasIndex(b => b.PublicId).IsUnique();
        modelBuilder.Entity<Employee>().HasIndex(e => e.PublicId).IsUnique();
        modelBuilder.Entity<Role>().HasIndex(r => r.PublicId).IsUnique();
            
        // Disable cascade delete globally to prevent SQL Server cyclic foreign key errors
        foreach (var relationship in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
        {
            relationship.DeleteBehavior = DeleteBehavior.Restrict;
        }

        if (_tenantProvider != null)
        {
            // EF Core permits only ONE query filter per entity type, so the tenant predicate
            // and the archive predicate must be combined into a single lambda. Pick the right
            // builder method based on which interfaces the entity implements.
            var flags = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var clr = entityType.ClrType;
                var isTenant = typeof(IMustHaveTenant).IsAssignableFrom(clr);
                var isArchivable = typeof(IArchivable).IsAssignableFrom(clr);

                string? builderName = (isTenant, isArchivable) switch
                {
                    (true, true)  => nameof(SetTenantAndArchiveQueryFilter),
                    (true, false) => nameof(SetGlobalQueryFilter),
                    (false, true) => nameof(SetArchiveQueryFilter),
                    _             => null
                };

                if (builderName == null) continue;

                typeof(BiometricAttendanceDbContext)
                    .GetMethod(builderName, flags)?
                    .MakeGenericMethod(clr)
                    ?.Invoke(this, new object[] { modelBuilder });
            }

            // Manual query filter for User (no longer implements IMustHaveTenant since OrganizationId is nullable).
            // Platform users (IsPlatformUser=true, OrganizationId=NULL) are excluded from org-scoped queries.
            // Org users are filtered to their tenant. BypassTenantId skips the filter entirely.
            modelBuilder.Entity<User>().HasQueryFilter(u =>
                BypassTenantId || u.IsPlatformUser || u.OrganizationId == _tenantProvider.TenantId);
        }

        modelBuilder.Entity<ApplicationSequence>(entity =>
        {
            entity.HasKey(e => new { e.Year, e.Month });
        });

        modelBuilder.Entity<AttendanceLog>(entity =>
        {
            entity.ToTable("attendance_logs");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.MachineNumber).HasColumnName("machine_number");
            entity.Property(e => e.PunchTime).HasColumnName("punch_time");
            entity.Property(e => e.VerifyMode).HasColumnName("verify_mode");
            entity.Property(e => e.VerifyType).HasColumnName("verify_type");
            entity.Property(e => e.SyncedAt).HasColumnName("synced_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.EmployeeId).HasDatabaseName("idx_employee_id");
            entity.HasIndex(e => e.PunchTime).HasDatabaseName("idx_punch_time");
            entity.HasIndex(e => e.SyncedAt).HasDatabaseName("idx_synced_at");

            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);
        });



        modelBuilder.Entity<DailyAttendance>(entity =>
        {
            entity.ToTable("daily_attendance");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RecordDate);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.RecordDate).HasColumnName("record_date");
            entity.Property(e => e.InTime).HasColumnName("in_time");
            entity.Property(e => e.OutTime).HasColumnName("out_time");
            entity.Property(e => e.ShiftId).HasColumnName("shift_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.IsLate).HasColumnName("is_late");
            entity.Property(e => e.LateMinutes).HasColumnName("late_minutes");
            entity.Property(e => e.IsEarly).HasColumnName("is_early");
            entity.Property(e => e.EarlyMinutes).HasColumnName("early_minutes");
            entity.Property(e => e.IsHalfDay).HasColumnName("is_half_day");
            entity.Property(e => e.WorkMinutes).HasColumnName("work_minutes");
            entity.Property(e => e.BreakMinutes).HasColumnName("break_minutes");
            entity.Property(e => e.IsActualBreak).HasColumnName("is_actual_break");
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.ApplicationNumber).HasColumnName("application_number");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.EmployeeId).HasDatabaseName("idx_daily_att_employee_id");
            entity.HasIndex(e => e.RecordDate).HasDatabaseName("idx_daily_att_record_date");
            entity.HasIndex(e => new { e.OrganizationId, e.RecordDate });
            entity.HasIndex(e => new { e.EmployeeId, e.RecordDate }).IsUnique().HasDatabaseName("idx_daily_att_emp_date");

            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Shift)
                .WithMany()
                .HasForeignKey(e => e.ShiftId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("departments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DepartmentName).HasColumnName("department_name");
            entity.Property(e => e.Status).HasColumnName("status");
        });

        modelBuilder.Entity<Designation>(entity =>
        {
            entity.ToTable("designations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DesignationName).HasColumnName("designation_name");
            entity.Property(e => e.Status).HasColumnName("status");
        });

        modelBuilder.Entity<Shift>(entity =>
        {
            entity.ToTable("shifts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ShiftName).HasColumnName("shift_name");
            entity.Property(e => e.ShiftCode).HasColumnName("shift_code");
            entity.Property(e => e.StartTime).HasColumnName("start_time");
            entity.Property(e => e.EndTime).HasColumnName("end_time");
            entity.Property(e => e.LunchBreakStart).HasColumnName("lunch_break_start");
            entity.Property(e => e.LunchBreakEnd).HasColumnName("lunch_break_end");
            entity.Property(e => e.HalfTime).HasColumnName("half_time");
            entity.Property(e => e.LateComingGraceMinutes).HasColumnName("late_coming_grace_minutes");
            entity.Property(e => e.LateComingAllowedCountPerMonth).HasColumnName("late_coming_allowed_count_per_month");
            entity.Property(e => e.LateComingHalfDayOnExceed).HasColumnName("late_coming_half_day_on_exceed");
            entity.Property(e => e.EarlyLeaveGraceMinutes).HasColumnName("early_leave_grace_minutes");
            entity.Property(e => e.EarlyGoAllowedTime).HasColumnName("early_go_allowed_time");
            entity.Property(e => e.EarlyGoFrequencyPerMonth).HasColumnName("early_go_frequency_per_month");
            entity.Property(e => e.LunchBreakDuration).HasColumnName("lunch_break_duration");
            entity.Property(e => e.WorkingHours).HasColumnName("working_hours");
            entity.Property(e => e.Status).HasColumnName("status");
        });

        modelBuilder.Entity<Holiday>(entity =>
        {
            entity.ToTable("holidays");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.HolidayName).HasColumnName("holiday_name");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsGlobal).HasColumnName("is_global").HasDefaultValue(true);
        });

        modelBuilder.Entity<HolidayEmployee>(entity =>
        {
            entity.ToTable("holiday_employees");
            entity.HasKey(e => new { e.OrganizationId, e.HolidayId, e.EmployeeId });
            
            entity.Property(e => e.HolidayId).HasColumnName("holiday_id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");

            entity.HasOne(e => e.Holiday)
                .WithMany(h => h.EligibleEmployees)
                .HasForeignKey(e => e.HolidayId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveType>(entity =>
        {
            entity.ToTable("leave_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Code).HasColumnName("code");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.IsPaid).HasColumnName("is_paid");
            entity.Property(e => e.ApplicableAfterProbation).HasColumnName("applicable_after_probation");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<LeaveAllocation>(entity =>
        {
            entity.ToTable("leave_allocations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.LeaveTypeId).HasColumnName("leave_type_id");
            entity.Property(e => e.Year).HasColumnName("year");
            entity.Property(e => e.TotalAllocated).HasColumnName("total_allocated");
            entity.Property(e => e.OpeningBalance).HasColumnName("opening_balance");
            entity.Property(e => e.UsedCount).HasColumnName("used_count");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
            entity.HasOne(e => e.LeaveType).WithMany().HasForeignKey(e => e.LeaveTypeId);
        });

        modelBuilder.Entity<LeaveApplication>(entity =>
        {
            entity.ToTable("leave_applications");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.LeaveTypeId).HasColumnName("leave_type_id");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.TotalDays).HasColumnName("total_days");
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ApprovedBy).HasColumnName("approved_by");
            entity.Property(e => e.IgnoreSandwichRule).HasColumnName("ignore_sandwich_rule");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
            entity.HasOne(e => e.LeaveType).WithMany().HasForeignKey(e => e.LeaveTypeId);
        });

        modelBuilder.Entity<LeaveApplication>(entity =>
        {
            entity.HasIndex(e => new { e.OrganizationId, e.CreatedAt }).IsDescending(false, true);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("employees");
            entity.HasKey(e => new { e.OrganizationId, e.EmployeeId });

            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName).HasColumnName("employee_name");
            entity.Property(e => e.DepartmentId).HasColumnName("department_id");
            entity.Property(e => e.DesignationId).HasColumnName("designation_id");

            entity.Property(e => e.Phone).HasColumnName("phone");
            entity.Property(e => e.JoiningDate).HasColumnName("joining_date");
            entity.Property(e => e.ResignationDate).HasColumnName("resignation_date");
            entity.Property(e => e.LastWorkingDate).HasColumnName("LastWorkingDate");
            entity.Property(e => e.ProbationStart).HasColumnName("probation_start");
            entity.Property(e => e.ProbationEnd).HasColumnName("probation_end");
            entity.Property(e => e.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(e => e.Weekoff).HasColumnName("weekoff");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.DeviceSynced)
                .HasColumnName("device_synced")
                .HasColumnType("tinyint")
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(e => e.DeviceSyncError)
                .HasColumnName("device_sync_error")
                .HasColumnType("varchar(255)")
                .IsRequired(false);

            entity.HasOne(e => e.Department)
                .WithMany()
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Designation)
                .WithMany()
                .HasForeignKey(e => e.DesignationId)
                .OnDelete(DeleteBehavior.SetNull);


        });

        modelBuilder.Entity<LoanType>(entity =>
        {
            entity.ToTable("loan_types");
        });

        modelBuilder.Entity<EmployeeLoan>(entity =>
        {
            entity.ToTable("employee_loans");
            
            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.LoanType)
                .WithMany()
                .HasForeignKey(e => e.LoanTypeId);
        });

        modelBuilder.Entity<LoanInstallment>(entity =>
        {
            entity.ToTable("loan_installments");
            
            entity.HasOne(i => i.EmployeeLoan)
                .WithMany(l => l.LoanInstallments)
                .HasForeignKey(i => i.LoanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SalaryComponent>(entity =>
        {
            entity.ToTable("salary_components");
        });

        modelBuilder.Entity<EmployeeSalaryStructure>(entity =>
        {
            entity.ToTable("employee_salary_structure");
            
            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.SalaryComponent)
                .WithMany()
                .HasForeignKey(e => e.ComponentId);
        });

        modelBuilder.Entity<PayrollMaster>(entity =>
        {
            entity.ToTable("payroll_master");
            
            entity.HasOne(p => p.Employee)
                .WithMany()
                .HasForeignKey(p => new { p.OrganizationId, p.EmployeeId })
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PayrollDetail>(entity =>
        {
            entity.ToTable("payroll_details");
            
            entity.HasOne(d => d.PayrollMaster)
                .WithMany(p => p.PayrollDetails)
                .HasForeignKey(d => d.PayrollId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(d => d.SalaryComponent)
                .WithMany()
                .HasForeignKey(d => d.ComponentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Payroll Phase 1 entities ─────────────────────────────────────────
        modelBuilder.Entity<PayGroup>(entity =>
        {
            entity.ToTable("pay_groups");
            entity.HasOne(pg => pg.Template)
                  .WithMany(t => t.PayGroups)
                  .HasForeignKey(pg => pg.TemplateId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SalaryStructureTemplate>(entity =>
        {
            entity.ToTable("salary_structure_templates");
        });

        modelBuilder.Entity<TemplateComponent>(entity =>
        {
            entity.ToTable("template_components");
            entity.HasOne(tc => tc.Template)
                  .WithMany(t => t.Components)
                  .HasForeignKey(tc => tc.TemplateId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(tc => tc.Component)
                  .WithMany()
                  .HasForeignKey(tc => tc.ComponentId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmployeeCTC>(entity =>
        {
            entity.ToTable("employee_ctc");
            entity.HasOne(ec => ec.Employee)
                  .WithMany()
                  .HasForeignKey(ec => new { ec.OrganizationId, ec.EmployeeId })
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ec => ec.Template)
                  .WithMany(t => t.EmployeeCTCs)
                  .HasForeignKey(ec => ec.TemplateId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProfessionalTaxSlab>(entity =>
        {
            entity.ToTable("professional_tax_slabs");
            entity.HasIndex(s => new { s.OrganizationId, s.State, s.MinGross });
        });

        // Employee → PayGroup relationship
        modelBuilder.Entity<Employee>()
            .HasOne(e => e.PayGroup)
            .WithMany(pg => pg.Employees)
            .HasForeignKey(e => e.PayGroupId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<LeaveTypeEligibility>(entity =>
        {
            entity.ToTable("leave_type_eligibility");
            entity.HasKey(e => new { e.OrganizationId, e.EmployeeId, e.LeaveTypeId });
            
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
            entity.HasOne(e => e.LeaveType).WithMany(lt => lt.EligibleEmployees).HasForeignKey(e => e.LeaveTypeId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasOne(u => u.CustomRole)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(u => u.Employee)
                .WithMany()
                .HasForeignKey(u => new { u.OrganizationId, u.EmployeeId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.HasMany(e => e.Permissions)
                .WithOne(p => p.Role)
                .HasForeignKey(p => p.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("role_permissions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.PermissionKey).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Scope).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => new { e.RoleId, e.PermissionKey });
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasOne(e => e.ReportingManager)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.ReportingManagerId })
                .OnDelete(DeleteBehavior.Restrict);
        });

                modelBuilder.Entity<AttendanceRegularization>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<CompOffRequest>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<EmployeeShiftAssignment>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<ShiftRoster>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<ShiftCycle>(entity =>
        {
            entity.ToTable("shift_cycles");
            entity.HasKey(e => e.Id);
            entity.HasMany(e => e.Slots)
                .WithOne(s => s.Cycle)
                .HasForeignKey(s => s.CycleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShiftCycleSlot>(entity =>
        {
            entity.ToTable("shift_cycle_slots");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Shift)
                .WithMany()
                .HasForeignKey(e => e.ShiftId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<EmployeeShiftAssignment>(entity =>
        {
            entity.HasOne(e => e.Cycle)
                .WithMany()
                .HasForeignKey(e => e.CycleId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ShiftChangeRequest>(entity =>
        {
            entity.ToTable("shift_change_requests");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });
                modelBuilder.Entity<CompOffCredit>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<AttendanceLog>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });
        
        modelBuilder.Entity<CelebrationLog>(entity =>
        {
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => new { e.OrganizationId, e.EmployeeId });
        });

        modelBuilder.Entity<Candidate>(entity =>
        {
            entity.ToTable("candidates");
            entity.HasOne(c => c.Organization).WithMany().HasForeignKey(c => c.OrganizationId);
            entity.HasOne(c => c.HiredEmployee).WithMany().HasForeignKey(c => new { c.OrganizationId, c.HiredEmployeeId });
        });

        modelBuilder.Entity<SubscriptionPlan>(entity =>
        {
            entity.ToTable("subscription_plans");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<TenantSubscription>(entity =>
        {
            entity.ToTable("tenant_subscriptions");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Organization).WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Plan).WithMany().HasForeignKey(e => e.PlanId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.OrganizationId);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.OrganizationId, e.Timestamp }).IsDescending(false, true);
            entity.HasIndex(e => new { e.OrganizationId, e.EntityName });
        });

        modelBuilder.Entity<SubscriptionPayment>(entity =>
        {
            entity.ToTable("subscription_payments");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Organization).WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Plan).WithMany().HasForeignKey(e => e.PlanId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => new { e.OrganizationId, e.CreatedAt }).IsDescending(false, true);
            entity.HasIndex(e => e.InvoiceNumber).IsUnique();
        });
        
        base.OnModelCreating(modelBuilder);
    }

    public bool BypassTenantId { get; set; } = false;
    public bool BypassAudit { get; set; } = false;

    /// <summary>
    /// When true, archived rows (ArchivedAt != null) are included in queries.
    /// Set this to power the Archive view or to resolve a row for restore / permanent delete.
    /// Prefer <see cref="Services.Infrastructure.IArchiveService"/> over flipping this by hand.
    /// </summary>
    public bool BypassArchiveFilter { get; set; } = false;

    private void SetGlobalQueryFilter<T>(ModelBuilder builder) where T : class, IMustHaveTenant
    {
        builder.Entity<T>().HasQueryFilter(e => BypassTenantId || e.OrganizationId == _tenantProvider.TenantId);
    }

    /// <summary>Tenant-scoped AND archive-scoped. Used for entities implementing both interfaces.</summary>
    private void SetTenantAndArchiveQueryFilter<T>(ModelBuilder builder)
        where T : class, IMustHaveTenant, IArchivable
    {
        builder.Entity<T>().HasQueryFilter(e =>
            (BypassTenantId || e.OrganizationId == _tenantProvider.TenantId) &&
            (BypassArchiveFilter || e.ArchivedAt == null));
    }

    /// <summary>Archive-scoped only. For archivable entities that are not tenant-scoped.</summary>
    private void SetArchiveQueryFilter<T>(ModelBuilder builder) where T : class, IArchivable
    {
        builder.Entity<T>().HasQueryFilter(e => BypassArchiveFilter || e.ArchivedAt == null);
    }

    public override int SaveChanges()
    {
        var audits = OnBeforeSaveChanges();
        var result = base.SaveChanges();
        if (audits.Count > 0)
        {
            AuditLogs.AddRange(audits);
            base.SaveChanges();
        }
        return result;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var audits = OnBeforeSaveChanges();
        var result = await base.SaveChangesAsync(cancellationToken);
        if (audits.Count > 0)
        {
            AuditLogs.AddRange(audits);
            await base.SaveChangesAsync(cancellationToken);
        }
        return result;
    }

    private List<AuditLog> OnBeforeSaveChanges()
    {
        ApplyTenantId();

        var auditEntries = new List<AuditLog>();
        if (BypassAudit) return auditEntries;

        var httpContext = _httpContextAccessor?.HttpContext;
        var userName = httpContext?.User?.Identity?.Name ?? "System";
        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
        var targetOrgId = _tenantProvider?.TenantId > 0 ? _tenantProvider.TenantId : 1;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog || entry.Entity is AttendanceLog || entry.State is EntityState.Detached or EntityState.Unchanged)
                continue;

            var entityName = entry.Entity.GetType().Name;
            if (entityName.Contains("Proxy") && entityName.Contains("_"))
            {
                entityName = entry.Entity.GetType().BaseType?.Name ?? entityName;
            }

            var audit = new AuditLog
            {
                OrganizationId = targetOrgId,
                UserName = userName,
                EntityName = entityName,
                IpAddress = ipAddress,
                Timestamp = DateTime.Now
            };

            var primaryKey = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey())?.CurrentValue?.ToString();
            audit.PrimaryKey = primaryKey;

            var oldValues = new Dictionary<string, object?>();
            var newValues = new Dictionary<string, object?>();
            var changedColumns = new List<string>();

            switch (entry.State)
            {
                case EntityState.Added:
                    audit.Action = "CREATE";
                    foreach (var prop in entry.Properties)
                    {
                        if (prop.Metadata.IsPrimaryKey() && prop.CurrentValue is int i && i <= 0)
                            continue;
                        // Avoid serializing binary photo bytes
                        if (prop.Metadata.Name == "PhotoData" || prop.Metadata.Name == "ResumeData")
                            continue;
                        newValues[prop.Metadata.Name] = prop.CurrentValue;
                    }
                    break;

                case EntityState.Deleted:
                    audit.Action = "DELETE";
                    foreach (var prop in entry.Properties)
                    {
                        if (prop.Metadata.Name == "PhotoData" || prop.Metadata.Name == "ResumeData")
                            continue;
                        oldValues[prop.Metadata.Name] = prop.OriginalValue;
                    }
                    break;

                case EntityState.Modified:
                    audit.Action = "UPDATE";
                    foreach (var prop in entry.Properties)
                    {
                        if (prop.IsModified && !Equals(prop.OriginalValue, prop.CurrentValue))
                        {
                            if (prop.Metadata.Name == "PhotoData" || prop.Metadata.Name == "ResumeData")
                                continue;
                            changedColumns.Add(prop.Metadata.Name);
                            oldValues[prop.Metadata.Name] = prop.OriginalValue;
                            newValues[prop.Metadata.Name] = prop.CurrentValue;
                        }
                    }

                    // Archive / restore are semantically distinct from a plain field update.
                    // Relabel them so the audit trail is queryable by intent.
                    if (entry.Entity is IArchivable && changedColumns.Contains(nameof(IArchivable.ArchivedAt)))
                    {
                        var nowArchived = entry.Property(nameof(IArchivable.ArchivedAt)).CurrentValue != null;
                        audit.Action = nowArchived ? "ARCHIVE" : "RESTORE";
                    }
                    break;
            }

            if (entry.State == EntityState.Modified && changedColumns.Count == 0)
                continue;

            if (oldValues.Count > 0)
                audit.OldValues = System.Text.Json.JsonSerializer.Serialize(oldValues);

            if (newValues.Count > 0)
                audit.NewValues = System.Text.Json.JsonSerializer.Serialize(newValues);

            if (changedColumns.Count > 0)
                audit.ChangedColumns = string.Join(", ", changedColumns);

            auditEntries.Add(audit);
        }

        return auditEntries;
    }

    private void ApplyTenantId()
    {
        if (BypassTenantId || _tenantProvider == null) return;
        
        int targetTenantId = _tenantProvider.TenantId > 0 ? _tenantProvider.TenantId : 1;

        foreach (var entry in ChangeTracker.Entries<IMustHaveTenant>().ToList())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                case EntityState.Modified:
                    if (entry.Entity.OrganizationId <= 0)
                    {
                        entry.Entity.OrganizationId = targetTenantId;
                    }
                    break;
            }
        }
    }
}



