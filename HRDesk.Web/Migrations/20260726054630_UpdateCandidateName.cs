using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCandidateName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "candidates");

            migrationBuilder.AddColumn<string>(
                name: "CandidateName",
                table: "candidates",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CandidateName",
                table: "candidates");

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "candidates",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "candidates",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }
    }
}
