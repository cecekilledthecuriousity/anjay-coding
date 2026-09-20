---
name: vanilla-form-wizard
description: Use when modifying UI components, styling, stepper navigation, dynamic tables, quick paste parsing, or client-side calculations in this vanilla HTML/CSS/JS form wizard
---

# Vanilla Form Wizard & UI Pattern Guide

Use this skill when developing or modifying frontend elements in `index.html`, `training_internal_plan.html`, `css/style.css`, or `js/app.js`.

---

## 1. Aturan Desain & Styling (Pure CSS & Anti-Collision)

1. **Framework-Free**:
   * Dilarang mengimpor Bootstrap, Tailwind, atau UI library berat lainnya.
   * Gunakan variabel CSS yang telah didefinisikan pada `:root` di `css/style.css` (`--accent`, `--moss`, `--sand`, `--ink`, `--panel`).
2. **Mobile Anti-Collision Standard**:
   * Seluruh `.field-row` multi-kolom (`cols-2`, `cols-3`, `cols-4`) otomatis menjadi `1fr` pada viewport mobile (`@media (max-width: 768px)`).
   * Gunakan `min-width: 0` pada child flex/grid container untuk mencegah teks panjang meluap (*overflow*).
   * Tabel input dinamis wajib dibungkus dalam `.tbl-wrap` dengan `overflow-x: auto; -webkit-overflow-scrolling: touch;`.
3. **Ikon Antarmuka**:
   * Gunakan inline SVG line-art bergaya Lucide / Feather dengan `stroke="currentColor"` dan `stroke-width="1.75"`.
   * Jangan gunakan emoji sebagai pengganti ikon tombol atau header kartu.

---

## 2. Pola Baris Dinamis (Dynamic Rows Pattern)

Ketika menambahkan atau memodifikasi tabel baris dinamis:
1. **Counter & Identifikasi**:
   * Gunakan variabel penghitung (misal: `participantCounter`, `moduleCounter`).
2. **Elemen Kolom**:
   * Bungkus setiap input dan select dengan kelas spesifik (contoh: `.participant-name`, `.participant-email`, `.participant-dept`) agar mudah dan aman saat diekstrak di fungsi pengumpul data.
3. **Tombol Hapus & Renumbering**:
   * Tombol hapus memanggil `onclick="removeRow(this)"`.
   * Fungsi `removeRow(btn)` wajib memanggil `renumber(tbody)` untuk memperbarui nomor urut tabel dan memicu pembaruan kalkulasi durasi atau jumlah peserta.

---

## 3. Quick Paste dari Excel Pattern

Fitur Quick Paste diimplementasikan dalam fungsi `importPesertaFromText()`:
* Membaca textarea line-by-line (`split('\n')`).
* Mendeteksi pemisah: Tab (`\t`), strip (` - `), titik koma (`;`), atau koma (`,`).
* **Deteksi Cerdas Kolom**:
  - Kolom pertama: Nama peserta.
  - Cek kolom kedua dan ketiga: Jika mengandung `@`, otomatis dipetakan sebagai email.
  - Kolom non-email dipetakan sebagai departemen (dengan fallback ke departemen pengaju form jika kosong).
* Menambahkan baris ke tabel via `addParticipant(name, email, dept)` dan menutup modal dengan toast notifikasi.

---

## 4. Validasi Antar-Langkah (Stepper Gate)

* Navigasi antar langkah diatur oleh fungsi `goToStep(step)` dan `validateStep(step)`.
* **Step 1 Gate**: Memastikan ID Training, Nama Training, Leader Pengaju, dan Departemen telah terisi.
* **Step 2 Gate**: Memastikan setiap peserta yang memiliki nama juga memiliki alamat email yang valid (`@` dan `.`) sebelum diizinkan melangkah ke Step 3.

---

## 5. Sinkronisasi File Mirror

Pastikan setiap perubahan struktur HTML pada `index.html` selalu disalin secara identik ke `training_internal_plan.html`.
