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
    echo     Deploying Z903 Attendance Service Update
    echo =====================================================
    echo.

    :: ---- Configuration ----
    set "PROJECT_DIR=C:\Users\Admin\HRDesk\Z903AttendanceService\Z903AttendanceService"
    set "BUILD_OUTPUT=%PROJECT_DIR%\bin\x64\Release"
    set "SERVICE_DIR=C:\Services\Z903AttendanceService"
    set "SERVICE_NAME=Z903AttendanceService"
    set "MSBUILD=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe"

    :: ---- Step 1: Restore NuGet packages ----
    echo Step 1: Restoring NuGet packages...
    nuget restore "%PROJECT_DIR%\..\Z903AttendanceService.slnx" 2>nul
    if %errorlevel% neq 0 (
        echo    Note: nuget restore skipped (nuget CLI not found or no restore needed).
    )
    echo.

    :: ---- Step 2: Build the project (Release x64) ----
    echo Step 2: Building project (Release ^| x64)...
    "%MSBUILD%" "%PROJECT_DIR%\Z903AttendanceService.csproj" /p:Configuration=Release /p:Platform=x64 /t:Build /nologo /v:minimal
    if %errorlevel% neq 0 (
        echo.
        echo =====================================================
        echo    ERROR: Build FAILED! Update aborted.
        echo =====================================================
        pause
        exit /b %errorlevel%
    )
    echo    Build succeeded!
    echo.

    :: ---- Step 3: Stop the Windows Service ----
    echo Step 3: Stopping %SERVICE_NAME% service...
    sc stop %SERVICE_NAME% >nul 2>&1
    :: Wait for service to fully stop
    timeout /t 3 >nul
    :: Double-check: kill the process if still running
    taskkill /F /IM Z903AttendanceService.exe /T >nul 2>&1
    echo    Service stopped.
    echo.

    :: ---- Step 4: Copy build output to service directory ----
    echo Step 4: Copying new files to %SERVICE_DIR%...
    
    :: Copy all .exe, .dll, .config, .pdb files (don't mirror to preserve SDK DLLs already there)
    xcopy "%BUILD_OUTPUT%\*.exe" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.dll" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.config" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.pdb" "%SERVICE_DIR%\" /Y /Q
    
    echo    Files copied.
    echo.

    :: ---- Step 5: Start the Windows Service ----
    echo Step 5: Starting %SERVICE_NAME% service...
    sc start %SERVICE_NAME%
    if %errorlevel% neq 0 (
        echo.
        echo WARNING: Service failed to start. Check Windows Event Viewer for details.
        echo You can also try: sc start %SERVICE_NAME%
        pause
        exit /b %errorlevel%
    )
    echo    Service started!
    echo.

    echo =====================================================
    echo    Z903 Service Update Complete!
    echo =====================================================
    echo.
    echo    Built from: %PROJECT_DIR%
    echo    Deployed to: %SERVICE_DIR%
    echo.
    pause
