using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiOrganizationSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "users",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "system_settings",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "shifts",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "shift_roster",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "salary_components",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "payroll_master",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "payroll_details",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "loan_types",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "loan_installments",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "leave_types",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "leave_type_eligibility",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "leave_applications",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "leave_allocations",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "holidays",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "holiday_employees",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "employees",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "employee_shift_assignments",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "employee_salary_structure",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "employee_loans",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "DeviceConfigurations",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "device_sync_state",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "designations",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "departments",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "daily_attendance",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "comp_off_requests",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "comp_off_credits",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "attendance_regularizations",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "attendance_logs",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "organization_id",
                table: "application_sequences",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("INSERT INTO Organizations (id, name, is_active, created_at) VALUES (1, 'Default Organization', 1, NOW());");

            migrationBuilder.CreateIndex(
                name: "IX_users_organization_id",
                table: "users",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_system_settings_organization_id",
                table: "system_settings",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_organization_id",
                table: "shifts",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_organization_id",
                table: "shift_roster",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_salary_components_organization_id",
                table: "salary_components",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_organization_id",
                table: "payroll_master",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_organization_id",
                table: "payroll_details",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_types_organization_id",
                table: "loan_types",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_installments_organization_id",
                table: "loan_installments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_organization_id",
                table: "leave_types",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_type_eligibility_organization_id",
                table: "leave_type_eligibility",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_organization_id",
                table: "leave_applications",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_organization_id",
                table: "leave_allocations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_holidays_organization_id",
                table: "holidays",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_organization_id",
                table: "holiday_employees",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employees_organization_id",
                table: "employees",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_organization_id",
                table: "employee_shift_assignments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_organization_id",
                table: "employee_salary_structure",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_organization_id",
                table: "employee_loans",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceConfigurations_organization_id",
                table: "DeviceConfigurations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_sync_state_organization_id",
                table: "device_sync_state",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_designations_organization_id",
                table: "designations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_organization_id",
                table: "departments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_organization_id",
                table: "daily_attendance",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_organization_id",
                table: "comp_off_requests",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_organization_id",
                table: "comp_off_credits",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_organization_id",
                table: "attendance_regularizations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_logs_organization_id",
                table: "attendance_logs",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_application_sequences_organization_id",
                table: "application_sequences",
                column: "organization_id");

            migrationBuilder.AddForeignKey(
                name: "FK_application_sequences_Organizations_organization_id",
                table: "application_sequences",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_logs_Organizations_organization_id",
                table: "attendance_logs",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_regularizations_Organizations_organization_id",
                table: "attendance_regularizations",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_credits_Organizations_organization_id",
                table: "comp_off_credits",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_requests_Organizations_organization_id",
                table: "comp_off_requests",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_daily_attendance_Organizations_organization_id",
                table: "daily_attendance",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_departments_Organizations_organization_id",
                table: "departments",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_designations_Organizations_organization_id",
                table: "designations",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_device_sync_state_Organizations_organization_id",
                table: "device_sync_state",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DeviceConfigurations_Organizations_organization_id",
                table: "DeviceConfigurations",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_loans_Organizations_organization_id",
                table: "employee_loans",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_salary_structure_Organizations_organization_id",
                table: "employee_salary_structure",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_assignments_Organizations_organization_id",
                table: "employee_shift_assignments",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employees_Organizations_organization_id",
                table: "employees",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_holiday_employees_Organizations_organization_id",
                table: "holiday_employees",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_holidays_Organizations_organization_id",
                table: "holidays",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_allocations_Organizations_organization_id",
                table: "leave_allocations",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_applications_Organizations_organization_id",
                table: "leave_applications",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_type_eligibility_Organizations_organization_id",
                table: "leave_type_eligibility",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_types_Organizations_organization_id",
                table: "leave_types",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_loan_installments_Organizations_organization_id",
                table: "loan_installments",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_loan_types_Organizations_organization_id",
                table: "loan_types",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_details_Organizations_organization_id",
                table: "payroll_details",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_master_Organizations_organization_id",
                table: "payroll_master",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_salary_components_Organizations_organization_id",
                table: "salary_components",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_shift_roster_Organizations_organization_id",
                table: "shift_roster",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_shifts_Organizations_organization_id",
                table: "shifts",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_system_settings_Organizations_organization_id",
                table: "system_settings",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_users_Organizations_organization_id",
                table: "users",
                column: "organization_id",
                principalTable: "Organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_application_sequences_Organizations_organization_id",
                table: "application_sequences");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_logs_Organizations_organization_id",
                table: "attendance_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_regularizations_Organizations_organization_id",
                table: "attendance_regularizations");

            migrationBuilder.DropForeignKey(
                name: "FK_comp_off_credits_Organizations_organization_id",
                table: "comp_off_credits");

            migrationBuilder.DropForeignKey(
                name: "FK_comp_off_requests_Organizations_organization_id",
                table: "comp_off_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_daily_attendance_Organizations_organization_id",
                table: "daily_attendance");

            migrationBuilder.DropForeignKey(
                name: "FK_departments_Organizations_organization_id",
                table: "departments");

            migrationBuilder.DropForeignKey(
                name: "FK_designations_Organizations_organization_id",
                table: "designations");

            migrationBuilder.DropForeignKey(
                name: "FK_device_sync_state_Organizations_organization_id",
                table: "device_sync_state");

            migrationBuilder.DropForeignKey(
                name: "FK_DeviceConfigurations_Organizations_organization_id",
                table: "DeviceConfigurations");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_loans_Organizations_organization_id",
                table: "employee_loans");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_salary_structure_Organizations_organization_id",
                table: "employee_salary_structure");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_shift_assignments_Organizations_organization_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_employees_Organizations_organization_id",
                table: "employees");

            migrationBuilder.DropForeignKey(
                name: "FK_holiday_employees_Organizations_organization_id",
                table: "holiday_employees");

            migrationBuilder.DropForeignKey(
                name: "FK_holidays_Organizations_organization_id",
                table: "holidays");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_allocations_Organizations_organization_id",
                table: "leave_allocations");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_applications_Organizations_organization_id",
                table: "leave_applications");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_type_eligibility_Organizations_organization_id",
                table: "leave_type_eligibility");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_types_Organizations_organization_id",
                table: "leave_types");

            migrationBuilder.DropForeignKey(
                name: "FK_loan_installments_Organizations_organization_id",
                table: "loan_installments");

            migrationBuilder.DropForeignKey(
                name: "FK_loan_types_Organizations_organization_id",
                table: "loan_types");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_details_Organizations_organization_id",
                table: "payroll_details");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_master_Organizations_organization_id",
                table: "payroll_master");

            migrationBuilder.DropForeignKey(
                name: "FK_salary_components_Organizations_organization_id",
                table: "salary_components");

            migrationBuilder.DropForeignKey(
                name: "FK_shift_roster_Organizations_organization_id",
                table: "shift_roster");

            migrationBuilder.DropForeignKey(
                name: "FK_shifts_Organizations_organization_id",
                table: "shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_system_settings_Organizations_organization_id",
                table: "system_settings");

            migrationBuilder.DropForeignKey(
                name: "FK_users_Organizations_organization_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_users_organization_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_system_settings_organization_id",
                table: "system_settings");

            migrationBuilder.DropIndex(
                name: "IX_shifts_organization_id",
                table: "shifts");

            migrationBuilder.DropIndex(
                name: "IX_shift_roster_organization_id",
                table: "shift_roster");

            migrationBuilder.DropIndex(
                name: "IX_salary_components_organization_id",
                table: "salary_components");

            migrationBuilder.DropIndex(
                name: "IX_payroll_master_organization_id",
                table: "payroll_master");

            migrationBuilder.DropIndex(
                name: "IX_payroll_details_organization_id",
                table: "payroll_details");

            migrationBuilder.DropIndex(
                name: "IX_loan_types_organization_id",
                table: "loan_types");

            migrationBuilder.DropIndex(
                name: "IX_loan_installments_organization_id",
                table: "loan_installments");

            migrationBuilder.DropIndex(
                name: "IX_leave_types_organization_id",
                table: "leave_types");

            migrationBuilder.DropIndex(
                name: "IX_leave_type_eligibility_organization_id",
                table: "leave_type_eligibility");

            migrationBuilder.DropIndex(
                name: "IX_leave_applications_organization_id",
                table: "leave_applications");

            migrationBuilder.DropIndex(
                name: "IX_leave_allocations_organization_id",
                table: "leave_allocations");

            migrationBuilder.DropIndex(
                name: "IX_holidays_organization_id",
                table: "holidays");

            migrationBuilder.DropIndex(
                name: "IX_holiday_employees_organization_id",
                table: "holiday_employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_organization_id",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employee_shift_assignments_organization_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropIndex(
                name: "IX_employee_salary_structure_organization_id",
                table: "employee_salary_structure");

            migrationBuilder.DropIndex(
                name: "IX_employee_loans_organization_id",
                table: "employee_loans");

            migrationBuilder.DropIndex(
                name: "IX_DeviceConfigurations_organization_id",
                table: "DeviceConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_device_sync_state_organization_id",
                table: "device_sync_state");

            migrationBuilder.DropIndex(
                name: "IX_designations_organization_id",
                table: "designations");

            migrationBuilder.DropIndex(
                name: "IX_departments_organization_id",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_daily_attendance_organization_id",
                table: "daily_attendance");

            migrationBuilder.DropIndex(
                name: "IX_comp_off_requests_organization_id",
                table: "comp_off_requests");

            migrationBuilder.DropIndex(
                name: "IX_comp_off_credits_organization_id",
                table: "comp_off_credits");

            migrationBuilder.DropIndex(
                name: "IX_attendance_regularizations_organization_id",
                table: "attendance_regularizations");

            migrationBuilder.DropIndex(
                name: "IX_attendance_logs_organization_id",
                table: "attendance_logs");

            migrationBuilder.DropIndex(
                name: "IX_application_sequences_organization_id",
                table: "application_sequences");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "shift_roster");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "loan_types");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "loan_installments");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "leave_type_eligibility");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "leave_applications");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "leave_allocations");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "holiday_employees");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "employee_salary_structure");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "DeviceConfigurations");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "device_sync_state");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "designations");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "daily_attendance");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "comp_off_requests");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "comp_off_credits");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "attendance_regularizations");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "application_sequences");
        }
    }
}
