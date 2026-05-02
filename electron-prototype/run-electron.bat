@echo off
echo ========================================
echo IPTV Player Electron Prototype Launcher
echo ========================================
echo.

echo Checking if Electron is installed...
electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Electron not found!
    echo.
    echo Please run SETUP_GUIDE.txt first to install Electron.
    echo.
    pause
    exit /b 1
)

echo Electron found: 
electron --version
echo.

echo Starting Electron prototype...
echo.
echo ========================================================
echo IMPORTANT: Open your IPTV provider panel in browser
echo to check if requests come from YOUR IP (not VPS IP)
echo ========================================================
echo.

cd /d "%~dp0"
electron .

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Electron failed to start
    echo.
    pause
)

pause