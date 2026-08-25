using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftChangeRequestsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shift_change_requests",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    branch_id = table.Column<int>(type: "int", nullable: true),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    request_date = table.Column<DateOnly>(type: "date", nullable: false),
                    current_shift_id = table.Column<int>(type: "int", nullable: true),
                    is_current_week_off = table.Column<bool>(type: "bit", nullable: false),
                    requested_shift_id = table.Column<int>(type: "int", nullable: true),
                    is_requested_week_off = table.Column<bool>(type: "bit", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    reviewed_by = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    rejection_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_change_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_shift_change_requests_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_change_requests_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_change_requests_employees_organization_id_employee_id",
                        columns: x => new { x.organization_id, x.employee_id },
                        principalTable: "employees",
                        principalColumns: new[] { "organization_id", "employee_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_change_requests_shifts_current_shift_id",
                        column: x => x.current_shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_change_requests_shifts_requested_shift_id",
                        column: x => x.requested_shift_id,
                        principalTable: "shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_shift_change_requests_branch_id",
                table: "shift_change_requests",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_change_requests_current_shift_id",
                table: "shift_change_requests",
                column: "current_shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_shift_change_requests_organization_id_employee_id_request_date",
                table: "shift_change_requests",
                columns: new[] { "organization_id", "employee_id", "request_date" });

            migrationBuilder.CreateIndex(
                name: "IX_shift_change_requests_requested_shift_id",
                table: "shift_change_requests",
                column: "requested_shift_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shift_change_requests");
        }
    }
}
