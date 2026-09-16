using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaryComponentCalculationDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "base_component_code",
                table: "salary_components",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "calculation_type",
                table: "salary_components",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "default_value",
                table: "salary_components",
                type: "decimal(10,4)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "base_component_code",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "calculation_type",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "default_value",
                table: "salary_components");
        }
    }
}
