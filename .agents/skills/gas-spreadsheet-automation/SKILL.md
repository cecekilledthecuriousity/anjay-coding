---
name: gas-spreadsheet-automation
description: Use when developing, debugging, or extending Google Apps Script backend, Google Sheets synchronization, email dispatching via GmailApp, Google Calendar invites, or time-driven reminder schedulers in this project
---

# Google Apps Script & Spreadsheet Automation Guide

Use this skill when working on the backend integration of this training application. The backend runs entirely on Google Apps Script (GAS) connected to Google Sheets, Gmail, and Google Calendar.

---

## 1. Arsitektur Backend Google Apps Script

* **File Sumber**: `google-apps-script.js`
* **Google Sheet DB**: Sheet bernama `Training Submissions`.
* **Kredensial**: Tidak memerlukan API key eksternal; script berjalan menggunakan konteks otorisasi akun Google pemilik sheet.

---

## 2. Struktur Headers & Pemetaan Kolom

Ketika mengubah header pada spreadsheet, selalu perbarui array `HEADERS` di `google-apps-script.js`:
```javascript
const HEADERS = [
  "Waktu Submit",
  "ID Training",
  "Nama Training",
  "Status Dokumen",
  "Nama Pengaju",
  "Departemen / Divisi",
  "Kategori Training",
  "Kategori Kebutuhan Training",
  "Target Level Kemahiran",
  "Tanggal Pengajuan",
  "Metode Training",
  "Platform & Link Meeting",
  "Jadwal Pelaksanaan",
  "Lokasi / Venue",
  "Trainer / Fasilitator",
  "Jumlah Peserta Terdaftar",
  "Total Durasi Belajar",
  "Rincian Biaya (Fee/Konsumsi/Materi/Venue)",
  "Estimasi Biaya",
  "Budget Disetujui",
  "Actual Spend",
  "Tujuan & Purpose",
  "Goals (Target)",
  "Prasyarat & Output",
  "Link Silabus / Materi",
  "Evaluasi & KPI",
  "Follow-up & PIC",
  "Daftar Peserta (Ringkasan)",
  "Modul & Sesi (Ringkasan)",
  "Approval Workflow (Ringkasan)",
  "Status Email Konfirmasi",
  "Status Email Reminder H-1",
  "ID Event Google Calendar",
  "Raw Data JSON"
];
```

Fungsi `setupSheetHeaders(sheet)` secara cerdas akan menambahkan kolom-kolom baru jika sheet yang ada memiliki jumlah kolom lebih sedikit daripada `HEADERS.length`.

---

## 3. Pengiriman Email HTML Responsif (`sendRegistrationEmails`)

Saat form disubmit, `doPost(e)` otomatis memanggil `sendRegistrationEmails(meta, participants, modules)`:
* **Filter Email Valid**: Selalu filter peserta menggunakan `p.email && p.email.includes("@") && p.email.includes(".")`.
* **Metode Kirim**: Gunakan `GmailApp.sendEmail(recipient, subject, plainText, options)`.
* **Options Object**:
  ```javascript
  {
    htmlBody: htmlBodyContent,
    name: "Training & Development Portal"
  }
  ```
* **Inline CSS Styling**: Pastikan seluruh styling pada template email HTML menggunakan atribut `style="..."` inline untuk kompatibilitas maksimal di Gmail, Outlook, dan aplikasi Mail mobile.

---

## 4. Google Calendar Auto-Invite (`createCalendarEvent`)

* Menghubungkan peserta langsung ke kalender kerja:
  ```javascript
  const calendar = CalendarApp.getDefaultCalendar();
  const event = calendar.createEvent(title, startDate, endDate, {
    description: description,
    location: location,
    guests: guestEmails, // string koma: "a@x.com,b@x.com"
    sendInvites: true    // Memicu notifikasi resmi Google Calendar
  });
  event.addPopupReminder(15);
  event.addEmailReminder(1440); // H-1 hari
  ```

---

## 5. Daily Time-Driven Reminder Scheduler (`checkAndSendReminders`)

* **Jadwal Pelaksanaan**: Berjalan otomatis setiap hari pukul 08:00 WIB.
* **Logika Pengecekan**:
  1. Hitung tanggal besok (`tomorrowStr`) dan hari ini (`todayStr`) berdasarkan timezone `Asia/Jakarta`.
  2. Periksa kolom `Status Email Reminder H-1`. Jika sudah berawalan `Terkirim` atau dokumen berstatus `Dibatalkan` / `Ditolak`, abaikan.
  3. Periksa kecocokan tanggal pada array `modules` atau teks `Jadwal Pelaksanaan`.
  4. Jika cocok, kirim email pengingat persiapan dan tandai status: `Terkirim (YYYY-MM-DD HH:mm - X email)`.
* **Setup Trigger**: Pasang otomatis menggunakan fungsi `setupDailyReminderTrigger()` yang membersihkan trigger usang dan mendaftarkan trigger baru harian jam 8 pagi.

---

## 6. Prosedur Deploy & Sinkronisasi

1. Salin seluruh isi `google-apps-script.js`.
2. Buka Spreadsheet > **Extensions** > **Apps Script**.
3. Simpan (Ctrl + S / ikon disket).
4. Klik **Deploy** > **Manage deployments** > Ikon pensil > Version: **New version** > **Deploy**.
