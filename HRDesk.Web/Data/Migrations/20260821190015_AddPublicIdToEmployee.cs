using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdToEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PublicId",
                table: "employees",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            // Backfill a unique value per existing row before creating the unique index,
            // since a static default would otherwise give every existing row the same value.
            migrationBuilder.Sql("UPDATE [employees] SET [PublicId] = NEWID();");

            migrationBuilder.CreateIndex(
                name: "IX_employees_PublicId",
                table: "employees",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_PublicId",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "employees");
        }
    }
}
