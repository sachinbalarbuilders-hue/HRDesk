using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGateActivityLogsAndEmployeeContractFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ContractDurationMonths",
                table: "employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContractEndDate",
                table: "employees",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "gate_activity_logs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    EmployeeId = table.Column<int>(type: "int", nullable: true),
                    EmployeeCode = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    EmployeeName = table.Column<string>(type: "nvarchar(150)", nullable: true),
                    DepartmentName = table.Column<string>(type: "nvarchar(100)", nullable: true),
                    DesignationName = table.Column<string>(type: "nvarchar(100)", nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(30)", nullable: true),
                    ScanMode = table.Column<string>(type: "nvarchar(30)", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(255)", nullable: true),
                    ScannedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ScannedBy = table.Column<string>(type: "nvarchar(100)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gate_activity_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_gate_activity_logs_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_date_emp",
                table: "shift_roster",
                columns: new[] { "roster_date", "employee_id" })
                .Annotation("SqlServer:Include", new[] { "is_week_off", "shift_id", "organization_id" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_date_emp",
                table: "leave_applications",
                columns: new[] { "start_date", "end_date", "employee_id", "status" })
                .Annotation("SqlServer:Include", new[] { "leave_type_id", "total_days", "reason", "organization_id" });

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_date_emp",
                table: "daily_attendance",
                columns: new[] { "record_date", "employee_id" })
                .Annotation("SqlServer:Include", new[] { "status", "in_time", "out_time", "work_minutes", "is_half_day", "is_late", "is_early", "shift_id", "organization_id" });

            migrationBuilder.CreateIndex(
                name: "IX_gate_activity_logs_organization_id_ScannedAt",
                table: "gate_activity_logs",
                columns: new[] { "organization_id", "ScannedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gate_activity_logs");

            migrationBuilder.DropIndex(
                name: "IX_shift_roster_date_emp",
                table: "shift_roster");

            migrationBuilder.DropIndex(
                name: "IX_leave_applications_date_emp",
                table: "leave_applications");

            migrationBuilder.DropIndex(
                name: "IX_daily_attendance_date_emp",
                table: "daily_attendance");

            migrationBuilder.DropColumn(
                name: "ContractDurationMonths",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "ContractEndDate",
                table: "employees");
        }
    }
}
