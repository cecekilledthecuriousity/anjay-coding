# Approval Dashboard & Clean URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun halaman dashboard approval terpisah (`/approval`) dengan sistem autentikasi Master PIN, live sync Google Spreadsheet, aksi approve/reject disertai notifikasi email otomatis ke pengaju, dan konfigurasi Clean URL di Vercel.

**Architecture:** Menggunakan arsitektur multi-halaman modular berbasis folder (`approval/index.html` & `approval/approval.js`) yang diakses sebagai URL bersih (`/approval`) melalui konfigurasi `vercel.json`. Dashboard berkomunikasi dua arah dengan Google Apps Script (`doGet` untuk fetching data pengajuan real-time dan `doPost` dengan action `update_approval` untuk mencatat keputusan serta mendispatch email hasil persetujuan).

**Tech Stack:** Pure Vanilla HTML5, Pure Vanilla CSS3 (Earth Tone Design System), Pure Vanilla JavaScript (ES6+), Google Apps Script (SpreadsheetApp, GmailApp), Vercel Routing.

**Spec:** [docs/superpowers/specs/2026-09-20-approval-dashboard-clean-urls-design.md](file:///C:/duta/tools_duta/anjay-coding/docs/superpowers/specs/2026-09-20-approval-dashboard-clean-urls-design.md)

## Global Constraints
- Jangan melakukan `git commit` tanpa izin eksplisit dari user (sesuai `GEMINI.md`).
- File `index.html` dan `training_internal_plan.html` harus selalu dijaga identik dan konsisten.
- Seluruh ikon UI wajib menggunakan inline Line SVG (`stroke-width="1.8"`), tanpa emoji.
- Desain antarmuka wajib menerapkan mobile anti-collision (`css/style.css`).
- Validasi sintaksis wajib lolos: `node -c approval/approval.js` dan `node -c google-apps-script.js`.

---

### Task 1: Vercel Clean URL Routing Configuration

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Produces: Konfigurasi routing Vercel agar rute `/` membuka `index.html` dan rute `/approval` membuka `approval/index.html` tanpa ekstensi file.

- [ ] **Step 1: Buat file `vercel.json`**
```json
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false,
  "routes": [
    {
      "src": "/approval",
      "dest": "/approval/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

- [ ] **Step 2: Verifikasi format JSON `vercel.json`**
Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('vercel.json valid!')"`
Expected: `vercel.json valid!`

---

### Task 2: Backend Google Apps Script (`google-apps-script.js`) Enhancement

**Files:**
- Modify: `google-apps-script.js`

**Interfaces:**
- Consumes: Google Sheets `"Training Submissions"`
- Produces:
  - `doGet(e)`: Mengembalikan array objek submission terstruktur JSON.
  - `doPost(e)`: Menangani `action === "update_approval"` untuk mengupdate status, approver, tanggal approval, dan catatan di spreadsheet.
  - `sendApprovalDecisionEmail(details, status, approverName, notes)`: Mengirim email HTML responsif ke pengaju.

- [ ] **Step 1: Implementasikan pembacaan data terstruktur di `doGet(e)`**
Perbarui `doGet(e)` pada `google-apps-script.js` agar membaca baris header dan memetakan setiap baris data menjadi objek JSON lengkap:
```javascript
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    const headers = values[0].map(h => String(h).trim());
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const obj = {};
      headers.forEach((h, colIdx) => {
        obj[h] = row[colIdx];
      });
      submissions.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify(submissions)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 2: Tambahkan fungsi `sendApprovalDecisionEmail` dan handler `update_approval` di `doPost(e)`**
Tambahkan logika pendeteksi `data.action === 'update_approval'` di awal `doPost(e)`:
- Mencari baris data berdasarkan `ID Training`.
- Mengupdate kolom `Status Dokumen`, kolom `Approver`, `Tanggal Approval`, dan `Catatan Approver`.
- Mengirim email konfirmasi ke email pengaju dengan kartu status HTML responsif.

- [ ] **Step 3: Jalankan verifikasi sintaksis Apps Script**
Run: `node -c google-apps-script.js`
Expected: Return code 0 tanpa error sintaks.

---

### Task 3: Desain & Tampilan Dashboard Approval (`approval/index.html`)

**Files:**
- Create: `approval/index.html`

**Interfaces:**
- Consumes: `../css/style.css`
- Produces: Antarmuka State 1 (Login Gate PIN) dan State 2 (Main Approval Dashboard & Detail Modal).

- [ ] **Step 1: Buat struktur HTML `approval/index.html`**
Berisi:
- `<div id="loginGate">`: Kartu Sand Panel terpusat dengan input Master PIN (`#approvalPinInput`), tombol `Masuk`, dan pesan error.
- `<div id="dashboardView" style="display:none;">`:
  - Toolbar atas: Judul *"Training Approval Portal"*, indikator waktu sinkronisasi, tombol Refresh Data (`#btnRefreshData`), dan tombol Logout (`#btnLogout`).
  - Baris KPI:
    - Total Pengajuan (`#kpiTotal`)
    - Menunggu Approval (`#kpiPending`)
    - Disetujui (`#kpiApproved`)
    - Ditolak (`#kpiRejected`)
  - Toolbar Pencarian & Filter:
    - Tab filter: `Semua` (`#tabAll`), `Menunggu Approval` (`#tabPending`), `Disetujui` (`#tabApproved`), `Ditolak` (`#tabRejected`).
    - Search input instan: `#approvalSearchInput`.
  - Tabel Pengajuan (`.tbl-wrap`):
    - `#approvalTable` dengan kolom ID, Pengajuan, Nama Training, Pengaju & Divisi, Jadwal, Budget, Status, Aksi.
    - Placeholder empty state (`#approvalEmptyState`).
  - Modal Tinjau Dokumen (`#modalReviewApproval`):
    - Header modal dengan ID training dan status pill.
    - Grid ringkasan informasi dokumen (Detail Training, Trainer, Jadwal, Venue, Silabus, Peserta, Modul, Biaya).
    - Form aksi approver:
      - Field input Nama Approver (`#approverNameInput`).
      - Textarea Catatan Approver (`#approverNotesInput`).
      - Tombol aksi: `#btnApproveAction` (Hijau) dan `#btnRejectAction` (Merah).
- Kontainer Toast Notifikasi (`#toastContainer`).

- [ ] **Step 2: Verifikasi keterkaitan aset dan inline SVG**
Pastikan link CSS mengarah ke `../css/style.css` dan seluruh ikon SVG menggunakan standar `stroke-width="1.8"`.

---

### Task 4: Logika Frontend Approval Dashboard (`approval/approval.js`)

**Files:**
- Create: `approval/approval.js`

**Interfaces:**
- Consumes: Google Apps Script Web App URL (`GOOGLE_SCRIPT_URL`), `localStorage` (`training_submissions_master`), dan `sessionStorage` (`approval_auth_token`).
- Produces: Logika interaktif login PIN, live data fetching, filter status, pencarian, render tabel, render modal detail, dan dispatch aksi approval.

- [ ] **Step 1: Implementasikan sistem autentikasi Master PIN**
- PIN default `ubahpin123`.
- Validasi input PIN, simpan token di `sessionStorage.setItem('approval_logged_in', 'true')`.
- Otomatis membuka dashboard jika token sudah ada saat halaman dimuat.
- Fungsi logout untuk mengunci kembali dashboard.

- [ ] **Step 2: Implementasikan data fetching (`fetchSubmissions`)**
- Melakukan fetch ke Google Apps Script Web App (`doGet`).
- Jika jaringan offline atau fetch gagal, membaca data cadangan dari `localStorage.getItem('training_submissions_master')`.
- Menyimpan hasil ke variabel `allSubmissions`.
- Memanggil fungsi kalkulasi KPI dan render tabel.

- [ ] **Step 3: Implementasikan filter status, pencarian, dan render tabel**
- Filter tab (`all`, `pending`, `approved`, `rejected`).
- Real-time search query pada ID training, nama training, pengaju, divisi.
- Render tabel dengan tombol "Tinjau Dokumen" pada setiap baris.

- [ ] **Step 4: Implementasikan Modal Detail & Aksi Approve/Reject**
- Mengisi modal review saat tombol tinjau diklik.
- Handler tombol `Setujui`:
  - Validasi nama approver.
  - Mengirim POST ke Google Apps Script dengan body `{ action: 'update_approval', id, status: 'Disetujui', approverName, notes }`.
  - Update status lokal, perbarui tampilan tabel dan KPI, tampilkan toast sukses.
- Handler tombol `Tolak`:
  - Validasi nama approver & catatan penolakan.
  - Mengirim POST ke Google Apps Script dengan status `'Ditolak'`.
  - Update status lokal, perbarui tampilan tabel dan KPI, tampilkan toast info.

- [ ] **Step 5: Jalankan verifikasi sintaksis JavaScript**
Run: `node -c approval/approval.js`
Expected: Return code 0 tanpa error.

---

### Task 5: Sinkronisasi Tautan Navigasi & File Mirror

**Files:**
- Modify: `index.html`
- Modify: `training_internal_plan.html`

**Interfaces:**
- Consumes: URL rute `/approval`
- Produces: Navigasi cepat dari form utama menuju portal approval bagi para leader/approver.

- [ ] **Step 1: Tambahkan link akses portal approval pada header/toolbar `index.html`**
Tambahkan tombol/tautan elegan menuju `/approval` di bagian header formulir untuk mempermudah approver berpindah halaman.

- [ ] **Step 2: Sinkronkan perubahan ke `training_internal_plan.html`**
Pastikan `training_internal_plan.html` dan `index.html` tetap 100% identik sesuai aturan proyek.

---

### Task 6: Verifikasi Menyeluruh & Testing

**Files:**
- Verify: `vercel.json`, `approval/index.html`, `approval/approval.js`, `google-apps-script.js`, `index.html`, `training_internal_plan.html`

- [ ] **Step 1: Uji seluruh file JavaScript dengan linter/compiler node**
Run: `node -c approval/approval.js && node -c google-apps-script.js && node -c js/app.js`
Expected: Seluruh file lulus validasi sintaksis.

- [ ] **Step 2: Verifikasi konsistensi `index.html` dan `training_internal_plan.html`**
Run: `powershell -Command "if ((Get-FileHash index.html).Hash -eq (Get-FileHash training_internal_plan.html).Hash) { Write-Host 'MATCH' } else { Write-Host 'MISMATCH' }"`
Expected: `MATCH`

- [ ] **Step 3: Uji simulasi alur approval secara lokal**
Buka `approval/index.html` di browser lokal untuk memastikan:
1. Layar login PIN muncul dan berfungsi membuka dashboard.
2. KPI terhitung dengan benar dari data tersimpan.
3. Filter dan pencarian responsif.
4. Modal tinjau dokumen menampilkan rincian dan tombol aksi bekerja dengan baik.
