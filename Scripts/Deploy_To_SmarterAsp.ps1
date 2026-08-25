$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
$clientPath = "$workspaceRoot\client"
$webPath = "$workspaceRoot\HRDesk.Web"
$publishPath = "$webPath\publish"
$smarterAspJson = "$webPath\appsettings.SmarterAsp.json"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   HRDesk -> SmarterASP Deploy Pipeline   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Build Frontend Client if needed
if (Test-Path "$clientPath\package.json") {
    Write-Host "`n[1/4] Building React Frontend..." -ForegroundColor Yellow
    Push-Location $clientPath
    npm run build
    Pop-Location
    
    if (Test-Path "$clientPath\dist") {
        Write-Host "Copying built frontend dist to HRDesk.Web/wwwroot..." -ForegroundColor Yellow
        Copy-Item -Path "$clientPath\dist\*" -Destination "$webPath\wwwroot" -Recurse -Force
    }
}

# 2. Publish .NET Backend
Write-Host "`n[2/4] Publishing ASP.NET Core Release bundle..." -ForegroundColor Yellow
if (Test-Path $publishPath) {
    Remove-Item -Path $publishPath -Recurse -Force -ErrorAction SilentlyContinue
}
dotnet publish "$webPath\HRDesk.Web.csproj" -c Release -o $publishPath --nologo

# 3. Ensure production appsettings.json uses SmarterASP configuration
Write-Host "`n[3/4] Injecting SmarterASP Production Configuration..." -ForegroundColor Yellow
if (Test-Path $smarterAspJson) {
    Copy-Item -Path $smarterAspJson -Destination "$publishPath\appsettings.json" -Force
    Copy-Item -Path $smarterAspJson -Destination "$publishPath\appsettings.Production.json" -Force
}

# 4. Zip and Upload directly into /site1
Write-Host "`n[4/4] Zipping and uploading directly to /site1..." -ForegroundColor Yellow
& "$PSScriptRoot\upload_zip_to_smarterasp.ps1"

Write-Host "`n Deployment to SmarterASP successfully completed!" -ForegroundColor Green
