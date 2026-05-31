$DatabaseName = "biometric_attendance"
$BackupDirectory = "D:\HRDesk_Backups"
$DateSuffix = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFileName = "$BackupDirectory\${DatabaseName}_${DateSuffix}.sql"
$MySqlUser = "root"

Write-Host "Starting backup for database: $DatabaseName"

# Create directory if it doesn't exist
if (!(Test-Path -Path $BackupDirectory)) {
    New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
    Write-Host "Created backup directory at $BackupDirectory"
}

# Run mysqldump
try {
    # Using absolute path to mysqldump to ensure it works reliably in Task Scheduler
    cmd.exe /c "C:\xampp\mysql\bin\mysqldump.exe -u $MySqlUser $DatabaseName > $BackupFileName"
    Write-Host "Backup successfully created: $BackupFileName"
}
catch {
    Write-Error "Failed to take database backup: $_"
    exit 1
}

# Delete backups older than 30 days to save disk space
$LimitDate = (Get-Date).AddDays(-30)
$OldBackups = Get-ChildItem -Path $BackupDirectory -Filter "*.sql" | Where-Object { $_.CreationTime -lt $LimitDate }

if ($OldBackups) {
    Write-Host "Removing old backups..."
    $OldBackups | Remove-Item -Force
    Write-Host "Removed $($OldBackups.Count) old backup(s)."
}
