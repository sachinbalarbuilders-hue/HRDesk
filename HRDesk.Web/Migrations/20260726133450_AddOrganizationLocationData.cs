using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationLocationData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "Organizations",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<double>(
                name: "latitude",
                table: "Organizations",
                type: "double",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "longitude",
                table: "Organizations",
                type: "double",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "address",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "Organizations");
        }
    }
}
