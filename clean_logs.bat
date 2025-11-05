@echo off
chcp 65001 > nul
echo 正在清理调试日志...

powershell -Command "(Get-Content 'C:\Users\qisaihao\回车键_uni\pages\index\index.vue' -Encoding UTF8) -replace \"console\.log\('【点赞】.*?'\);\", \"\" -replace \"console\.log\('【图片预览】.*?'\);\", \"\" -replace \"console\.log\('【头像点击】.*?'\);\", \"\" -replace \"console\.log\('🔍 \[首页\].*?'\);\", \"\" -replace \"console\.log\('✅ \[首页\].*?'\);\", \"\" -replace \"console\.log\('⏱️ \[首页\].*?'\);\", \"\" -replace \"console\.log\('🔐 \[首页\].*?'\);\", \"\" | Set-Content 'C:\Users\qisaihao\回车键_uni\pages\index\index.vue' -Encoding UTF8"

echo 调试日志清理完成！
pause