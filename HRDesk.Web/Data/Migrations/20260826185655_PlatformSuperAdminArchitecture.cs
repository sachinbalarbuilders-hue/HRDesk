using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class PlatformSuperAdminArchitecture : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "organization_id",
                table: "users",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<bool>(
                name: "is_platform_user",
                table: "users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "attempts",
                table: "password_reset_tokens",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // ── DATA MIGRATION ──────────────────────────────────────────────
            // 1. Downgrade existing SuperAdmin accounts to organization-level Admin.
            //    They retain their RoleId (which gives them full org permissions via CustomRole).
            migrationBuilder.Sql(@"
                UPDATE users SET role = 'Admin' WHERE role = 'SuperAdmin' AND is_platform_user = 0;
            ");

            // 2. Create new Platform Super Admin account.
            //    Password is a securely generated BCrypt hash (work factor 12).
            //    The password must be changed on first login via the forgot-password flow.
            //    OrganizationId = NULL, EmployeeId = NULL, BranchId = NULL, IsPlatformUser = 1.
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'sm4163094@gmail.com')
                BEGIN
                    INSERT INTO users (username, password_hash, full_name, role, role_id, employee_id, branch_id, organization_id, is_platform_user, is_active, created_at)
                    VALUES (
                        'sm4163094@gmail.com',
                        '$2a$12$A5EKN/NeAyM/yBM/LeOJTOHLnGotEmB0jTGjbFZjMFjDdYBFThwpG',
                        'Platform Administrator',
                        'PlatformSuperAdmin',
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        1,
                        1,
                        GETDATE()
                    );
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_platform_user",
                table: "users");

            migrationBuilder.DropColumn(
                name: "attempts",
                table: "password_reset_tokens");

            migrationBuilder.AlterColumn<int>(
                name: "organization_id",
                table: "users",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
