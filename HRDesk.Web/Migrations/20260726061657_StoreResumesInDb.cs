using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class StoreResumesInDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResumePath",
                table: "candidates");

            migrationBuilder.AddColumn<string>(
                name: "ResumeContentType",
                table: "candidates",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<byte[]>(
                name: "ResumeData",
                table: "candidates",
                type: "longblob",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumeFileName",
                table: "candidates",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResumeContentType",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ResumeData",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ResumeFileName",
                table: "candidates");

            migrationBuilder.AddColumn<string>(
                name: "ResumePath",
                table: "candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }
    }
}
