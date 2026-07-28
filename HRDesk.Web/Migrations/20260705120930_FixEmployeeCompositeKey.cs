using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class FixEmployeeCompositeKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create a helper stored procedure to safely drop FKs only if they exist.
            // This is needed because error 1553 ("Cannot drop index: needed in a foreign key constraint")
            // cannot be bypassed by FOREIGN_KEY_CHECKS=0. Explicit FK drops are required first.
            migrationBuilder.Sql(@"
                DROP PROCEDURE IF EXISTS `_TempDropFK`;
                CREATE PROCEDURE `_TempDropFK`(IN tbl VARCHAR(255), IN fk VARCHAR(255))
                BEGIN
                    IF EXISTS (SELECT NULL FROM information_schema.TABLE_CONSTRAINTS
                               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl
                               AND CONSTRAINT_NAME = fk AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
                        SET @_sql = CONCAT('ALTER TABLE `', tbl, '` DROP FOREIGN KEY `', fk, '`');
                        PREPARE _stmt FROM @_sql;
                        EXECUTE _stmt;
                        DEALLOCATE PREPARE _stmt;
                    END IF;
                END;
            ");

            // Drop FKs that block dropping PK of leave_type_eligibility
            migrationBuilder.Sql("CALL `_TempDropFK`('leave_type_eligibility', 'FK_leave_type_eligibility_employees_employee_id');");
            migrationBuilder.Sql("CALL `_TempDropFK`('leave_type_eligibility', 'FK_leave_type_eligibility_leave_type_id');");
            migrationBuilder.Sql("CALL `_TempDropFK`('leave_type_eligibility', 'fk_lte_emp_rel_v1');");
            migrationBuilder.Sql("CALL `_TempDropFK`('leave_type_eligibility', 'fk_lte_type_rel_v1');");

            migrationBuilder.DropPrimaryKey(
                name: "PK_leave_type_eligibility",
                table: "leave_type_eligibility");

            // Drop FKs that block dropping PK of holiday_employees
            migrationBuilder.Sql("CALL `_TempDropFK`('holiday_employees', 'fk_employee_holiday');");
            migrationBuilder.Sql("CALL `_TempDropFK`('holiday_employees', 'FK_holiday_employees_employees_employee_id');");
            migrationBuilder.Sql("CALL `_TempDropFK`('holiday_employees', 'FK_holiday_employees_holidays_holiday_id');");

            migrationBuilder.DropPrimaryKey(
                name: "PK_holiday_employees",
                table: "holiday_employees");

            // Disable FK checks for employees PK drop — many child tables reference employees.employee_id
            migrationBuilder.Sql("SET FOREIGN_KEY_CHECKS=0;");

            migrationBuilder.DropPrimaryKey(
                name: "PK_employees",
                table: "employees");

            migrationBuilder.Sql("SET FOREIGN_KEY_CHECKS=1;");

            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS `_TempDropFK`;");

            migrationBuilder.AlterColumn<int>(
                name: "employee_id",
                table: "employees",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);

            migrationBuilder.AddPrimaryKey(
                name: "PK_leave_type_eligibility",
                table: "leave_type_eligibility",
                columns: new[] { "organization_id", "employee_id", "leave_type_id" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_holiday_employees",
                table: "holiday_employees",
                columns: new[] { "organization_id", "holiday_id", "employee_id" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_employees",
                table: "employees",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_organization_id_employee_id",
                table: "shift_roster",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_organization_id_employee_id",
                table: "payroll_master",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_organization_id_employee_id",
                table: "leave_applications",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_organization_id_employee_id",
                table: "leave_allocations",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_holiday_id",
                table: "holiday_employees",
                column: "holiday_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_organization_id_employee_id",
                table: "holiday_employees",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_organization_id_employee_id",
                table: "employee_shift_assignments",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_organization_id_employee_id",
                table: "employee_salary_structure",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_organization_id_employee_id",
                table: "employee_loans",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_organization_id_employee_id",
                table: "daily_attendance",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_organization_id_employee_id",
                table: "comp_off_requests",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_organization_id_employee_id",
                table: "comp_off_credits",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_organization_id_employee_id",
                table: "attendance_regularizations",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_logs_organization_id_employee_id",
                table: "attendance_logs",
                columns: new[] { "organization_id", "employee_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_logs_employees_organization_id_employee_id",
                table: "attendance_logs",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_regularizations_employees_organization_id_employe~",
                table: "attendance_regularizations",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_credits_employees_organization_id_employee_id",
                table: "comp_off_credits",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_requests_employees_organization_id_employee_id",
                table: "comp_off_requests",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_daily_attendance_employees_organization_id_employee_id",
                table: "daily_attendance",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_loans_employees_organization_id_employee_id",
                table: "employee_loans",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_salary_structure_employees_organization_id_employee~",
                table: "employee_salary_structure",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_assignments_employees_organization_id_employe~",
                table: "employee_shift_assignments",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_holiday_employees_employees_organization_id_employee_id",
                table: "holiday_employees",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            // Re-add the FK that was dropped to allow dropping the primary key
            migrationBuilder.Sql("ALTER TABLE `holiday_employees` ADD CONSTRAINT `FK_holiday_employees_holidays_holiday_id` FOREIGN KEY (`holiday_id`) REFERENCES `holidays` (`id`) ON DELETE CASCADE;");


            migrationBuilder.AddForeignKey(
                name: "FK_leave_allocations_employees_organization_id_employee_id",
                table: "leave_allocations",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_applications_employees_organization_id_employee_id",
                table: "leave_applications",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_type_eligibility_employees_organization_id_employee_id",
                table: "leave_type_eligibility",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_master_employees_organization_id_employee_id",
                table: "payroll_master",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_shift_roster_employees_organization_id_employee_id",
                table: "shift_roster",
                columns: new[] { "organization_id", "employee_id" },
                principalTable: "employees",
                principalColumns: new[] { "organization_id", "employee_id" },
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("SET FOREIGN_KEY_CHECKS=0;");
            migrationBuilder.DropForeignKey(
                name: "FK_attendance_logs_employees_organization_id_employee_id",
                table: "attendance_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_regularizations_employees_organization_id_employe~",
                table: "attendance_regularizations");

            migrationBuilder.DropForeignKey(
                name: "FK_comp_off_credits_employees_organization_id_employee_id",
                table: "comp_off_credits");

            migrationBuilder.DropForeignKey(
                name: "FK_comp_off_requests_employees_organization_id_employee_id",
                table: "comp_off_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_daily_attendance_employees_organization_id_employee_id",
                table: "daily_attendance");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_loans_employees_organization_id_employee_id",
                table: "employee_loans");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_salary_structure_employees_organization_id_employee~",
                table: "employee_salary_structure");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_shift_assignments_employees_organization_id_employe~",
                table: "employee_shift_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_holiday_employees_employees_organization_id_employee_id",
                table: "holiday_employees");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_allocations_employees_organization_id_employee_id",
                table: "leave_allocations");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_applications_employees_organization_id_employee_id",
                table: "leave_applications");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_type_eligibility_employees_organization_id_employee_id",
                table: "leave_type_eligibility");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_master_employees_organization_id_employee_id",
                table: "payroll_master");

            migrationBuilder.DropForeignKey(
                name: "FK_shift_roster_employees_organization_id_employee_id",
                table: "shift_roster");

            migrationBuilder.DropPrimaryKey(
                name: "PK_leave_type_eligibility",
                table: "leave_type_eligibility");

            migrationBuilder.DropPrimaryKey(
                name: "PK_holiday_employees",
                table: "holiday_employees");

            migrationBuilder.DropIndex(
                name: "IX_holiday_employees_holiday_id",
                table: "holiday_employees");

            migrationBuilder.DropPrimaryKey(
                name: "PK_employees",
                table: "employees");

            migrationBuilder.AlterColumn<int>(
                name: "employee_id",
                table: "employees",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);

            migrationBuilder.AddPrimaryKey(
                name: "PK_leave_type_eligibility",
                table: "leave_type_eligibility",
                columns: new[] { "employee_id", "leave_type_id" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_holiday_employees",
                table: "holiday_employees",
                columns: new[] { "holiday_id", "employee_id" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_employees",
                table: "employees",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_employee_id",
                table: "shift_roster",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_organization_id",
                table: "shift_roster",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_employee_id",
                table: "payroll_master",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_master_organization_id",
                table: "payroll_master",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_type_eligibility_organization_id",
                table: "leave_type_eligibility",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_employee_id",
                table: "leave_applications",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_organization_id",
                table: "leave_applications",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_employee_id",
                table: "leave_allocations",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_allocations_organization_id",
                table: "leave_allocations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_employee_id",
                table: "holiday_employees",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_holiday_employees_organization_id",
                table: "holiday_employees",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employees_organization_id",
                table: "employees",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_employee_id",
                table: "employee_shift_assignments",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_organization_id",
                table: "employee_shift_assignments",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_employee_id",
                table: "employee_salary_structure",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_salary_structure_organization_id",
                table: "employee_salary_structure",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_employee_id",
                table: "employee_loans",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_loans_organization_id",
                table: "employee_loans",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_organization_id",
                table: "daily_attendance",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_employee_id",
                table: "comp_off_requests",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_requests_organization_id",
                table: "comp_off_requests",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_employee_id",
                table: "comp_off_credits",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_organization_id",
                table: "comp_off_credits",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_employee_id",
                table: "attendance_regularizations",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_regularizations_organization_id",
                table: "attendance_regularizations",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_logs_organization_id",
                table: "attendance_logs",
                column: "organization_id");

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_logs_employees_employee_id",
                table: "attendance_logs",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_regularizations_employees_employee_id",
                table: "attendance_regularizations",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_credits_employees_employee_id",
                table: "comp_off_credits",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comp_off_requests_employees_employee_id",
                table: "comp_off_requests",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_daily_attendance_employees_employee_id",
                table: "daily_attendance",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_loans_employees_employee_id",
                table: "employee_loans",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_salary_structure_employees_employee_id",
                table: "employee_salary_structure",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_assignments_employees_employee_id",
                table: "employee_shift_assignments",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_holiday_employees_employees_employee_id",
                table: "holiday_employees",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_allocations_employees_employee_id",
                table: "leave_allocations",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_applications_employees_employee_id",
                table: "leave_applications",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_type_eligibility_employees_employee_id",
                table: "leave_type_eligibility",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_master_employees_employee_id",
                table: "payroll_master",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_shift_roster_employees_employee_id",
                table: "shift_roster",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}




