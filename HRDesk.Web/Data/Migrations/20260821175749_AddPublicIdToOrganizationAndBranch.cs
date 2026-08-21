using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdToOrganizationAndBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "public_id",
                table: "Organizations",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            migrationBuilder.AddColumn<Guid>(
                name: "public_id",
                table: "branches",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            // Backfill a unique value per existing row before creating the unique index,
            // since a static default would otherwise give every existing row the same value.
            migrationBuilder.Sql("UPDATE [Organizations] SET [public_id] = NEWID();");
            migrationBuilder.Sql("UPDATE [branches] SET [public_id] = NEWID();");

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_public_id",
                table: "Organizations",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_branches_public_id",
                table: "branches",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Organizations_public_id",
                table: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_branches_public_id",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "public_id",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "public_id",
                table: "branches");
        }
    }
}
