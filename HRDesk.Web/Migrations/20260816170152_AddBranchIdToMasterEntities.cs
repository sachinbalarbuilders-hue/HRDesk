using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchIdToMasterEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "system_settings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "shifts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "leave_types",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "designations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "departments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_system_settings_branch_id",
                table: "system_settings",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_branch_id",
                table: "shifts",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_branch_id",
                table: "leave_types",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_designations_branch_id",
                table: "designations",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_branch_id",
                table: "departments",
                column: "branch_id");

            migrationBuilder.AddForeignKey(
                name: "FK_departments_branches_branch_id",
                table: "departments",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_designations_branches_branch_id",
                table: "designations",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_types_branches_branch_id",
                table: "leave_types",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_shifts_branches_branch_id",
                table: "shifts",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_system_settings_branches_branch_id",
                table: "system_settings",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_departments_branches_branch_id",
                table: "departments");

            migrationBuilder.DropForeignKey(
                name: "FK_designations_branches_branch_id",
                table: "designations");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_types_branches_branch_id",
                table: "leave_types");

            migrationBuilder.DropForeignKey(
                name: "FK_shifts_branches_branch_id",
                table: "shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_system_settings_branches_branch_id",
                table: "system_settings");

            migrationBuilder.DropIndex(
                name: "IX_system_settings_branch_id",
                table: "system_settings");

            migrationBuilder.DropIndex(
                name: "IX_shifts_branch_id",
                table: "shifts");

            migrationBuilder.DropIndex(
                name: "IX_leave_types_branch_id",
                table: "leave_types");

            migrationBuilder.DropIndex(
                name: "IX_designations_branch_id",
                table: "designations");

            migrationBuilder.DropIndex(
                name: "IX_departments_branch_id",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "designations");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "departments");
        }
    }
}
