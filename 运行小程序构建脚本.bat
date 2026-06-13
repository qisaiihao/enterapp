@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   小程序构建后处理脚本
echo   1. 注入 wx.cloud 初始化代码
echo   2. 复制自定义 tabBar 组件
echo   3. 删除字体和 sticker 文件（使用云端资源）
echo ========================================
echo.

node scripts/post-build-mp-weixin.js

echo.
echo ========================================
echo   脚本执行完成
echo ========================================
echo.
pause
