using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class PayrollPhase1_PayGroups_Templates_CTC : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "category",
                table: "salary_components",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_epf_applicable",
                table: "salary_components",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_esi_applicable",
                table: "salary_components",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_taxable",
                table: "salary_components",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "annual_ctc",
                table: "payroll_master",
                type: "decimal(14,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "employer_esi",
                table: "payroll_master",
                type: "decimal(10,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "employer_pf",
                table: "payroll_master",
                type: "decimal(10,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_prorated",
                table: "payroll_master",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "locked_at",
                table: "payroll_master",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "professional_tax",
                table: "payroll_master",
                type: "decimal(8,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "proration_days",
                table: "payroll_master",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "salary_basis",
                table: "payroll_master",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tds",
                table: "payroll_master",
                type: "decimal(10,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "pay_group_id",
                table: "employees",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "professional_tax_slabs",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    state = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    min_gross = table.Column<decimal>(type: "decimal(10,2)", precision: 18, scale: 2, nullable: false),
                    max_gross = table.Column<decimal>(type: "decimal(10,2)", precision: 18, scale: 2, nullable: true),
                    monthly_pt = table.Column<decimal>(type: "decimal(8,2)", precision: 18, scale: 2, nullable: false),
                    is_february = table.Column<bool>(type: "bit", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_tax_slabs", x => x.id);
                    table.ForeignKey(
                        name: "FK_professional_tax_slabs_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "salary_structure_templates",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salary_structure_templates", x => x.id);
                    table.ForeignKey(
                        name: "FK_salary_structure_templates_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "employee_ctc",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    annual_ctc = table.Column<decimal>(type: "decimal(14,2)", precision: 18, scale: 2, nullable: false),
                    template_id = table.Column<int>(type: "int", nullable: false),
                    salary_basis_override = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_ctc", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_ctc_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employee_ctc_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employee_ctc_salary_structure_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "salary_structure_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pay_groups",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    salary_basis = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    lop_rounding = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    pf_applicable = table.Column<bool>(type: "bit", nullable: false),
                    esi_applicable = table.Column<bool>(type: "bit", nullable: false),
                    pt_applicable = table.Column<bool>(type: "bit", nullable: false),
                    pt_state = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    template_id = table.Column<int>(type: "int", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pay_groups", x => x.id);
                    table.ForeignKey(
                        name: "FK_pay_groups_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pay_groups_salary_structure_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "salary_structure_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "template_components",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    template_id = table.Column<int>(type: "int", nullable: false),
                    component_id = table.Column<int>(type: "int", nullable: false),
                    calculation_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    value = table.Column<decimal>(type: "decimal(10,4)", precision: 18, scale: 2, nullable: true),
                    base_component_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_template_components", x => x.id);
                    table.ForeignKey(
                        name: "FK_template_components_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_template_components_salary_components_component_id",
                        column: x => x.component_id,
                        principalTable: "salary_components",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_template_components_salary_structure_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "salary_structure_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employees_pay_group_id",
                table: "employees",
                column: "pay_group_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_ctc_organization_id_employee_id",
                table: "employee_ctc",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_ctc_template_id",
                table: "employee_ctc",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "IX_pay_groups_organization_id",
                table: "pay_groups",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_pay_groups_template_id",
                table: "pay_groups",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "IX_professional_tax_slabs_organization_id_state_min_gross",
                table: "professional_tax_slabs",
                columns: new[] { "organization_id", "state", "min_gross" });

            migrationBuilder.CreateIndex(
                name: "IX_salary_structure_templates_organization_id",
                table: "salary_structure_templates",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_template_components_component_id",
                table: "template_components",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "IX_template_components_organization_id",
                table: "template_components",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_template_components_template_id",
                table: "template_components",
                column: "template_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employees_pay_groups_pay_group_id",
                table: "employees",
                column: "pay_group_id",
                principalTable: "pay_groups",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employees_pay_groups_pay_group_id",
                table: "employees");

            migrationBuilder.DropTable(
                name: "employee_ctc");

            migrationBuilder.DropTable(
                name: "pay_groups");

            migrationBuilder.DropTable(
                name: "professional_tax_slabs");

            migrationBuilder.DropTable(
                name: "template_components");

            migrationBuilder.DropTable(
                name: "salary_structure_templates");

            migrationBuilder.DropIndex(
                name: "IX_employees_pay_group_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "category",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "is_epf_applicable",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "is_esi_applicable",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "is_taxable",
                table: "salary_components");

            migrationBuilder.DropColumn(
                name: "annual_ctc",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "employer_esi",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "employer_pf",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "is_prorated",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "locked_at",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "professional_tax",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "proration_days",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "salary_basis",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "tds",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "pay_group_id",
                table: "employees");
        }
    }
}
