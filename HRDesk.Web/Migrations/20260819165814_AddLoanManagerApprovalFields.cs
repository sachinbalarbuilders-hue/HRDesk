using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanManagerApprovalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "assigned_manager_id",
                table: "employee_loans",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "manager_approved_by",
                table: "employee_loans",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "manager_approved_date",
                table: "employee_loans",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "assigned_manager_id",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "manager_approved_by",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "manager_approved_date",
                table: "employee_loans");
        }
    }
}
