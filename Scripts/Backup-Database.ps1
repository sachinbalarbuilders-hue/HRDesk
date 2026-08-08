$DatabaseName = "biometric_attendance"
$BackupDirectory = "D:\HRDesk_Backups"
$DateSuffix = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFileName = "$BackupDirectory\${DatabaseName}_${DateSuffix}.bak"
$MySqlUser = "root"

Write-Host "Starting backup for database: $DatabaseName"

# Create directory if it doesn't exist
if (!(Test-Path -Path $BackupDirectory)) {
    New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
    Write-Host "Created backup directory at $BackupDirectory"
}

# Run SQL Server Backup
try {
    # Ensure SQL Server has permission to write to this directory. 
    # Using sqlcmd to execute the BACKUP DATABASE command.
    $SqlCmd = "BACKUP DATABASE [$DatabaseName] TO DISK = N'$BackupFileName' WITH NOFORMAT, NOINIT, NAME = N'$DatabaseName-Full Database Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
    sqlcmd -S ".\SQLEXPRESS" -E -Q $SqlCmd
    
    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd exited with code $LASTEXITCODE"
    }
    
    Write-Host "Backup successfully created: $BackupFileName"
}
catch {
    Write-Error "Failed to take database backup: $_"
    exit 1
}

# Delete backups older than 30 days to save disk space
$LimitDate = (Get-Date).AddDays(-30)
$OldBackups = Get-ChildItem -Path $BackupDirectory -Filter "*.bak" | Where-Object { $_.CreationTime -lt $LimitDate }

if ($OldBackups) {
    Write-Host "Removing old backups..."
    $OldBackups | Remove-Item -Force
    Write-Host "Removed $($OldBackups.Count) old backup(s)."
}
