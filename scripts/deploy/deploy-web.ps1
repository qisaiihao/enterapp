$ErrorActionPreference = 'Stop'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
}

$envId = 'cloud1-5gb0pbyl400845f5'
$hostUrl = 'https://cloud1-5gb0pbyl400845f5-1378788263.tcloudbaseapp.com'
$dist = Join-Path $PSScriptRoot '..\..\unpackage\dist\build\web'
$noOpen = $env:DEPLOY_NO_OPEN -eq '1'

function Exit-Script([int]$code) {
  exit $code
}

try {
  Write-Host '============================================'
  Write-Host '  poementer 网页版一键部署（腾讯云 CloudBase）'
  Write-Host '============================================'
  Write-Host ''

  if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
    Write-Host '[错误] 没有找到导出好的网站文件：' -ForegroundColor Red
    Write-Host "  $dist"
    Write-Host '请先在 HBuilderX 中重新导出 H5 网站，再双击本脚本。'
    Exit-Script 1
  }

  $tcb = Get-Command tcb.cmd -ErrorAction SilentlyContinue
  if ($null -eq $tcb) {
    Write-Host '[提示] 未检测到 CloudBase CLI，正在自动安装...'
    if ($null -eq (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
      Write-Host '[错误] 未找到 npm，请先安装 Node.js。' -ForegroundColor Red
      Exit-Script 1
    }
    & npm.cmd install -g @cloudbase/cli
    if ($LASTEXITCODE -ne 0) {
      Write-Host '[错误] CloudBase CLI 安装失败。' -ForegroundColor Red
      Exit-Script 1
    }
    $tcb = Get-Command tcb.cmd -ErrorAction SilentlyContinue
    if ($null -eq $tcb) {
      Write-Host '[错误] 安装完成但找不到 tcb 命令，请重新打开本脚本。' -ForegroundColor Red
      Exit-Script 1
    }
  }

  Write-Host "[信息] 环境 ID：$envId"
  Write-Host "[信息] 本地目录：$dist"
  Write-Host '[信息] 开始上传，请稍候...'
  Write-Host ''

  & $tcb.Source hosting deploy $dist / -e $envId
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[错误] 部署失败。如果是登录状态失效，请先执行：' -ForegroundColor Red
    Write-Host '  tcb login'
    Write-Host '登录完成后再重新双击本脚本。'
    Exit-Script 1
  }

  Write-Host ''
  Write-Host '[成功] 部署完成！' -ForegroundColor Green
  Write-Host "访问地址：$hostUrl"
  Write-Host ''

  if (-not $noOpen) {
    Start-Process $hostUrl
  }
  Exit-Script 0
} catch {
  Write-Host ''
  Write-Host "[错误] $($_.Exception.Message)" -ForegroundColor Red
  Exit-Script 1
}
