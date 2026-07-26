using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class StoreEmployeePhotosInDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhotoContentType",
                table: "employees",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<byte[]>(
                name: "PhotoData",
                table: "employees",
                type: "longblob",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoContentType",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PhotoData",
                table: "employees");
        }
    }
}
