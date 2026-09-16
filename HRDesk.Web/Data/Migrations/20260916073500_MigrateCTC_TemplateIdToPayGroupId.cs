using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class MigrateCTC_TemplateIdToPayGroupId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_ctc_salary_structure_templates_template_id",
                table: "employee_ctc");

            migrationBuilder.DropForeignKey(
                name: "FK_pay_groups_salary_structure_templates_template_id",
                table: "pay_groups");

            migrationBuilder.DropTable(
                name: "template_components");

            migrationBuilder.DropTable(
                name: "salary_structure_templates");

            migrationBuilder.DropIndex(
                name: "IX_pay_groups_template_id",
                table: "pay_groups");

            migrationBuilder.DropColumn(
                name: "template_id",
                table: "pay_groups");

            migrationBuilder.RenameColumn(
                name: "template_id",
                table: "employee_ctc",
                newName: "pay_group_id");

            migrationBuilder.RenameIndex(
                name: "IX_employee_ctc_template_id",
                table: "employee_ctc",
                newName: "IX_employee_ctc_pay_group_id");


            migrationBuilder.CreateTable(
                name: "pay_group_components",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    pay_group_id = table.Column<int>(type: "int", nullable: false),
                    component_id = table.Column<int>(type: "int", nullable: false),
                    calculation_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    value = table.Column<decimal>(type: "decimal(10,4)", precision: 18, scale: 2, nullable: true),
                    base_component_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pay_group_components", x => x.id);
                    table.ForeignKey(
                        name: "FK_pay_group_components_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pay_group_components_pay_groups_pay_group_id",
                        column: x => x.pay_group_id,
                        principalTable: "pay_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pay_group_components_salary_components_component_id",
                        column: x => x.component_id,
                        principalTable: "salary_components",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pay_group_components_component_id",
                table: "pay_group_components",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "IX_pay_group_components_organization_id",
                table: "pay_group_components",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_pay_group_components_pay_group_id",
                table: "pay_group_components",
                column: "pay_group_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employee_ctc_pay_groups_pay_group_id",
                table: "employee_ctc",
                column: "pay_group_id",
                principalTable: "pay_groups",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_ctc_pay_groups_pay_group_id",
                table: "employee_ctc");

            migrationBuilder.DropTable(
                name: "pay_group_components");

            migrationBuilder.RenameColumn(
                name: "pay_group_id",
                table: "employee_ctc",
                newName: "template_id");

            migrationBuilder.RenameIndex(
                name: "IX_employee_ctc_pay_group_id",
                table: "employee_ctc",
                newName: "IX_employee_ctc_template_id");

            migrationBuilder.AddColumn<int>(
                name: "template_id",
                table: "pay_groups",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "salary_structure_templates",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    archived_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    archived_by = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
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
                name: "template_components",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    component_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    template_id = table.Column<int>(type: "int", nullable: false),
                    base_component_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    calculation_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    display_order = table.Column<int>(type: "int", nullable: false),
                    value = table.Column<decimal>(type: "decimal(10,4)", precision: 18, scale: 2, nullable: true)
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
                name: "IX_pay_groups_template_id",
                table: "pay_groups",
                column: "template_id");

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
                name: "FK_employee_ctc_salary_structure_templates_template_id",
                table: "employee_ctc",
                column: "template_id",
                principalTable: "salary_structure_templates",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pay_groups_salary_structure_templates_template_id",
                table: "pay_groups",
                column: "template_id",
                principalTable: "salary_structure_templates",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
