$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
$clientPath    = "$workspaceRoot\web-client"
$webPath       = "$workspaceRoot\HRDesk.Web"
$publishPath   = "$webPath\publish"
$smarterAspJson = "$webPath\appsettings.SmarterAsp.json"

# ── Web Deploy (MSDeploy) connection settings ────────────────────────────────
$msdeployExe   = "C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe"
$siteName      = "hrdeskhrms-001-site1"
$serverUrl     = "https://win8167.site4now.net:8172/msdeploy.axd?site=$siteName"
$msdeployUser  = "hrdeskhrms-001"
$msdeployPwd   = "Man_yooooh199#"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   HRDesk -> SmarterASP Deploy Pipeline   " -ForegroundColor Cyan
Write-Host "   (Web Deploy / MSDeploy)                " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ── 1. Build React frontend ──────────────────────────────────────────────────
if (Test-Path "$clientPath\package.json") {
    Write-Host "`n[1/4] Building React Frontend..." -ForegroundColor Yellow
    Push-Location $clientPath
    npm run build
    Pop-Location

    if (Test-Path "$clientPath\dist") {
        Write-Host "Copying dist -> HRDesk.Web/wwwroot..." -ForegroundColor Yellow
        Copy-Item -Path "$clientPath\dist\*" -Destination "$webPath\wwwroot" -Recurse -Force
    }
}

# ── 2. Publish .NET backend (Release) ───────────────────────────────────────
Write-Host "`n[2/4] Publishing ASP.NET Core Release bundle..." -ForegroundColor Yellow
if (Test-Path $publishPath) {
    Remove-Item -Path $publishPath -Recurse -Force -ErrorAction SilentlyContinue
}
dotnet publish "$webPath\HRDesk.Web.csproj" -c Release -o $publishPath --nologo

# ── 3. Inject non-sensitive template appsettings & Clean up ────────────────
Write-Host "`n[3/4] Injecting template configuration and cleaning sensitive files..." -ForegroundColor Yellow
$exampleJson = "$webPath\appsettings.example.json"
if (Test-Path $exampleJson) {
    Copy-Item -Path $exampleJson -Destination "$publishPath\appsettings.json"            -Force
    Copy-Item -Path $exampleJson -Destination "$publishPath\appsettings.Production.json" -Force
}

# Remove any development or sensitive config files that dotnet publish copied to the output directory
Remove-Item -Path "$publishPath\appsettings.Development.json" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$publishPath\appsettings.SmarterAsp.json" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$publishPath\appsettings.example.json" -Force -ErrorAction SilentlyContinue

# ── 4. Deploy via MSDeploy (Web Deploy) ─────────────────────────────────────
# -enableRule:AppOffline  — MSDeploy automatically uploads app_offline.htm,
#   waits for IIS w3wp.exe to release file locks, syncs all files, then
#   removes app_offline.htm. No manual lock-breaking needed.
Write-Host "`n[4/4] Deploying via Web Deploy (MSDeploy)..." -ForegroundColor Yellow

$destArg = "contentPath=`"$siteName`",computerName=`"$serverUrl`",userName=`"$msdeployUser`",password=`"$msdeployPwd`",authtype=`"basic`",includeAcls=`"false`""

& $msdeployExe `
    -verb:sync `
    -source:contentPath="$publishPath" `
    "-dest:$destArg" `
    -enableRule:AppOffline `
    -allowUntrusted `
    -retryAttempts:3 `
    -retryInterval:5000 `
    -verbose

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nMSDeploy failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n Deployment to SmarterASP completed successfully! (Web Deploy)" -ForegroundColor Green
