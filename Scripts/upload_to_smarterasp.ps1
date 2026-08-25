$ftpServer = "WIN9071.site4now.net"
$ftpUser = "hrdesk001-001"
$ftpPass = "Man_yooooh199#"
$remoteRoot = "/site1"
$localPath = "C:\Users\Admin\HRDesk\HRDesk.Web\publish"

$credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)

function Ensure-FtpDirectory($dirPath) {
    $parts = $dirPath.Trim("/").Split("/")
    $current = ""
    foreach ($part in $parts) {
        $current += "/" + $part
        try {
            $req = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$current")
            $req.Credentials = $credentials
            $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $req.UsePassive = $true
            $resp = $req.GetResponse()
            $resp.Close()
        } catch {
            # Directory may already exist
        }
    }
}

Write-Host "Connecting to FTP $ftpServer..."
$files = Get-ChildItem -Path $localPath -Recurse -File

$total = $files.Count
$count = 0

foreach ($file in $files) {
    $count++
    $relativePath = $file.FullName.Substring($localPath.Length).Replace("\", "/")
    $remoteFileUrl = "ftp://$ftpServer$remoteRoot$relativePath"
    
    # Ensure directory
    $dirName = [System.IO.Path]::GetDirectoryName($relativePath).Replace("\", "/")
    if ($dirName) {
        Ensure-FtpDirectory "$remoteRoot/$dirName"
    }

    Write-Host "[$count/$total] Uploading: $relativePath..."
    try {
        $req = [System.Net.FtpWebRequest]::Create($remoteFileUrl)
        $req.Credentials = $credentials
        $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $req.UseBinary = $true
        $req.UsePassive = $true
        $req.KeepAlive = $false
        
        $fileBytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $req.ContentLength = $fileBytes.Length
        
        $stream = $req.GetRequestStream()
        $stream.Write($fileBytes, 0, $fileBytes.Length)
        $stream.Close()
        
        $resp = $req.GetResponse()
        $resp.Close()
    } catch {
        Write-Warning "Failed to upload $relativePath : $_"
    }
}

Write-Host "Upload Complete!" -ForegroundColor Green
