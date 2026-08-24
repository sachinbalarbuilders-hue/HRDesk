using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubRestrictionsToRolePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('role_permissions', 'sub_restrictions') IS NULL
                BEGIN
                    ALTER TABLE [role_permissions] ADD [sub_restrictions] nvarchar(max) NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('role_permissions', 'sub_restrictions') IS NOT NULL
                BEGIN
                    ALTER TABLE [role_permissions] DROP COLUMN [sub_restrictions];
                END
            ");
        }
    }
}
