using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBiometricEmployeeMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "biometric_employee_mappings",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    biometric_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_biometric_employee_mappings", x => x.id);
                    table.ForeignKey(
                        name: "FK_biometric_employee_mappings_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_leave_applications_organization_id_created_at",
                table: "leave_applications",
                columns: new[] { "organization_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_daily_attendance_organization_id_record_date",
                table: "daily_attendance",
                columns: new[] { "organization_id", "record_date" });

            migrationBuilder.CreateIndex(
                name: "IX_biometric_employee_mappings_organization_id",
                table: "biometric_employee_mappings",
                column: "organization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "biometric_employee_mappings");

            migrationBuilder.DropIndex(
                name: "IX_leave_applications_organization_id_created_at",
                table: "leave_applications");

            migrationBuilder.DropIndex(
                name: "IX_daily_attendance_organization_id_record_date",
                table: "daily_attendance");
        }
    }
}
