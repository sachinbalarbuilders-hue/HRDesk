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
    :: Change to the script's directory (elevated cmd starts in System32)
    cd /d "%~dp0"
    
    echo =====================================================
    echo     Deploying Z903 Attendance Service Update
    echo =====================================================
    echo.

    :: ---- Configuration ----
    set "PROJECT_DIR=%~dp0Z903AttendanceService\Z903AttendanceService"
    set "BUILD_OUTPUT=%PROJECT_DIR%\bin\x64\Release"
    set "SERVICE_DIR=C:\Services\Z903AttendanceService"
    set "SERVICE_NAME=Z903AttendanceService"
    set "MSBUILD=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe"

    :: Check MSBuild exists
    if not exist "%MSBUILD%" (
        echo ERROR: MSBuild not found at:
        echo   %MSBUILD%
        echo.
        echo Please install Visual Studio Community or update the path.
        goto :end
    )

    :: Check project exists
    if not exist "%PROJECT_DIR%\Z903AttendanceService.csproj" (
        echo ERROR: Project file not found at:
        echo   %PROJECT_DIR%\Z903AttendanceService.csproj
        goto :end
    )

    :: ---- Step 1: Build the project (Release x64) ----
    echo Step 1: Building project (Release ^| x64)...
    echo.
    "%MSBUILD%" "%PROJECT_DIR%\Z903AttendanceService.csproj" /p:Configuration=Release /p:Platform=x64 /t:Build /nologo /v:minimal /restore
    if %errorlevel% neq 0 (
        echo.
        echo =====================================================
        echo    ERROR: Build FAILED! Update aborted.
        echo =====================================================
        goto :end
    )
    echo.
    echo    Build succeeded!
    echo.

    :: Check build output exists
    if not exist "%BUILD_OUTPUT%\Z903AttendanceService.exe" (
        echo ERROR: Build output not found at:
        echo   %BUILD_OUTPUT%\Z903AttendanceService.exe
        echo.
        echo Build may have output to a different folder.
        dir /b "%PROJECT_DIR%\bin\" 2>nul
        goto :end
    )

    :: ---- Step 2: Stop the Windows Service ----
    echo Step 2: Stopping %SERVICE_NAME% service...
    sc stop %SERVICE_NAME% >nul 2>&1
    :: Wait for service to fully stop
    timeout /t 3 >nul
    :: Kill the process if still running
    taskkill /F /IM Z903AttendanceService.exe /T >nul 2>&1
    echo    Service stopped.
    echo.

    :: ---- Step 3: Copy build output to service directory ----
    echo Step 3: Copying new files to %SERVICE_DIR%...
    
    if not exist "%SERVICE_DIR%" (
        echo    Creating service directory...
        mkdir "%SERVICE_DIR%"
    )

    :: Copy all .exe, .dll, .config, .pdb files (Logs folder is preserved automatically since we only copy specific extensions)
    xcopy "%BUILD_OUTPUT%\*.exe" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.dll" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.config" "%SERVICE_DIR%\" /Y /Q
    xcopy "%BUILD_OUTPUT%\*.pdb" "%SERVICE_DIR%\" /Y /Q
    
    echo    Files copied.
    echo.

    :: ---- Step 4: Start the Windows Service ----
    echo Step 4: Starting %SERVICE_NAME% service...
    sc start %SERVICE_NAME%
    if %errorlevel% neq 0 (
        echo.
        echo WARNING: Service failed to start. Check Event Viewer.
    ) else (
        echo    Service started!
    )
    echo.

    echo =====================================================
    echo    Z903 Service Update Complete!
    echo =====================================================
    echo.

:end
    echo.
    echo Press any key to close...
    pause >nul
