using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeTaxDeclarations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeTaxDeclarations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    archived_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    archived_by = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    EmployeeOrganizationId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId1 = table.Column<int>(type: "int", nullable: false),
                    financial_year = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    tax_regime = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    submitted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    sec80c_epf = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_ppf = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_elss = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_life_insurance = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_tuition_fees = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_home_loan_principal = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80c_other = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80d_self_family = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80d_parents = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80d_parents_senior_citizen = table.Column<bool>(type: "bit", nullable: false),
                    sec80d_preventive_checkup = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80ccd_nps = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec24_home_loan_interest = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    lender_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    lender_pan = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    annual_rent_paid = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    rental_city_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    landlord_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    landlord_pan = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    sec80e_education_loan_interest = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80g_donations = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    sec80tta_savings_interest = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    other_income = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    previous_employer_gross = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    previous_employer_tds = table.Column<decimal>(type: "decimal(12,2)", precision: 18, scale: 2, nullable: false),
                    remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    rejection_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeTaxDeclarations", x => x.id);
                    table.ForeignKey(
                        name: "FK_EmployeeTaxDeclarations_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeTaxDeclarations_employees_EmployeeOrganizationId_EmployeeId1",
                        columns: x => new { x.EmployeeOrganizationId, x.EmployeeId1 },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeTaxDeclarations_EmployeeOrganizationId_EmployeeId1",
                table: "EmployeeTaxDeclarations",
                columns: new[] { "EmployeeOrganizationId", "EmployeeId1" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeTaxDeclarations_organization_id_employee_id_financial_year",
                table: "EmployeeTaxDeclarations",
                columns: new[] { "organization_id", "employee_id", "financial_year" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeTaxDeclarations");
        }
    }
}
