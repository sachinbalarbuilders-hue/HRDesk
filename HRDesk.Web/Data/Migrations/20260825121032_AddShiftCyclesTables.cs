using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftCyclesTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "cycle_id",
                table: "employee_shift_assignments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "cycle_start_date",
                table: "employee_shift_assignments",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "shift_cycles",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    cycle_length_days = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    branch_id = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_cycles", x => x.id);
                    table.ForeignKey(
                        name: "FK_shift_cycles_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_cycles_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "shift_cycle_slots",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    cycle_id = table.Column<int>(type: "int", nullable: false),
                    slot_index = table.Column<int>(type: "int", nullable: false),
                    shift_id = table.Column<int>(type: "int", nullable: true),
                    is_week_off = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_cycle_slots", x => x.id);
                    table.ForeignKey(
                        name: "FK_shift_cycle_slots_shift_cycles_cycle_id",
                        column: x => x.cycle_id,
                        principalTable: "shift_cycles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_shift_cycle_slots_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employee_shift_assignments_cycle_id",
                table: "employee_shift_assignments",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_cycle_slots_cycle_id_slot_index",
                table: "shift_cycle_slots",
                columns: new[] { "cycle_id", "slot_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_shift_cycle_slots_shift_id",
                table: "shift_cycle_slots",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_cycles_branch_id",
                table: "shift_cycles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_cycles_organization_id_is_active",
                table: "shift_cycles",
                columns: new[] { "organization_id", "is_active" });

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_assignments_shift_cycles_cycle_id",
                table: "employee_shift_assignments",
                column: "cycle_id",
                principalTable: "shift_cycles",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_employee_shift_assignments_shift_cycles_cycle_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropTable(
                name: "shift_cycle_slots");

            migrationBuilder.DropTable(
                name: "shift_cycles");

            migrationBuilder.DropIndex(
                name: "IX_employee_shift_assignments_cycle_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropColumn(
                name: "cycle_id",
                table: "employee_shift_assignments");

            migrationBuilder.DropColumn(
                name: "cycle_start_date",
                table: "employee_shift_assignments");
        }
    }
}
