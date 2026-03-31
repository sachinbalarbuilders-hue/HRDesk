using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Data;

public sealed class BiometricAttendanceDbContext : DbContext
{
    public BiometricAttendanceDbContext(DbContextOptions<BiometricAttendanceDbContext> options)
        : base(options)
    {
    }

    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();

    public DbSet<DailyAttendance> DailyAttendance => Set<DailyAttendance>();

    public DbSet<Employee> Employees => Set<Employee>();

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

    public DbSet<CompOffCredit> CompOffCredits { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }

    public DbSet<CompOffRequest> CompOffRequests => Set<CompOffRequest>();

    public DbSet<DeviceConfiguration> DeviceConfigurations => Set<DeviceConfiguration>();

    public DbSet<User> Users => Set<User>();

    public DbSet<DeviceSyncState> DeviceSyncStates => Set<DeviceSyncState>();
    public DbSet<LeaveTypeEligibility> LeaveTypeEligibilities => Set<LeaveTypeEligibility>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
                .HasForeignKey(e => e.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });



        modelBuilder.Entity<DailyAttendance>(entity =>
        {
            entity.ToTable("daily_attendance");
            entity.HasKey(e => e.Id);

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
            entity.HasIndex(e => new { e.EmployeeId, e.RecordDate }).IsUnique().HasDatabaseName("idx_daily_att_emp_date");

            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => e.EmployeeId)
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
            entity.Property(e => e.LunchBreakDuration).HasColumnName("lunch_break_duration").ValueGeneratedOnAddOrUpdate();
            entity.Property(e => e.WorkingHours).HasColumnName("working_hours").ValueGeneratedOnAddOrUpdate();
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
            entity.HasKey(e => new { e.HolidayId, e.EmployeeId });
            
            entity.Property(e => e.HolidayId).HasColumnName("holiday_id");
            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");

            entity.HasOne(e => e.Holiday)
                .WithMany(h => h.EligibleEmployees)
                .HasForeignKey(e => e.HolidayId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Employee)
                .WithMany()
                .HasForeignKey(e => e.EmployeeId)
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

            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
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
            entity.Property(e => e.ApplicationNumber).HasColumnName("application_number");
            entity.Property(e => e.IgnoreSandwichRule).HasColumnName("ignore_sandwich_rule");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
            entity.HasOne(e => e.LeaveType).WithMany().HasForeignKey(e => e.LeaveTypeId);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("employees");
            entity.HasKey(e => e.EmployeeId);

            entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName).HasColumnName("employee_name");
            entity.Property(e => e.DepartmentId).HasColumnName("department_id");
            entity.Property(e => e.DesignationId).HasColumnName("designation_id");
            entity.Property(e => e.ShiftId).HasColumnName("shift_id");
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

            entity.HasOne(e => e.Shift)
                .WithMany()
                .HasForeignKey(e => e.ShiftId)
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
                .HasForeignKey(e => e.EmployeeId)
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
                .HasForeignKey(e => e.EmployeeId)
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
                .HasForeignKey(p => p.EmployeeId)
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

        modelBuilder.Entity<LeaveTypeEligibility>(entity =>
        {
            entity.ToTable("leave_type_eligibility");
            entity.HasKey(e => new { e.EmployeeId, e.LeaveTypeId });
            
            entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
            entity.HasOne(e => e.LeaveType).WithMany(lt => lt.EligibleEmployees).HasForeignKey(e => e.LeaveTypeId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasIndex(u => u.Username).IsUnique();
        });

        base.OnModelCreating(modelBuilder);
    }
}
