# Dual-Section Evaluasi Pasca Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengintegrasikan dua formulir evaluasi pasca-training resmi (Evaluasi Trainee oleh Atasan & Evaluasi Trainer oleh Peserta) ke dalam tab Post Test pada halaman Post Training Trampoline dengan navigasi sub-tab segment switcher yang bersih dan bebas kode internal CPS.

**Architecture:** Menggunakan pure Vanilla JavaScript dan CSS responsif di dalam tab `#trampolinePanelPostTest`. Navigasi menggunakan segmented sub-tab switcher yang mengontrol tampilan dua kartu evaluasi mandiri dengan fitur Salin Link, Buka Tab Baru, dan pratinjau embed iframe berbasis lazy loading untuk menjaga performa rendering tetap kencang.

**Tech Stack:** Pure Vanilla HTML5, CSS3, JavaScript (ES6+), Google Apps Script, PowerShell Build Assembler (`scripts/build.ps1`).

**Spec:** `docs/superpowers/specs/2026-10-11-evaluasi-pasca-training-design.md`

## Global Constraints

- Pure Vanilla JS: Tidak menggunakan framework eksternal (React, Vue, jQuery).
- Pure Vanilla CSS: Konsisten dengan palet warna TDS (`#4B96FF`, `#00178F`, `#1F2421`, `#FAF9F5`).
- Mobile Anti-Collision: Responsif pada layar mobile (`max-width: 768px`) tanpa teks terpotong.
- Mirror Synchronization: `index.html` dan `training_internal_plan.html` wajib selalu identik via `scripts/build.ps1`.
- Clean UI: Tanpa kode dokumen seperti `CPS-HRD-FRM-...` pada teks tampilan.
- Syntax Validation: Wajib valid `node -c js/app.js` dan `node -c google-apps-script.js`.
- Git Commit Policy: Biarkan perubahan di working tree (uncommitted) sesuai rule GEMINI.md.

## Review Focus

- Switcher sub-tab harus berpindah mulus tanpa reload halaman dan menjaga state pilihan training.
- Iframe pratinjau harus lazy-loaded (src tidak dimuat sebelum tombol ditekan) dan ditutup otomatis saat berpindah sub-tab.
- Tombol salin link harus bekerja dengan `navigator.clipboard` serta fallback `document.execCommand('copy')`.
- Tautan buka tab baru harus membuka Google Form yang sesuai di tab baru browser.
- Tampilan harus rapi dan proporsional di layar desktop maupun mobile.

---

### Task 1: UI Structure Update di `src/pages/post-training.html`

**Files:**
- Modify: `src/pages/post-training.html:180-260`
- Target Assembly: `index.html`, `training_internal_plan.html`

**Interfaces:**
- Produces:
  - Sub-tab buttons: `#subTabBtnEvalTrainee`, `#subTabBtnEvalTrainer`
  - Sub-panels: `#evalSectionTrainee`, `#evalSectionTrainer`
  - Input URLs: `#evalTraineeFormUrl`, `#evalTrainerFormUrl`
  - Action buttons: `copyEvalTraineeLink()`, `copyEvalTrainerLink()`, `toggleEvalTraineePreview()`, `toggleEvalTrainerPreview()`
  - Iframe wrappers: `#evalTraineeIframeWrap`, `#evalTrainerIframeWrap`

- [ ] **Step 1: Ganti blok kartu evaluasi tunggal lama di `src/pages/post-training.html` dengan segmented switcher & 2 kartu evaluasi**
  - Buat sub-tab bar `.pt-subtab-nav` dengan dua tombol:
    1. `#subTabBtnEvalTrainee` dengan label `👔 Evaluasi Trainee (oleh Atasan)`
    2. `#subTabBtnEvalTrainer` dengan label `🎓 Evaluasi Trainer (oleh Peserta)`
  - Buat kartu `#evalSectionTrainee`:
    - Judul: *Evaluasi Penerapan & Dampak Kinerja Peserta*
    - Badges: *Untuk Atasan / User Divisi* &bull; *Rekomendasi Waktu: H+14 s.d H+30*
    - URL Form: `https://docs.google.com/forms/d/1W6Txh0Y1B9jvqi32FepiWCLbocOZL8qRPgegoUICLl4/viewform`
    - Tombol: Salin Link, Buka di Tab Baru, Tampilkan Form di Sini
    - Iframe accordion wrap: `#evalTraineeIframeWrap` dengan iframe `#iframeEvalTrainee`
  - Buat kartu `#evalSectionTrainer` (hidden by default):
    - Judul: *Evaluasi Mutu Fasilitator & Pelatihan*
    - Badges: *Untuk Peserta Pelatihan* &bull; *Rekomendasi Waktu: Hari-H / H+1*
    - URL Form: `https://docs.google.com/forms/d/e/1FAIpQLSdLNo9kzy22HEKq3xSCBHmZO2ksfCE2K7U_Y3EA2hCzQtRYmw/viewform`
    - Tombol: Salin Link, Buka di Tab Baru, Tampilkan Form di Sini
    - Iframe accordion wrap: `#evalTrainerIframeWrap` dengan iframe `#iframeEvalTrainer`

- [ ] **Step 2: Jalankan build script untuk merakit template ke `index.html` dan `training_internal_plan.html`**
  Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1`
  Expected: Success output size ~265 KB

---

### Task 2: Styling CSS Sub-Tab Switcher & Kartu di `css/style.css`

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Produces:
  - CSS Classes: `.pt-subtab-nav`, `.pt-subtab-btn`, `.pt-subtab-btn.active`
  - CSS Classes: `.pt-role-badge`, `.pt-timing-badge`
  - Responsive adjustments for mobile screens

- [ ] **Step 1: Tambahkan rule styling untuk sub-tab switch bar**
  - `.pt-subtab-nav`: inline-flex container dengan background `--paper`, border radius 10px, padding 4px.
  - `.pt-subtab-btn`: tombol flex dengan transisi halus, font-weight 600, padding 8px 16px.
  - `.pt-subtab-btn.active`: background `var(--accent-dark, #00178F)`, warna putih, shadow halus.
  - `.pt-role-badge` & `.pt-timing-badge`: pill badges untuk identifikasi peran dan waktu pengisian.

- [ ] **Step 2: Tambahkan style accordion pratinjau iframe**
  - Pastikan `.pt-iframe-wrap` mendukung iframe responsif dengan min-height 540px dan border radius yang rapi.

---

### Task 3: JavaScript State & Interaction Controller di `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Produces:
  - `switchPostTestEvaluationTab(tabType)`: toggle aktif antara `'trainee'` dan `'trainer'`
  - `copyEvalTraineeLink()`: salin link formulir evaluasi trainee
  - `copyEvalTrainerLink()`: salin link formulir evaluasi trainer
  - `toggleEvalTraineePreview()`: buka/tutup iframe pratinjau evaluasi trainee
  - `toggleEvalTrainerPreview()`: buka/tutup iframe pratinjau evaluasi trainer
  - Window exposures untuk fungsi di atas

- [ ] **Step 1: Implementasikan fungsi `switchPostTestEvaluationTab(tabType)`**
  - Toggle class `active` pada tombol switcher.
  - Tampilkan `#evalSectionTrainee` atau `#evalSectionTrainer`.
  - Jika berpindah tab saat iframe preview di tab lain terbuka, tutup preview di tab sebelumnya agar menghemat memori.

- [ ] **Step 2: Implementasikan fungsi salin link `copyEvalTraineeLink()` dan `copyEvalTrainerLink()`**
  - Ambil nilai URL dari input readonly yang bersesuaian.
  - Salin ke clipboard via `navigator.clipboard.writeText` dengan fallback `document.execCommand('copy')`.
  - Berikan feedback visual toast: *"Tautan formulir berhasil disalin!"*.

- [ ] **Step 3: Implementasikan fungsi toggle preview iframe `toggleEvalTraineePreview()` dan `toggleEvalTrainerPreview()`**
  - Mengatur accordion display dan lazy loading attribute `src`.
  - Perbarui teks tombol antara *"Tampilkan Form di Sini"* dan *"Sembunyikan Form"*.

- [ ] **Step 4: Expose semua fungsi baru ke objek `window`**
  - `window.switchPostTestEvaluationTab = switchPostTestEvaluationTab;`
  - `window.copyEvalTraineeLink = copyEvalTraineeLink;`
  - `window.copyEvalTrainerLink = copyEvalTrainerLink;`
  - `window.toggleEvalTraineePreview = toggleEvalTraineePreview;`
  - `window.toggleEvalTrainerPreview = toggleEvalTrainerPreview;`

- [ ] **Step 5: Verifikasi sintaksis JavaScript**
  Run: `node -c js/app.js; node -c google-apps-script.js`
  Expected: Return exit code 0 tanpa error

---

### Task 4: Static Assembly & Verifikasi Akhir

**Files:**
- Execute: `scripts/build.ps1`
- Verify: `index.html`, `training_internal_plan.html`, `css/style.css`, `js/app.js`

- [ ] **Step 1: Jalankan build assembler**
  Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1`
  Expected: Output size ~265 KB, exit code 0

- [ ] **Step 2: Verifikasi kecocokan hash SHA-256 antara index.html dan training_internal_plan.html**
  Run: `Get-FileHash index.html, training_internal_plan.html`
  Expected: Kedua file memiliki hash identik

- [ ] **Step 3: Verifikasi sintaksis node**
  Run: `node -c js/app.js; node -c google-apps-script.js`
  Expected: Clean exit code 0

- [ ] **Step 4: Cek status git working tree**
  Run: `git status`
  Expected: Perubahan file siap ditinjau pengguna, tanpa commit otomatis
