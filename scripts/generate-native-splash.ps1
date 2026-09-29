# Rebuild the plain-white native launch resources; no network or image dependencies.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$splashResourceDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../resources/splash'))
$dimensions = @(
    @{ Name = 'hdpi'; Width = 480; Height = 762 },
    @{ Name = 'xhdpi'; Width = 720; Height = 1242 },
    @{ Name = 'xxhdpi'; Width = 1080; Height = 1882 }
)
foreach ($size in $dimensions) {
    $bitmap = New-Object System.Drawing.Bitmap($size.Width, $size.Height, ([Drawing.Imaging.PixelFormat]::Format24bppRgb))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([Drawing.Color]::White)
        $bitmap.Save((Join-Path $splashResourceDir "android-$($size.Name).png"), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}
# Passing the source file directly keeps the ZIP flat, as required by HBuilderX.
Compress-Archive -LiteralPath (Join-Path $splashResourceDir 'poementer-launch.storyboard') -DestinationPath (Join-Path $splashResourceDir 'poementer-launch.zip') -Force
Write-Output 'Generated three Android launch images and the iOS storyboard ZIP.'
