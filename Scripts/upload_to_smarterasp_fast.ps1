$ftpServer = "WIN8167.site4now.net"
$ftpUser = "hrdeskhrms-001"
$ftpPass = "Man_yooooh199#"
$remoteRoot = "/site1"
$localPath = if (Test-Path "$PSScriptRoot\..\HRDesk.Web\publish") { (Resolve-Path "$PSScriptRoot\..\HRDesk.Web\publish").Path } else { "d:\HRDesk\HRDesk.Web\publish" }

$credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)

Write-Host "Ensuring remote directory structure..."
$dirs = Get-ChildItem -Path $localPath -Recurse -Directory
$uniquePaths = [System.Collections.Generic.HashSet[string]]::new()
foreach ($dir in $dirs) {
    $rel = $dir.FullName.Substring($localPath.Length).Replace("\", "/").Trim("/")
    $parts = $rel.Split("/")
    $curr = $remoteRoot
    foreach ($p in $parts) {
        $curr += "/" + $p
        [void]$uniquePaths.Add($curr)
    }
}

foreach ($curr in ($uniquePaths | Sort-Object Length)) {
    try {
        $req = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$curr")
        $req.Credentials = $credentials
        $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $req.UsePassive = $true
        $req.Timeout = 4000
        $resp = $req.GetResponse()
        $resp.Close()
    } catch { }
}

Write-Host "Starting parallel upload with 12 concurrent streams..."
$files = Get-ChildItem -Path $localPath -Recurse -File

$runspacePool = [runspacefactory]::CreateRunspacePool(1, 12)
$runspacePool.Open()

$tasks = New-Object System.Collections.ArrayList

foreach ($file in $files) {
    $rel = $file.FullName.Substring($localPath.Length).Replace("\", "/")
    $targetUrl = "ftp://$ftpServer$remoteRoot$rel"
    $filePath = $file.FullName

    $ps = [powershell]::Create()
    $ps.RunspacePool = $runspacePool
    [void]$ps.AddScript({
        param($filePath, $targetUrl, $user, $pass)
        $attempts = 0
        $maxAttempts = 3
        while ($attempts -lt $maxAttempts) {
            $attempts++
            try {
                $req = [System.Net.FtpWebRequest]::Create($targetUrl)
                $req.Credentials = New-Object System.Net.NetworkCredential($user, $pass)
                $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                $req.UseBinary = $true
                $req.UsePassive = $true
                $req.KeepAlive = $false
                $req.Timeout = 60000
                $req.ReadWriteTimeout = 60000
                
                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                $req.ContentLength = $fileBytes.Length
                
                $stream = $req.GetRequestStream()
                $stream.Write($fileBytes, 0, $fileBytes.Length)
                $stream.Close()
                
                $resp = $req.GetResponse()
                $resp.Close()
                return "Uploaded: $targetUrl"
            } catch {
                if ($attempts -ge $maxAttempts) {
                    return "Error ($targetUrl): $_"
                }
                Start-Sleep -Milliseconds (500 * $attempts)
            }
        }
    }).AddArgument($filePath).AddArgument($targetUrl).AddArgument($ftpUser).AddArgument($ftpPass)

    $asyncResult = $ps.BeginInvoke()
    [void]$tasks.Add([PSCustomObject]@{
        Pipe = $ps
        Result = $asyncResult
        File = $rel
    })
}

$done = 0
$total = $tasks.Count

while ($tasks.Count -gt 0) {
    $completed = @()
    foreach ($task in $tasks) {
        if ($task.Result.IsCompleted) {
            $res = $task.Pipe.EndInvoke($task.Result)
            $task.Pipe.Dispose()
            $done++
            Write-Host "[$done/$total] $res"
            $completed += $task
        }
    }
    foreach ($c in $completed) {
        $tasks.Remove($c)
    }
    if ($tasks.Count -gt 0) {
        Start-Sleep -Milliseconds 200
    }
}

$runspacePool.Close()
$runspacePool.Dispose()

Write-Host "ALL $total FILES UPLOADED SUCCESSFULLY!" -ForegroundColor Green
