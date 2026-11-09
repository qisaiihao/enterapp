@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found. Please install Python 3 first.
  pause
  exit /b 1
)

python -c "import requests" >nul 2>nul
if errorlevel 1 (
  echo [INFO] Installing requests...
  python -m pip install requests
  if errorlevel 1 (
    echo [ERROR] Failed to install requests.
    pause
    exit /b 1
  )
)

python "%~dp0deploy-apk.py"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo [FAILED] Deploy failed, exit code %RESULT%.
pause
exit /b %RESULT%
