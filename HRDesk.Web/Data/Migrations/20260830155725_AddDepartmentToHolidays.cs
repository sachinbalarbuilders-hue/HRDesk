using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDepartmentToHolidays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "marital_status_applicability",
                table: "leave_types",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "department_id",
                table: "holidays",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "department_ids",
                table: "holidays",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "employee_exits",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    exit_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    initiated_by = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    resignation_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_working_date = table.Column<DateOnly>(type: "date", nullable: false),
                    notice_period_days = table.Column<int>(type: "int", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    reason_details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    approved_by_user_id = table.Column<int>(type: "int", nullable: true),
                    approved_by_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    approved_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    is_eligible_for_rehire = table.Column<bool>(type: "bit", nullable: false),
                    handover_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    clearance_checklist_json = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    handover_notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    exit_interview_completed = table.Column<bool>(type: "bit", nullable: false),
                    exit_interview_rating = table.Column<int>(type: "int", nullable: true),
                    exit_interview_notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    settlement_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    relieved_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    resignation_doc_data = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    resignation_doc_filename = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    resignation_doc_content_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    relieving_letter_data = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    relieving_letter_filename = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    relieving_letter_content_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    experience_letter_data = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    experience_letter_filename = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    experience_letter_content_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    clearance_doc_data = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    clearance_doc_filename = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    clearance_doc_content_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    archived_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    archived_by = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_exits", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_exits_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_exits_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_holidays_department_id",
                table: "holidays",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_exits_organization_id_employee_id",
                table: "employee_exits",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_holidays_departments_department_id",
                table: "holidays",
                column: "department_id",
                principalTable: "departments",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_holidays_departments_department_id",
                table: "holidays");

            migrationBuilder.DropTable(
                name: "employee_exits");

            migrationBuilder.DropIndex(
                name: "IX_holidays_department_id",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "department_id",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "department_ids",
                table: "holidays");

            migrationBuilder.AlterColumn<string>(
                name: "marital_status_applicability",
                table: "leave_types",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200,
                oldNullable: true);
        }
    }
}
