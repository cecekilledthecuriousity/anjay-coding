# Spesifikasi Desain: Dual-Section Evaluasi Pasca Training

## 1. 📌 Ringkasan Eksekutif (Overview)

Dokumen ini mendefinisikan arsitektur dan alur kerja untuk pembaruan fitur **Evaluasi Pasca Training** pada modul *Post Training Trampoline* (`#page-post-training`), khususnya di dalam tab **Post Test** (`#trampolinePanelPostTest`).

Sistem akan menyediakan **2 Sub-Section Evaluasi Terpadu** berbasis sub-tab switcher:
1. **Evaluasi Trainee oleh Atasan (User)**: Ditujukan untuk Atasan/Leader/User divisi dalam mengevaluasi perubahan kompetensi dan implementasi kerja peserta pasca-pelatihan (Level 3 Kirkpatrick: *Job Behavior & Application*).
2. **Evaluasi Trainer oleh Peserta (Trainee)**: Ditujukan untuk peserta pelatihan dalam menilai kualitas fasilitator, penguasaan materi, dan efektivitas pelatihan (Level 1 Kirkpatrick: *Reaction*).

Sesuai arahan desain, seluruh kode dokumen internal (seperti `CPS-HRD-FRM-...`) **ditiadakan** dari antarmuka pengguna agar lebih bersih, elegan, dan *human-friendly*.

---

## 2. 🏛️ Arsitektur UI / UX

### 2.1. Lokasi & Struktur Komponen
Fitur ini berlokasi di:
* **Halaman**: `Post Training Trampoline` (`#page-post-training`)
* **Tab Utama**: `Post Test` (`#trampolinePanelPostTest`)
* **Dropdown Pelatihan**: `#postTestTrainingSelect`

### 2.2. Sub-Tab Segment Switcher
Tepat di bawah dropdown training, ditambahkan navigasi sub-tab segment toggle:
* **Tombol A**: `👔 Evaluasi Trainee (oleh Atasan)` (ID: `subTabBtnEvalTrainee`)
* **Tombol B**: `🎓 Evaluasi Trainer (oleh Peserta)` (ID: `subTabBtnEvalTrainer`)

### 2.3. Panel Konten Sub-Tab 1: Evaluasi Trainee (oleh Atasan)
* **ID Kontainer**: `#evalSectionTrainee`
* **Badge Indikator**: *Untuk Atasan / User Divisi* &bull; *Rekomendasi Waktu: H+14 s.d H+30*
* **Judul**: *Evaluasi Penerapan & Dampak Kinerja Peserta*
* **Deskripsi**: *Formulir penilaian untuk atasan/user guna mengevaluasi penerapan kompetensi dan perubahan performa kerja peserta setelah pelatihan.*
* **URL Form**: `https://docs.google.com/forms/d/1W6Txh0Y1B9jvqi32FepiWCLbocOZL8qRPgegoUICLl4/viewform`
* **Elemen Aksi**:
  - Input teks tautan readonly (`#evalTraineeFormUrl`)
  - Tombol Salin Link (`copyEvalTraineeLink()`)
  - Tombol Buka Form di Tab Baru (`#btnOpenEvalTraineeTab`)
  - Tombol Toggle Pratinjau / Embed Iframe (`#btnToggleEvalTraineePreview`)
  - Kontainer Iframe Accordion (`#evalTraineeIframeWrap`, iframe `#iframeEvalTrainee`)

### 2.4. Panel Konten Sub-Tab 2: Evaluasi Trainer (oleh Peserta)
* **ID Kontainer**: `#evalSectionTrainer`
* **Badge Indikator**: *Untuk Peserta Pelatihan* &bull; *Rekomendasi Waktu: Hari-H / H+1*
* **Judul**: *Evaluasi Mutu Fasilitator & Pelatihan*
* **Deskripsi**: *Formulir evaluasi untuk peserta pelatihan guna memberikan penilaian terhadap penguasaan materi, metode penyampaian, dan efektivitas trainer.*
* **URL Form**: `https://docs.google.com/forms/d/e/1FAIpQLSdLNo9kzy22HEKq3xSCBHmZO2ksfCE2K7U_Y3EA2hCzQtRYmw/viewform`
* **Elemen Aksi**:
  - Input teks tautan readonly (`#evalTrainerFormUrl`)
  - Tombol Salin Link (`copyEvalTrainerLink()`)
  - Tombol Buka Form di Tab Baru (`#btnOpenEvalTrainerTab`)
  - Tombol Toggle Pratinjau / Embed Iframe (`#btnToggleEvalTrainerPreview`)
  - Kontainer Iframe Accordion (`#evalTrainerIframeWrap`, iframe `#iframeEvalTrainer`)

---

## 3. ⚙️ Logika Interaksi & State Management

### 3.1. Fungsi Switcher Sub-Tab (`switchPostTestEvaluationTab`)
```javascript
function switchPostTestEvaluationTab(targetType) {
  // targetType: 'trainee' | 'trainer'
  // 1. Toggle active class pada subTabBtnEvalTrainee dan subTabBtnEvalTrainer
  // 2. Tampilkan panel yang bersesuaian (#evalSectionTrainee vs #evalSectionTrainer)
  // 3. Jika panel lain memiliki iframe preview yang sedang terbuka, collapse dan reset src agar menghemat memori
}
```

### 3.2. URL Synchronization & Pre-fill Logic
Ketika `#postTestTrainingSelect` memilih suatu training (`activeTraining`):
* Menarik metadata: `Judul Pelatihan`, `Tanggal Pelatihan`, `Trainer`, `Divisi`.
* Memperbarui tautan `#evalTraineeFormUrl` dan `#evalTrainerFormUrl`.
* Jika pengguna mengklik *Buka Form* atau *Salin Link*, URL yang disalin menyertakan konteks training yang dipilih.

### 3.3. Lazy Loading Iframe Preview
* Nilai awal `src` pada iframe adalah `about:blank`.
* Ketika pengguna menekan *"Tampilkan Form di Sini"*, `src` diisi dengan URL Google Form yang bersangkutan (`embed=true` / `embedded=true`).
* Menekan tombol lagi akan menutup accordion dan mengosongkan iframe untuk mencegah lag.

### 3.4. Penyimpanan Hasil Tindak Lanjut
* Textarea catatan evaluasi (`#postTestCatatan`) dan tombol *"Simpan Hasil Post-Test"* (`#btnSubmitPostTest`) tetap aktif untuk mencatat status distribusi evaluasi ke sheet `"Post Training"` di Google Spreadsheet backend.

---

## 4. 📂 File yang Terdampak (File Manifest)

1. `src/pages/post-training.html`:
   - Memperbarui struktur Tab 2 (`#trampolinePanelPostTest`) dengan segmented switch bar dan dua kartu section evaluasi.
2. `css/style.css`:
   - Menambahkan styling segmented switch button, kartu evaluasi, badge indikator waktu/target pengisi, dan responsivitas mobile anti-collision.
3. `js/app.js`:
   - Menambahkan fungsi `switchPostTestEvaluationTab()`, `toggleEvalTraineePreview()`, `toggleEvalTrainerPreview()`, `copyEvalTraineeLink()`, `copyEvalTrainerLink()`, serta memperbarui `handlePostTestTrainingChange()`.
4. `index.html` & `training_internal_plan.html`:
   - Dirakit ulang secara otomatis melalui `scripts/build.ps1` agar tetap identik.

---

## 5. ✅ Rencana Verifikasi & Pengujian

1. **Pengujian Sub-Tab Switcher**:
   - Memastikan transisi antara tab *Evaluasi Trainee* dan *Evaluasi Trainer* berjalan mulus tanpa reload halaman.
2. **Pengujian Salin & Buka Link**:
   - Memastikan tombol Salin Link menyalin URL yang valid ke clipboard.
   - Memastikan tombol Buka Form membuka tab baru ke Google Form yang tepat.
3. **Pengujian Embed Iframe**:
   - Memastikan iframe terbuka dan dapat diakses saat toggle ditekan.
   - Memastikan saat berganti tab, iframe otomatis ditutup agar performa tetap ringan.
4. **Validasi Sintaksis & Build**:
   - `powershell -File scripts/build.ps1`
   - `node -c js/app.js`
   - `node -c google-apps-script.js`
