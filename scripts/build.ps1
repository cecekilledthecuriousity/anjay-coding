# Static HTML Assembler for Windows PowerShell (TDS)
# Compiles modular components in src/ into root index.html and training_internal_plan.html.
[CmdletBinding()]
param(
    [switch]$Watch
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $rootDir "src"
$templateFile = Join-Path $srcDir "index.template.html"
$targetIndex = Join-Path $rootDir "index.html"
$targetMirror = Join-Path $rootDir "training_internal_plan.html"

function Invoke-Assemble {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "[TDS Build] Memulai assembly dari src/index.template.html..." -ForegroundColor Cyan

    if (-not (Test-Path $templateFile)) {
        Write-Error "File template tidak ditemukan: $templateFile"
        return
    }

    $content = [System.IO.File]::ReadAllText($templateFile, [System.Text.Encoding]::UTF8)
    $pattern = "<!--\s*@@include\(['""]([^'""]+)['""]\)\s*-->"
    $regex = [regex]$pattern

    $iterations = 0
    $maxIterations = 20

    while ($regex.IsMatch($content)) {
        $iterations++
        if ($iterations -gt $maxIterations) {
            Write-Error "Terlalu banyak include rekursif. Kemungkinan ada circular include."
            return
        }

        $matches = $regex.Matches($content)
        foreach ($match in $matches) {
            $includeRelPath = $match.Groups[1].Value.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $includeFullPath = Join-Path $srcDir $includeRelPath

            if (-not (Test-Path $includeFullPath)) {
                Write-Error "File partial tidak ditemukan: $includeFullPath (direferensikan di template)"
                return
            }

            $partialContent = [System.IO.File]::ReadAllText($includeFullPath, [System.Text.Encoding]::UTF8)
            $content = $content.Replace($match.Value, $partialContent)
        }
    }

    # Tulis hasil kompilasi ke index.html dan training_internal_plan.html (UTF-8 No BOM)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($targetIndex, $content, $utf8NoBom)
    [System.IO.File]::WriteAllText($targetMirror, $content, $utf8NoBom)

    $sw.Stop()
    $fileInfo = Get-Item $targetIndex
    $sizeKb = [math]::Round($fileInfo.Length / 1024, 1)

    Write-Host "[TDS Build] Berhasil dalam $($sw.ElapsedMilliseconds)ms!" -ForegroundColor Green
    Write-Host "  -> index.html ($sizeKb KB)" -ForegroundColor DarkGray
    Write-Host "  -> training_internal_plan.html (Mirrored)" -ForegroundColor DarkGray
}

if ($Watch) {
    Invoke-Assemble
    Write-Host "[TDS Build] Memantau perubahan di folder src/... Tekan Ctrl+C untuk berhenti." -ForegroundColor Yellow

    $fsw = New-Object System.IO.FileSystemWatcher
    $fsw.Path = $srcDir
    $fsw.IncludeSubdirectories = $true
    $fsw.EnableRaisingEvents = $true

    $action = {
        param($source, $eventArgs)
        Write-Host "`n[TDS Build] Terdeteksi perubahan pada: $($eventArgs.Name). Merakit ulang..." -ForegroundColor Magenta
        Invoke-Assemble
    }

    Register-ObjectEvent $fsw "Changed" -Action $action | Out-Null
    Register-ObjectEvent $fsw "Created" -Action $action | Out-Null
    Register-ObjectEvent $fsw "Deleted" -Action $action | Out-Null

    try {
        while ($true) { Start-Sleep -Seconds 1 }
    } finally {
        Unregister-Event -SourceIdentifier * -ErrorAction SilentlyContinue
        $fsw.Dispose()
    }
} else {
    Invoke-Assemble
}
