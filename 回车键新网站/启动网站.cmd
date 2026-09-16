@echo off
setlocal
chcp 65001 >nul
title POEMENTER Website
cd /d "%~dp0"
echo.
echo Starting POEMENTER...
echo Website: http://127.0.0.1:5173/
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js 22.12 or later.
  pause
  exit /b 1
)
node scripts\start-website.mjs %*
set "launchResult=%errorlevel%"
echo.
if not "%launchResult%"=="0" echo Startup failed. Please send the message above for troubleshooting.
echo If the browser did not open, visit http://127.0.0.1:5173/
echo You may close this window if the website was already running.
pause
exit /b %launchResult%
