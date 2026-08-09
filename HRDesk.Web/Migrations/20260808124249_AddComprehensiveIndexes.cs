using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddComprehensiveIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "leave_applications",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "employees",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_roster_date",
                table: "shift_roster",
                column: "roster_date");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_month",
                table: "payroll_master",
                column: "month");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_status",
                table: "payroll_master",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_start_date_end_date",
                table: "leave_applications",
                columns: new[] { "start_date", "end_date" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_status",
                table: "leave_applications",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_holidays_start_date_end_date",
                table: "holidays",
                columns: new[] { "start_date", "end_date" });

            migrationBuilder.CreateIndex(
                name: "IX_employees_status",
                table: "employees",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_status",
                table: "comp_off_requests",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_worked_date",
                table: "comp_off_requests",
                column: "worked_date");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_work_date",
                table: "comp_off_credits",
                column: "work_date");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_request_date",
                table: "attendance_regularizations",
                column: "request_date");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_status",
                table: "attendance_regularizations",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_shift_roster_roster_date",
                table: "shift_roster");

            migrationBuilder.DropIndex(
                name: "IX_payroll_master_month",
                table: "payroll_master");

            migrationBuilder.DropIndex(
                name: "IX_payroll_master_status",
                table: "payroll_master");

            migrationBuilder.DropIndex(
                name: "IX_leave_applications_start_date_end_date",
                table: "leave_applications");

            migrationBuilder.DropIndex(
                name: "IX_leave_applications_status",
                table: "leave_applications");

            migrationBuilder.DropIndex(
                name: "IX_holidays_start_date_end_date",
                table: "holidays");

            migrationBuilder.DropIndex(
                name: "IX_employees_status",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_comp_off_requests_status",
                table: "comp_off_requests");

            migrationBuilder.DropIndex(
                name: "IX_comp_off_requests_worked_date",
                table: "comp_off_requests");

            migrationBuilder.DropIndex(
                name: "IX_comp_off_credits_work_date",
                table: "comp_off_credits");

            migrationBuilder.DropIndex(
                name: "IX_attendance_regularizations_request_date",
                table: "attendance_regularizations");

            migrationBuilder.DropIndex(
                name: "IX_attendance_regularizations_status",
                table: "attendance_regularizations");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "leave_applications",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "employees",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);
        }
    }
}
