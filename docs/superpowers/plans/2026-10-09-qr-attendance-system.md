# Sistem Absensi QR Pelatihan Terintegrasi (Live QR Attendance Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun sistem absensi QR digital terintegrasi pelatihan yang otomatis mendeteksi jadwal aktif hari ini, menampilkan QR dinamis di layar proyektor trainer dengan live counter, menyediakan form mobile check-in anti-joki (verifikasi email) untuk peserta, dan mencatat data kehadiran langsung ke Google Sheets.

**Architecture:** 
- **Backend (Google Apps Script)**: Menambahkan tabel `"Training Attendance"` di Spreadsheet serta handler `recordAttendance`, `getAttendanceLogs`, dan `manualAttendance` di `google-apps-script.js`.
- **Frontend Hub Trainer & Proyektor**: Halaman modular `src/pages/absensi.html` dengan QR generator client-side canvas/SVG, pemilih sesi otomatis, fullscreen proyektor mode, live counter kehadiran, dan checklist manual.
- **Frontend Mobile Check-In**: Tampilan responsif 1-kolom (`#absen`) untuk peserta memilih nama terdaftar dari dropdown, verifikasi kecocokan email, dan kunci proteksi duplikasi submit.
- **Integrasi**: Menambahkan item menu di `src/components/sidebar.html`, menyinkronkan metrik kehadiran ke `src/pages/post-training.html`, serta build otomatis via `scripts/build.js`.

**Tech Stack:** Pure Vanilla JavaScript (ES6+), Vanilla CSS3 (Earthy Palette, Anti-Collision Mobile), HTML5 Canvas/SVG, Google Apps Script, Google Sheets API.

**Spec:** `docs/superpowers/specs/2026-10-09-qr-attendance-system-design.md`

## Global Constraints

- Wajib menggunakan Pure Vanilla JS tanpa framework pihak ketiga (React/Vue/jQuery).
- Wajib menggunakan Pure Vanilla CSS mengikuti palet Earthy Modern (`#3F5A44`, `#1F2421`, `#FAF9F5`, `#B78628`).
- Mobile Anti-Collision: Pada viewport `<= 768px`, tata letak beralih menjadi 1 kolom (`1fr`, `min-width: 0`).
- Clean Inline Line SVGs (stroke-width 1.75 / 1.8), tidak menggunakan emoji pada tombol antarmuka utama.
- File `index.html` dan `training_internal_plan.html` harus selalu identik hasil kompilasi `node scripts/build.js`.
- Validasi sintaksis `node -c js/app.js` dan `node -c google-apps-script.js` wajib lolos sebelum menyelesaikan tugas.
- Jangan melakukan git commit otomatis tanpa izin eksplisit (patuhi rule `GEMINI.md`).

## Review Focus

1. **Pencegahan Double-Submit**: Peserta yang men-submit dua kali untuk training dan sesi modul yang sama harus ditolak secara elegan tanpa menduplikasi baris di Google Sheets.
2. **Kesesuaian Validasi Email Peserta**: Jika peserta memilih nama A namun memasukkan email B (atau typo email), form harus memblokir pengiriman dan menampilkan pesan verifikasi yang jelas.
3. **Penanganan Multi-Sesi / Hari Berbeda**: Pelatihan dengan beberapa sesi modul (misal Sesi 1 pagi, Sesi 2 siang) harus memiliki catatan presensi terpisah dan QR Code spesifik sesi.
4. **Offline / Fallback Kamera Rusak**: Trainer harus memiliki tombol *Manual Check-in* dan *Salin Link Absen* untuk mengantisipasi peserta dengan HP low-batt atau kamera tidak bisa memindai QR.
5. **Peserta Walk-in**: Sesi harus mendukung penambahan peserta susulan tanpa merusak data pengajuan awal di Google Sheets.

---

### Task 1: Backend Google Apps Script — Attendance Schema & Handlers

**Files:**
- Modify: `google-apps-script.js:25-35, 130-160, 2790-2840`
- Test: `node -c google-apps-script.js`

**Interfaces:**
- Consumes: Spreadsheet target `SpreadsheetApp.getActiveSpreadsheet()`
- Produces: 
  - `ATTENDANCE_SHEET_NAME = "Training Attendance"`
  - `handleRecordAttendance(ss, data)` -> JSON response `{ status: "success" | "exists", message: string }`
  - `handleGetAttendanceLogs(ss, trainingId, moduleId)` -> JSON array log kehadiran

- [ ] **Step 1: Definisikan nama sheet konstanta dan header kolom kehadiran**
Tambahkan konstanta `ATTENDANCE_SHEET_NAME = "Training Attendance"` dan struktur header:
`["Waktu Absen", "ID Training", "Nama Training", "ID Sesi Modul", "Tanggal Sesi", "Nama Peserta", "Email Peserta", "Departemen / Divisi", "Metode Absen", "Status Kehadiran", "Catatan"]`.

- [ ] **Step 2: Implementasikan fungsi `setupAttendanceHeaders(sheet)`**
Fungsi pemeriksa header otomatis untuk memastikan sheet `Training Attendance` ada dan memiliki 11 kolom terformat rapi.

- [ ] **Step 3: Implementasikan fungsi `handleRecordAttendance(ss, data)`**
Tangani aksi `recordAttendance` pada `doPost`:
Validasi apakah email peserta sudah terdaftar pada `trainingId` dan `moduleId`. Jika belum ada, sisipkan baris baru dengan timestamp Asia/Jakarta.

- [ ] **Step 4: Implementasikan fungsi `handleGetAttendanceLogs(ss, trainingId, moduleId)`**
Tangani aksi `getAttendanceLogs` pada `doGet`:
Ambil baris kehadiran yang cocok dengan `trainingId` (dan opsional `moduleId`) lalu kembalikan format JSON array.

- [ ] **Step 5: Verifikasi sintaks Google Apps Script**
Run: `node -c google-apps-script.js`
Expected: Exit code 0 (tidak ada syntax error).

---

### Task 2: Pure Vanilla Client-Side QR Code Generator Engine

**Files:**
- Modify: `js/app.js`
- Test: `node -c js/app.js`

**Interfaces:**
- Produces: `window.generateQRCodeCanvas(elementId, textUrl, size)`
- Menghasilkan gambar QR Code tajam pada elemen `<canvas>` tanpa ketergantungan API pihak ketiga / eksternal.

- [ ] **Step 1: Tambahkan engine generator QR berbasis Vanilla Canvas/SVG**
Sematkan utilitas generator QR murni (algoritma QR matrix standar yang ringan dan modular) ke dalam `js/app.js`.

- [ ] **Step 2: Buat fungsi pembungkus `renderSessionQRCode(containerId, qrUrl, options)`**
Fungsi menerima container ID dan string URL tujuan (misal: `https://domain.com/#absen?id=...&sesi=...`), lalu merender canvas QR Code beresolusi tinggi (min 260px).

- [ ] **Step 3: Verifikasi sintaks JavaScript**
Run: `node -c js/app.js`
Expected: Exit code 0.

---

### Task 3: Trainer View — Live Absensi Hub & Layar Proyektor

**Files:**
- Create: `src/pages/absensi.html`
- Modify: `css/style.css`
- Modify: `js/app.js`
- Test: `node scripts/build.js`

**Interfaces:**
- Produces:
  - Section `#page-absensi`
  - Fungsi `initAttendanceHub()`
  - Fungsi `handleAttendanceTrainingChange(trainingId)`
  - Fungsi `handleAttendanceModuleChange(moduleId)`
  - Fungsi `toggleProjectorMode()`
  - Fungsi `manualCheckInParticipant(participantEmail)`
  - Fungsi `openAddWalkInModal()`

- [ ] **Step 1: Buat file modular `src/pages/absensi.html` (Trainer View)**
Struktur tampilan:
1. Header halaman dengan ikon badge QR, judul "Live Absensi Pelatihan", dan status indikator hari ini.
2. Filter bar: Dropdown Training (Auto-detect hari ini), Dropdown Sesi Modul, tombol *Fullscreen Proyektor*, tombol *Salin Link*.
3. Grid 2-kolom responsif:
   - Kolom kiri: Kartu QR Code besar dengan judul sesi, jam mulai, dan petunjuk scan.
   - Kolom kanan: Live Counter (`X / Y Peserta Hadir (Z%)`), progress bar, search filter peserta, dan daftar checklist peserta terdaftar dengan badge waktu check-in.
4. Modal Tambah Peserta Walk-in.

- [ ] **Step 2: Tambahkan logika controller di `js/app.js`**
- `detectActiveTrainingsToday()`: Membaca submissions dari cache lokal/remote, menyaring yang statusnya `Approved` dan tanggalnya hari ini.
- `renderAttendanceTrainerBoard()`: Merender daftar peserta terdaftar, memetakan status `Hadir` vs `Belum Hadir`.
- `syncAttendanceStatus()`: Polling berkala (atau tombol refresh) untuk mengambil data terbaru dari Apps Script.
- `toggleProjectorMode()`: Menambahkan kelas CSS `.projector-mode` pada body untuk menyembunyikan sidebar dan memaksimalkan area tampilan.

- [ ] **Step 3: Tambahkan gaya styling di `css/style.css`**
Styling kartu QR Code, progress bar warna moss/gold, daftar peserta ber-badge status, dan tata letak `.projector-mode`.

- [ ] **Step 4: Uji assembly build**
Run: `node scripts/build.js`
Expected: Build sukses, `index.html` dan `training_internal_plan.html` ter-update.

---

### Task 4: Participant Mobile Check-In & Validasi Anti-Joki

**Files:**
- Modify: `src/pages/absensi.html`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Test: `node -c js/app.js`

**Interfaces:**
- Produces:
  - View `#page-checkin` / `#view-checkin-mobile`
  - Routing URL hash `#absen`
  - Fungsi `handleParticipantCheckInSubmit(event)`
  - Validasi email kecocokan terhadap `currentSessionParticipants`

- [ ] **Step 1: Tambahkan antarmuka check-in mobile di `src/pages/absensi.html`**
Formulir mobile ringkas:
- Banner info pelatihan: Nama training, Sesi modul, Trainer.
- Dropdown pemilihan nama peserta (hanya daftar peserta terdaftar).
- Input email kantor dengan auto-fill placeholder.
- Tombol aksi "Konfirmasi Kehadiran" dengan spinner loading.
- Kartu feedback sukses "Kehadiran Berhasil Dicatat" dengan tanggal & waktu presensi.

- [ ] **Step 2: Tambahkan logika validasi anti-joki di `js/app.js`**
Saat nama dipilih dari dropdown, sistem menyimpan email terdaftar yang seharusnya. Saat form disubmit:
- Cek kecocokan email input vs email terdaftar (case-insensitive & whitespace trimmed).
- Jika tidak cocok, munculkan alert ramah: *"Email tidak sesuai dengan nama peserta yang terdaftar pada pengajuan training ini"*.
- Jika cocok, kirim POST ke Apps Script `action: "recordAttendance"`.
- Kunci form di `localStorage` (`attendance_${trainingId}_${moduleId}`) agar tidak dapat disubmit ulang dari perangkat yang sama.

- [ ] **Step 3: Tambahkan penanganan routing hash `#absen`**
Di fungsi routing navigasi `handleHashRouting()` atau `switchPage()`:
Jika hash diawali `#absen`, ekstrak parameter query `id` dan `sesi`, muat data pelatihan terkait, dan tampilkan langsung tampilan check-in peserta tanpa menampilkan halaman dashboard trainer.

- [ ] **Step 4: Verifikasi sintaks JavaScript**
Run: `node -c js/app.js`
Expected: Exit code 0.

---

### Task 5: Integrasi Navigasi Sidebar & Template Utama

**Files:**
- Modify: `src/components/sidebar.html:23-26`
- Modify: `src/index.template.html`
- Modify: `js/app.js`
- Test: `node scripts/build.js`

**Interfaces:**
- Produces: Menu navigasi "Live Absensi" di sidebar
- Menyertakan partial `<!-- @@include('pages/absensi.html') -->` pada `src/index.template.html`.

- [ ] **Step 1: Perbarui `src/components/sidebar.html`**
Sisipkan item menu `Live Absensi` tepat setelah `Training Request` dan sebelum `Post Training Trampoline`.

- [ ] **Step 2: Sertakan include halaman di `src/index.template.html`**
Tambahkan `<!-- @@include('pages/absensi.html') -->` di dalam elemen `<main class="tds-main">`.

- [ ] **Step 3: Daftarkan halaman di fungsi navigasi `js/app.js`**
Tambahkan `'absensi'` ke dalam daftar halaman yang dihandle oleh `goToPage(pageId)`.

- [ ] **Step 4: Jalankan script perakitan build**
Run: `node scripts/build.js`
Expected: File `index.html` dan `training_internal_plan.html` berhasil terkompilasi identik.

---

### Task 6: Integrasi Post-Training Trampoline & Verifikasi Akhir

**Files:**
- Modify: `src/pages/post-training.html`
- Modify: `js/app.js`
- Test: `node scripts/build.js` dan verifikasi browser / scripts

**Interfaces:**
- Produces: Metrik persentase kehadiran aktual pada form Post Training Trampoline

- [ ] **Step 1: Tambahkan card metrik kehadiran pada `src/pages/post-training.html`**
Saat user memilih training di Post Training Trampoline, tampilkan info:
*"Tingkat Kehadiran: X / Y Peserta (Z%)"* beserta daftar ringkas peserta yang hadir.

- [ ] **Step 2: Hubungkan fungsi fetch kehadiran di `js/app.js`**
Saat event listener `handleEvidenceTrainingChange()` terpanggil, ambil data log presensi dan render ringkasan ke elemen metrik.

- [ ] **Step 3: Jalankan verifikasi sintaks menyeluruh**
Run: `node -c js/app.js`
Run: `node -c google-apps-script.js`
Run: `node scripts/build.js`
Expected: Seluruh proses lolos tanpa error.

- [ ] **Step 4: Uji fungsionalitas end-to-end**
Buka web app, klik menu "Live Absensi", pastikan QR Code ter-render di canvas, uji navigasi ke `#absen`, dan pastikan tampilan responsif rapi.
