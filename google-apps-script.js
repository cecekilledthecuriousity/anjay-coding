/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: FORMULIR TRAINING KARYAWAN -> SPREADSHEET & EMAIL DISPATCHER
 * ==============================================================================
 * Fitur:
 * 1. Simpan pengajuan form ke Google Sheets "Training Submissions"
 * 2. Kirim Email Konfirmasi Instan (HTML) ke setiap peserta yang memiliki email
 * 3. Otomatis buat event Google Calendar & undang email peserta (Google Calendar Invite)
 * 4. Automated Daily Scheduler: Kirim Email Reminder H-1 sebelum training dimulai
 * ==============================================================================
 * Petunjuk Instalasi & Update:
 * 1. Buka Google Sheets Anda yang terhubung dengan form ini.
 * 2. Klik menu "Extensions" (Ekstensi) > "Apps Script".
 * 3. Hapus seluruh kode lama dan tempelkan SELURUH isi file ini.
 * 4. Klik tombol "Save" (ikon disket).
 * 5. Jalankan fungsi "setupDailyReminderTrigger" sekali untuk mengaktifkan scheduler reminder jam 08:00 WIB.
 * 6. Klik "Deploy" > "Manage deployments" > klik ikon Pensil (Edit) > Version: "New version" > Klik "Deploy".
 * ==============================================================================
 */

const SHEET_NAME = "Training Submissions";

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

// ==============================================================================
// 1. WEB APP POST HANDLER (FORM SUBMIT)
// ==============================================================================
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Buat Sheet jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Buat/sinkronisasi header jika sheet masih baru atau bertambah kolom
    setupSheetHeaders(sheet);

    // Ambil data payload JSON dari request
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("No data received");
    }

    const meta = data.meta || {};
    const participants = data.participants || [];
    const modules = data.modules || [];
    const approvals = data.approvals || [];

    // Format ringkasan peserta (termasuk email)
    const participantsSummary = participants
      .filter(p => p.nama)
      .map((p, idx) => `${idx + 1}. ${p.nama}${p.email ? ' <' + p.email + '>' : ''} (${p.departemen || "-"})`)
      .join("\n");

    // Format ringkasan modul
    const modulesSummary = modules
      .filter(m => m.modul)
      .map((m, idx) => {
        const scheduleStr = [m.tanggal, (m.jamMulai && m.jamSelesai ? `${m.jamMulai}-${m.jamSelesai}` : "")].filter(Boolean).join(" ");
        const loc = m.lokasi ? ` @ ${m.lokasi}` : "";
        return `${idx + 1}. ${m.modul} [${m.durasi || "-"}${scheduleStr ? " | " + scheduleStr : ""}${loc}] PIC: ${m.pic || "-"} (${m.metode || "-"})`;
      })
      .join("\n");

    // Format ringkasan approval
    const approvalsSummary = approvals
      .filter(a => a.role)
      .map((a, idx) => `${idx + 1}. ${a.role}: ${a.nama || "-"} (${a.tanggal || "-"})`)
      .join("\n");

    // Format meeting info
    let meetingInfo = "-";
    if (meta["Platform online"] || meta["Link meeting online"]) {
      meetingInfo = [meta["Platform online"], meta["Link meeting online"]].filter(Boolean).join(" - ");
    }

    // Format rincian biaya breakdown
    const rincianBiaya = `Fee: ${meta["Fee trainer"] || "0"} | Konsumsi: ${meta["Konsumsi & catering"] || "0"} | Materi: ${meta["Materi & sertifikat"] || "0"} | Venue: ${meta["Venue & alat"] || "0"}`;

    // Format prasyarat & output
    const prasyaratOutput = `Prasyarat: ${meta["Prasyarat peserta"] || "-"} | Output: ${meta["Sertifikasi / output"] || "-"}`;

    // Format evaluasi & indikator
    const hasilDiharapkan = meta["Hasil yang diharapkan"] || meta["Expected outcomes"] || "-";
    const penerapanKerja = meta["Penerapan di pekerjaan"] || meta["Aplikasi / implementasi"] || "-";
    const indikator = meta["Indikator keberhasilan"] || "-";
    const evaluasiKpi = `Hasil: ${hasilDiharapkan} | Penerapan: ${penerapanKerja} | Indikator: ${indikator}`;

    // Format follow-up / waktu evaluasi & PIC
    const waktuEval = meta["Waktu evaluasi"] || meta["Interval follow-up"] || "-";
    const picEval = meta["PIC evaluasi"] || meta["PIC monitoring"] || "-";
    const followupInfo = `Waktu: ${waktuEval} | PIC: ${picEval}`;

    // 1. Kirim Email Konfirmasi Pendaftaran ke Peserta
    let confirmationEmailStatus = "Belum Ada Email";
    try {
      confirmationEmailStatus = sendRegistrationEmails(meta, participants, modules);
    } catch (mailErr) {
      Logger.log("Gagal kirim email konfirmasi: " + mailErr.toString());
      confirmationEmailStatus = "Error: " + mailErr.message;
    }

    // 2. Buat Event di Google Calendar (Opsional / Otomatis)
    let calendarEventId = "-";
    try {
      calendarEventId = createCalendarEvent(meta, participants, modules);
    } catch (calErr) {
      Logger.log("Gagal buat kalender event: " + calErr.toString());
      calendarEventId = "Gagal: " + calErr.message;
    }

    // Initial Status Reminder H-1
    const reminderStatus = "Pending";

    const rowData = [
      data.submittedAt || new Date().toISOString(),
      meta["ID training"] || "-",
      meta["Nama training"] || "-",
      data.status || "Pending approval",
      meta["Nama pengaju"] || meta["Leader pengaju"] || "-",
      meta["Departemen / divisi"] || "-",
      meta["Kategori training"] || "-",
      meta["Kategori kebutuhan training"] || "-",
      meta["Target level kemahiran"] || "-",
      meta["Tanggal pengajuan"] || "-",
      meta["Metode training"] || "-",
      meetingInfo,
      meta["Tanggal & jam pelaksanaan"] || "-",
      meta["Lokasi / venue"] || "-",
      meta["Trainer"] || "-",
      participants.filter(p => p.nama).length,
      meta["Total durasi belajar"] || "-",
      rincianBiaya,
      meta["Estimasi biaya"] || "-",
      meta["Budget disetujui"] || "-",
      meta["Actual spend"] || "-",
      meta["Training plan purpose"] || "-",
      meta["Training goals"] || "-",
      prasyaratOutput,
      meta["Link silabus materi"] || "-",
      evaluasiKpi,
      followupInfo,
      participantsSummary || "-",
      modulesSummary || "-",
      approvalsSummary || "-",
      confirmationEmailStatus,
      reminderStatus,
      calendarEventId,
      JSON.stringify(data)
    ];

    sheet.appendRow(rowData);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: "Data tersimpan & email konfirmasi diproses",
        id: meta["ID training"],
        emailStatus: confirmationEmailStatus,
        calendarId: calendarEventId
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// 2. SETUP SPREADSHEET HEADERS
// ==============================================================================
function setupSheetHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#3F5A44");
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  } else {
    // Pastikan jika kolom baru ditambahkan, row 1 disinkronkan
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < HEADERS.length) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#3F5A44");
      headerRange.setFontColor("#FFFFFF");
    }
  }
}

// ==============================================================================
// 3. PENGIRIMAN EMAIL KONFIRMASI INSTAN KE PESERTA
// ==============================================================================
function sendRegistrationEmails(meta, participants, modules) {
  const validParticipants = participants.filter(p => p.email && p.email.includes("@") && p.email.includes("."));
  if (validParticipants.length === 0) {
    return "Tidak ada email valid";
  }

  const trainingName = meta["Nama training"] || "Pelatihan Internal";
  const trainingId = meta["ID training"] || "TRN";
  const jadwal = meta["Tanggal & jam pelaksanaan"] || "-";
  const trainer = meta["Trainer"] || "Tim TnD";
  const metode = meta["Metode training"] || "Onsite";

  let lokasiOrLink = meta["Lokasi / venue"] || "-";
  if (metode === "Online" || metode === "Hybrid") {
    const platform = meta["Platform online"] || "Online";
    const link = meta["Link meeting online"] || "";
    lokasiOrLink = link ? `${platform} (<a href="${link}" target="_blank">${link}</a>)` : platform;
  }

  const silabusLink = meta["Link silabus materi"]
    ? `<a href="${meta["Link silabus materi"]}" target="_blank" style="color:#3F5A44;font-weight:600;text-decoration:underline;">Buka Silabus / Materi Pelatihan &rarr;</a>`
    : "-";

  let sentCount = 0;

  validParticipants.forEach(p => {
    const recipientName = p.nama || "Rekan Karyawan";
    const subject = `[Konfirmasi Pendaftaran] Pelatihan: ${trainingName} (${trainingId})`;

    const htmlBody = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAF9F5;border:1px solid #E6E4DD;border-radius:12px;overflow:hidden;color:#1F2421;">
        <div style="background:#3F5A44;color:#FFFFFF;padding:24px 28px;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;">Employee Development Program</p>
          <h2 style="margin:6px 0 0;font-size:20px;font-weight:600;">Konfirmasi Pendaftaran Pelatihan</h2>
        </div>
        
        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Halo <strong>${recipientName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A4D4A;">
            Anda telah resmi didaftarkan untuk mengikuti program pelatihan internal berikut. Silakan catat jadwal dan detail pelaksanaannya di bawah ini:
          </p>

          <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:8px;border:1px solid #E6E4DD;margin-bottom:22px;">
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;width:140px;">ID Training</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13.5px;font-weight:600;color:#3F5A44;">${trainingId}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;">Topik Pelatihan</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13.5px;font-weight:600;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;">Jadwal Pelaksanaan</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13.5px;font-weight:600;color:#1F2421;">${jadwal}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;">Metode Pelatihan</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13px;">${metode}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;">Lokasi / Link Meeting</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13px;">${lokasiOrLink}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:12px;color:#7A7D7A;">Trainer / Fasilitator</td>
              <td style="padding:10px 14px;border-bottom:1px solid #EFEFEA;font-size:13px;">${trainer}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:12px;color:#7A7D7A;">Materi / Silabus</td>
              <td style="padding:10px 14px;font-size:13px;">${silabusLink}</td>
            </tr>
          </table>

          <div style="background:#EBF0EC;border-left:4px solid #3F5A44;padding:12px 16px;border-radius:4px;margin-bottom:22px;font-size:13px;line-height:1.5;color:#2D3E31;">
            <strong>Catatan Persiapan:</strong> Mohon hadir 5-10 menit sebelum sesi dimulai. Pastikan perangkat dan kebutuhan prasyarat telah disiapkan dengan baik.
          </div>

          <p style="margin:0;font-size:13px;color:#7A7D7A;line-height:1.5;">
            Salam hangat,<br>
            <strong>Tim Training & Development / People & Culture</strong>
          </p>
        </div>

        <div style="background:#F2F0E9;padding:12px 28px;text-align:center;font-size:11px;color:#9A9D9A;border-top:1px solid #E6E4DD;">
          Pemberitahuan otomatis dari Portal Training Karyawan. Tidak perlu membalas email ini secara langsung.
        </div>
      </div>
    `;

    const plainText = `Halo ${recipientName},\n\nAnda telah terdaftar dalam pelatihan internal:\nTopik: ${trainingName}\nID: ${trainingId}\nJadwal: ${jadwal}\nLokasi/Link: ${meta["Lokasi / venue"] || meta["Link meeting online"] || "-"}\nTrainer: ${trainer}\n\nSalam,\nTim TnD`;

    try {
      GmailApp.sendEmail(p.email, subject, plainText, {
        htmlBody: htmlBody,
        name: "Training & Development Portal"
      });
      sentCount++;
    } catch (err) {
      Logger.log(`Gagal kirim ke ${p.email}: ${err.toString()}`);
    }
  });

  return `Terkirim (${sentCount}/${validParticipants.length})`;
}

// ==============================================================================
// 4. GOOGLE CALENDAR EVENT CREATOR (AUTO-INVITE GUESTS)
// ==============================================================================
function createCalendarEvent(meta, participants, modules) {
  const guestEmails = participants
    .filter(p => p.email && p.email.includes("@"))
    .map(p => p.email.trim())
    .join(",");

  const trainingName = meta["Nama training"] || "Pelatihan Karyawan";
  const trainingId = meta["ID training"] || "TRN";
  let location = meta["Lokasi / venue"] || meta["Link meeting online"] || "";

  // Tentukan tanggal & waktu
  let startDate = null;
  let endDate = null;

  if (modules && modules.length > 0 && modules[0].tanggal) {
    const firstMod = modules[0];
    const tgl = firstMod.tanggal; // YYYY-MM-DD
    const startStr = firstMod.jamMulai || "09:00";
    const endStr = firstMod.jamSelesai || "15:00";
    startDate = new Date(`${tgl}T${startStr}:00`);
    endDate = new Date(`${tgl}T${endStr}:00`);
  }

  if (!startDate || isNaN(startDate.getTime())) {
    // Fallback jika format tanggal custom
    return "Jadwal custom (tidak dibuat event kalender otomatis)";
  }

  const title = `[Training] ${trainingName} (${trainingId})`;
  const description = `Program Pelatihan Karyawan:\nID Training: ${trainingId}\nTopik: ${trainingName}\nTrainer: ${meta["Trainer"] || "-"}\nSilabus: ${meta["Link silabus materi"] || "-"}\n\nEmail ini otomatis dibuat oleh Portal Training.`;

  const calendar = CalendarApp.getDefaultCalendar();
  const event = calendar.createEvent(title, startDate, endDate, {
    description: description,
    location: location,
    guests: guestEmails,
    sendInvites: true // Otomatis mengirim undangan kalender resmi
  });

  // Tambahkan reminder default 15 menit & 1 hari sebelumnya
  event.addPopupReminder(15);
  event.addEmailReminder(1440); // 1440 menit = 1 hari

  return event.getId();
}

// ==============================================================================
// 5. AUTOMATED DAILY SCHEDULER: EMAIL REMINDER H-1
// ==============================================================================
/**
 * Fungsi ini dipanggil secara otomatis oleh Time-Driven Trigger setiap hari jam 08:00 WIB.
 * Memeriksa seluruh jadwal training pada spreadsheet yang akan berlangsung besok (H-1)
 * dan mengirim email pengingat kepada seluruh peserta.
 */
function checkAndSendReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet tidak ditemukan: " + SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("Belum ada data training untuk dicek.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colId = headers.indexOf("ID Training") + 1;
  const colName = headers.indexOf("Nama Training") + 1;
  const colDocStatus = headers.indexOf("Status Dokumen") + 1;
  const colJadwal = headers.indexOf("Jadwal Pelaksanaan") + 1;
  const colReminder = headers.indexOf("Status Email Reminder H-1") + 1;
  const colJson = headers.indexOf("Raw Data JSON") + 1;

  if (!colReminder || !colJson) {
    Logger.log("Kolom tracking reminder atau JSON tidak ditemukan.");
    return;
  }

  const today = new Date();
  const tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000));
  const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
  const tomorrowStr = Utilities.formatDate(tomorrow, timeZone, "yyyy-MM-dd");
  const todayStr = Utilities.formatDate(today, timeZone, "yyyy-MM-dd");

  Logger.log(`Mengecek reminder untuk tanggal pelaksanaan: Besok (${tomorrowStr}) atau Hari Ini (${todayStr})`);

  const numRows = lastRow - 1;
  const dataRange = sheet.getRange(2, 1, numRows, sheet.getLastColumn()).getValues();

  let remindersSentTotal = 0;

  for (let i = 0; i < dataRange.length; i++) {
    const row = dataRange[i];
    const rowNum = i + 2;
    const currentReminderStatus = String(row[colReminder - 1] || "");
    const docStatus = String(row[colDocStatus - 1] || "");

    // Lewati jika sudah pernah dikirim reminder atau dokumen dibatalkan/ditolak
    if (currentReminderStatus.startsWith("Terkirim") || docStatus.toLowerCase().includes("batal") || docStatus.toLowerCase().includes("tolak")) {
      continue;
    }

    const rawJsonStr = row[colJson - 1];
    if (!rawJsonStr) continue;

    let parsedData;
    try {
      parsedData = JSON.parse(rawJsonStr);
    } catch (e) {
      continue;
    }

    const meta = parsedData.meta || {};
    const modules = parsedData.modules || [];
    const participants = parsedData.participants || [];

    // Cek apakah tanggal pelaksanaan training adalah besok (H-1) atau hari ini
    let isMatchDate = false;
    let targetDateStr = "";

    // 1. Cek dari tanggal modul
    for (let m = 0; m < modules.length; m++) {
      const modDate = modules[m].tanggal;
      if (modDate === tomorrowStr || modDate === todayStr) {
        isMatchDate = true;
        targetDateStr = modDate;
        break;
      }
    }

    // 2. Cek dari teks jadwal jika modul kosong
    if (!isMatchDate && row[colJadwal - 1]) {
      const jadwalStr = String(row[colJadwal - 1]);
      if (jadwalStr.includes(tomorrowStr) || jadwalStr.includes(todayStr)) {
        isMatchDate = true;
        targetDateStr = tomorrowStr;
      }
    }

    if (isMatchDate) {
      Logger.log(`Mengirim Reminder H-1 untuk ${meta["ID training"]} (${meta["Nama training"]})...`);
      const sentResult = sendReminderEmails(meta, participants, modules, targetDateStr);
      
      // Update cell status reminder pada sheet
      const timestamp = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm");
      sheet.getRange(rowNum, colReminder).setValue(`Terkirim (${timestamp} - ${sentResult})`);
      remindersSentTotal++;
    }
  }

  Logger.log(`Selesai mengecek reminder. Total training yang dikirimi reminder: ${remindersSentTotal}`);
}

// ==============================================================================
// 6. HELPER EMAIL REMINDER H-1 TEMPLATE
// ==============================================================================
function sendReminderEmails(meta, participants, modules, executionDate) {
  const validParticipants = participants.filter(p => p.email && p.email.includes("@") && p.email.includes("."));
  if (validParticipants.length === 0) return "0 email valid";

  const trainingName = meta["Nama training"] || "Pelatihan Internal";
  const trainingId = meta["ID training"] || "TRN";
  const jadwal = meta["Tanggal & jam pelaksanaan"] || "-";
  const metode = meta["Metode training"] || "Onsite";

  let lokasiOrLink = meta["Lokasi / venue"] || "-";
  if (metode === "Online" || metode === "Hybrid") {
    const platform = meta["Platform online"] || "Online";
    const link = meta["Link meeting online"] || "";
    lokasiOrLink = link ? `${platform} (<a href="${link}" target="_blank">${link}</a>)` : platform;
  }

  const silabusLink = meta["Link silabus materi"]
    ? `<a href="${meta["Link silabus materi"]}" target="_blank" style="color:#3F5A44;font-weight:600;text-decoration:underline;">Tautan Materi / Silabus &rarr;</a>`
    : "-";

  let count = 0;

  validParticipants.forEach(p => {
    const recipientName = p.nama || "Rekan Karyawan";
    const subject = `[REMINDER H-1] Pelatihan Besok: ${trainingName} (${trainingId})`;

    const htmlBody = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAF9F5;border:1px solid #E6E4DD;border-radius:12px;overflow:hidden;color:#1F2421;">
        <div style="background:#B78628;color:#FFFFFF;padding:22px 28px;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">Pengingat Jadwal Pelatihan</p>
          <h2 style="margin:6px 0 0;font-size:20px;font-weight:600;">Reminder: Pelatihan Anda Berlangsung Besok!</h2>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Halo <strong>${recipientName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A4D4A;">
            Ini adalah pengingat bahwa Anda dijadwalkan untuk mengikuti pelatihan internal berikut yang akan diselenggarakan <strong>besok</strong>:
          </p>

          <div style="background:#FFFFFF;border:1px solid #E6E4DD;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
            <div style="font-size:16px;font-weight:600;color:#3F5A44;margin-bottom:8px;">${trainingName}</div>
            <div style="font-size:13px;color:#6A6D6A;margin-bottom:12px;">ID: ${trainingId} &bull; Metode: ${metode}</div>
            <div style="font-size:13.5px;margin-bottom:6px;">⏰ <strong>Waktu:</strong> ${jadwal}</div>
            <div style="font-size:13.5px;margin-bottom:6px;">📍 <strong>Tempat / Tautan:</strong> ${lokasiOrLink}</div>
            <div style="font-size:13.5px;">📂 <strong>Silabus:</strong> ${silabusLink}</div>
          </div>

          <div style="background:#FFF9E6;border-left:4px solid #B78628;padding:12px 16px;border-radius:4px;margin-bottom:22px;font-size:13px;line-height:1.5;color:#664B11;">
            <strong>Checklist Persiapan:</strong>
            <ul style="margin:6px 0 0;padding-left:18px;">
              <li>Hadir tepat waktu (minimal 5-10 menit sebelum sesi dimulai).</li>
              <li>Pastikan laptop/koneksi internet dalam kondisi stabil jika daring.</li>
              <li>Pelajari silabus awal jika tersedia.</li>
            </ul>
          </div>

          <p style="margin:0;font-size:13px;color:#7A7D7A;line-height:1.5;">
            Semoga pelatihannya berjalan lancar dan bermanfaat bagi pengembangan kompetensi Anda.<br><br>
            Salam hangat,<br>
            <strong>Tim Training & Development / People & Culture</strong>
          </p>
        </div>

        <div style="background:#F2F0E9;padding:12px 28px;text-align:center;font-size:11px;color:#9A9D9A;border-top:1px solid #E6E4DD;">
          Pemberitahuan otomatis dari Portal Training Karyawan.
        </div>
      </div>
    `;

    const plainText = `Halo ${recipientName},\n\nReminder pelatihan Anda besok:\nTopik: ${trainingName} (${trainingId})\nWaktu: ${jadwal}\nTempat/Link: ${meta["Lokasi / venue"] || meta["Link meeting online"] || "-"}\n\nSalam,\nTim TnD`;

    try {
      GmailApp.sendEmail(p.email, subject, plainText, {
        htmlBody: htmlBody,
        name: "Training & Development Portal"
      });
      count++;
    } catch (e) {
      Logger.log(`Gagal kirim reminder ke ${p.email}: ${e.toString()}`);
    }
  });

  return `${count} email`;
}

// ==============================================================================
// 7. SETUP TRIGGER SCHEDULER OTOMATIS (1-KLIK)
// ==============================================================================
/**
 * Jalankan fungsi ini SATU KALI dari editor Apps Script
 * untuk memasang trigger harian otomatis jam 08:00 pagi.
 */
function setupDailyReminderTrigger() {
  // Hapus trigger lama jika ada agar tidak terjadi duplikasi
  const allTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === "checkAndSendReminders") {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  }

  // Buat trigger harian jam 08:00 WIB
  ScriptApp.newTrigger("checkAndSendReminders")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log("SUKSES: Trigger harian 'checkAndSendReminders' berhasil dipasang setiap hari pukul 08:00 pagi!");
}

// ==============================================================================
// 8. FUNGSI PENGUJIAN MANUAL (TEST RUNNER)
// ==============================================================================
/**
 * Jalankan fungsi ini untuk mengetes pengiriman email sample ke akun email Anda sendiri.
 */
function testSendSampleEmail() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("Tidak dapat mendeteksi email aktif.");
    return;
  }

  const sampleMeta = {
    "ID training": "TRN-TEST-001",
    "Nama training": "Workshop Google Workspace Automation",
    "Tanggal & jam pelaksanaan": "21 September 2026, 09:00 - 15:00 WIB",
    "Metode training": "Online",
    "Platform online": "Google Meet",
    "Link meeting online": "https://meet.google.com/abc-defg-hij",
    "Trainer": "Duta TnD",
    "Link silabus materi": "https://drive.google.com"
  };

  const sampleParticipants = [
    { nama: "Testing User", email: myEmail, departemen: "DEVELOPER" }
  ];

  const result = sendRegistrationEmails(sampleMeta, sampleParticipants, []);
  Logger.log("Hasil pengujian email: " + result + " ke " + myEmail);
}

// ==============================================================================
// 9. WEB APP GET HANDLER (READ DATA)
// ==============================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
