using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchIdToShiftRosterAndAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "shift_roster",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "employee_shift_assignments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_branch_id",
                table: "shift_roster",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_branch_id",
                table: "employee_shift_assignments",
                column: "branch_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_assignments_branches_branch_id",
                table: "employee_shift_assignments",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_shift_roster_branches_branch_id",
                table: "shift_roster",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_shift_assignments_branches_branch_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_shift_roster_branches_branch_id",
                table: "shift_roster");

            migrationBuilder.DropIndex(
                name: "IX_shift_roster_branch_id",
                table: "shift_roster");

            migrationBuilder.DropIndex(
                name: "IX_employee_shift_assignments_branch_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "shift_roster");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "employee_shift_assignments");
        }
    }
}
