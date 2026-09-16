using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLatLongRadiusFromOrganizations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "latitude",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "radius_meters",
                table: "organizations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "latitude",
                table: "organizations",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "longitude",
                table: "organizations",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "radius_meters",
                table: "organizations",
                type: "float",
                nullable: true,
                defaultValue: 100.0);
        }
    }
}
