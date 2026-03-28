using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AttendanceUI.Migrations
{
    /// <inheritdoc />
    public partial class AddLastWorkingDateToEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "LastWorkingDate",
                table: "employees",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastWorkingDate",
                table: "employees");
        }
    }
}
