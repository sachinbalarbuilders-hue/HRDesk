using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyAndBranchEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "roles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "code",
                table: "Organizations",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "Organizations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "radius_meters",
                table: "Organizations",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "daily_attendance",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "branches",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    city = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    state = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    pincode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    latitude = table.Column<double>(type: "float", nullable: true),
                    longitude = table.Column<double>(type: "float", nullable: true),
                    radius_meters = table.Column<double>(type: "float", nullable: true),
                    whatsapp_group_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branches", x => x.id);
                    table.ForeignKey(
                        name: "FK_branches_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    legal_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    trade_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    gstin = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    cin = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    pan = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    logo_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    website = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    headquarters_address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_branch_id",
                table: "users",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_roles_branch_id",
                table: "roles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_company_id",
                table: "Organizations",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_employees_branch_id",
                table: "employees",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_branch_id",
                table: "daily_attendance",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_branches_organization_id",
                table: "branches",
                column: "organization_id");

            migrationBuilder.AddForeignKey(
                name: "FK_daily_attendance_branches_branch_id",
                table: "daily_attendance",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_employees_branches_branch_id",
                table: "employees",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Organizations_companies_company_id",
                table: "Organizations",
                column: "company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_roles_branches_branch_id",
                table: "roles",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_users_branches_branch_id",
                table: "users",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_daily_attendance_branches_branch_id",
                table: "daily_attendance");

            migrationBuilder.DropForeignKey(
                name: "FK_employees_branches_branch_id",
                table: "employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Organizations_companies_company_id",
                table: "Organizations");

            migrationBuilder.DropForeignKey(
                name: "FK_roles_branches_branch_id",
                table: "roles");

            migrationBuilder.DropForeignKey(
                name: "FK_users_branches_branch_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "branches");

            migrationBuilder.DropTable(
                name: "companies");

            migrationBuilder.DropIndex(
                name: "IX_users_branch_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_roles_branch_id",
                table: "roles");

            migrationBuilder.DropIndex(
                name: "IX_Organizations_company_id",
                table: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_employees_branch_id",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_daily_attendance_branch_id",
                table: "daily_attendance");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "code",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "radius_meters",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "daily_attendance");
        }
    }
}
