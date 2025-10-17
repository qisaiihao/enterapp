@echo off
setlocal enabledelayedexpansion

echo Starting file renaming process...

:: Directory containing the images
set "IMAGE_DIR=C:\Users\qisaihao\回车键_uni\unpackage\dist\build\app-plus\static\images"

:: Change to the images directory
cd /d "%IMAGE_DIR%"

echo.
echo Renaming Chinese-named files to English...

:: Rename the files
if exist "存草稿.png" (
    echo Renaming 存草稿.png to save_draft.png
    ren "存草稿.png" "save_draft.png"
) else (
    echo File 存草稿.png not found
)

if exist "发布.png" (
    echo Renaming 发布.png to publish.png
    ren "发布.png" "publish.png"
) else (
    echo File 发布.png not found
)

if exist "发帖.png" (
    echo Renaming 发帖.png to create_post.png
    ren "发帖.png" "create_post.png"
) else (
    echo File 发帖.png not found
)

if exist "返回编辑.png" (
    echo Renaming 返回编辑.png to back_to_edit.png
    ren "返回编辑.png" "back_to_edit.png"
) else (
    echo File 返回编辑.png not found
)

if exist "回车键.png" (
    echo Renaming 回车键.png to enter_key.png
    ren "回车键.png" "enter_key.png"
) else (
    echo File 回车键.png not found
)

if exist "加标签.png" (
    echo Renaming 加标签.png to add_tag.png
    ren "加标签.png" "add_tag.png"
) else (
    echo File 加标签.png not found
)

if exist "配图.png" (
    echo Renaming 配图.png to add_image.png
    ren "配图.png" "add_image.png"
) else (
    echo File 配图.png not found
)

if exist "切换发布模式.png" (
    echo Renaming 切换发布模式.png to switch_publish_mode.png
    ren "切换发布模式.png" "switch_publish_mode.png"
) else (
    echo File 切换发布模式.png not found
)

if exist "确认选择.png" (
    echo Renaming 确认选择.png to confirm_selection.png
    ren "确认选择.png" "confirm_selection.png"
) else (
    echo File 确认选择.png not found
)

if exist "删除.png" (
    echo Renaming 删除.png to delete.png
    ren "删除.png" "delete.png"
) else (
    echo File 删除.png not found
)

if exist "搜索.png" (
    echo Renaming 搜索.png to search.png
    ren "搜索.png" "search.png"
) else (
    echo File 搜索.png not found
)

if exist "我的帖子.png" (
    echo Renaming 我的帖子.png to my_posts.png
    ren "我的帖子.png" "my_posts.png"
) else (
    echo File 我的帖子.png not found
)

if exist "我收藏的.png" (
    echo Renaming 我收藏的.png to my_favorites.png
    ren "我收藏的.png" "my_favorites.png"
) else (
    echo File 我收藏的.png not found
)

if exist "消息.png" (
    echo Renaming 消息.png to messages.png
    ren "消息.png" "messages.png"
) else (
    echo File 消息.png not found
)

if exist "写评论.png" (
    echo Renaming 写评论.png to write_comment.png
    ren "写评论.png" "write_comment.png"
) else (
    echo File 写评论.png not found
)

if exist "写诗.png" (
    echo Renaming 写诗.png to write_poetry.png
    ren "写诗.png" "write_poetry.png"
) else (
    echo File 写诗.png not found
)

if exist "选更多.png" (
    echo Renaming 选更多.png to select_more.png
    ren "选更多.png" "select_more.png"
) else (
    echo File 选更多.png not found
)

if exist "选择高光句.png" (
    echo Renaming 选择高光句.png to select_highlight.png
    ren "选择高光句.png" "select_highlight.png"
) else (
    echo File 选择高光句.png not found
)

if exist "选择颜色.png" (
    echo Renaming 选择颜色.png to select_color.png
    ren "选择颜色.png" "select_color.png"
) else (
    echo File 选择颜色.png not found
)

if exist "作品集.png" (
    echo Renaming 作品集.png to portfolio.png
    ren "作品集.png" "portfolio.png"
) else (
    echo File 作品集.png not found
)

echo.
echo File renaming completed!
echo.
echo Listing current files in the directory:
dir /b

pause