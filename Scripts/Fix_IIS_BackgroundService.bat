@echo off
:: Check for Administrator privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo =====================================================
    echo    Requesting Administrative Privileges...
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
echo    Configuring IIS for Automatic Background Services
echo =====================================================
echo.

echo Step 1: Setting App Pool 'AttendanceUI' to AlwaysRunning...
%systemroot%\system32\inetsrv\appcmd.exe set config -section:applicationPools -[name='AttendanceUI'].startMode:"AlwaysRunning" /commit:apphost

echo.
echo Step 2: Disabling Idle Time-out (Setting to 0)...
%systemroot%\system32\inetsrv\appcmd.exe set config -section:applicationPools -[name='AttendanceUI'].processModel.idleTimeout:"00:00:00" /commit:apphost

echo.
echo Step 3: Enabling Preload on Website 'AttendanceUI'...
%systemroot%\system32\inetsrv\appcmd.exe set site /site.name:"AttendanceUI" /applicationDefaults.preloadEnabled:true

echo.
echo Step 4: Restarting IIS to apply changes...
iisreset

echo.
echo =====================================================
echo    DONE! Your background service will now auto-start!
echo =====================================================
pause
