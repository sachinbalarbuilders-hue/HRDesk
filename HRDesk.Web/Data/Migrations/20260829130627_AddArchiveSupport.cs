using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddArchiveSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "shifts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "shifts",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "shift_cycles",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "shift_cycles",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "salary_structure_templates",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "salary_structure_templates",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "salary_components",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "salary_components",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "roles",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "roles",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "professional_tax_slabs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "professional_tax_slabs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "payroll_master",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "payroll_master",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "pay_groups",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "pay_groups",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "loan_types",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "loan_types",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "leave_types",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "leave_types",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "leave_applications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "leave_applications",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "holidays",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "holidays",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "employees",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "employees",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "employee_loans",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "employee_loans",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "employee_documents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "employee_documents",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "designations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "designations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "departments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "departments",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "branches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "branches",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "attendance_regularizations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "attendance_regularizations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "Announcements",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "Announcements",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "shift_cycles");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "shift_cycles");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "salary_structure_templates");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "salary_structure_templates");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "professional_tax_slabs");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "professional_tax_slabs");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "pay_groups");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "pay_groups");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "loan_types");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "loan_types");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "leave_applications");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "leave_applications");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "employee_documents");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "employee_documents");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "designations");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "designations");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "attendance_regularizations");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "attendance_regularizations");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "Announcements");
        }
    }
}
