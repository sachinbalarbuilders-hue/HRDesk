using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchIdToHolidaysPayrollLoans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "payroll_master",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "payroll_details",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "loan_types",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "loan_installments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "holidays",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "holiday_employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "branch_id",
                table: "employee_loans",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_branch_id",
                table: "payroll_master",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_branch_id",
                table: "payroll_details",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_types_branch_id",
                table: "loan_types",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_loan_installments_branch_id",
                table: "loan_installments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_holidays_branch_id",
                table: "holidays",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_branch_id",
                table: "holiday_employees",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_branch_id",
                table: "employee_loans",
                column: "branch_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employee_loans_branches_branch_id",
                table: "employee_loans",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_holiday_employees_branches_branch_id",
                table: "holiday_employees",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_holidays_branches_branch_id",
                table: "holidays",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_loan_installments_branches_branch_id",
                table: "loan_installments",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_loan_types_branches_branch_id",
                table: "loan_types",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_details_branches_branch_id",
                table: "payroll_details",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_master_branches_branch_id",
                table: "payroll_master",
                column: "branch_id",
                principalTable: "branches",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_loans_branches_branch_id",
                table: "employee_loans");

            migrationBuilder.DropForeignKey(
                name: "FK_holiday_employees_branches_branch_id",
                table: "holiday_employees");

            migrationBuilder.DropForeignKey(
                name: "FK_holidays_branches_branch_id",
                table: "holidays");

            migrationBuilder.DropForeignKey(
                name: "FK_loan_installments_branches_branch_id",
                table: "loan_installments");

            migrationBuilder.DropForeignKey(
                name: "FK_loan_types_branches_branch_id",
                table: "loan_types");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_details_branches_branch_id",
                table: "payroll_details");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_master_branches_branch_id",
                table: "payroll_master");

            migrationBuilder.DropIndex(
                name: "IX_payroll_master_branch_id",
                table: "payroll_master");

            migrationBuilder.DropIndex(
                name: "IX_payroll_details_branch_id",
                table: "payroll_details");

            migrationBuilder.DropIndex(
                name: "IX_loan_types_branch_id",
                table: "loan_types");

            migrationBuilder.DropIndex(
                name: "IX_loan_installments_branch_id",
                table: "loan_installments");

            migrationBuilder.DropIndex(
                name: "IX_holidays_branch_id",
                table: "holidays");

            migrationBuilder.DropIndex(
                name: "IX_holiday_employees_branch_id",
                table: "holiday_employees");

            migrationBuilder.DropIndex(
                name: "IX_employee_loans_branch_id",
                table: "employee_loans");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "payroll_master");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "loan_types");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "loan_installments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "holidays");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "holiday_employees");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "employee_loans");
        }
    }
}
