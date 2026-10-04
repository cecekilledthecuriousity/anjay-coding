# Design Specification: Modularisasi index.html & Static Assembly System

- **Tanggal**: 2026-10-03
- **Topik**: Modularisasi `index.html` menjadi partials modular dengan Static Assembly Script
- **Status**: Disetujui (Approved via Brainstorming)
- **Target Hosting**: Vercel (Utama) & VPS Nginx/Caddy (Masa Depan)

---

## 1. Latar Belakang & Masalah
File [index.html](../../../index.html) saat ini memiliki lebih dari 2.500 baris kode yang mencakup seluruh halaman aplikasi (Sidebar, 9 Halaman SPA, puluhan inline SVG, dan 8+ Modal Dialog). Ukuran yang sangat besar ini menyulitkan pemeliharaan, pencarian kode, dan kolaborasi tim.

Tujuan utama dari arsitektur baru ini adalah:
1. Memecah `index.html` menjadi file-file kecil yang terisolasi dan mudah dibaca (< 200 baris per file).
2. Mempertahankan 100% fungsionalitas dan selektor DOM agar logika JavaScript di [js/app.js](../../../js/app.js) tetap berjalan tanpa error atau *race condition*.
3. Menyediakan alur build otomatis yang kompatibel dengan Vercel, serta dapat dirakit secara offline di Windows tanpa dependensi npm global.
4. Menjaga aturan sinkronisasi file mirror [training_internal_plan.html](../../../training_internal_plan.html) tetap otomatis.
5. Menyediakan dokumentasi panduan deploy ke VPS untuk kebutuhan masa depan.

---

## 2. Struktur Direktori Baru

```text
form-training-cece-main/
├── src/
│   ├── index.template.html          # Kerangka HTML utama & placeholder include
│   ├── components/
│   │   ├── sidebar.html             # TDS Sidebar navigasi & brand
│   │   └── sticky-bar.html          # Sticky bottom action bar
│   ├── pages/
│   │   ├── dashboard.html           # #page-dashboard (Hero & KPI Summary)
│   │   ├── ajukan-training.html     # #page-ajukan (Form wizard Step 1 - 4)
│   │   ├── skill-matrix.html        # #page-skill-matrix (Matriks kompetensi)
│   │   ├── ai-studio.html           # #page-ai-studio (AI Studio prompt & preview)
│   │   ├── kalender.html            # #page-kalender (FullCalendar & filter room)
│   │   ├── training-saya.html       # #page-training-saya (Daftar pelatihan user)
│   │   ├── vendor.html              # #page-vendor (Direktori vendor eksternal)
│   │   ├── post-training.html       # #page-post-training (Trampoline post-training)
│   │   └── portal-approval.html     # #page-portal-approval (Master view pengajuan)
│   └── modals/
│       ├── quick-paste.html         # Modal import Excel
│       ├── confirm-submit.html      # Modal preview submission sebelum submit
│       ├── skill-score.html         # Modal skor penguasaan kompetensi
│       ├── add-skill.html           # Modal penambahan kompetensi baru
│       ├── ai-skill-summary.html    # Modal TNA diagnostic rekomendasi AI
│       ├── success-submit.html      # Modal feedback sukses & info konfirmasi email
│       ├── admin-pin.html           # Modal proteksi PIN master admin
│       ├── approval-pin.html        # Modal proteksi PIN portal approval
│       ├── detail-submission.html   # Modal detail submission data
│       ├── ai-assistant.html        # Modal AI Course Architect
│       └── calendar-detail.html     # Modal detail event kalender
├── scripts/
│   ├── build.js                     # Assembler Node.js (Vercel & Linux/VPS)
│   ├── build.ps1                    # Assembler PowerShell (Windows lokal tanpa Node)
│   └── verify.js / verify.ps1       # Script validasi integritas DOM & file mirror
├── build.bat                        # Shortcut double-click build untuk Windows
├── docs/
│   ├── superpowers/specs/           # Dokumentasi spesifikasi arsitektur
│   └── vps-deployment.md            # Panduan konfigurasi Nginx/Caddy di VPS
├── index.html                       # Hasil kompilasi final (tetap di root)
├── training_internal_plan.html      # Hasil kompilasi mirror (identik index.html)
└── package.json                     # Konfigurasi npm script build Vercel
```

---

## 3. Mekanisme Assembly & Template Engine Sederhana

### 3.1 Sintaks Template (`src/index.template.html`)
Template menggunakan komentar HTML khusus yang mudah dibaca dan tidak merusak syntax highlighter HTML standar:
```html
<!-- @@include('components/sidebar.html') -->
<!-- @@include('pages/dashboard.html') -->
<!-- @@include('modals/quick-paste.html') -->
```

### 3.2 Alur Eksekusi Build
1. Membaca `src/index.template.html`.
2. Mencari seluruh pola regex `<!--\s*@@include\('([^']+)'\)\s*-->`.
3. Membaca file partial terkait dari `src/`.
4. Mengganti komentar placeholder dengan konten file asli secara rekursif/deterministik.
5. Menyimpan output gabungan ke:
   * [index.html](../../../index.html)
   * [training_internal_plan.html](../../../training_internal_plan.html)
6. Menampilkan pesan ringkas jumlah komponen yang dirakit dan ukuran file hasil akhir.

### 3.3 Multi-Platform Execution
* **Node.js (`scripts/build.js`)**:
  * Menggunakan modul standar Node.js (`fs`, `path`). Tidak membutuhkan `npm install` dependensi luar.
  * Mendukung flag `--watch` untuk memantau perubahan file di `src/` selama masa pengembangan.
* **PowerShell (`scripts/build.ps1`) & Batch (`build.bat`)**:
  * Memungkinkan developer di lingkungan Windows untuk merakit ulang file hanya dengan klik dua kali pada `build.bat`, bahkan jika Node.js belum terpasang di PATH global.

---

## 4. Alur Deployment

### 4.1 Deployment ke Vercel (Prioritas Utama)
* Disediakan [package.json](../../../package.json) dengan script:
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
* Saat dihubungkan ke Vercel:
  * Vercel akan otomatis menjalankan `npm run build` sebelum menyajikan file statis.
  * File statis di root (`index.html`, `css/`, `js/`, `favicon/`) langsung disajikan via edge network Vercel dengan kecepatan maksimal.
  * **Zero-Failure Fallback**: File `index.html` dan `training_internal_plan.html` di root juga tetap di-commit ke Git, sehingga jika build command dilewati sekalipun, Vercel tetap dapat menyajikan halaman dengan sempurna.

### 4.2 Deployment ke VPS (Catatan Panduan Masa Depan)
* Disediakan file panduan teknis [docs/vps-deployment.md](../../vps-deployment.md) yang mengulas:
  1. Setup direktori `/var/www/form-training`.
  2. Contoh blok konfigurasi Nginx untuk domain/subdomain dengan caching statis dan gzip/brotli.
  3. Contoh konfigurasi Caddy Server (auto-HTTPS 3 baris).
  4. Panduan webhook/git pull otomatis saat ada push baru ke repository.

---

## 5. Rencana Verifikasi & Uji Fungsi (Quality Assurance)

Sebelum pekerjaan dinyatakan selesai, verifikasi berikut wajib lolos 100%:

1. **DOM ID Parity Check**:
   * Script pembanding mengekstrak seluruh atribut `id="..."` dari file `index.html` sebelum dipecah, lalu membandingkannya dengan `index.html` hasil perakitan baru.
   * Jumlah ID yang hilang harus **0 (Nol)**.
2. **Include Residual Check**:
   * Memastikan tidak ada teks `@@include` yang tersisa di `index.html`.
3. **Mirror Parity Check**:
   * Memastikan konten teks `index.html` sama persis dengan `training_internal_plan.html`.
4. **Interactive Browser Checks**:
   * Navigasi sidebar (`goToPage`) ke 9 menu utama.
   * Pengisian form wizard langkah 1 s/d 4.
   * Fungsi Quick Paste Excel dan pemetaan otomatis ke baris tabel.
   * Kalkulasi durasi dan budget otomatis.
   * Pembukaan dan penutupan seluruh dialog modal.
   * Tidak ada error di browser console.

---

## 6. Self-Review Spec
- [x] **Placeholder Scan**: Tidak ada tag "TBD" atau "TODO" yang belum terjawab.
- [x] **Internal Consistency**: Seluruh nama komponen dan path file sinkron antara deskripsi teks dan skema struktur.
- [x] **Scope Check**: Terfokus pada pemecahan file HTML, penyusunan assembler, dan integrasi Vercel/VPS tanpa merombak logika CSS/JS yang sudah stabil.
- [x] **Ambiguity Check**: Mekanisme build, script fallback, dan penanganan file mirror telah didefinisikan secara eksplisit.
