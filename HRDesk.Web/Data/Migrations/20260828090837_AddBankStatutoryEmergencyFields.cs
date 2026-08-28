using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBankStatutoryEmergencyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AadhaarNumber",
                table: "employees",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankAccountHolderName",
                table: "employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankAccountType",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankIfscCode",
                table: "employees",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelation",
                table: "employees",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EsiNumber",
                table: "employees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FatherOrSpouseName",
                table: "employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NoticePeriodDays",
                table: "employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanNumber",
                table: "employees",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PassportNumber",
                table: "employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PfNumber",
                table: "employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UanNumber",
                table: "employees",
                type: "nvarchar(22)",
                maxLength: 22,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AadhaarNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankAccountHolderName",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankAccountType",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankIfscCode",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "EmergencyContactRelation",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "EsiNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "FatherOrSpouseName",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "NoticePeriodDays",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PanNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PassportNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PfNumber",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "UanNumber",
                table: "employees");
        }
    }
}
