using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class FixEmployeeDocumentFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_documents_employees_employee_id_organization_id",
                table: "employee_documents");

            migrationBuilder.DropIndex(
                name: "IX_employee_documents_employee_id_organization_id",
                table: "employee_documents");

            migrationBuilder.CreateIndex(
                name: "IX_employee_documents_organization_id_employee_id",
                table: "employee_documents",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_employee_documents_employees_organization_id_employee_id",
                table: "employee_documents",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_documents_employees_organization_id_employee_id",
                table: "employee_documents");

            migrationBuilder.DropIndex(
                name: "IX_employee_documents_organization_id_employee_id",
                table: "employee_documents");

            migrationBuilder.CreateIndex(
                name: "IX_employee_documents_employee_id_organization_id",
                table: "employee_documents",
                columns: new[] { "employee_id", "organization_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_employee_documents_employees_employee_id_organization_id",
                table: "employee_documents",
                columns: new[] { "employee_id", "organization_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Restrict);
        }
    }
}
