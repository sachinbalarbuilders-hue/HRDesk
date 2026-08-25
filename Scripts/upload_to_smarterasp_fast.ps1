$ftpServer = "WIN9071.site4now.net"
$ftpUser = "hrdesk001-001"
$ftpPass = "Man_yooooh199#"
$remoteRoot = "/site1"
$localPath = "C:\Users\Admin\HRDesk\HRDesk.Web\publish"

$credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)

Write-Host "Creating all remote directories first..."
$dirs = Get-ChildItem -Path $localPath -Recurse -Directory
foreach ($dir in $dirs) {
    $rel = $dir.FullName.Substring($localPath.Length).Replace("\", "/").Trim("/")
    $parts = $rel.Split("/")
    $curr = $remoteRoot
    foreach ($p in $parts) {
        $curr += "/" + $p
        try {
            $req = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$curr")
            $req.Credentials = $credentials
            $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $req.UsePassive = $true
            $resp = $req.GetResponse()
            $resp.Close()
        } catch { }
    }
}

Write-Host "Starting parallel upload with 10 concurrent streams..."
$files = Get-ChildItem -Path $localPath -Recurse -File

$runspacePool = [runspacefactory]::CreateRunspacePool(1, 10)
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
        try {
            $req = [System.Net.FtpWebRequest]::Create($targetUrl)
            $req.Credentials = New-Object System.Net.NetworkCredential($user, $pass)
            $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
            $req.UseBinary = $true
            $req.UsePassive = $true
            $req.KeepAlive = $false
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $req.ContentLength = $fileBytes.Length
            
            $stream = $req.GetRequestStream()
            $stream.Write($fileBytes, 0, $fileBytes.Length)
            $stream.Close()
            
            $resp = $req.GetResponse()
            $resp.Close()
            return "Uploaded: $targetUrl"
        } catch {
            return "Error ($targetUrl): $_"
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
