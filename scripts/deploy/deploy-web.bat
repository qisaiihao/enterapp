@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-web.ps1"
echo.
echo Press any key to close this window.
pause >nul
