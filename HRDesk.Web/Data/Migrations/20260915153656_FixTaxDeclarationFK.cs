using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixTaxDeclarationFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeTaxDeclarations_employees_EmployeeOrganizationId_EmployeeId1",
                table: "EmployeeTaxDeclarations");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeTaxDeclarations_EmployeeOrganizationId_EmployeeId1",
                table: "EmployeeTaxDeclarations");

            migrationBuilder.DropColumn(
                name: "EmployeeId1",
                table: "EmployeeTaxDeclarations");

            migrationBuilder.DropColumn(
                name: "EmployeeOrganizationId",
                table: "EmployeeTaxDeclarations");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeTaxDeclarations_employees_organization_id_employee_id",
                table: "EmployeeTaxDeclarations",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeTaxDeclarations_employees_organization_id_employee_id",
                table: "EmployeeTaxDeclarations");

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId1",
                table: "EmployeeTaxDeclarations",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "EmployeeOrganizationId",
                table: "EmployeeTaxDeclarations",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeTaxDeclarations_EmployeeOrganizationId_EmployeeId1",
                table: "EmployeeTaxDeclarations",
                columns: new[] { "EmployeeOrganizationId", "EmployeeId1" });

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeTaxDeclarations_employees_EmployeeOrganizationId_EmployeeId1",
                table: "EmployeeTaxDeclarations",
                columns: new[] { "EmployeeOrganizationId", "EmployeeId1" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Restrict);
        }
    }
}
