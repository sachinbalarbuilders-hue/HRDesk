using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubRestrictionsToRolePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "application_number",
                table: "leave_applications");

            migrationBuilder.DropColumn(
                name: "application_number",
                table: "attendance_regularizations");

            migrationBuilder.AddColumn<string>(
                name: "sub_restrictions",
                table: "role_permissions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sub_restrictions",
                table: "role_permissions");

            migrationBuilder.AddColumn<string>(
                name: "application_number",
                table: "leave_applications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "application_number",
                table: "attendance_regularizations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }
    }
}
