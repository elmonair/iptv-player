@echo off
title IPTV Player - Electron Prototype
color 0A
cls

echo.
echo ============================================
echo    IPTV Player - Electron Prototype
echo ============================================
echo.
echo This will launch the IPTV Player as a
echo Windows desktop application.
echo.
echo IMPORTANT: Close any existing Electron
echo windows first before running.
echo.
echo ============================================
echo.

cd /d "%~dp0"

echo Starting Electron...
echo.
timeout /t 2 /nobreak >nul

electron .

if errorlevel 1 (
    echo.
    echo ERROR: Electron failed to start!
    echo.
    echo Make sure Electron is installed:
    echo npm install -g electron
    echo.
    pause
)