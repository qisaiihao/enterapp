@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python not found. Please install Python 3.
  pause
  exit /b 1
)
where pythonw >nul 2>nul
if errorlevel 1 (
  python "%~dp0scripts\deploy\deploy-tool.py"
) else (
  start "" pythonw "%~dp0scripts\deploy\deploy-tool.py"
)
