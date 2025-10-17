# PowerShell script to rename Chinese-named image files to English

Write-Host "Starting file renaming process..." -ForegroundColor Green

# Directory containing the images
$imageDir = "C:\Users\qisaihao\回车键_uni\unpackage\dist\build\app-plus\static\images"

# Check if directory exists
if (-not (Test-Path $imageDir)) {
    Write-Host "Error: Directory not found: $imageDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Changing to directory: $imageDir" -ForegroundColor Yellow
Set-Location $imageDir

Write-Host "`nRenaming Chinese-named files to English..." -ForegroundColor Cyan

# Define the file mappings
$fileMappings = @{
    "存草稿.png" = "save_draft.png"
    "发布.png" = "publish.png"
    "发帖.png" = "create_post.png"
    "返回编辑.png" = "back_to_edit.png"
    "回车键.png" = "enter_key.png"
    "加标签.png" = "add_tag.png"
    "配图.png" = "add_image.png"
    "切换发布模式.png" = "switch_publish_mode.png"
    "确认选择.png" = "confirm_selection.png"
    "删除.png" = "delete.png"
    "搜索.png" = "search.png"
    "我的帖子.png" = "my_posts.png"
    "我收藏的.png" = "my_favorites.png"
    "消息.png" = "messages.png"
    "写评论.png" = "write_comment.png"
    "写诗.png" = "write_poetry.png"
    "选更多.png" = "select_more.png"
    "选择高光句.png" "select_highlight.png"
    "选择颜色.png" = "select_color.png"
    "作品集.png" = "portfolio.png"
}

# Rename files
$renamedCount = 0
$notFoundCount = 0

foreach ($mapping in $fileMappings.GetEnumerator()) {
    $oldName = $mapping.Key
    $newName = $mapping.Value

    if (Test-Path $oldName) {
        try {
            Rename-Item -Path $oldName -NewName $newName -ErrorAction Stop
            Write-Host "✓ Renamed: $oldName → $newName" -ForegroundColor Green
            $renamedCount++
        }
        catch {
            Write-Host "✗ Failed to rename: $oldName → $newName" -ForegroundColor Red
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ File not found: $oldName" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host "`nRenaming completed!" -ForegroundColor Green
Write-Host "Successfully renamed: $renamedCount files" -ForegroundColor Green
Write-Host "Files not found: $notFoundCount files" -ForegroundColor Yellow

Write-Host "`nCurrent files in directory:" -ForegroundColor Cyan
Get-ChildItem -Path $imageDir -Filter "*.png" | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}

Write-Host "`nScript completed successfully!" -ForegroundColor Green
Read-Host "Press Enter to exit"