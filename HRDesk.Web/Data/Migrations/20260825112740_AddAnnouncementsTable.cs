using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRDesk.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAnnouncementsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Announcements')
BEGIN
    CREATE TABLE [Announcements] (
        [Id] int NOT NULL IDENTITY,
        [Title] nvarchar(max) NULL,
        [Message] nvarchar(max) NULL,
        [Category] nvarchar(max) NULL,
        [Priority] nvarchar(max) NULL,
        [StartDate] date NOT NULL,
        [EndDate] date NULL,
        [IsPinned] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [organization_id] int NOT NULL,
        [branch_id] int NULL,
        [CreatedByUserId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Announcements] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Announcements_Organizations_organization_id] FOREIGN KEY ([organization_id]) REFERENCES [Organizations] ([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Announcements_branches_branch_id] FOREIGN KEY ([branch_id]) REFERENCES [branches] ([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Announcements_users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [users] ([id]) ON DELETE NO ACTION
    );

    CREATE INDEX [IX_Announcements_branch_id] ON [Announcements] ([branch_id]);
    CREATE INDEX [IX_Announcements_CreatedByUserId] ON [Announcements] ([CreatedByUserId]);
    CREATE INDEX [IX_Announcements_organization_id_IsActive_StartDate_EndDate] ON [Announcements] ([organization_id], [IsActive], [StartDate], [EndDate]);
END");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Announcements')
BEGIN
    DROP TABLE [Announcements];
END");
        }
    }
}
