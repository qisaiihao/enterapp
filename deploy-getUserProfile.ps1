# 部署 getUserProfile 云函数（仅更新代码，不更新配置）
# 使用方法：在 PowerShell 中运行 .\deploy-getUserProfile.ps1

$functionName = "getUserProfile"
$envId = "cloud1-5gb0pbyl400845f5"
$functionDir = "functions\$functionName"

Write-Host "开始部署 $functionName..." -ForegroundColor Green

# 1. 进入函数目录
Set-Location $functionDir

# 2. 确保依赖已安装
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    npm install
}

# 3. 创建临时目录用于打包
$tempDir = "..\..\temp-deploy-$functionName"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# 4. 复制文件到临时目录（排除 node_modules 中的不必要文件）
Write-Host "打包代码..." -ForegroundColor Yellow
Copy-Item "index.js" $tempDir
Copy-Item "package.json" $tempDir
Copy-Item "config.json" $tempDir -ErrorAction SilentlyContinue

# 复制 node_modules（排除开发依赖和缓存）
if (Test-Path "node_modules") {
    Write-Host "复制依赖..." -ForegroundColor Yellow
    Copy-Item -Recurse "node_modules" $tempDir
}

# 5. 创建 zip 文件
Set-Location $tempDir
$zipFile = "..\$functionName.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}

Write-Host "创建压缩包..." -ForegroundColor Yellow
Compress-Archive -Path * -DestinationPath $zipFile -Force

Set-Location ..\..

# 6. 使用 TCB CLI 上传代码（仅更新代码，不更新配置）
Write-Host "上传代码到云端..." -ForegroundColor Yellow
Write-Host "注意：如果遇到运行时错误，请在腾讯云控制台手动上传 $functionName.zip 文件" -ForegroundColor Cyan

# 尝试使用 code update 命令
# 注意：这个命令可能需要额外的参数
tcb fn code update $functionName -e $envId

# 7. 清理临时文件
Write-Host "清理临时文件..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $tempDir
Remove-Item "temp-deploy-$functionName.zip" -ErrorAction SilentlyContinue

Write-Host "部署完成！" -ForegroundColor Green
Write-Host "如果自动上传失败，请："
Write-Host "1. 找到生成的 zip 文件：temp-deploy-$functionName\$functionName.zip"
Write-Host "2. 登录腾讯云控制台"
Write-Host "3. 进入云函数 getUserProfile"
Write-Host "4. 选择'代码'标签"
Write-Host "5. 点击'上传'按钮，选择 zip 文件"
Write-Host "6. 点击'部署'按钮"

