param(
    [string]$FtpServer = "ftp://WIN8036.site4now.net/",
    [string]$FtpUser = "hrdesk-001",
    [string]$FilePath = "C:\Users\Admin\HRDesk\HRDesk.Web\HRDesk_SmarterASP_Deployment.zip",
    [string]$RemotePath = "site1/HRDesk_SmarterASP_Deployment.zip" # site1 is usually the default root folder in SmarterASP
)

Write-Host "Starting deployment to SmarterASP.NET..." -ForegroundColor Cyan
Write-Host "Server: $FtpServer"
Write-Host "User: $FtpUser"

$ftpPassword = Read-Host "Please enter your FTP Password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ftpPassword)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

try {
    Write-Host "Uploading $FilePath to $FtpServer$RemotePath..." -ForegroundColor Yellow
    $webclient = New-Object System.Net.WebClient
    $webclient.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $PlainPassword)
    
    $uri = New-Object System.Uri($FtpServer + $RemotePath)
    $webclient.UploadFile($uri, $FilePath)
    
    Write-Host "Upload completed successfully!" -ForegroundColor Green
    Write-Host "Next Step: Go to your SmarterASP.NET File Manager and Extract the zip file." -ForegroundColor Cyan
}
catch {
    Write-Host "Error uploading file: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}
