using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchOutsideAttendancePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "attendance_logs",
                type: "nvarchar(50)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsGeofenceValid",
                table: "attendance_logs",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsIpValid",
                table: "attendance_logs",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "attendance_logs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "attendance_logs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "attendance_logs",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "IsGeofenceValid",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "IsIpValid",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "attendance_logs");
        }
    }
}
