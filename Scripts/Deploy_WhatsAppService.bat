@echo off
setlocal

:: Check for Administrator privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting Administrative Privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "cmd.exe", "/k ""%~f0""", "%~dp0", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    :: Change to the script's directory
    cd /d "%~dp0.."
    
    echo =====================================================
    echo     Deploying WhatsApp Microservice Update
    echo =====================================================
    echo.

    :: ---- Configuration ----
    set "SOURCE_DIR=%~dp0..\WhatsAppService"
    set "SERVICE_DIR=C:\HRServices\WhatsAppService"
    set "SERVICE_NAME=HRDesk WhatsApp Service"

    :: ---- Step 1: Copy files to service directory ----
    echo Step 1: Copying files to %SERVICE_DIR%...
    
    if not exist "%SERVICE_DIR%" (
        echo    Creating service directory...
        mkdir "%SERVICE_DIR%"
    )

    :: Copy index.js, package.json, install_service.js
    xcopy "%SOURCE_DIR%\index.js" "%SERVICE_DIR%\" /Y /Q
    xcopy "%SOURCE_DIR%\package.json" "%SERVICE_DIR%\" /Y /Q
    xcopy "%SOURCE_DIR%\install_service.js" "%SERVICE_DIR%\" /Y /Q
    xcopy "%SOURCE_DIR%\*.html" "%SERVICE_DIR%\" /Y /Q
    
    :: We do not copy node_modules to avoid massive I/O. We run npm install there.
    
    echo    Files copied.
    echo.

    echo Step 2: Stopping existing service (if any)...
    net stop "%SERVICE_NAME%" >nul 2>&1
    echo.

    :: ---- Step 3: Install Node modules and Service ----
    echo Step 3: Installing Node modules and Service...
    cd /d "%SERVICE_DIR%"
    call npm install
    
    echo.
    echo Running Windows Service Installer...
    sc query "hrdeskwhatsappservice.exe" >nul 2>&1
    if %errorlevel% neq 0 (
        echo Service not found. Installing...
        node install_service.js
        timeout /t 3 >nul
    ) else (
        echo Service already installed. Skipping install script.
    )
    
    echo.
    echo Starting the Service...
    net start "%SERVICE_NAME%" >nul 2>&1

    echo.
    echo =====================================================
    echo    WhatsApp Service Deployment Complete!
    echo =====================================================
    echo.

    echo Press any key to close...
    pause >nul
