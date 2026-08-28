$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
$clientPath = "$workspaceRoot\web-client"
$webPath = "$workspaceRoot\HRDesk.Web"
$smarterAspJson = "$webPath\appsettings.SmarterAsp.json"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   HRDesk -> Web Deploy Pipeline          " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Build Frontend
if (Test-Path "$clientPath\package.json") {
    Write-Host "`n[1/3] Building React Frontend..." -ForegroundColor Yellow
    Push-Location $clientPath
    npm run build
    Pop-Location

    if (Test-Path "$clientPath\dist") {
        Write-Host "Copying dist to wwwroot..." -ForegroundColor Yellow
        Copy-Item -Path "$clientPath\dist\*" -Destination "$webPath\wwwroot" -Recurse -Force
    }
}

# 2. Inject production config
Write-Host "`n[2/3] Injecting SmarterASP config..." -ForegroundColor Yellow
if (Test-Path $smarterAspJson) {
    Copy-Item -Path $smarterAspJson -Destination "$webPath\appsettings.Production.json" -Force
}

# 3. Publish via Web Deploy
Write-Host "`n[3/3] Publishing via Web Deploy..." -ForegroundColor Yellow
Write-Host "You will be prompted for password (SmarterASP control panel password)." -ForegroundColor Cyan

dotnet publish "$webPath\HRDesk.Web.csproj" -c Release /p:PublishProfile=SmarterASP /p:Password=$env:SMARTERASP_PASSWORD --nologo

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n Deploy complete! Site is live." -ForegroundColor Green
    Write-Host "URL: http://hrdeskhrms-001-site1.htempurl.com/" -ForegroundColor Cyan
} else {
    Write-Host "`n Deploy FAILED. Check errors above." -ForegroundColor Red
}
