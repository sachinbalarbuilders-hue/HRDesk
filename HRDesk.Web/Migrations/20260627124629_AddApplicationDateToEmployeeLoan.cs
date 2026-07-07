using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationDateToEmployeeLoan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employees_shifts_shift_id",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_shift_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "shift_id",
                table: "employees");

            migrationBuilder.AddColumn<string>(
                name: "color_code",
                table: "shifts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "background_color",
                table: "leave_types",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "text_color",
                table: "leave_types",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "resignation_date",
                table: "employees",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "application_date",
                table: "employee_loans",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateTable(
                name: "comp_off_credits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    work_date = table.Column<DateOnly>(type: "date", nullable: false),
                    credited_days = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    reason = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comp_off_credits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_comp_off_credits_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "device_sync_state",
                columns: table => new
                {
                    device_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    device_ip = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    last_synced_time = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    last_sync_status = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    records_synced = table.Column<int>(type: "int", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_sync_state", x => x.device_id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "employee_shift_assignments",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: false),
                    from_date = table.Column<DateOnly>(type: "date", nullable: false),
                    to_date = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_shift_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_employee_shift_assignments_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employee_shift_assignments_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "shift_roster",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: true),
                    roster_date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_week_off = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    remarks = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_roster", x => x.id);
                    table.ForeignKey(
                        name: "FK_shift_roster_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_shift_roster_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id");
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "system_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    setting_key = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    setting_value = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    description = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_settings", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_comp_off_credits_employee_id",
                table: "comp_off_credits",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_employee_id",
                table: "employee_shift_assignments",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_shift_id",
                table: "employee_shift_assignments",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_employee_id",
                table: "shift_roster",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_roster_shift_id",
                table: "shift_roster",
                column: "shift_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comp_off_credits");

            migrationBuilder.DropTable(
                name: "device_sync_state");

            migrationBuilder.DropTable(
                name: "employee_shift_assignments");

            migrationBuilder.DropTable(
                name: "shift_roster");

            migrationBuilder.DropTable(
                name: "system_settings");

            migrationBuilder.DropColumn(
                name: "color_code",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "background_color",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "text_color",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "resignation_date",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "application_date",
                table: "employee_loans");

            migrationBuilder.AddColumn<int>(
                name: "shift_id",
                table: "employees",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_shift_id",
                table: "employees",
                column: "shift_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employees_shifts_shift_id",
                table: "employees",
                column: "shift_id",
                principalTable: "shifts",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
