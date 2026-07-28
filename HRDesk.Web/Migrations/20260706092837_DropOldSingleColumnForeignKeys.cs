using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class DropOldSingleColumnForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP PROCEDURE IF EXISTS DropForeignKeyIfExists;
CREATE PROCEDURE DropForeignKeyIfExists(
    IN tableName VARCHAR(255), 
    IN constraintName VARCHAR(255)
)
BEGIN
    SET @dbName = DATABASE();
    IF EXISTS (
        SELECT NULL 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = @dbName 
          AND TABLE_NAME = tableName 
          AND CONSTRAINT_NAME = constraintName
    ) THEN
        SET @s = CONCAT('ALTER TABLE ', tableName, ' DROP FOREIGN KEY ', constraintName);
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;
");
            
            var fksToDrop = new List<(string TableName, string ForeignKeyName)>
            {
                ("daily_attendance", "FK_daily_attendance_employees_employee_id"),
                ("comp_off_requests", "comp_off_requests_ibfk_1"),
                ("comp_off_requests", "FK_comp_off_requests_employees_employee_id"),
                ("holiday_employees", "fk_employee_holiday"),
                ("holiday_employees", "FK_holiday_employees_employees_employee_id"),
                ("leave_type_eligibility", "fk_lte_emp_rel_v1"),
                ("leave_type_eligibility", "FK_leave_type_eligibility_employees_employee_id"),
                ("attendance_logs", "FK_attendance_logs_employees_employee_id"),
                ("attendance_regularizations", "FK_attendance_regularizations_employees_employee_id"),
                ("comp_off_credits", "FK_comp_off_credits_employees_employee_id"),
                ("employee_loans", "FK_employee_loans_employees_employee_id"),
                ("employee_salary_structure", "FK_employee_salary_structure_employees_employee_id"),
                ("employee_shift_assignments", "FK_employee_shift_assignments_employees_employee_id"),
                ("leave_allocations", "FK_leave_allocations_employees_employee_id"),
                ("leave_applications", "FK_leave_applications_employees_employee_id"),
                ("payroll_master", "FK_payroll_master_employees_employee_id"),
                ("shift_roster", "FK_shift_roster_employees_employee_id")
            };

            foreach (var kvp in fksToDrop)
            {
                migrationBuilder.Sql($"CALL DropForeignKeyIfExists('{kvp.TableName}', '{kvp.ForeignKeyName}');");
            }

            migrationBuilder.Sql("DROP PROCEDURE DropForeignKeyIfExists;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
