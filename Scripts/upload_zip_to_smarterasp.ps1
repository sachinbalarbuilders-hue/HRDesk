$ErrorActionPreference = "Stop"

$ftpServer = "WIN8167.site4now.net"
$ftpUser = "hrdeskhrms-001"
$ftpPass = "Man_yooooh199#"
$remoteFile = "/site1/publish.zip"

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
$webPath = "$workspaceRoot\HRDesk.Web"
$publishPath = "$webPath\publish"
$zipPath = "$webPath\publish.zip"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Zipping & Fast Uploading to SmarterASP " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

# 1. Create ZIP of publish folder contents
Write-Host "`n[1/2] Compressing publish files into publish.zip..." -ForegroundColor Yellow
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($publishPath, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "ZIP created successfully ($zipSizeMb MB)" -ForegroundColor Green

# 2. Upload ZIP via single FTP stream
Write-Host "`n[2/2] Uploading publish.zip via high-speed stream to ftp://$ftpServer$remoteFile..." -ForegroundColor Yellow
$credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
$req = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$remoteFile")
$req.Credentials = $credentials
$req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
$req.UseBinary = $true
$req.UsePassive = $true
$req.KeepAlive = $false
$req.Timeout = 120000

$fileBytes = [System.IO.File]::ReadAllBytes($zipPath)
$req.ContentLength = $fileBytes.Length

$stream = $req.GetRequestStream()
$stream.Write($fileBytes, 0, $fileBytes.Length)
$stream.Close()

$resp = $req.GetResponse()
$resp.Close()

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host " publish.zip UPLOADED SUCCESSFULLY! ($zipSizeMb MB)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Next step in SmarterASP Control Panel:" -ForegroundColor Cyan
Write-Host "1. Go to Hosting Control Panel -> File Manager" -ForegroundColor White
Write-Host "2. Select 'publish.zip' -> click 'Unzip / Extract' -> choose '/site1'" -ForegroundColor White
