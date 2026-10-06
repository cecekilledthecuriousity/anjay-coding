# PowerShell Static HTML Assembler for TDS
$templatePath = Join-Path $PSScriptRoot "..\src\index.template.html"
$srcDir = Join-Path $PSScriptRoot "..\src"
$targetIndex = Join-Path $PSScriptRoot "..\index.html"
$targetMirror = Join-Path $PSScriptRoot "..\training_internal_plan.html"

$content = [System.IO.File]::ReadAllText($templatePath, [System.Text.Encoding]::UTF8)
$includeRegex = [regex]'<!--\s*@@include\([''"]([^''"]+)[''"]\)\s*-->'

for ($i = 0; $i -lt 10; $i++) {
    $matches = $includeRegex.Matches($content)
    if ($matches.Count -eq 0) { break }
    foreach ($m in $matches) {
        $relPath = $m.Groups[1].Value.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $fullPath = [System.IO.Path]::Combine($srcDir, $relPath)
        if (Test-Path $fullPath) {
            $included = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
            $content = $content.Replace($m.Value, $included)
        } else {
            Write-Error "Included file not found: $fullPath"
        }
    }
}

[System.IO.File]::WriteAllText($targetIndex, $content, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($targetMirror, $content, [System.Text.Encoding]::UTF8)

Write-Host "[TDS Build] Successfully assembled index.html and training_internal_plan.html"
Write-Host "  -> Output size: $([Math]::Round($content.Length / 1024, 1)) KB"
