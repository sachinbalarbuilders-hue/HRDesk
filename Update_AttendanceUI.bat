@echo off
:: Check for Administrator privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo =====================================================
    echo    Requesting Administrative Privileges for Update
    echo =====================================================
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params= %*
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    echo =====================================================
    echo         Deploying AttendanceUI Application Update
    echo =====================================================
    echo.
    echo Step 1: Publishing application (Release)...
    cd /d "%~dp0AttendanceUI"
    dotnet publish -c Release -o "%~dp0AttendanceUI\publish" --nologo
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Publish failed! Update aborted.
        pause
        exit /b %errorlevel%
    )

    echo.
    echo Step 2: Stopping IIS to unlock files...
    iisreset /stop
    timeout /t 2 >nul
    
    :: Aggressively kill any remaining worker processes to unlock DLLs
    taskkill /F /IM w3wp.exe /T >nul 2>&1
    echo IIS and worker processes stopped.

    echo.
    echo Step 3: Synchronizing published files to IIS deployment...
    :: /MIR = Mirror directory (copies all, deletes extras)
    :: /Z = Restartable mode
    :: /XD = Exclude logs folder if exists
    robocopy "%~dp0AttendanceUI\publish" "C:\inetpub\AttendanceUI" /MIR /Z /XD "logs" "UserUploads"
    
    echo.
    echo Step 4: Restarting IIS services...
    iisreset /start
    
    echo.
    echo =====================================================
    echo    Update Complete! Please refresh your browser.
    echo =====================================================
    echo.
    pause
