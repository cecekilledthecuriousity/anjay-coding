# Automated Parity & Integrity Verification Script (TDS)
# Ensures 100% selector parity, 0 missing IDs, mirror sync, and 0 leaked include tags.

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$fixtureFile = Join-Path $rootDir "tests\fixtures\original-index.html"
$indexFile = Join-Path $rootDir "index.html"
$mirrorFile = Join-Path $rootDir "training_internal_plan.html"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " [TDS VERIFICATION] Memulai Uji Integritas & Paritas" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$passed = $true

# 1. Pastikan file ada
if (-not (Test-Path $fixtureFile)) {
    Write-Host "[FAIL] File fixture baseline tidak ditemukan: $fixtureFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $indexFile)) {
    Write-Host "[FAIL] File index.html tidak ditemukan: $indexFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $mirrorFile)) {
    Write-Host "[FAIL] File mirror training_internal_plan.html tidak ditemukan: $mirrorFile" -ForegroundColor Red
    exit 1
}

# 2. Baca isi file
$origContent = [System.IO.File]::ReadAllText($fixtureFile, [System.Text.Encoding]::UTF8)
$compContent = [System.IO.File]::ReadAllText($indexFile, [System.Text.Encoding]::UTF8)
$mirrorContent = [System.IO.File]::ReadAllText($mirrorFile, [System.Text.Encoding]::UTF8)

# 3. Uji Leaked Includes
if ($compContent -match "@@include") {
    Write-Host "[FAIL] Terdeteksi tag @@include yang tidak ter-render di index.html!" -ForegroundColor Red
    $passed = $false
} else {
    Write-Host "[PASS] Tidak ada tag include bocor (0 leaked includes)." -ForegroundColor Green
}

# 4. Uji Kesamaan Mirror
if ($compContent -ne $mirrorContent) {
    Write-Host "[FAIL] index.html dan training_internal_plan.html TIDAK identik!" -ForegroundColor Red
    $passed = $false
} else {
    Write-Host "[PASS] index.html dan training_internal_plan.html 100% identik." -ForegroundColor Green
}

# 5. Uji Ekstraksi & Paritas DOM ID
$idRegex = [regex]'id="([^"]+)"'
$origIds = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $idRegex.Matches($origContent)) {
    $null = $origIds.Add($m.Groups[1].Value)
}

$compIds = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $idRegex.Matches($compContent)) {
    $null = $compIds.Add($m.Groups[1].Value)
}

Write-Host "[INFO] Total ID di baseline original : $($origIds.Count)" -ForegroundColor Gray
Write-Host "[INFO] Total ID di file terkompilasi  : $($compIds.Count)" -ForegroundColor Gray

# ID yang telah sengaja dihapus/dideprecate (halaman dashboard & skor post test)
$deprecatedDashboardIds = @(
    "page-dashboard",
    "dashKpiTotal",
    "dashKpiTotalSub",
    "dashKpiPending",
    "dashKpiStatusSub",
    "dashKpiBudget",
    "dashKpiJenis",
    "dashKpiJenisSub",
    "dashUpcomingList",
    "postTestSkor"
)

$missingIds = @()
foreach ($id in $origIds) {
    if (-not $compIds.Contains($id) -and -not ($deprecatedDashboardIds -contains $id)) {
        $missingIds += $id
    }
}

if ($missingIds.Count -gt 0) {
    Write-Host "[FAIL] Ditemukan $($missingIds.Count) ID yang hilang di index.html baru:" -ForegroundColor Red
    foreach ($m in $missingIds) {
        Write-Host "   - $m" -ForegroundColor Red
    }
    $passed = $false
} else {
    Write-Host "[PASS] 100% DOM ID terpenuhi (0 missing IDs di luar dashboard yang dihapus)." -ForegroundColor Green
}

# 6. Uji Elemen Kritis Spesifik TDS
$criticalIds = @(
    "tdsSidebar",
    "page-ajukan",
    "page-skill-matrix",
    "page-ai-studio",
    "page-kalender",
    "page-training-saya",
    "page-vendor",
    "page-post-training",
    "page-portal-approval",
    "formView",
    "stepPanel1",
    "stepPanel2",
    "stickyBottomBar",
    "modalQuickPasteExcel",
    "modalConfirmSubmit",
    "modalSuccessSubmit",
    "modalAdminPin",
    "modalApprovalPin",
    "toastContainer"
)

$missingCritical = @()
foreach ($cid in $criticalIds) {
    if (-not $compIds.Contains($cid)) {
        $missingCritical += $cid
    }
}

if ($missingCritical.Count -gt 0) {
    Write-Host "[FAIL] Komponen kritis berikut hilang: $($missingCritical -join ', ')" -ForegroundColor Red
    $passed = $false
} else {
    Write-Host "[PASS] Seluruh $( $criticalIds.Count ) komponen kritis TDS terverifikasi ada." -ForegroundColor Green
}

Write-Host "--------------------------------------------------" -ForegroundColor Gray
if ($passed) {
    Write-Host "[SUCCESS] Seluruh uji verifikasi integrasi LOLOS DENGAN SEMPURNA!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAILED] Verifikasi gagal. Periksa log kesalahan di atas." -ForegroundColor Red
    exit 1
}
