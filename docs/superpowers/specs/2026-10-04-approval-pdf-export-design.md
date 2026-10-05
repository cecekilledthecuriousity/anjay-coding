# Spesifikasi Desain: Pratinjau & Ekspor Lembar Otorisasi Pelatihan (PDF / Print)

- **Tanggal:** 2026-10-04
- **Modul Target:** Portal Approver (`approval/index.html`, `approval/approval.js`, `css/style.css`)
- **Status:** Menunggu Review & Persetujuan Pengguna

---

## 1. Latar Belakang & Tujuan (Problem & Goal)

### Permasalahan
Saat ini, proses otorisasi pengajuan training pada Portal Approver (`/approval`) telah mencatat keputusan *Approved* atau *Rejected* secara digital di Google Sheets. Namun, untuk keperluan audit kepatuhan (ISO/internal audit), pencairan anggaran operasional ke Finance, maupun arsip resmi departemen, para manajer dan HR sering kali membutuhkan dokumen fisik atau berkas PDF resmi yang memuat kop surat perusahaan, rincian biaya, jadwal, daftar peserta, serta riwayat persetujuan bertanda tangan digital.

### Tujuan
Menyediakan fitur **Pratinjau Interaktif & Ekspor Lembar Otorisasi Training (PDF/Print)** langsung dari antarmuka Approver:
1. Approver dapat melihat pratinjau dokumen formal berstandar A4 di layar sebelum dicetak.
2. Sekali klik pada tombol cetak memicu dialog native browser (`window.print()`) dengan opsi simpan PDF atau cetak langsung ke printer fisik.
3. Kualitas dokumen berbasis vektor (CSS Print) yang sangat tajam, tanpa dependensi library eksternal yang berat, dan memiliki pemutusan halaman (*page-break*) yang rapi.

---

## 2. Arsitektur & Alur Pengguna (User Flow)

```
[ Antrean / Riwayat Approval ]
              │
              ▼ (Klik baris pengajuan)
[ Modal Detail Pengajuan: #modalReviewApproval ]
              │
              ├── Tombol Baru: "📄 Lembar Otorisasi (PDF)"
              │
              ▼ (Klik tombol)
[ Modal Pratinjau Dokumen: #modalAuthSheetPreview ]
   ├── Header Modal:
   │     ├── Tombol "🖨️ Cetak / Simpan PDF" ──► window.print() (Layout A4 Resmi)
   │     └── Tombol "✕ Tutup"
   │
   └── Area Dokumen Resmi (#authSheetPrintArea):
         ├── Kop Surat Resmi Perusahaan & Judul Dokumen
         ├── No. Dokumen (ID Training) & Status Stempel (APPROVED/PENDING/REJECTED)
         ├── Bagian 1: Ringkasan & Profil Pelatihan
         ├── Bagian 2: Latar Belakang & Sasaran Terukur
         ├── Bagian 3: Rincian Jadwal & Modul Pelatihan
         ├── Bagian 4: Daftar Peserta Terdaftar
         ├── Bagian 5: Breakdown Anggaran & Komitmen Biaya
         ├── Bagian 6: Matriks Tanda Tangan Digital & Stempel Approver
         └── Footer: QR Code Validasi & Catatan Integritas Audit
```

---

## 3. Komponen & Anatomi Dokumen Resmi A4

Dokumen yang dicetak ke kertas A4 portrait diformat dengan struktur korporat elegan:

### A. Kop Surat Resmi (Letterhead)
* **Logo Perusahaan**: Menggunakan `favicon/logo.svg` atau inline SVG resmi TDS.
* **Header Teks**:
  * *Header Atas*: "TRAINING & DEVELOPMENT SYSTEM - HUMAN CAPITAL & EMPLOYEE DEVELOPMENT"
  * *Judul Dokumen*: **LEMBAR PERSETUJUAN & OTORISASI PELATIHAN KARYAWAN (INTERNAL PLAN)**
  * *Metadata Dokumen*: Nomor Dokumen: `[ID Training]`, Tanggal Terbit: `[Tanggal Terkini/Tanggal Approval]`.
* **Stempel Status Digital**:
  * Badge cap resmi di kanan atas: **DISANGGUPI / APPROVED** (hijau botol/emas), **MENUNGGU / PENDING** (kuning mustard), atau **DITOLAK / REJECTED** (merah bata).

### B. Profil & Karakteristik Program
Tabel informasi 2 kolom:
* Nama Program Pelatihan
* Departemen / Divisi Pemohon
* Leader Pengaju
* Tingkat Kemahiran (Basic / Intermediate / Advanced)
* Kategori Training (Soft skill / Hard skill)
* Metode Pelaksanaan (Onsite / Online / Hybrid)
* Lokasi / Platform & Link Meeting
* Trainer / Narasumber
* Total Durasi Belajar (Jam)

### C. Latar Belakang & Target Kompetensi
* **Latar Belakang / Urgensi**: Menampilkan `Purpose / latar belakang`.
* **Target / Goals Terukur**: Menampilkan `Goals / tujuan terukur`.

### D. Rangkaian Modul & Jadwal
Tabel terstruktur:
* Kolom: No, Modul / Materi, Tanggal, Jam, Durasi, Fasilitator (PIC), Metode/Lokasi.

### E. Daftar Peserta Pelatihan
Tabel peserta yang rapi:
* Kolom: No, Nama Lengkap Peserta, Email Kantor, Departemen / Divisi.

### F. Rincian Anggaran (Financial Summary)
Tabel breakdown biaya:
* Fee Trainer / Lembaga Eksternal
* Konsumsi Peserta
* Materi, Modul & Ujian Sertifikasi
* Venue, Akomodasi & Transportasi
* Biaya Lain-lain
* **Total Estimasi Biaya** & **Budget Disetujui** (tercetak tebal dalam format Rupiah).

### G. Matriks Otorisasi & Tanda Tangan Digital
Tiga kolom blok tanda tangan digital bergaris batas elegan:
1. **Diajukan Oleh**: Nama Leader Pengaju, Departemen, Tanggal Pengajuan.
2. **Diverifikasi (Direct Supervisor)**: Nama Atasan Langsung, Tanggal Verifikasi, Status Persetujuan.
3. **Disetujui Oleh (HR Dept / Finance / Management)**: Nama Approver, Tanggal Otorisasi, Catatan Khusus Approver, Stempel Digital TDS.

### H. Validasi Keabsahan Dokumen (QR Code)
* Di sudut kiri bawah blok tanda tangan, disematkan QR Code keabsahan yang mengodekan teks verifikasi:
  `TDS-AUTH|ID:[ID Training]|APPR:[Nama Approver]|STATUS:[Status]|DATE:[Tanggal]`
* Menggunakan URL generator QR SVG ringan atau API generator QR terpercaya tanpa dependensi library eksternal.
* Catatan kaki (*Disclaimer Audit*): Dokumen ini dihasilkan secara otomatis oleh sistem Training & Development System dan memiliki kekuatan otorisasi internal yang sah.

---

## 4. Spesifikasi Teknis & Styling `@media print`

### Pengaturan CSS Cetak
```css
@media print {
  /* 1. Sembunyikan seluruh UI web */
  body * {
    visibility: hidden;
  }
  
  /* 2. Tampilkan HANYA area dokumen lembar otorisasi */
  #authSheetPrintArea,
  #authSheetPrintArea * {
    visibility: visible;
  }
  
  #authSheetPrintArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    background: #FFFFFF !important;
    color: #1F2421 !important;
    box-shadow: none !important;
    border: none !important;
  }

  /* 3. Pengaturan Halaman A4 */
  @page {
    size: A4 portrait;
    margin: 14mm 16mm 14mm 16mm;
  }

  /* 4. Anti Page-Break Awkward Cuts */
  .auth-print-block,
  .auth-print-table tr,
  .auth-sig-matrix {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

### Penanganan Modal Interaktif
* Di layar biasa (*screen*), `#modalAuthSheetPreview` berfungsi sebagai modal preview dengan latar gelap (`rgba(0,0,0,0.6)`), kartu modal berukuran `max-width: 860px` dengan kertas putih berbingkai dokumen nyata (*A4 paper shadow effect*).
* Tombol **"🖨️ Cetak / Simpan PDF"** di modal header memanggil fungsi:
  ```javascript
  function printAuthSheet() {
    window.print();
  }
  ```

---

## 5. Rencana Pengujian & Verifikasi (Test & Verification)

1. **Uji Tampilan & Data:**
   * Buka proposal berstatus *Pending*, *Approved*, dan *Rejected*.
   * Pastikan seluruh data (nama pengaju, peserta, modul, biaya, dan riwayat approver) terisi presisi tanpa ada field `undefined` atau `-`.
2. **Uji Browser Print:**
   * Klik tombol *Cetak / Simpan PDF* di berbagai browser (Chrome, Edge, Firefox).
   * Verifikasi bahwa dialog cetak menampilkan halaman putih bersih A4 tanpa elemen UI dashboard/sidebar/tombol.
   * Uji pilihan *"Save as PDF"* pada browser untuk memastikan file PDF yang dihasilkan rapi dan beresolusi tinggi.
3. **Uji Script Integritas Repo:**
   * Jalankan `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` untuk memastikan tidak ada ID atau file paritas yang terganggu.

---

## 6. Batasan & Non-Goals

* Tidak menggunakan library compiler eksternal yang membebani bundle (seperti jsPDF atau html2pdf).
* Tidak mengubah skema data spreadsheet backend (menggunakan data JSON submission yang sudah ada).
