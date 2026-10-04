# Modularisasi index.html & Static Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memecah monolitik `index.html` (2.531 baris) menjadi modul-modul terpisah (`src/components/`, `src/pages/`, `src/modals/`), menyediakan script assembly deterministik (Node.js & PowerShell) yang kompatibel dengan Vercel, menjaga sinkronisasi mirror `training_internal_plan.html`, serta menyusun panduan VPS.

**Architecture:** Menggunakan pendekatan *Zero-Dependency Static Assembler*. Kerangka utama di `src/index.template.html` memuat placeholder `<!-- @@include('...') -->` yang akan digantikan secara deterministik oleh konten partials melalui `scripts/build.js` (untuk Vercel/VPS) dan `scripts/build.ps1` (untuk Windows lokal). Hasil kompilasi disimpan di `index.html` dan `training_internal_plan.html` sehingga seluruh kode JavaScript di `js/app.js` tetap berjalan normal tanpa modifikasi.

**Tech Stack:** Pure Vanilla HTML5, Vanilla JavaScript, CSS3, Node.js (`fs`/`path` bawaan), PowerShell Core/Desktop, Vercel Static Hosting.

**Spec:** [docs/superpowers/specs/2026-10-03-modularize-html-design.md](file:///C:/Users/RUSLI/Downloads/Anjay%20coding/form-training-cece-main/docs/superpowers/specs/2026-10-03-modularize-html-design.md)

## Global Constraints
- Target Vercel: Wajib dapat langsung di-deploy ke Vercel tanpa dependensi external runtime tambahan.
- Pure Vanilla JS: Tidak mengubah atau merusak fungsi selektor di `js/app.js`.
- File Mirror Sinkron: `index.html` dan `training_internal_plan.html` wajib selalu identik byte-for-byte setelah perakitan.
- Aturan Commit: Sesuai rulebook `GEMINI.md`, jangan melakukan `git commit` tanpa izin eksplisit; biarkan hasil perubahan berada di working tree.
- Format Quick Paste & ID: Seluruh ID form dan modal wajib dipertahankan 100% (0 ID yang hilang).

## Review Focus
1. **DOM ID Preservation**: Seluruh 50+ ID elemen penting (seperti `#page-dashboard`, `#page-ajukan`, `#excelPasteArea`, dll.) wajib tetap ada agar tidak merusak `document.getElementById` di `js/app.js`.
2. **Include Tag Leakage**: Tidak boleh ada komentar `<!-- @@include(...) -->` yang tertinggal di file hasil kompilasi.
3. **Cross-Platform Compatibility**: Script perakitan harus bisa dijalankan di Windows via PowerShell (`scripts/build.ps1`) dan di Linux/Vercel via Node.js (`scripts/build.js`).
4. **Mirror File Parity**: `training_internal_plan.html` harus identik persis dengan `index.html`.
5. **No Broken Layout / Styles**: Struktur tag pembuka dan penutup (`div.tds-layout`, `div.tds-main`, `div.page`) tidak boleh terputus atau salah nesting.

---

### Task 1: Backup & Persiapan Package Configuration
**Files:**
- Create: `tests/fixtures/original-index.html`
- Create: `package.json`

**Interfaces:**
- Consumes: `index.html`
- Produces: Salinan baseline untuk verifikasi paritas dan konfigurasi npm script untuk Vercel

- [x] **Step 1: Backup index.html ke fixture**
  Salin file `index.html` yang ada saat ini ke `tests/fixtures/original-index.html` sebagai acuan validasi paritas.

- [x] **Step 2: Buat package.json untuk Vercel**
  Buat `package.json` berisi script:
  ```json
  {
    "name": "form-training-tds",
    "version": "1.0.0",
    "private": true,
    "scripts": {
      "build": "node scripts/build.js",
      "watch": "node scripts/build.js --watch"
    }
  }
  ```

- [x] **Step 3: Verifikasi keberadaan file backup dan package.json**
  Pastikan `tests/fixtures/original-index.html` dan `package.json` telah terbentuk.

---

### Task 2: Implementasi Assembler Scripts (`scripts/build.js`, `scripts/build.ps1`, `build.bat`)
**Files:**
- Create: `scripts/build.js`
- Create: `scripts/build.ps1`
- Create: `build.bat`

**Interfaces:**
- Consumes: Template `src/index.template.html` dan file-file di `src/**/*.html`
- Produces: File terkompilasi `index.html` dan `training_internal_plan.html`

- [x] **Step 1: Tulis script Node.js (`scripts/build.js`)**
  Menggunakan native `fs` dan `path`:
  - Membaca `src/index.template.html`.
  - Regex replacement: `<!--\s*@@include\('([^']+)'\)\s*-->` digantikan konten file dari folder `src/`.
  - Menulis output secara sinkron ke `index.html` dan `training_internal_plan.html`.
  - Jika argumen `--watch` diberikan, pasang `fs.watch` pada direktori `src/`.

- [x] **Step 2: Tulis script PowerShell (`scripts/build.ps1`)**
  Implementasikan logika regex penggantian yang sama persis di PowerShell agar dapat dieksekusi secara lokal di Windows tanpa Node.js.

- [x] **Step 3: Tulis batch wrapper (`build.bat`)**
  File satu baris untuk Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1`

- [x] **Step 4: Uji eksekusi test awal assembler**
  Jalankan `scripts/build.ps1` (akan mengembalikan peringatan jika `src/index.template.html` belum ada, membuktikan script berjalan).

---

### Task 3: Implementasi Script Verifikasi Paritas (`scripts/verify.ps1`)
**Files:**
- Create: `scripts/verify.ps1`

**Interfaces:**
- Consumes: `tests/fixtures/original-index.html`, `index.html`, `training_internal_plan.html`
- Produces: Laporan perbandingan (Missing IDs, Residual includes, Hash/Content parity)

- [x] **Step 1: Buat script verifikasi paritas di `scripts/verify.ps1`**
  Fitur verifikasi:
  1. Ekstrak seluruh `id="([a-zA-Z0-9_\-]+)"` dari file original dan file hasil kompilasi.
  2. Cari selisih ID yang hilang di file baru. Jika ada yang hilang, gagalkan proses (Exit Code 1).
  3. Cek apakah ada pola `@@include` yang tersisa di `index.html`. Jika ada, gagalkan proses.
  4. Bandingkan konten `index.html` dengan `training_internal_plan.html`. Keduanya harus identik 100%.

- [x] **Step 2: Uji coba verify script terhadap original**
  Jalankan script terhadap original untuk memastikan logika ekstraksi ID valid.

---

### Task 4: Ekstraksi Layout, Components, & Kerangka Template
**Files:**
- Create: `src/index.template.html`
- Create: `src/components/sidebar.html`
- Create: `src/components/sticky-bar.html`

**Interfaces:**
- Consumes: Baris 1-78, 2061-2083, dan 2527-2531 dari `index.html`
- Produces: Kerangka template bersih dan modular components

- [x] **Step 1: Ekstrak `src/components/sidebar.html`**
  Pindahkan elemen `<aside class="tds-sidebar" id="tdsSidebar">...</aside>` (baris 24 s/d 76).

- [x] **Step 2: Ekstrak `src/components/sticky-bar.html`**
  Pindahkan elemen `<div class="sticky-bottom-bar" id="stickyBottomBar">...</div>` (baris 2061 s/d 2082).

- [x] **Step 3: Buat `src/index.template.html`**

---

### Task 5: Ekstraksi 9 Halaman SPA ke `src/pages/`
**Files:**
- Create: `src/pages/dashboard.html`
- Create: `src/pages/ajukan-training.html`
- Create: `src/pages/skill-matrix.html`
- Create: `src/pages/ai-studio.html`
- Create: `src/pages/kalender.html`
- Create: `src/pages/training-saya.html`
- Create: `src/pages/vendor.html`
- Create: `src/pages/post-training.html`
- Create: `src/pages/portal-approval.html`

**Interfaces:**
- Consumes: Elemen `<section class="tds-page ...">` dari `index.html`
- Produces: 9 file partial halaman independen

- [x] **Step 1: Ekstrak `src/pages/dashboard.html`** (`#page-dashboard`)
- [x] **Step 2: Ekstrak `src/pages/ajukan-training.html`** (`#page-ajukan`, Step 1 s/d 4)
- [x] **Step 3: Ekstrak `src/pages/skill-matrix.html`** (`#page-skill-matrix`)
- [x] **Step 4: Ekstrak `src/pages/ai-studio.html`** (`#page-ai-studio`)
- [x] **Step 5: Ekstrak `src/pages/kalender.html`** (`#page-kalender`)
- [x] **Step 6: Ekstrak `src/pages/training-saya.html`** (`#page-training-saya`)
- [x] **Step 7: Ekstrak `src/pages/vendor.html`** (`#page-vendor`)
- [x] **Step 8: Ekstrak `src/pages/post-training.html`** (`#page-post-training`)
- [x] **Step 9: Ekstrak `src/pages/portal-approval.html`** (`#page-portal-approval`)

---

### Task 6: Ekstraksi Modal Dialog ke `src/modals/`
**Files:**
- Create: `src/modals/quick-paste.html`
- Create: `src/modals/confirm-submit.html`
- Create: `src/modals/skill-score.html`
- Create: `src/modals/add-skill.html`
- Create: `src/modals/ai-skill-summary.html`
- Create: `src/modals/success-submit.html`
- Create: `src/modals/admin-pin.html`
- Create: `src/modals/approval-pin.html`
- Create: `src/modals/detail-submission.html`
- Create: `src/modals/ai-assistant.html`
- Create: `src/modals/calendar-detail.html`

**Interfaces:**
- Consumes: Seluruh elemen `<div class="modal-overlay" id="...">` dari `index.html`
- Produces: 11 file modal terpisah yang rapi dan mudah dimodifikasi

- [x] **Step 1: Ekstrak Modal Quick Paste, Confirm Submit, Success Submit**
- [x] **Step 2: Ekstrak Modal Skill Matrix (Score, Add Skill, AI Summary)**
- [x] **Step 3: Ekstrak Modal Security PIN (Admin PIN, Approval PIN)**
- [x] **Step 4: Ekstrak Modal Details & AI (Detail Submission, AI Assistant, Calendar Detail)**

---

### Task 7: Eksekusi Assembly & Verifikasi Paritas Penuh
**Files:**
- Modify: `index.html` (ter-regenerasi)
- Modify: `training_internal_plan.html` (ter-regenerasi & sinkron)

**Interfaces:**
- Consumes: Script `scripts/build.ps1` dan `scripts/verify.ps1`
- Produces: Verifikasi 100% sukses tanpa ada elemen yang hilang

- [x] **Step 1: Jalankan assembly script**
  Eksekusi: `powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1`

- [x] **Step 2: Jalankan automated verification script**
  Eksekusi: `powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1`
  Ekspektasi:
  - Missing IDs: 0
  - Residual includes: 0
  - Mirror parity: IDENTICAL

---

### Task 8: Penyusunan Panduan Deployment VPS
**Files:**
- Create: `docs/vps-deployment.md`

**Interfaces:**
- Consumes: Catatan arsitektur dari spec
- Produces: Panduan deployment server mandiri (Nginx, Caddy, Docker)

- [x] **Step 1: Tulis dokumentasi panduan VPS di `docs/vps-deployment.md`**
  Mencakup konfigurasi Nginx statis, blok lokasi, kompresi gzip/brotli, Caddyfile ringkas, dan instruksi alur update via Git.

---

### Task 9: Verifikasi Fungsional Akhir & Smoke Test
**Files:**
- Test: `index.html`, `training_internal_plan.html`, `js/app.js`

- [x] **Step 1: Validasi sintaks JS**
  Pastikan `js/app.js` tetap valid dan tidak ada syntax error.

- [x] **Step 2: Verifikasi alur DOM & Interaktivitas**
  Verifikasi semua tombol navigasi sidebar, stepper pengajuan, quick paste, dan modal trigger dapat diakses tanpa throwing JavaScript error.
