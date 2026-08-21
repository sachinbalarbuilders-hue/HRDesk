using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdToRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PublicId",
                table: "roles",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            // Backfill a unique value per existing row before creating the unique index,
            // since a static default would otherwise give every existing row the same value.
            migrationBuilder.Sql("UPDATE [roles] SET [PublicId] = NEWID();");

            migrationBuilder.CreateIndex(
                name: "IX_roles_PublicId",
                table: "roles",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_roles_PublicId",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "roles");
        }
    }
}
