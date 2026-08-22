using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionAndPlanQuotas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subscription_plans",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    public_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    max_employees = table.Column<int>(type: "int", nullable: false),
                    max_branches = table.Column<int>(type: "int", nullable: false),
                    has_biometrics_module = table.Column<bool>(type: "bit", nullable: false),
                    has_payroll_module = table.Column<bool>(type: "bit", nullable: false),
                    has_recruitment_module = table.Column<bool>(type: "bit", nullable: false),
                    has_loan_management = table.Column<bool>(type: "bit", nullable: false),
                    has_custom_domain = table.Column<bool>(type: "bit", nullable: false),
                    price_per_month = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_subscriptions",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    public_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    plan_id = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    billing_cycle = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    valid_until = table.Column<DateTime>(type: "datetime2", nullable: false),
                    trial_ends_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_subscriptions", x => x.id);
                    table.ForeignKey(
                        name: "FK_tenant_subscriptions_Organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "Organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tenant_subscriptions_subscription_plans_plan_id",
                        column: x => x.plan_id,
                        principalTable: "subscription_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_subscription_plans_code",
                table: "subscription_plans",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_subscriptions_organization_id",
                table: "tenant_subscriptions",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_subscriptions_plan_id",
                table: "tenant_subscriptions",
                column: "plan_id");

            // Seed standard subscription plans
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'free')
                BEGIN
                    INSERT INTO subscription_plans (public_id, name, code, description, max_employees, max_branches, has_biometrics_module, has_payroll_module, has_recruitment_module, has_loan_management, has_custom_domain, price_per_month, is_active, created_at)
                    VALUES (NEWID(), 'Free Starter', 'free', 'Ideal for micro teams & startups getting started with attendance', 10, 1, 1, 0, 0, 0, 0, 0.00, 1, GETDATE());
                END

                IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'starter')
                BEGIN
                    INSERT INTO subscription_plans (public_id, name, code, description, max_employees, max_branches, has_biometrics_module, has_payroll_module, has_recruitment_module, has_loan_management, has_custom_domain, price_per_month, is_active, created_at)
                    VALUES (NEWID(), 'Starter Core', 'starter', 'Essential HRMS: Biometrics & automated payroll for growing businesses', 35, 2, 1, 1, 0, 0, 0, 1499.00, 1, GETDATE());
                END

                IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'growth')
                BEGIN
                    INSERT INTO subscription_plans (public_id, name, code, description, max_employees, max_branches, has_biometrics_module, has_payroll_module, has_recruitment_module, has_loan_management, has_custom_domain, price_per_month, is_active, created_at)
                    VALUES (NEWID(), 'Growth Enterprise', 'growth', 'Full SaaS suite: Recruitment, Payroll, Biometrics, Loans & Multi-branch', 200, 5, 1, 1, 1, 1, 0, 4999.00, 1, GETDATE());
                END

                IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'enterprise')
                BEGIN
                    INSERT INTO subscription_plans (public_id, name, code, description, max_employees, max_branches, has_biometrics_module, has_payroll_module, has_recruitment_module, has_loan_management, has_custom_domain, price_per_month, is_active, created_at)
                    VALUES (NEWID(), 'Enterprise Custom', 'enterprise', 'Unlimited scale, dedicated SLA, custom domain & highest priority support', 10000, 50, 1, 1, 1, 1, 1, 14999.00, 1, GETDATE());
                END

                -- Auto-assign active Growth plan subscription to all existing organizations
                DECLARE @growthPlanId INT = (SELECT TOP 1 id FROM subscription_plans WHERE code = 'growth');
                IF @growthPlanId IS NOT NULL
                BEGIN
                    INSERT INTO tenant_subscriptions (public_id, organization_id, plan_id, status, billing_cycle, valid_until, created_at, updated_at)
                    SELECT NEWID(), o.id, @growthPlanId, 'Active', 'Yearly', DATEADD(year, 1, GETDATE()), GETDATE(), GETDATE()
                    FROM Organizations o
                    WHERE NOT EXISTS (SELECT 1 FROM tenant_subscriptions ts WHERE ts.organization_id = o.id);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tenant_subscriptions");

            migrationBuilder.DropTable(
                name: "subscription_plans");
        }
    }
}
