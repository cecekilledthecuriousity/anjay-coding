# PowerShell Script: Generate Authentic Travel Passport Ink Stamps for TDS
# Produces transparent PNGs with letterpress / vintage rubber stamp styling.
# Generated WITHOUT hardcoded dates or hours, leaving dedicated blank stamping areas.

Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot "..\assets\stamps"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

function Add-DistressTexture($g, $width, $height, $intensity = 180) {
    # Subtle vintage letterpress ink imperfections (transparent erosion speckles)
    $rand = New-Object System.Random(42)
    $clearBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    for ($i = 0; $i -lt $intensity; $i++) {
        $x = $rand.Next(10, $width - 10)
        $y = $rand.Next(10, $height - 10)
        $size = $rand.Next(1, 3)
        $g.FillEllipse($clearBrush, $x, $y, $size, $size)
    }
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
}

# =========================================================================
# 1. STAMP-COMPLETED: Circular Moss Green Passport Stamp
# =========================================================================
function Generate-StampCompleted {
    $size = 320
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $color = [System.Drawing.Color]::FromArgb(235, 46, 125, 50) # Moss green ink
    $penDashed = New-Object System.Drawing.Pen($color, 3.5)
    $penDashed.DashPattern = @(4.0, 2.5)
    $penSolid = New-Object System.Drawing.Pen($color, 2.5)
    $penThin = New-Object System.Drawing.Pen($color, 1.5)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $tintColor = [System.Drawing.Color]::FromArgb(24, 46, 125, 50)
    $tintBrush = New-Object System.Drawing.SolidBrush($tintColor)

    # Outer dashed circle & inner rings
    $g.DrawEllipse($penDashed, 16, 16, 288, 288)
    $g.DrawEllipse($penSolid, 26, 26, 268, 268)
    $g.DrawEllipse($penThin, 68, 68, 184, 184)

    # Curved top text: TDS PASSPORT
    $fontArc = New-Object System.Drawing.Font("Arial Black", 13, [System.Drawing.FontStyle]::Bold)
    $topChars = "★  T D S   P A S S P O R T  ★".ToCharArray()
    $angleStep = 6.2
    $startAngle = 270 - (($topChars.Length - 1) * $angleStep / 2)
    for ($i = 0; $i -lt $topChars.Length; $i++) {
        $angle = $startAngle + ($i * $angleStep)
        $rad = $angle * [Math]::PI / 180.0
        $cx = 160 + (112 * [Math]::Cos($rad))
        $cy = 160 + (112 * [Math]::Sin($rad))
        
        $state = $g.Save()
        $g.TranslateTransform($cx, $cy)
        $g.RotateTransform($angle + 90)
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($topChars[$i].ToString(), $fontArc, $brush, 0, 0, $sf)
        $g.Restore($state)
    }

    # Center banner: COMPLETED
    $bannerY = 138
    $g.FillRectangle($tintBrush, 42, $bannerY, 236, 44)
    $g.DrawLine($penSolid, 42, $bannerY, 278, $bannerY)
    $g.DrawLine($penSolid, 42, $bannerY + 44, 278, $bannerY + 44)

    $fontBanner = New-Object System.Drawing.Font("Arial Black", 17, [System.Drawing.FontStyle]::Bold)
    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("COMPLETED", $fontBanner, $brush, 160, ($bannerY + 22), $sfCenter)

    # Icon in center-top: Graduation Cap / Open Book
    $penIcon = New-Object System.Drawing.Pen($color, 2.5)
    # Cap diamond
    $capPts = @(
        [System.Drawing.Point]::new(160, 84),
        [System.Drawing.Point]::new(192, 98),
        [System.Drawing.Point]::new(160, 112),
        [System.Drawing.Point]::new(128, 98)
    )
    $g.DrawPolygon($penIcon, $capPts)
    # Cap skull base
    $g.DrawArc($penIcon, 142, 105, 36, 20, 20, 140)
    # Tassel
    $g.DrawLine($penThin, 192, 98, 204, 116)
    $g.FillEllipse($brush, 202, 115, 4, 6)

    # Empty dynamic date box (Bottom region for dynamic overlay)
    $g.DrawRectangle($penThin, 100, 202, 120, 36)
    $fontHint = New-Object System.Drawing.Font("Arial", 7, [System.Drawing.FontStyle]::Bold)
    $brushSubtle = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, $color))
    $g.DrawString("VALIDATED", $fontHint, $brushSubtle, 160, 194, $sfCenter)

    Add-DistressTexture $g $size $size 240
    $bmp.Save((Join-Path $outputDir "stamp-completed.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: stamp-completed.png"
}

# =========================================================================
# 2. STAMP-VERIFIED: Double-frame Octagon Blue Ink Stamp
# =========================================================================
function Generate-StampVerified {
    $size = 320
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $color = [System.Drawing.Color]::FromArgb(235, 0, 23, 143) # Deep ink blue
    $penSolid = New-Object System.Drawing.Pen($color, 3.5)
    $penInner = New-Object System.Drawing.Pen($color, 1.8)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $tintColor = [System.Drawing.Color]::FromArgb(20, 0, 23, 143)
    $tintBrush = New-Object System.Drawing.SolidBrush($tintColor)

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Outer Octagon
    function Get-Octagon($pad, $s) {
        $c = 55 # Corner cut
        return @(
            [System.Drawing.Point]::new(($pad + $c), $pad),
            [System.Drawing.Point]::new(($s - $pad - $c), $pad),
            [System.Drawing.Point]::new(($s - $pad), ($pad + $c)),
            [System.Drawing.Point]::new(($s - $pad), ($s - $pad - $c)),
            [System.Drawing.Point]::new(($s - $pad - $c), ($s - $pad)),
            [System.Drawing.Point]::new(($pad + $c), ($s - $pad)),
            [System.Drawing.Point]::new($pad, ($s - $pad - $c)),
            [System.Drawing.Point]::new($pad, ($pad + $c))
        )
    }
    $g.DrawPolygon($penSolid, (Get-Octagon 18 $size))
    $g.DrawPolygon($penInner, (Get-Octagon 28 $size))

    # Top header text
    $fontHeader = New-Object System.Drawing.Font("Arial Black", 12, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("★ OFFICIAL IMMIGRATION ★", $fontHeader, $brush, 160, 52, $sfCenter)

    # Icon: Shield with checkmark
    $penIcon = New-Object System.Drawing.Pen($color, 3.0)
    $shieldPts = @(
        [System.Drawing.Point]::new(125, 82),
        [System.Drawing.Point]::new(195, 82),
        [System.Drawing.Point]::new(195, 120),
        [System.Drawing.Point]::new(160, 150),
        [System.Drawing.Point]::new(125, 120)
    )
    $g.DrawPolygon($penIcon, $shieldPts)
    # Checkmark inside shield
    $checkPts = @(
        [System.Drawing.Point]::new(144, 110),
        [System.Drawing.Point]::new(156, 124),
        [System.Drawing.Point]::new(178, 96)
    )
    $g.DrawLines($penIcon, $checkPts)

    # Banner: TDS VERIFIED
    $bannerY = 164
    $g.FillRectangle($tintBrush, 40, $bannerY, 240, 42)
    $g.DrawLine($penSolid, 40, $bannerY, 280, $bannerY)
    $g.DrawLine($penSolid, 40, ($bannerY + 42), 280, ($bannerY + 42))

    $fontBanner = New-Object System.Drawing.Font("Arial Black", 16, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("TDS VERIFIED", $fontBanner, $brush, 160, ($bannerY + 21), $sfCenter)

    # Empty dynamic date box (Bottom area)
    $g.DrawRectangle($penInner, 90, 222, 140, 38)
    $fontSub = New-Object System.Drawing.Font("Arial Black", 7.5, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("ENTRY VISA", $fontSub, $brush, 160, 276, $sfCenter)

    Add-DistressTexture $g $size $size 240
    $bmp.Save((Join-Path $outputDir "stamp-verified.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: stamp-verified.png"
}

# =========================================================================
# 3. STAMP-HOURS: Classic Oval Antique Gold Visa Stamp
# =========================================================================
function Generate-StampHours {
    $size = 320
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $color = [System.Drawing.Color]::FromArgb(235, 183, 134, 40) # Antique Gold / Amber
    $penSolid = New-Object System.Drawing.Pen($color, 3.5)
    $penDashed = New-Object System.Drawing.Pen($color, 2.0)
    $penDashed.DashPattern = @(3.0, 2.0)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Outer and Inner Oval
    $g.DrawEllipse($penSolid, 20, 50, 280, 220)
    $g.DrawEllipse($penDashed, 32, 62, 256, 196)

    # Top Text along oval
    $fontTop = New-Object System.Drawing.Font("Arial Black", 13, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("TRAINING CREDITS", $fontTop, $brush, 160, 85, $sfCenter)

    # Icon: Hourglass in center
    $penIcon = New-Object System.Drawing.Pen($color, 2.8)
    # Hourglass top and bottom bars
    $g.DrawLine($penIcon, 142, 118, 178, 118)
    $g.DrawLine($penIcon, 142, 162, 178, 162)
    # Diagonal glass sides
    $g.DrawLine($penIcon, 144, 118, 176, 162)
    $g.DrawLine($penIcon, 176, 118, 144, 162)
    # Sand grains
    $g.FillEllipse($brush, 158, 144, 4, 6)

    # Banner / Label: HOURS VISA
    $fontBanner = New-Object System.Drawing.Font("Arial Black", 15, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("HOURS VISA", $fontBanner, $brush, 160, 182, $sfCenter)

    # Empty Box for Dynamic Hours / Date overlay
    $g.DrawRectangle($penDashed, 95, 205, 130, 36)

    Add-DistressTexture $g $size $size 220
    $bmp.Save((Join-Path $outputDir "stamp-hours.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: stamp-hours.png"
}

# =========================================================================
# 4. STAMP-ACHIEVEMENT: Arch Shape Purple Ink Stamp (Trophy / Star)
# =========================================================================
function Generate-StampAchievement {
    $size = 320
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $color = [System.Drawing.Color]::FromArgb(235, 107, 33, 168) # Royal Purple
    $penSolid = New-Object System.Drawing.Pen($color, 3.5)
    $penThin = New-Object System.Drawing.Pen($color, 1.8)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Arch path (half circle on top, straight sides, rounded corners on bottom)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(35, 24, 250, 250, 180, 180) # Top semi-circle
    $path.AddLine(285, 149, 285, 276)
    $path.AddArc(265, 260, 20, 20, 0, 90)
    $path.AddLine(265, 280, 55, 280)
    $path.AddArc(35, 260, 20, 20, 90, 90)
    $path.CloseFigure()
    $g.DrawPath($penSolid, $path)

    # Inner Arch
    $pathInner = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pathInner.AddArc(47, 36, 226, 226, 180, 180)
    $pathInner.AddLine(273, 149, 273, 264)
    $pathInner.AddLine(273, 268, 47, 268)
    $pathInner.CloseFigure()
    $g.DrawPath($penThin, $pathInner)

    # Header in Arch
    $fontHeader = New-Object System.Drawing.Font("Arial Black", 12, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("EXCELLENCE AWARD", $fontHeader, $brush, 160, 80, $sfCenter)

    # Icon: Trophy Cup
    $penIcon = New-Object System.Drawing.Pen($color, 2.5)
    # Cup body
    $g.DrawArc($penIcon, 136, 108, 48, 46, 0, 180)
    $g.DrawLine($penIcon, 136, 108, 184, 108)
    # Handles
    $g.DrawArc($penIcon, 122, 110, 18, 22, 90, 180)
    $g.DrawArc($penIcon, 180, 110, 18, 22, 270, 180)
    # Stem & base
    $g.DrawLine($penIcon, 160, 154, 160, 172)
    $g.DrawLine($penIcon, 144, 172, 176, 172)
    # Star inside cup
    $g.DrawString("★", (New-Object System.Drawing.Font("Arial", 14)), $brush, 160, 124, $sfCenter)

    # Text: KNOWLEDGE VISA
    $fontSub = New-Object System.Drawing.Font("Arial Black", 13, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("KNOWLEDGE VISA", $fontSub, $brush, 160, 198, $sfCenter)

    # Empty Box for Dynamic Date
    $g.DrawRectangle($penThin, 95, 218, 130, 36)

    Add-DistressTexture $g $size $size 220
    $bmp.Save((Join-Path $outputDir "stamp-achievement.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: stamp-achievement.png"
}

# =========================================================================
# 5. STAMP-MASTERY: Scalloped/Serrated Badge Dark Slate Stamp
# =========================================================================
function Generate-StampMastery {
    $size = 320
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $color = [System.Drawing.Color]::FromArgb(235, 55, 65, 81) # Dark Slate / Charcoal
    $penSolid = New-Object System.Drawing.Pen($color, 3.0)
    $penInner = New-Object System.Drawing.Pen($color, 1.8)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $tintColor = [System.Drawing.Color]::FromArgb(20, 55, 65, 81)
    $tintBrush = New-Object System.Drawing.SolidBrush($tintColor)

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Serrated / Scalloped Starburst Badge (24 points)
    $points = @()
    $cx = 160
    $cy = 160
    $rOuter = 138
    $rInner = 124
    $n = 24
    for ($i = 0; $i -lt ($n * 2); $i++) {
        $r = if ($i % 2 -eq 0) { $rOuter } else { $rInner }
        $angle = ($i * [Math]::PI / $n)
        $x = $cx + ($r * [Math]::Cos($angle))
        $y = $cy + ($r * [Math]::Sin($angle))
        $points += [System.Drawing.Point]::new([int]$x, [int]$y)
    }
    $g.DrawPolygon($penSolid, $points)
    $g.DrawEllipse($penInner, 48, 48, 224, 224)

    # Top Text
    $fontTop = New-Object System.Drawing.Font("Arial Black", 12, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("★ SKILL MASTERY ★", $fontTop, $brush, 160, 78, $sfCenter)

    # Icon: 3 Stars in Arc
    $fontStarBig = New-Object System.Drawing.Font("Arial Black", 20)
    $fontStarSmall = New-Object System.Drawing.Font("Arial Black", 14)
    $g.DrawString("★", $fontStarSmall, $brush, 126, 114, $sfCenter)
    $g.DrawString("★", $fontStarBig, $brush, 160, 108, $sfCenter)
    $g.DrawString("★", $fontStarSmall, $brush, 194, 114, $sfCenter)

    # Banner: TDS MASTERED
    $bannerY = 148
    $g.FillRectangle($tintBrush, 52, $bannerY, 216, 40)
    $g.DrawLine($penSolid, 52, $bannerY, 268, $bannerY)
    $g.DrawLine($penSolid, 52, ($bannerY + 40), 268, ($bannerY + 40))

    $fontBanner = New-Object System.Drawing.Font("Arial Black", 15, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("TDS MASTERED", $fontBanner, $brush, 160, ($bannerY + 20), $sfCenter)

    # Empty Box for Dynamic Date / ID
    $g.DrawRectangle($penInner, 95, 206, 130, 36)

    Add-DistressTexture $g $size $size 240
    $bmp.Save((Join-Path $outputDir "stamp-mastery.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: stamp-mastery.png"
}

# Run All Generators
Generate-StampCompleted
Generate-StampVerified
Generate-StampHours
Generate-StampAchievement
Generate-StampMastery

Write-Host "All passport stamps generated successfully in $outputDir!"
