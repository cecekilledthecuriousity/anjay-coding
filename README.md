# Formulir Training Karyawan (Internal Plan)

Aplikasi web formulir pengajuan training karyawan internal yang modern, interaktif, rapi, responsif (Mobile & Desktop), dan siap di-deploy langsung ke **Vercel** dengan penyimpanan otomatis ke **Google Spreadsheet**.

---

## 📁 Struktur File Proyek

```text
form-training/
├── index.html                  # File HTML utama (4-step stepper wizard, entry point Vercel)
├── training_internal_plan.html # File backup/mirror identik dengan index.html
├── css/
│   └── style.css               # Styling murni (Pure CSS, custom SVG dropdown, anti-collision mobile)
├── js/
│   └── app.js                  # Logika wizard, auto-calculate, quick paste Excel, & Sheet sync
├── google-apps-script.js       # Backend Google Apps Script (headers & row mapper lengkap)
└── README.md                   # Dokumentasi teknis dan panduan penggunaan
```

---

## 🌟 Fitur Unggulan & Penyempurnaan

1. **Desain Stepper 4-Tahap yang Interaktif**:
   - **Langkah 1: Profil & Sasaran**: Auto ID Training (`TRN-2026-XXX`), Leader pengaju, Departemen dropdown dinamis (+ opsi ketik divisi kustom), Target Level Kemahiran (chips: *Beginner / Intermediate / Advanced*), Purpose, Goals, Prasyarat peserta, Sertifikasi/Output, dan Tautan Silabus/Materi (Google Drive).
   - **Langkah 2: Pelaksanaan & Peserta**: Metode kartu (*Onsite / Online / Hybrid / On-the-job*), Platform online (*Google Meet, Zoom, Teams*) & tautan meeting URL, Jadwal picker (tanggal & jam mulai-selesai), kalkulator durasi otomatis, Tabel Modul Pelatihan, dan Tabel Peserta terintegrasi fitur **"Quick Paste dari Excel"**.
   - **Langkah 3: Biaya & Evaluasi**: Rincian sub-biaya (*Fee Trainer, Konsumsi/Catering, Materi/Sertifikat, Venue/Sewa Alat*), akumulasi otomatis ke Estimasi Biaya, Budget Disetujui, Actual Spend, perhitungan selisih hemat/over budget real-time, serta sasaran KPI evaluasi.
   - **Langkah 4: Review & Approval**: Live Executive Summary preview sebelum submit, dan hierarki approval bertingkat yang dapat ditambah secara dinamis.

2. **Mobile & Desktop Anti-Collision Design**:
   - Didesain secara presisi menggunakan **Pure Vanilla CSS** tanpa bergantung pada framework berat (seperti Bootstrap).
   - Pada layar smartphone/mobile, grid multi-kolom otomatis beralih menjadi 1 kolom (`1fr`) dengan `min-width: 0`, memastikan **sama sekali tidak ada teks yang terpotong atau bertumpuk**.
   - Tabel panjang dilengkapi horizontal swipe yang ramah sentuhan dengan ukuran baris yang proporsional.

3. **Modern Clean Line SVGs (Tanpa Icon Google Default / Emoji)**:
   - Menggunakan icon line SVG inline berkualitas tinggi bergaya Lucide/Feather yang tajam, elegan, dan ringan.
   - Dropdown menggunakan custom chevron SVG elegan, menghilangkan dropdown panah bawaan OS yang kaku.

4. **Fitur "Quick Paste dari Excel"**:
   - Memudahkan panitia meng-copy langsung puluhan nama peserta dari Excel / Google Sheet / WhatsApp lalu menempelkannya dalam sekali klik ke tabel peserta.

---

## 🚀 1. Cara Deploy ke Vercel

Karena aplikasi ini adalah web statis murni tanpa proses build kompleks (`npm run build`), Anda dapat langsung mendeploy ke Vercel:

### Opsi A: Via GitHub (Rekomendasi)
1. Push repository ini ke akun GitHub Anda.
2. Buka [vercel.com](https://vercel.com) > **"Add New..."** > **"Project"**.
3. Pilih repository Anda, lalu klik **"Deploy"**.
4. Website langsung aktif dan siap digunakan oleh tim di mana saja.

### Opsi B: Via Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 📊 2. Integrasi Google Spreadsheet & Email Dispatcher

URL Google Apps Script Web App sudah diatur di dalam [`js/app.js`](./js/app.js):
```javascript
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_3OrTUdwweTOHFYTR4KMdq06HQTjub54z_Cae4q6ZN26YlW0DLwpovd2ggE2G8Pxb/exec";
```

### Fitur Otomasi Backend yang Disediakan:
1. **Penyimpanan Spreadsheet Otomatis**: Setiap pengajuan formulir akan langsung tercatat rapi pada sheet **"Training Submissions"**.
2. **Email Konfirmasi Instan**: Mengirim email berformat HTML profesional ke setiap peserta yang didaftarkan (lengkap dengan info topik, jadwal, lokasi/link meeting, dan silabus).
3. **Google Calendar Auto-Invite**: Otomatis membuat jadwal di Google Calendar dan mengundang email peserta (sehingga peserta mendapat notifikasi bawaan kalender di smartphone/laptop).
4. **Automated Daily Reminder Scheduler (H-1)**: Trigger otomatis jam 08:00 WIB yang memindai spreadsheet dan mengirimkan email pengingat bagi pelatihan yang akan diadakan besok hari.

### Langkah Update Kode di Google Apps Script:
1. Buka Google Sheet Anda yang terhubung dengan form.
2. Buka menu **Extensions** (Ekstensi) > **Apps Script**.
3. Salin seluruh kode terbaru dari file [`google-apps-script.js`](./google-apps-script.js) dan tempelkan (timpa) di editor Apps Script.
4. Klik tombol **Save** (disket).
5. **Aktifkan Scheduler Reminder Otomatis**:
   - Pada dropdown fungsi di toolbar atas Apps Script, pilih fungsi **`setupDailyReminderTrigger`**.
   - Klik tombol **Run** (Jalankan) sekali.
   - Izinkan hak akses (OAuth Permission) akun Google Anda saat diminta.
   - Scheduler harian jam 08:00 WIB sekarang telah aktif otomatis!
6. **Deploy Versi Terbaru**:
   - Klik tombol biru **Deploy** > **Manage deployments**.
   - Klik ikon **Pensil (Edit)**.
   - Pada opsi Version, pilih: **"New version"**.
   - Klik tombol **Deploy**.

---

## 📋 3. Format Quick Paste Peserta dari Excel

Pada Langkah 2 (Pelaksanaan & Peserta), Anda dapat menyalin data peserta langsung dari Excel / Google Sheet / WhatsApp dan menempelkannya ke modal **"Quick Paste dari Excel"**. Format yang didukung:
- 3 Kolom: `Nama Karyawan [TAB] Email Karyawan [TAB] Departemen`
- Format Teks: `Nama Karyawan, email@perusahaan.com, Departemen`
- Sistem secara cerdas akan mendeteksi email jika terdapat simbol `@`. Jika departemen tidak dicantumkan, sistem otomatis menggunakan departemen pengaju training.

---

## 🔐 4. Akses Master Data & Riwayat (Manual Link & Terproteksi Password)

Halaman formulir sengaja dibuat bersih (*clean*) tanpa tombol navigasi master data publik. Untuk mengakses halaman Master Data & Riwayat:
1. Ketikkan hash `#master` atau `#admin` di akhir URL browser Anda:
   - Contoh Lokal: `http://localhost:3000/#master` atau `file:///.../index.html#master`
   - Contoh Vercel: `https://nama-proyek.vercel.app/#master` (atau `/#admin`)
2. Sistem akan otomatis menampilkan pop-up keamanan PIN Admin.
3. Masukkan PIN admin: `ubahpin123` (default, dapat diubah di konstanta `DEFAULT_ADMIN_PIN` pada [`js/app.js`](./js/app.js)).
4. Setelah masuk:
   - Anda dapat melihat seluruh riwayat submission yang tersimpan.
   - Tersedia tombol **Export CSV** untuk mendownload data.
   - Tersedia tombol **Kunci** untuk mengunci kembali sesi admin.
   - Tersedia tombol **Kembali ke Form** untuk kembali ke formulir utama yang bersih.
