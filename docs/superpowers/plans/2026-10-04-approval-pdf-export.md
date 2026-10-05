# Pratinjau & Ekspor Lembar Otorisasi Pelatihan (PDF / Print) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan modal pratinjau lembar persetujuan resmi berstandar A4 korporat beserta kapabilitas cetak/simpan PDF langsung dari portal approver tanpa dependensi library eksternal.

**Architecture:** Menggunakan arsitektur native web rendering murni berbasis Vanilla JS dan CSS Print (`@media print`). Data pengajuan aktif diekstrak dari memori approver, dirender ke dalam template HTML formal A4 di dalam modal `#modalAuthSheetPreview`, lalu dicetak ke PDF atau printer fisik via `window.print()` yang mengisolasi HANYA area cetak `#authSheetPrintArea`.

**Tech Stack:** HTML5, Pure Vanilla CSS (Flexbox/Grid, `@media print`, `@page`), Vanilla JavaScript ES6+.

**Spec:** [`docs/superpowers/specs/2026-10-04-approval-pdf-export-design.md`](file:///C:/Users/RUSLI/Downloads/Anjay%20coding/form-training-cece-main/docs/superpowers/specs/2026-10-04-approval-pdf-export-design.md)

## Global Constraints

- Wajib mematuhi Pure Vanilla JS & CSS tanpa library eksternal (larangan import framework/bundle berat).
- Desain cetak harus berstandar A4 portrait dengan margin 12-14mm dan `page-break-inside: avoid` pada elemen penting.
- Nilai status otorisasi harus konsisten: Approved (hijau botol/emas), Pending (mustard), Rejected (merah bata).
- Seluruh data yang di-render ke dokumen wajib melalui fungsi sanitasi `escapeHtml()` untuk mencegah XSS.
- Paritas dan uji integritas sistem (`scripts/verify.ps1`) wajib tetap 100% lulus.

## Review Focus

- Kasus data pengajuan memiliki list modul atau peserta sangat banyak (10-30 peserta): tabel tidak boleh terpotong di tengah teks baris saat dicetak berhalaman ganda.
- Kasus pengajuan berstatus "Pending" (belum ada approver): blok tanda tangan approver harus menampilkan kotak titik-titik tanda tangan kosong dengan keterangan status "Menunggu Otorisasi", bukan teks `undefined` atau `-`.
- Kasus pengajuan tanpa biaya (biaya 0 / internal tanpa budget): tabel anggaran harus tetap menampilkan format `Rp 0` tanpa error kalkulasi.
- Kasus tombol cetak ditekan: elemen UI latar belakang (sidebar, modal header, tombol tutup, navbar) tidak boleh bocor/tercetak ke kertas.
- Responsivitas modal preview di layar desktop & tablet: dokumen di layar harus memiliki visual kertas A4 berskala proporsional yang dapat di-scroll vertikal dengan nyaman.

---

### Task 1: Markup Modal Pratinjau & Tombol Cetak Dokumen di `approval/index.html`

**Files:**
- Modify: `approval/index.html:848-915` (menambahkan tombol pemicu "📄 Lembar Otorisasi (PDF)" pada modal review pengajuan)
- Modify: `approval/index.html:980-990` (menambahkan struktur modal `#modalAuthSheetPreview` dan container `#authSheetPrintArea`)

**Interfaces:**
- Consumes: `openAuthSheetModal(trainingId)`, `closeAuthSheetModal()`, `printAuthSheet()`
- Produces: Elemen DOM `#btnOpenAuthSheet`, `#modalAuthSheetPreview`, `#authSheetPrintArea`, `#btnCloseAuthSheet`, `#btnPrintAuthSheet`

- [ ] **Step 1: Tambahkan tombol trigger di modal review detail**
  Pada footer modal `#modalReviewApproval` (`approval/index.html`), tambahkan tombol sekunder:
  ```html
  <button type="button" id="btnOpenAuthSheet" class="btn-secondary" onclick="openAuthSheetFromCurrentReview()" style="gap:7px;font-size:13px;padding:9px 16px;">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
    <span>Lembar Otorisasi (PDF)</span>
  </button>
  ```

- [ ] **Step 2: Tambahkan struktur modal pratinjau lembar otorisasi `#modalAuthSheetPreview`**
  Letakkan sebelum penutup `</body>` di `approval/index.html`:
  ```html
  <!-- ================= MODAL PRATINJAU LEMBAR OTORISASI (PDF / PRINT) ================= -->
  <div class="modal-overlay" id="modalAuthSheetPreview" role="dialog" aria-modal="true" style="display:none;z-index:9998;background:rgba(15,20,18,0.78);backdrop-filter:blur(4px);">
    <div class="modal-card auth-sheet-modal-card" style="max-width:900px;width:95%;max-height:92vh;display:flex;flex-direction:column;padding:0;background:var(--panel-solid);border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.35);">
      <!-- Header Preview Modal (Hidden on Print) -->
      <div class="auth-sheet-modal-header no-print" style="padding:14px 22px;border-bottom:1px solid var(--line);background:var(--panel-strong);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="card-icon-wrap" style="width:34px;height:34px;border-radius:9px;background:rgba(63,90,68,0.12);color:var(--accent);display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3 class="voice" style="margin:0;font-size:16px;color:var(--ink);">Pratinjau Lembar Otorisasi Pelatihan</h3>
            <span style="font-size:12px;color:var(--ink-soft);">Format resmi siap cetak / simpan ke PDF A4</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="btn-primary" onclick="printAuthSheet()" style="gap:7px;font-size:13px;padding:8px 16px;background:var(--moss);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Cetak / Simpan PDF</span>
          </button>
          <button type="button" class="modal-close" onclick="closeAuthSheetModal()" aria-label="Tutup pratinjau">&times;</button>
        </div>
      </div>
      <!-- Scrollable Preview Viewport -->
      <div class="auth-sheet-modal-body" style="flex:1;overflow-y:auto;padding:24px 20px;background:#E8EAE6;display:flex;justify-content:center;">
        <!-- The Printable Document Container -->
        <div id="authSheetPrintArea" class="auth-sheet-paper"></div>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 3: Verifikasi keberadaan elemen DOM di `approval/index.html`**
  Pastikan ID `#btnOpenAuthSheet`, `#modalAuthSheetPreview`, dan `#authSheetPrintArea` ada di file.

---

### Task 2: Pure CSS Print Styles & A4 Sheet Styles di `css/style.css`

**Files:**
- Modify: `css/style.css` (tambahkan bagian `.auth-sheet-*` dan blok `@media print` komprehensif)

**Interfaces:**
- Consumes: Kelas `.auth-sheet-paper`, `.auth-sheet-header`, `.auth-sheet-meta-grid`, `.auth-sheet-table`, `.auth-sig-matrix`, `.no-print`
- Produces: Tampilan kertas A4 digital di layar (`.auth-sheet-paper`) dan isolasi total saat `window.print()` dipanggil.

- [ ] **Step 1: Tambahkan gaya visual dokumen A4 di layar (screen)**
  Tambahkan kelas styling ke `css/style.css`:
  - `.auth-sheet-paper`: Lebar 100%, `max-width: 820px`, latar belakang putih murni `#FFFFFF`, border-radius tipis `6px`, box-shadow `0 8px 30px rgba(0,0,0,0.12)`, padding `34px 40px`, warna teks `#1F2421`, jenis font `Inter, sans-serif`.
  - `.auth-sheet-header`: Flex layout antara logo/title dan cap stempel digital status.
  - `.auth-sheet-table`: Border collapse, border 1px solid `#D9DDD7`, font size 12px, cell padding `6px 10px`.
  - `.auth-sig-matrix`: Tiga kolom grid dengan border tanda tangan, baris nama, dan cap otorisasi digital.

- [ ] **Step 2: Tambahkan aturan cetak `@media print` tanpa kebocoran UI**
  Tambahkan blok cetak di akhir `css/style.css`:
  ```css
  @media print {
    /* 1. Sembunyikan semua elemen default halaman */
    body * {
      visibility: hidden !important;
    }
    .no-print,
    .tds-sidebar,
    .tds-topbar,
    .modal-overlay:not(#modalAuthSheetPreview),
    .auth-sheet-modal-header {
      display: none !important;
    }

    /* 2. Tampilkan HANYA #authSheetPrintArea */
    #modalAuthSheetPreview,
    #modalAuthSheetPreview .auth-sheet-modal-card,
    #modalAuthSheetPreview .auth-sheet-modal-body,
    #authSheetPrintArea,
    #authSheetPrintArea * {
      visibility: visible !important;
    }

    #modalAuthSheetPreview {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      display: block !important;
    }

    .auth-sheet-modal-card {
      box-shadow: none !important;
      border: none !important;
      max-width: 100% !important;
      width: 100% !important;
    }

    .auth-sheet-modal-body {
      background: transparent !important;
      padding: 0 !important;
      overflow: visible !important;
    }

    #authSheetPrintArea {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: #FFFFFF !important;
      color: #1F2421 !important;
    }

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }

    .auth-print-block,
    .auth-sheet-table tr,
    .auth-sig-matrix {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
  ```

---

### Task 3: Logic Render Dokumen & Print Event Trigger di `approval/approval.js`

**Files:**
- Modify: `approval/approval.js` (tambahkan fungsi `openAuthSheetFromCurrentReview`, `openAuthSheetModal`, `buildAuthSheetHtml`, `closeAuthSheetModal`, `printAuthSheet`)

**Interfaces:**
- Consumes: Data `currentReviewItem` atau `allSubmissions`
- Produces: Dynamic HTML injection ke `#authSheetPrintArea`, event listeners untuk tombol cetak & tutup

- [ ] **Step 1: Buat fungsi `buildAuthSheetHtml(item)`**
  Menerima objek submission `item`, menyusun data:
  - Meta profil (Nama training, ID, leader, divisi, level kemahiran, metode, lokasi, narasumber, durasi).
  - Latar belakang & tujuan terukur (`Purpose` & `Goals`).
  - Tabel modul (No, Judul Modul, Tanggal, Jam, Durasi, Fasilitator).
  - Tabel peserta (No, Nama, Email, Departemen).
  - Tabel rincian anggaran (Item biaya, estimasi, budget disetujui).
  - Matriks tanda tangan digital 3 pihak: Pengaju, Direct Supervisor, Approver (dengan status stempel `APPROVED` / `PENDING` / `REJECTED`, timestamp keputusan, dan QR Code keabsahan via `api.qrserver.com` dengan data verifikasi).
  - Catatan kaki audit resmi.

- [ ] **Step 2: Buat fungsi `openAuthSheetModal(trainingId)` & `openAuthSheetFromCurrentReview()`**
  - Mengambil data proposal dari ID yang diberikan (atau dari submission aktif di modal review).
  - Merender HTML ke `document.getElementById('authSheetPrintArea')`.
  - Menampilkan modal `#modalAuthSheetPreview` (`style.display = 'flex'`).
  - Menambahkan event listener keyboard `Esc` untuk menutup modal.

- [ ] **Step 3: Buat fungsi `closeAuthSheetModal()` & `printAuthSheet()`**
  - `closeAuthSheetModal()`: menyembunyikan modal `#modalAuthSheetPreview`.
  - `printAuthSheet()`: memanggil `window.print()`.

- [ ] **Step 4: Ekspor fungsi ke window**
  Tambahkan:
  ```javascript
  window.openAuthSheetModal = openAuthSheetModal;
  window.openAuthSheetFromCurrentReview = openAuthSheetFromCurrentReview;
  window.closeAuthSheetModal = closeAuthSheetModal;
  window.printAuthSheet = printAuthSheet;
  ```

---

### Task 4: Uji Integrasi, Paritas & Verifikasi Repository

**Files:**
- Verify: `approval/index.html`
- Verify: `approval/approval.js`
- Verify: `css/style.css`
- Run: `scripts/verify.ps1`

- [ ] **Step 1: Jalankan skrip verifikasi integritas repository**
  Jalankan perintah PowerShell:
  `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1`
  Harus menghasilkan: `[SUCCESS] Seluruh uji verifikasi integrasi LOLOS DENGAN SEMPURNA!`

- [ ] **Step 2: Lakukan visual & functional smoke test**
  - Verifikasi pembukaan modal detail review -> klik tombol "Lembar Otorisasi (PDF)".
  - Pastikan modal preview terbuka dengan lembar dokumen berformat A4 lengkap (kop, profil, sasaran, modul, peserta, biaya, tanda tangan, QR).
  - Verifikasi tombol "Cetak / Simpan PDF" memanggil `window.print()` dan modal dapat ditutup dengan tombol tutup atau tombol `Esc`.
