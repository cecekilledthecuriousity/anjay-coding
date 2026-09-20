# Spesifikasi Desain: Halaman Approval Dashboard & Clean URL Routing (Vercel)

- **Tanggal**: 2026-09-20
- **Status**: Disetujui
- **Proyek**: Formulir Pengajuan Training Karyawan (Internal Plan)
- **Target Deployment**: Vercel & Google Apps Script Backend

---

## 1. 🎯 Latar Belakang & Tujuan

Saat ini sistem telah memiliki formulir pengajuan training berbasis stepper 4 langkah (`index.html`) yang tersinkronisasi ke Google Spreadsheet (`google-apps-script.js`). Namun untuk proses verifikasi dan approval oleh tim Leader/HR/Management:
1. Belum ada halaman terpisah khusus approver yang terisolasi dari formulir pengajuan.
2. Pengguna menginginkan URL bersih (*clean URL*) tanpa ekstensi file seperti `.html` (misal: `/` untuk formulir dan `/approval` untuk approval dashboard).
3. Diperlukan autentikasi Master PIN/Password untuk mengamankan akses data training perusahaan.
4. Diperlukan mekanisme aksi approval (*Approve* / *Reject*) yang secara langsung memperbarui status di Google Spreadsheet dan mengirimkan email notifikasi resmi otomatis ke pengaju training.

---

## 2. 🏛️ Arsitektur Sistem & Struktur File

### 2.1 Struktur Direktori Proyek
```text
anjay-coding/
├── index.html                   # Form pengajuan training karyawan (URL: /)
├── training_internal_plan.html  # Mirror identik index.html (sesuai rulebook)
├── approval/
│   ├── index.html               # Halaman antarmuka Approval Dashboard (URL: /approval)
│   └── approval.js              # Logika frontend approval (auth PIN, live sync, aksi approve/reject)
├── css/
│   └── style.css                # Desain visual global (Earth tone palette, mobile anti-collision)
├── google-apps-script.js        # Backend Apps Script (Spreadsheet, Calendar, & Email Dispatcher)
├── vercel.json                  # Konfigurasi clean URLs & rewrites Vercel
├── GEMINI.md                    # Rulebook & guideline proyek
└── docs/
    └── superpowers/specs/
        └── 2026-09-20-approval-dashboard-clean-urls-design.md
```

### 2.2 Konfigurasi Clean URL (`vercel.json`)
File `vercel.json` dikonfigurasi untuk memastikan Vercel menyajikan halaman tanpa ekstensi `.html` dan menangani routing ke folder `approval/`:
```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```
* Akses `https://<project-name>.vercel.app/` otomatis merender `index.html`.
* Akses `https://<project-name>.vercel.app/approval` otomatis merender `approval/index.html` tanpa menampilkan file `.html`.

---

## 3. 🎨 Desain Antarmuka & Alur Pengguna (UI/UX)

### 3.1 Desain Visual
* Mengikuti aturan global di `css/style.css` dan `GEMINI.md`:
  * Palet warna: *Deep Forest Moss (`#3F5A44`), Earth Ink (`#1F2421`), Sand Panel (`#FAF9F5`), Accent Gold (`#B78628`), Danger Soft (`#D9534F`), Approved Soft (`#2E7D32`)*.
  * Line icons: Menggunakan clean inline SVG (`stroke-width="1.8"`), tanpa emoji.
  * Mobile Anti-Collision: Grid otomatis beralih ke 1 kolom di layar `<= 768px`, tabel dibungkus `.tbl-wrap` dengan horizontal scroll ramah sentuhan.

### 3.2 State 1: Layar Autentikasi (PIN Gate)
* Muncul saat approver mengakses `/approval` jika sesi belum dibuka.
* Input PIN admin (default: `ubahpin123`, tersimpan dan dapat disesuaikan).
* Validasi instan:
  * Jika benar: Status login disimpan di `sessionStorage.setItem('approval_authenticated', 'true')` dan dashboard langsung ditampilkan.
  * Jika salah: Menampilkan pesan kesalahan merah dan animasi getar (*shake*).

### 3.3 State 2: Main Approval Dashboard
1. **Header & Toolbar**:
   * Judul: *"Training Approval Dashboard"*.
   * Tombol *"Refresh Data"* dengan ikon pemutar untuk mengambil data terkini dari Google Sheets.
   * Tombol *"Kunci Sesi / Logout"* untuk mengakhiri sesi autentikasi.
2. **Kartu Metrik (KPI Overview)**:
   * *Total Pengajuan*: Akumulasi seluruh pengajuan training.
   * *Menunggu Approval*: Jumlah training dengan status "Diajukan" / "Pending".
   * *Disetujui*: Jumlah training yang telah disetujui.
   * *Ditolak*: Jumlah training yang ditolak atau butuh revisi.
3. **Filter & Pencarian**:
   * Filter Tab: `Semua`, `Menunggu Approval`, `Disetujui`, `Ditolak`.
   * Input Pencarian Cepat: Real-time search berdasarkan ID training, nama training, nama pengaju, dan departemen.
4. **Tabel Pengajuan**:
   * Kolom:
     * `ID Training`
     * `Tanggal Pengajuan`
     * `Nama Training & Kategori`
     * `Pengaju & Divisi`
     * `Jadwal Pelaksanaan`
     * `Budget / Estimasi Biaya`
     * `Status` (Badge pill: Kuning / Hijau / Merah)
     * `Aksi` (Tombol "Tinjau Dokumen")

### 3.4 Modal / Drawer Tinjau Dokumen & Panel Aksi Approver
Saat baris diklik atau tombol "Tinjau Dokumen" ditekan, modal detail menampilkan:
* **Detail Pelatihan**: ID, Nama, Kategori, Level Kemahiran, Metode, Venue/Link Meeting, Trainer.
* **Tujuan & Silabus**: Purpose, Goals, dan link klik langsung ke silabus Google Drive.
* **Daftar Peserta & Modul**: Jumlah peserta terdaftar serta jadwal sesi modul.
* **Biaya & Anggaran**: Rincian fee trainer, konsumsi, materi, venue, dan total budget.
* **Form Keputusan Approver**:
  * Input: *Nama Approver* (wajib diisi, misal: "Duta TnD / Budi HR").
  * Textarea: *Catatan / Catatan Revisi Approver* (opsional untuk persetujuan, wajib untuk penolakan).
  * Tombol Aksi:
    * **[Setujui Training]** (Warna Moss Green): Menandai status `Disetujui`, mencatat tanggal & approver, dan mengirim email persetujuan ke pengaju.
    * **[Tolak Training]** (Warna Danger Soft): Menandai status `Ditolak`, mencatat alasan penolakan, dan mengirim email penjelasan ke pengaju.

---

## 4. ⚡ Spesifikasi Backend Google Apps Script (`google-apps-script.js`)

### 4.1 Endpoint Pembacaan Data (`doGet`)
Memodifikasi `doGet(e)` agar mengembalikan daftar seluruh baris data dari sheet `"Training Submissions"` dalam format JSON terstruktur:
* Response payload:
  ```json
  [
    {
      "id": "TRN-2026-001",
      "submittedAt": "2026-09-20 10:00:00",
      "namaTraining": "Workshop Golang Backend",
      "pengaju": "Budi Santoso",
      "emailPengaju": "budi@perusahaan.com",
      "departemen": "WEB DEVELOPER",
      "kategori": "Technical / IT",
      "level": "Intermediate",
      "metode": "Online",
      "jadwal": "2026-09-21, 09:00 - 15:00 WIB",
      "venue": "Google Meet",
      "trainer": "Duta TnD",
      "durasi": "6 Jam",
      "budget": "Rp 3.500.000",
      "linkSilabus": "https://drive.google.com/...",
      "peserta": [ ... ],
      "status": "Diajukan",
      "approver": "",
      "approvalDate": "",
      "approvalNotes": ""
    }
  ]
  ```

### 4.2 Endpoint Aksi Approval (`doPost`)
Menambahkan penanganan request approval pada `doPost(e)`:
* Payload request:
  ```json
  {
    "action": "update_approval",
    "id": "TRN-2026-001",
    "status": "Disetujui", // atau "Ditolak"
    "approverName": "Budi HR",
    "notes": "Silakan dilanjutkan koordinasi room meeting."
  }
  ```
* Logika eksekusi:
  1. Mencari baris pada sheet `"Training Submissions"` dengan kolom `ID Training` yang cocok.
  2. Memperbarui kolom `Status Dokumen` menjadi nilai status baru.
  3. Mencatat nama approver dan timestamp waktu approval.
  4. Menyimpan catatan approver pada kolom terkait.
  5. Memanggil fungsi pengiriman email notifikasi keputusan: `sendApprovalDecisionEmail()`.

### 4.3 Email Dispatcher Hasil Approval (`sendApprovalDecisionEmail`)
* Penerima: Email pengaju training (`Leader pengaju` / `email pengaju`).
* Subject:
  * Jika disetujui: `[DISETUJUI] Pengajuan Training: {Nama Training} ({ID})`
  * Jika ditolak: `[DITOLAK] Pengajuan Training: {Nama Training} ({ID})`
* Format Email: Desain HTML responsif bernuansa Earth Tone dengan indikator status jelas, rincian training, catatan approver, dan panduan langkah selanjutnya.

---

## 5. 🔒 Keamanan & Penanganan Kesalahan (Reliability)

1. **Fallback Offline / Local Storage**: Jika koneksi ke Google Apps Script mengalami kendala, data lokal yang tersimpan di browser tetap dapat diakses dengan indikator status offline.
2. **CORS Safe & No-Cors Fallback**: Menangani request secara aman menggunakan standar `fetch` Web API modern dengan feedback toast indikator status pengiriman.
3. **Session Auto-lock**: Approver dapat mengunci sesi kapan saja menggunakan tombol Logout untuk menjaga privasi dokumen training.

---

## 6. 📋 Rencana Pengujian & Verifikasi

1. **Validasi Sintaksis**: Menjalankan `node -c approval/approval.js` dan `node -c google-apps-script.js` untuk memastikan tidak ada kesalahan sintaks JavaScript.
2. **Pengujian Clean URL di Vercel**: Memastikan `vercel.json` valid dan rute `/` maupun `/approval` dapat disajikan tanpa error 404.
3. **Sinkronisasi File Mirror**: Memastikan konsistensi `index.html` dan `training_internal_plan.html`.
4. **Verifikasi Alur UI**:
   - Membuka `/approval` -> Verifikasi PIN input gate.
   - Login PIN -> Menampilkan KPI, tabel data, filter status, dan search.
   - Klik "Tinjau Dokumen" -> Muncul modal detail lengkap.
   - Klik "Setujui" / "Tolak" -> Status terupdate dan notifikasi toast muncul.
