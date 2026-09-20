# GEMINI.md - Context & Rulebook Proyek Formulir Training Karyawan

Dokumen ini adalah acuan utama bagi AI assistant (Antigravity, Gemini CLI, Claude Code, dll.) dalam memahami arsitektur, filosofi desain, struktur data, dan aturan pengembangan pada repositori ini.

---

## 1. 📌 Ikhtisar Proyek (Project Overview)

Proyek ini adalah **Aplikasi Web Formulir Pengajuan Training Karyawan (Internal Plan)** yang modern, responsif, dan terintegrasi langsung dengan **Google Spreadsheet & Email Dispatcher**.

* **Tujuan Utama**: Memudahkan leader/HR mengajukan pelatihan karyawan, menghitung durasi dan anggaran otomatis, mencatat data ke Google Sheets, mengirim email konfirmasi pendaftaran instan ke setiap peserta, serta menjadwalkan email reminder otomatis H-1 sebelum training dimulai.
* **Hosting**: Siap di-deploy langsung ke **Vercel** atau server web statis lainnya tanpa proses build (`npm run build`).

---

## 2. 🛠️ Tech Stack & Prinsip Desain (Core Philosophies)

1. **Pure Vanilla JavaScript (`js/app.js`)**:
   * Tidak menggunakan framework berat (React, Vue, Angular, jQuery).
   * Seluruh DOM manipulation, reactive calculations, dan stepper navigation murni menggunakan Vanilla JS modern (ES6+).
2. **Pure Vanilla CSS (`css/style.css`)**:
   * Desain kustom berkelas dengan palet warna earthy modern: *Deep Forest Moss (`#3F5A44`), Earth Ink (`#1F2421`), Sand Panel (`#FAF9F5`), Accent Gold (`#B78628`)*.
   * **Mobile Anti-Collision Design**: Pada layar mobile (`max-width: 768px`), seluruh grid multi-kolom otomatis beralih menjadi 1 kolom (`1fr`) dengan `min-width: 0`. Tabel panjang dibungkus dalam `.tbl-wrap` dengan horizontal scroll yang ramah sentuhan. Sama sekali tidak boleh ada teks yang terpotong atau tumpang tindih.
3. **Clean Inline Line SVGs (Bukan Emoji / Google Icons Default)**:
   * Menggunakan inline SVG bergaya Lucide / Feather dengan `stroke-width="1.75"` atau `1.8`.
   * Hindari penggunaan karakter emoji sebagai ikon antarmuka tombol/kartu.
4. **Sinkronisasi File Mirror**:
   * File `index.html` dan `training_internal_plan.html` harus selalu dijaga identik/sinkron.

---

## 3. 📂 Struktur File Utama

```text
anjay-coding/
├── index.html                  # Entry point utama (4-step stepper wizard)
├── training_internal_plan.html # File backup/mirror identik index.html
├── css/
│   └── style.css               # Styling pure CSS responsif anti-collision
├── js/
│   └── app.js                  # Logika wizard, quick paste, auto-calc, sheet sync
├── google-apps-script.js       # Backend Apps Script (Spreadsheet, Email, Calendar, Scheduler)
├── README.md                   # Dokumentasi teknis & panduan deployment
├── GEMINI.md                   # Rulebook & context master AI ini
└── .agents/
    └── skills/                 # Skills modular untuk otomatisasi AI
        ├── gas-spreadsheet-automation/SKILL.md
        └── vanilla-form-wizard/SKILL.md
```

---

## 4. 🔄 Alur Kerja Stepper & Struktur Data

Formulir terdiri dari 4 tahapan stepper wizard:
* **Langkah 1: Profil & Sasaran**: ID Training (`TRN-YYYY-XXX`), Nama Pelatihan, Leader Pengaju, Departemen (+ opsi custom), Level Kemahiran (Chips: Beginner/Intermediate/Advanced), Purpose, Goals, Prasyarat, Output Sertifikasi, dan Link Silabus Drive.
* **Langkah 2: Pelaksanaan & Peserta**: Metode (Onsite/Online/Hybrid), Detail Link Meeting Online, Jadwal & Jam, Tabel Modul (dengan kalkulasi durasi otomatis), dan Tabel Peserta (Nama, Email, Departemen) terintegrasi fitur **Quick Paste dari Excel**.
* **Langkah 3: Biaya & Evaluasi**: Breakdown biaya (Fee Trainer, Konsumsi, Materi, Venue), akumulasi otomatis, budget disetujui, dan KPI Evaluasi.
* **Langkah 4: Review & Approval**: Live summary executive card dan approval workflow dinamis.

### Format Objek Data (`collectFormData`):
```javascript
{
  meta: {
    "ID training": "TRN-2026-001",
    "Nama training": "Workshop Golang Backend",
    "Leader pengaju": "Budi Santoso",
    "Departemen / divisi": "WEB DEVELOPER",
    "Target level kemahiran": "Intermediate",
    "Metode training": "Online",
    "Platform online": "Google Meet",
    "Link meeting online": "https://meet.google.com/...",
    "Tanggal & jam pelaksanaan": "2026-09-21, 09:00 - 15:00 WIB",
    "Lokasi / venue": "Google Meet",
    "Trainer": "Duta TnD",
    "Total durasi belajar": "6 Jam",
    "Estimasi biaya": "Rp 3.500.000",
    "Budget disetujui": "Rp 3.500.000",
    "Link silabus materi": "https://drive.google.com/..."
  },
  participants: [
    { nama: "Budi", email: "budi@perusahaan.com", departemen: "IT" }
  ],
  modules: [
    { tanggal: "2026-09-21", jamMulai: "09:00", jamSelesai: "15:00", modul: "Sesi 1", durasi: "6 Jam", pic: "Duta", metode: "Praktik", lokasi: "", deskripsi: "" }
  ],
  approvals: [
    { role: "Direct Supervisor", nama: "Manager A", tanggal: "2026-09-20" }
  ]
}
```

---

## 5. ⚡ Backend Google Apps Script (`google-apps-script.js`)

1. **Spreadsheet Target**: Sheet bernama `"Training Submissions"`. Header dibuat dan disinkronkan otomatis oleh `setupSheetHeaders(sheet)`.
2. **Email Konfirmasi Instan**: Saat form disubmit (`doPost`), fungsi `sendRegistrationEmails()` langsung mengirimkan email HTML responsif ke seluruh email peserta terdaftar via `GmailApp.sendEmail()`.
3. **Google Calendar Auto-Invite**: Fungsi `createCalendarEvent()` otomatis membuat jadwal di Google Calendar default pemilik akun, menambahkan email peserta sebagai `guests`, dan mengaktifkan notifikasi alarm kalender bawaan HP.
4. **Daily Reminder Scheduler (H-1)**:
   * Fungsi `checkAndSendReminders()` berjalan setiap hari pukul 08:00 WIB via **Time-Driven Trigger**.
   * Memindai sheet untuk jadwal pelatihan yang jatuh tempo besok hari (H-1) atau hari ini, lalu mengirimkan email pengingat HTML ke seluruh peserta.
   * Mengupdate kolom spreadsheet `"Status Email Reminder H-1"` menjadi `Terkirim (YYYY-MM-DD HH:mm)`.
   * Trigger dipasang dengan menjalankan fungsi `setupDailyReminderTrigger()` sekali dari editor Apps Script.

---

## 6. 🔐 Akses Master Data & Riwayat Lokal

* Halaman master data diproteksi password dan diakses melalui URL hash `#master` atau `#admin`.
* PIN default: `ubahpin123` (didefinisikan di konstanta `DEFAULT_ADMIN_PIN` pada [`js/app.js`](./js/app.js)).
* Menyediakan fitur KPI dashboard, kalender visual jadwal pelatihan, daftar submission, dan tombol ekspor CSV.

---

## 7. ⚠️ Aturan Bagi AI Assistant (Guidelines for Agents)

1. **Jangan Melakukan Commit Tanpa Izin**:
   * Biarkan perubahan file berada di *working tree* (uncommitted) agar pengguna dapat melakukan tinjauan dan commit sendiri, kecuali diminta secara eksplisit.
2. **Jaga Konsistensi Antara `index.html` dan `training_internal_plan.html`**:
   * Setiap kali mengubah elemen UI, tabel, atau modal di `index.html`, pastikan perubahan yang sama diterapkan ke `training_internal_plan.html`.
3. **Validasi Sintaksis Sebelum Menyatakan Selesai**:
   * Selalu jalankan `node -c js/app.js` dan `node -c google-apps-script.js` untuk memastikan tidak ada kesalahan sintaks JavaScript.
4. **Patuhi Format Quick Paste**:
   * Fitur import dari Excel harus selalu mendukung 3 kolom: `Nama [TAB] Email [TAB] Departemen` dengan auto-detection simbol `@`.
