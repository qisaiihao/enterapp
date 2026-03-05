@echo off
echo 正在清理编译缓存...

if exist "unpackage\dist\build\mp-weixin" (
    rmdir /s /q "unpackage\dist\build\mp-weixin"
    echo 已删除 mp-weixin 编译目录
)

if exist "unpackage\dist\dev\mp-weixin" (
    rmdir /s /q "unpackage\dist\dev\mp-weixin"
    echo 已删除 mp-weixin 开发目录
)

echo.
echo 清理完成！请在 HBuilderX 中重新编译项目。
pause
