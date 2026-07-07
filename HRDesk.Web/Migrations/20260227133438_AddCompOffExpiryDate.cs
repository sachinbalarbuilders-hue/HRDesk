using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddCompOffExpiryDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_active",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "is_punch_exempt",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "is_manual_override",
                table: "daily_attendance");

            migrationBuilder.DropColumn(
                name: "manual_override_by",
                table: "daily_attendance");

            migrationBuilder.RenameColumn(
                name: "holiday_date",
                table: "holidays",
                newName: "start_date");

            migrationBuilder.RenameColumn(
                name: "punch_time",
                table: "attendance_regularizations",
                newName: "punch_time_in");

            migrationBuilder.AddColumn<string>(
                name: "leave_breakdown",
                table: "payroll_master",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "ignore_sandwich_rule",
                table: "leave_applications",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "end_date",
                table: "holidays",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<bool>(
                name: "is_global",
                table: "holidays",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "starting_paid_installments",
                table: "employee_loans",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "expiry_date",
                table: "comp_off_requests",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "holiday_employees",
                columns: table => new
                {
                    holiday_id = table.Column<int>(type: "int", nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_holiday_employees", x => new { x.holiday_id, x.employee_id });
                    table.ForeignKey(
                        name: "FK_holiday_employees_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_holiday_employees_holidays_holiday_id",
                        column: x => x.holiday_id,
                        principalTable: "holidays",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_employee_id",
                table: "holiday_employees",
                column: "employee_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "holiday_employees");

            migrationBuilder.DropColumn(
                name: "leave_breakdown",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "ignore_sandwich_rule",
                table: "leave_applications");

            migrationBuilder.DropColumn(
                name: "end_date",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "is_global",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "starting_paid_installments",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "expiry_date",
                table: "comp_off_requests");

            migrationBuilder.RenameColumn(
                name: "start_date",
                table: "holidays",
                newName: "holiday_date");

            migrationBuilder.RenameColumn(
                name: "punch_time_in",
                table: "attendance_regularizations",
                newName: "punch_time");

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "holidays",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_punch_exempt",
                table: "employees",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_manual_override",
                table: "daily_attendance",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "manual_override_by",
                table: "daily_attendance",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }
    }
}
