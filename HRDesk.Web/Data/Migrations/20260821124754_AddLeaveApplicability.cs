using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveApplicability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "department_id",
                table: "leave_types",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "designation_id",
                table: "leave_types",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "role_id",
                table: "leave_types",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_department_id",
                table: "leave_types",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_designation_id",
                table: "leave_types",
                column: "designation_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_types_role_id",
                table: "leave_types",
                column: "role_id");

            migrationBuilder.AddForeignKey(
                name: "FK_leave_types_departments_department_id",
                table: "leave_types",
                column: "department_id",
                principalTable: "departments",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_types_designations_designation_id",
                table: "leave_types",
                column: "designation_id",
                principalTable: "designations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_types_roles_role_id",
                table: "leave_types",
                column: "role_id",
                principalTable: "roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_leave_types_departments_department_id",
                table: "leave_types");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_types_designations_designation_id",
                table: "leave_types");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_types_roles_role_id",
                table: "leave_types");

            migrationBuilder.DropIndex(
                name: "IX_leave_types_department_id",
                table: "leave_types");

            migrationBuilder.DropIndex(
                name: "IX_leave_types_designation_id",
                table: "leave_types");

            migrationBuilder.DropIndex(
                name: "IX_leave_types_role_id",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "department_id",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "designation_id",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "role_id",
                table: "leave_types");
        }
    }
}
