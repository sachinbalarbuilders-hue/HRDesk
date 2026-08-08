using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class InitialSqlServer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    whatsapp_group_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    latitude = table.Column<double>(type: "float", nullable: true),
                    longitude = table.Column<double>(type: "float", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "application_sequences",
                columns: table => new
                {
                    year = table.Column<int>(type: "int", nullable: false),
                    month = table.Column<int>(type: "int", nullable: false),
                    current_value = table.Column<int>(type: "int", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_sequences", x => new { x.year, x.month });
                    table.ForeignKey(
                        name: "FK_application_sequences_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "departments",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    department_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_departments", x => x.id);
                    table.ForeignKey(
                        name: "FK_departments_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "designations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    designation_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_designations", x => x.id);
                    table.ForeignKey(
                        name: "FK_designations_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_commands",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: true),
                    employee_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    enabled = table.Column<bool>(type: "bit", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    error_message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_commands", x => x.id);
                    table.ForeignKey(
                        name: "FK_device_commands_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "device_sync_state",
                columns: table => new
                {
                    device_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    device_ip = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    last_synced_time = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_sync_status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    records_synced = table.Column<int>(type: "int", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_sync_state", x => x.device_id);
                    table.ForeignKey(
                        name: "FK_device_sync_state_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DeviceConfigurations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Port = table.Column<int>(type: "int", nullable: false),
                    MachineNumber = table.Column<int>(type: "int", nullable: false),
                    CommKey = table.Column<int>(type: "int", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceConfigurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeviceConfigurations_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "holidays",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    holiday_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_global = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_holidays", x => x.id);
                    table.ForeignKey(
                        name: "FK_holidays_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "leave_types",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    default_yearly_quota = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    is_paid = table.Column<bool>(type: "bit", nullable: false),
                    applicable_after_probation = table.Column<bool>(type: "bit", nullable: false),
                    allow_carry_forward = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    text_color = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    background_color = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_types", x => x.id);
                    table.ForeignKey(
                        name: "FK_leave_types_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loan_types",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    type_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    max_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    max_installments = table.Column<int>(type: "int", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loan_types", x => x.id);
                    table.ForeignKey(
                        name: "FK_loan_types_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "salary_components",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    component_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    component_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    component_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salary_components", x => x.id);
                    table.ForeignKey(
                        name: "FK_salary_components_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "shifts",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    shift_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    shift_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    start_time = table.Column<TimeOnly>(type: "time", nullable: false),
                    end_time = table.Column<TimeOnly>(type: "time", nullable: false),
                    lunch_break_start = table.Column<TimeOnly>(type: "time", nullable: true),
                    lunch_break_end = table.Column<TimeOnly>(type: "time", nullable: true),
                    half_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    late_coming_grace_minutes = table.Column<int>(type: "int", nullable: true),
                    late_coming_allowed_count_per_month = table.Column<int>(type: "int", nullable: true),
                    late_coming_half_day_on_exceed = table.Column<bool>(type: "bit", nullable: true),
                    early_leave_grace_minutes = table.Column<int>(type: "int", nullable: true),
                    early_go_allowed_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    early_go_frequency_per_month = table.Column<int>(type: "int", nullable: true),
                    color_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    lunch_break_duration = table.Column<int>(type: "int", nullable: false),
                    working_hours = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shifts", x => x.id);
                    table.ForeignKey(
                        name: "FK_shifts_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "system_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    setting_key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    setting_value = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_settings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_system_settings_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_login = table.Column<DateTime>(type: "datetime2", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_users_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "employees",
                columns: table => new
                {
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    employee_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    department_id = table.Column<int>(type: "int", nullable: true),
                    designation_id = table.Column<int>(type: "int", nullable: true),
                    phone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    joining_date = table.Column<DateOnly>(type: "date", nullable: true),
                    resignation_date = table.Column<DateOnly>(type: "date", nullable: true),
                    LastWorkingDate = table.Column<DateOnly>(type: "date", nullable: true),
                    probation_start = table.Column<DateOnly>(type: "date", nullable: true),
                    probation_end = table.Column<DateOnly>(type: "date", nullable: true),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    weekoff = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhotoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhotoData = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    PhotoContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    device_synced = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)0),
                    device_sync_error = table.Column<string>(type: "varchar(255)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employees", x => new { x.organization_id, x.employee_id });
                    table.ForeignKey(
                        name: "FK_employees_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employees_departments_department_id",
                        column: x => x.department_id,
                        principalTable: "departments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_employees_designations_designation_id",
                        column: x => x.designation_id,
                        principalTable: "designations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "attendance_logs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    machine_number = table.Column<int>(type: "int", nullable: false),
                    punch_time = table.Column<DateTime>(type: "datetime2", nullable: false),
                    verify_mode = table.Column<int>(type: "int", nullable: false),
                    verify_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    synced_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_attendance_logs_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_logs_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "attendance_regularizations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    request_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    waive_penalty = table.Column<bool>(type: "bit", nullable: false),
                    request_date = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    application_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    punch_time_in = table.Column<DateTime>(type: "datetime2", nullable: true),
                    punch_time_out = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    approved_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_regularizations", x => x.id);
                    table.ForeignKey(
                        name: "FK_attendance_regularizations_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_regularizations_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "candidates",
                columns: table => new
                {
                    CandidateId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    CandidateName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    AppliedFor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResumeData = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    ResumeFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ResumeContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApplicationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentSalary = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ExpectedSalary = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    HiredEmployeeId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidates", x => x.CandidateId);
                    table.ForeignKey(
                        name: "FK_candidates_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_candidates_employees_organization_id_HiredEmployeeId",
                        columns: x => new { x.organization_id, x.HiredEmployeeId },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "celebration_logs",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    event_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    sent_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_celebration_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_celebration_logs_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_celebration_logs_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "comp_off_credits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    work_date = table.Column<DateOnly>(type: "date", nullable: false),
                    credited_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comp_off_credits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_comp_off_credits_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_comp_off_credits_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "comp_off_requests",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    worked_date = table.Column<DateOnly>(type: "date", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: true),
                    in_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    out_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    work_minutes = table.Column<int>(type: "int", nullable: true),
                    comp_off_days = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    request_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    approved_by = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    approved_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    rejection_reason = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comp_off_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_comp_off_requests_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_comp_off_requests_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_comp_off_requests_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "daily_attendance",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    record_date = table.Column<DateOnly>(type: "date", nullable: false),
                    in_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    out_time = table.Column<TimeOnly>(type: "time", nullable: true),
                    shift_id = table.Column<int>(type: "int", nullable: true),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    is_late = table.Column<bool>(type: "bit", nullable: false),
                    late_minutes = table.Column<int>(type: "int", nullable: false),
                    is_early = table.Column<bool>(type: "bit", nullable: false),
                    early_minutes = table.Column<int>(type: "int", nullable: false),
                    work_minutes = table.Column<int>(type: "int", nullable: false),
                    break_minutes = table.Column<int>(type: "int", nullable: false),
                    is_actual_break = table.Column<bool>(type: "bit", nullable: false),
                    is_half_day = table.Column<bool>(type: "bit", nullable: false),
                    remarks = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    application_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_daily_attendance", x => x.id);
                    table.ForeignKey(
                        name: "FK_daily_attendance_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_daily_attendance_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_daily_attendance_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "employee_loans",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    loan_type_id = table.Column<int>(type: "int", nullable: false),
                    application_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    loan_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    installments = table.Column<int>(type: "int", nullable: false),
                    installment_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    remaining_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    remaining_installments = table.Column<int>(type: "int", nullable: false),
                    starting_paid_installments = table.Column<int>(type: "int", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    approved_by = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    approved_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    foreclosure_remark = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    application_date = table.Column<DateOnly>(type: "date", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_loans", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_loans_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_loans_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employee_loans_loan_types_loan_type_id",
                        column: x => x.loan_type_id,
                        principalTable: "loan_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "employee_salary_structure",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    component_id = table.Column<int>(type: "int", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_salary_structure", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_salary_structure_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_salary_structure_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employee_salary_structure_salary_components_component_id",
                        column: x => x.component_id,
                        principalTable: "salary_components",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "employee_shift_assignments",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: false),
                    from_date = table.Column<DateOnly>(type: "date", nullable: false),
                    to_date = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_shift_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_shift_assignments_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_shift_assignments_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_shift_assignments_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "holiday_employees",
                columns: table => new
                {
                    holiday_id = table.Column<int>(type: "int", nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_holiday_employees", x => new { x.organization_id, x.holiday_id, x.employee_id });
                    table.ForeignKey(
                        name: "FK_holiday_employees_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_holiday_employees_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_holiday_employees_holidays_holiday_id",
                        column: x => x.holiday_id,
                        principalTable: "holidays",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "leave_allocations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    leave_type_id = table.Column<int>(type: "int", nullable: false),
                    year = table.Column<int>(type: "int", nullable: false),
                    total_allocated = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    opening_balance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    used_count = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_allocations", x => x.id);
                    table.ForeignKey(
                        name: "FK_leave_allocations_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_allocations_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_allocations_leave_types_leave_type_id",
                        column: x => x.leave_type_id,
                        principalTable: "leave_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "leave_applications",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    leave_type_id = table.Column<int>(type: "int", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    day_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    approved_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    application_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ignore_sandwich_rule = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_applications", x => x.id);
                    table.ForeignKey(
                        name: "FK_leave_applications_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_applications_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_applications_leave_types_leave_type_id",
                        column: x => x.leave_type_id,
                        principalTable: "leave_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "leave_type_eligibility",
                columns: table => new
                {
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    leave_type_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_type_eligibility", x => new { x.organization_id, x.employee_id, x.leave_type_id });
                    table.ForeignKey(
                        name: "FK_leave_type_eligibility_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_type_eligibility_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leave_type_eligibility_leave_types_leave_type_id",
                        column: x => x.leave_type_id,
                        principalTable: "leave_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payroll_master",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    month = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    total_days = table.Column<int>(type: "int", nullable: false),
                    present_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    absent_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    paid_leaves = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    unpaid_leaves = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    half_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    weekoffs = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    holidays = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    payable_days = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    gross_salary = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    total_earnings = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    total_deductions = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    net_salary = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    processed_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    approved_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    payment_date = table.Column<DateOnly>(type: "date", nullable: true),
                    remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    leave_breakdown = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_master", x => x.id);
                    table.ForeignKey(
                        name: "FK_payroll_master_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payroll_master_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shift_roster",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: true),
                    roster_date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_week_off = table.Column<bool>(type: "bit", nullable: false),
                    remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_roster", x => x.id);
                    table.ForeignKey(
                        name: "FK_shift_roster_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_roster_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_roster_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InterviewSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    CandidateId = table.Column<int>(type: "int", nullable: false),
                    InterviewDateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterviewType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Round = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InterviewerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    InterviewerPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Result = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Feedback = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReminderSent = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewSchedules_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InterviewSchedules_candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "candidates",
                        principalColumn: "CandidateId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loan_installments",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    loan_id = table.Column<int>(type: "int", nullable: false),
                    installment_number = table.Column<int>(type: "int", nullable: false),
                    due_month = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    paid_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    paid_date = table.Column<DateOnly>(type: "date", nullable: true),
                    payroll_id = table.Column<int>(type: "int", nullable: true),
                    remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loan_installments", x => x.id);
                    table.ForeignKey(
                        name: "FK_loan_installments_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_loan_installments_employee_loans_loan_id",
                        column: x => x.loan_id,
                        principalTable: "employee_loans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payroll_details",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    payroll_id = table.Column<int>(type: "int", nullable: false),
                    component_id = table.Column<int>(type: "int", nullable: true),
                    component_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    component_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_details", x => x.id);
                    table.ForeignKey(
                        name: "FK_payroll_details_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payroll_details_payroll_master_payroll_id",
                        column: x => x.payroll_id,
                        principalTable: "payroll_master",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payroll_details_salary_components_component_id",
                        column: x => x.component_id,
                        principalTable: "salary_components",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_application_sequences_organization_id",
                table: "application_sequences",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "idx_employee_id",
                table: "attendance_logs",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "idx_punch_time",
                table: "attendance_logs",
                column: "punch_time");

            migrationBuilder.CreateIndex(
                name: "idx_synced_at",
                table: "attendance_logs",
                column: "synced_at");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_logs_organization_id_employee_id",
                table: "attendance_logs",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_organization_id_employee_id",
                table: "attendance_regularizations",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_candidates_organization_id_HiredEmployeeId",
                table: "candidates",
                columns: new[] { "organization_id", "HiredEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_celebration_logs_organization_id_employee_id",
                table: "celebration_logs",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_organization_id_employee_id",
                table: "comp_off_credits",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_organization_id_employee_id",
                table: "comp_off_requests",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_shift_id",
                table: "comp_off_requests",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "idx_daily_att_emp_date",
                table: "daily_attendance",
                columns: new[] { "employee_id", "record_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_daily_att_employee_id",
                table: "daily_attendance",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "idx_daily_att_record_date",
                table: "daily_attendance",
                column: "record_date");

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_organization_id_employee_id",
                table: "daily_attendance",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_shift_id",
                table: "daily_attendance",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_organization_id",
                table: "departments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_designations_organization_id",
                table: "designations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_commands_organization_id",
                table: "device_commands",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_sync_state_organization_id",
                table: "device_sync_state",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceConfigurations_organization_id",
                table: "DeviceConfigurations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_loan_type_id",
                table: "employee_loans",
                column: "loan_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_organization_id_employee_id",
                table: "employee_loans",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_component_id",
                table: "employee_salary_structure",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_organization_id_employee_id",
                table: "employee_salary_structure",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_organization_id_employee_id",
                table: "employee_shift_assignments",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_shift_id",
                table: "employee_shift_assignments",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_employees_department_id",
                table: "employees",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_employees_designation_id",
                table: "employees",
                column: "designation_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_holiday_id",
                table: "holiday_employees",
                column: "holiday_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_organization_id_employee_id",
                table: "holiday_employees",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_holidays_organization_id",
                table: "holidays",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewSchedules_CandidateId",
                table: "InterviewSchedules",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewSchedules_organization_id",
                table: "InterviewSchedules",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_leave_type_id",
                table: "leave_allocations",
                column: "leave_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_organization_id_employee_id",
                table: "leave_allocations",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_leave_type_id",
                table: "leave_applications",
                column: "leave_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_organization_id_employee_id",
                table: "leave_applications",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_type_eligibility_leave_type_id",
                table: "leave_type_eligibility",
                column: "leave_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_organization_id",
                table: "leave_types",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_installments_loan_id",
                table: "loan_installments",
                column: "loan_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_installments_organization_id",
                table: "loan_installments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_types_organization_id",
                table: "loan_types",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_component_id",
                table: "payroll_details",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_organization_id",
                table: "payroll_details",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_payroll_id",
                table: "payroll_details",
                column: "payroll_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_organization_id_employee_id",
                table: "payroll_master",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_salary_components_organization_id",
                table: "salary_components",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_organization_id_employee_id",
                table: "shift_roster",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_shift_id",
                table: "shift_roster",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_organization_id",
                table: "shifts",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_system_settings_organization_id",
                table: "system_settings",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_organization_id",
                table: "users",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_username",
                table: "users",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "application_sequences");

            migrationBuilder.DropTable(
                name: "attendance_logs");

            migrationBuilder.DropTable(
                name: "attendance_regularizations");

            migrationBuilder.DropTable(
                name: "celebration_logs");

            migrationBuilder.DropTable(
                name: "comp_off_credits");

            migrationBuilder.DropTable(
                name: "comp_off_requests");

            migrationBuilder.DropTable(
                name: "daily_attendance");

            migrationBuilder.DropTable(
                name: "device_commands");

            migrationBuilder.DropTable(
                name: "device_sync_state");

            migrationBuilder.DropTable(
                name: "DeviceConfigurations");

            migrationBuilder.DropTable(
                name: "employee_salary_structure");

            migrationBuilder.DropTable(
                name: "employee_shift_assignments");

            migrationBuilder.DropTable(
                name: "holiday_employees");

            migrationBuilder.DropTable(
                name: "InterviewSchedules");

            migrationBuilder.DropTable(
                name: "leave_allocations");

            migrationBuilder.DropTable(
                name: "leave_applications");

            migrationBuilder.DropTable(
                name: "leave_type_eligibility");

            migrationBuilder.DropTable(
                name: "loan_installments");

            migrationBuilder.DropTable(
                name: "payroll_details");

            migrationBuilder.DropTable(
                name: "shift_roster");

            migrationBuilder.DropTable(
                name: "system_settings");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "holidays");

            migrationBuilder.DropTable(
                name: "candidates");

            migrationBuilder.DropTable(
                name: "leave_types");

            migrationBuilder.DropTable(
                name: "employee_loans");

            migrationBuilder.DropTable(
                name: "payroll_master");

            migrationBuilder.DropTable(
                name: "salary_components");

            migrationBuilder.DropTable(
                name: "shifts");

            migrationBuilder.DropTable(
                name: "loan_types");

            migrationBuilder.DropTable(
                name: "employees");

            migrationBuilder.DropTable(
                name: "departments");

            migrationBuilder.DropTable(
                name: "designations");

            migrationBuilder.DropTable(
                name: "Organizations");
        }
    }
}
