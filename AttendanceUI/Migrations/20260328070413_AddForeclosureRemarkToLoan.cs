using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AttendanceUI.Migrations
{
    /// <inheritdoc />
    public partial class AddForeclosureRemarkToLoan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "foreclosure_remark",
                table: "employee_loans",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "foreclosure_remark",
                table: "employee_loans");
        }
    }
}
