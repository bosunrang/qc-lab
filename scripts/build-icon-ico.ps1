Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\build\icon.png"
$dstPath = Join-Path $PSScriptRoot "..\build\icon.ico"
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$src = [System.Drawing.Image]::FromFile($srcPath)

$pngBlocks = @()
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBlocks += ,$ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
}
$src.Dispose()

$count = $sizes.Count
$headerSize = 6 + 16 * $count
$fs = New-Object System.IO.FileStream $dstPath, ([System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR
$bw.Write([UInt16]0)      # reserved
$bw.Write([UInt16]1)      # type = icon
$bw.Write([UInt16]$count)

$offset = $headerSize
for ($i = 0; $i -lt $count; $i++) {
    $size = $sizes[$i]
    $dim = if ($size -ge 256) { 0 } else { $size }
    $bw.Write([byte]$dim)          # width
    $bw.Write([byte]$dim)          # height
    $bw.Write([byte]0)             # color count
    $bw.Write([byte]0)             # reserved
    $bw.Write([UInt16]1)           # planes
    $bw.Write([UInt16]32)          # bit count
    $bw.Write([UInt32]$pngBlocks[$i].Length)
    $bw.Write([UInt32]$offset)
    $offset += $pngBlocks[$i].Length
}
for ($i = 0; $i -lt $count; $i++) {
    $bw.Write($pngBlocks[$i])
}
$bw.Flush()
$fs.Close()

Write-Output "Da tao $dstPath tu $srcPath voi cac size: $($sizes -join ', ')"
