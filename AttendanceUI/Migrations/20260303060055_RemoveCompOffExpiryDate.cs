using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AttendanceUI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCompOffExpiryDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "expiry_date",
                table: "comp_off_requests");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "DeviceConfigurations",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "DeviceConfigurations");

            migrationBuilder.AddColumn<DateOnly>(
                name: "expiry_date",
                table: "comp_off_requests",
                type: "date",
                nullable: true);
        }
    }
}
