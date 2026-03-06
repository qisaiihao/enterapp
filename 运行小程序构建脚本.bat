@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   小程序构建后处理脚本
echo ========================================
echo.

node scripts/post-build-mp-weixin.js

echo.
echo ========================================
echo   脚本执行完成
echo ========================================
echo.
pause
