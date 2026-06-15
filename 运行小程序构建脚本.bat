@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   WeChat Miniprogram Post-build Script
echo   1. Inject wx.cloud init code
echo   2. Copy custom tabBar components
echo   3. Remove fonts and sticker files (use cloud resources)
echo ========================================
echo.

node scripts/post-build-mp-weixin.js

echo.
echo ========================================
echo   Script execution completed
echo ========================================
echo.
pause
