using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxDeclarationProofs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "employee_tax_declaration_proofs",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    tax_declaration_id = table.Column<int>(type: "int", nullable: false),
                    proof_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    file_path = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    uploaded_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_tax_declaration_proofs", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_tax_declaration_proofs_EmployeeTaxDeclarations_tax_declaration_id",
                        column: x => x.tax_declaration_id,
                        principalTable: "EmployeeTaxDeclarations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_tax_declaration_proofs_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employee_tax_declaration_proofs_organization_id",
                table: "employee_tax_declaration_proofs",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_tax_declaration_proofs_tax_declaration_id",
                table: "employee_tax_declaration_proofs",
                column: "tax_declaration_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "employee_tax_declaration_proofs");
        }
    }
}
