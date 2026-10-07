/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: FORMULIR TRAINING KARYAWAN -> SPREADSHEET & EMAIL DISPATCHER
 * ==============================================================================
 * Fitur:
 * 1. Simpan pengajuan form ke Google Sheets "Training Submissions"
 * 2. Kirim Email Konfirmasi Instan (HTML) ke setiap peserta yang memiliki email
 * 3. Otomatis buat event Google Calendar & undang email peserta (Google Calendar Invite)
 * 4. Automated Daily Scheduler: Kirim Email Reminder H-1 sebelum training dimulai
 * 5. Multi-Source Date Extraction (Mendukung ID Baru TRN-YYYYMMDD-..., Modul, Teks Jadwal, JSON)
 * 6. Fallback Ekstraksi Peserta jika Raw Data JSON tidak lengkap
 * 7. Test Runners Lengkap: testSendSampleEmail, testSendReminderEmail, testSendApprovalDecisionEmail, forceSendReminderToFirstRow
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
const POST_TRAINING_SHEET_NAME = "Post Training";

// ID Folder Utama Google Drive untuk menyimpan bukti foto (evidence).
// Kosongkan "" untuk menyimpan di My Drive utama akun pelaksana (training@cpssoft.com),
// atau isi dengan Folder ID Google Drive jika ingin dimasukkan ke folder spesifik/Shared Drive.
const EVIDENCE_ROOT_FOLDER_ID = "";

const TIME_ZONE = "Asia/Jakarta";
const LOGO_IMAGE_URL = "https://raw.githubusercontent.com/cecekilledthecuriousity/anjay-coding/main/favicon/apple-touch-icon.png";

// URL Portal Approval (Tautan langsung pada tombol notifikasi email approver)
const APPROVAL_PORTAL_URL = "https://request-training-development.vercel.app/approval";

// URL Google Form Evaluasi Trainer & Post-Test
const DEFAULT_EVALUATION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdLNo9kzy22HEKq3xSCBHmZO2ksfCE2K7U_Y3EA2hCzQtRYmw/viewform";

// Konfigurasi 2-3 Approver Utama (Tersimpan aman di script backend, tersembunyi dari form & master data publik)
const APPROVER_EMAILS = [
  "training@cpssoft.com",
  "fernanda.rusli@cpssoft.com"
];

// Opsi kirim email invite Google Calendar ke tamu / peserta
const SEND_CALENDAR_INVITES = true;

const ROOM_CALENDAR_MAP = {
  'Ruangan Meeting Neptunus': 'c_1881kdt0gqog6js3lg0umkabhcc5s@resource.calendar.google.com',
  'Ruangan Meeting Saturnus': 'c_1888qp0vkrf3mi6ri2sci3qi57o62@resource.calendar.google.com',
  'Ruangan Meeting Mars': 'c_188af71f94iieh7oif5rf055i47pi@resource.calendar.google.com',
  'Ruangan Meeting Merkurius': 'c_188850vcfda0kjn4lgnm6olsfs098@resource.calendar.google.com'
};

const HEADERS = [
  "Waktu Submit",
  "ID Training",
  "Status Dokumen",
  "Jenis Training",
  "Nama Training",
  "Nama Pengaju",
  "Email Pengaju",
  "Departemen / Divisi",
  "Kategori Training",
  "Target Level Kemahiran",
  "Kategori Kebutuhan Training",
  "Tanggal Pengajuan",
  "Metode Training",
  "Jadwal Pelaksanaan",
  "Lokasi / Venue",
  "Platform & Link Meeting",
  "Trainer / Fasilitator",
  "Opsi Vendor (Eksternal)",
  "Total Durasi Belajar",
  "Jumlah Partisipan (Rencana)",
  "Jumlah Peserta Terdaftar",
  "Daftar Peserta (Ringkasan)",
  "Modul & Sesi (Ringkasan)",
  "Modul & Materi (File/Link)",
  "Training Goals",
  "Hasil yang Diharapkan",
  "Penerapan di Pekerjaan",
  "Indikator Keberhasilan",
  "Waktu Evaluasi",
  "PIC Evaluasi",
  "Link Form Evaluasi",
  "Status Email Konfirmasi",
  "Status Email Reminder H-1",
  "Status Reminder Approval",
  "ID Event Google Calendar",
  "Approver",
  "Tanggal Approval",
  "Catatan Approver",
  "Raw Data JSON"
];

// ==============================================================================
// 0. SECURITY HELPERS (validasi input, escaping, lock)
// ==============================================================================

/**
 * Menormalkan status keputusan approval. Hanya nilai yang dikirim portal approval
 * yang diterima; nilai lain dikembalikan "" agar request ditolak.
 */
function normalizeApprovalStatus(raw) {
  const key = String(raw === null || raw === undefined ? "" : raw).trim().toLowerCase();
  const map = {
    "disetujui": "Disetujui",
    "approved": "Disetujui",
    "approve": "Disetujui",
    "ditolak": "Ditolak",
    "rejected": "Ditolak",
    "reject": "Ditolak"
  };
  return map[key] || "";
}

// ==============================================================================
// 1. WEB APP POST HANDLER (FORM SUBMIT & APPROVAL ACTION)
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
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("No data received");
    }

    // Aksi pembaruan status persetujuan dari portal approval (/approval)
    if (data.action === "update_approval") {
      return handleUpdateApproval(sheet, data);
    }

    // Aksi hapus pengajuan training dari portal approval
    if (data.action === "delete_submission" || data.action === "deleteSubmission") {
      return handleDeleteSubmission(sheet, data);
    }

    // Aksi Unggah Evidence Post Training Trampoline (Google Drive & Sheets)
    if (data.action === "submitPostTrainingEvidence" || data.action === "post_training_evidence") {
      return handlePostTrainingEvidence(ss, data);
    }

    // Aksi Simpan Hasil Post-Test Post Training Trampoline
    if (data.action === "submitPostTest" || data.action === "post_training_test") {
      return handlePostTestSubmission(ss, data);
    }

    // Aksi Simpan Pelaporan Knowledge Sharing Post Training Trampoline
    if (data.action === "submitKnowledgeSharing" || data.action === "post_training_sharing") {
      return handleKnowledgeSharingSubmission(ss, data);
    }

    const meta = data.meta || {};
    const participants = data.participants || [];
    const modules = data.modules || [];
    const approvals = data.approvals || [];

    // Pastikan ID Training tersimpan dengan rapi (mendukung format divisi TRN-YYYYMMDD-DEPT-CAT atau format kustom)
    let trainingId = String(meta["ID training"] || data.id || "").trim();
    if (!trainingId || trainingId === "TRN" || trainingId === "-") {
      trainingId = generateTrainingIdFromMeta(meta, sheet);
      meta["ID training"] = trainingId;
      data.id = trainingId;
    }

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

    // Format ringkasan vendor (jika jenis pelatihan eksternal)
    const vendors = data.vendors || [];
    const vendorsSummary = vendors
      .filter(v => v.nama)
      .map((v, idx) => `${idx + 1}. ${v.nama} [Kontak: ${v.kontak || "-"} | Est. Biaya: ${v.biaya || "-"} | Info: ${v.catatan || "-"}]`)
      .join("\n");

    // Format meeting info
    let meetingInfo = "-";
    if (meta["Platform online"] || meta["Link meeting online"]) {
      meetingInfo = [meta["Platform online"], meta["Link meeting online"]].filter(Boolean).join(" - ");
    }

    // Format data sasaran SMART, evaluasi & target
    const goals = meta["Training goals"] || meta["Training plan purpose"] || "-";
    const hasilDiharapkan = meta["Hasil yang diharapkan"] || meta["Expected outcomes"] || "-";
    const penerapanKerja = meta["Penerapan di pekerjaan"] || meta["Aplikasi / implementasi"] || "-";
    const indikator = meta["Indikator keberhasilan"] || "-";
    const waktuEval = meta["Waktu evaluasi"] || meta["Interval follow-up"] || "-";
    const picEval = meta["PIC evaluasi"] || meta["PIC monitoring"] || "-";
    const linkEvaluasi = meta["Link form evaluasi"] || DEFAULT_EVALUATION_URL;

    // 1. Status Email Konfirmasi ke Peserta (Ditahan & baru dikirim bersamaan dengan kalender setelah Disetujui oleh Approver)
    const confirmationEmailStatus = "Menunggu Approval";

    // 2. Status Booking Ruangan & Kalender (Ditahan & baru dibuat otomatis setelah Disetujui oleh Approver)
    const calendarEventId = "Menunggu Approval";
    const bookingResult = {
      booked: false,
      status: "pending_approval",
      room: meta["Lokasi / venue"] || "-",
      message: "Pilihan ruangan tersimpan. Booking ruangan dan jadwal kalender akan dibuat otomatis setelah pengajuan disetujui oleh Approver."
    };

    // 3. Kirim Email Notifikasi ke 2-3 Approver Utama
    let approverNotifStatus = "Belum terkirim";
    try {
      approverNotifStatus = sendApproverNotification(meta, participants, modules, trainingId);
    } catch (apprErr) {
      Logger.log("Gagal kirim notifikasi approver: " + apprErr.toString());
      approverNotifStatus = "Error: " + apprErr.message;
    }

    // Initial Status Reminder H-1 & Reminder SLA Approver
    const reminderStatus = "Pending";
    const slaReminderStatus = "Pending";

    // 4. Proses Berkas Modul & Silabus Proposal ke Google Drive jika ada
    let proposalMaterialsSummary = meta["Link silabus materi"] || "-";
    if (Array.isArray(data.materials) && data.materials.length > 0) {
      try {
        const rootFolder = getEvidenceRootFolder();
        const propFolder = getOrCreateSubFolder(rootFolder, "📁 Proposal Modul Training");
        const sessionFolder = getOrCreateSubFolder(propFolder, `${trainingId}`);
        try {
          sessionFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (eShare) {
          try { sessionFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eLink) {}
        }
        const savedFiles = [];
        data.materials.forEach((m, idx) => {
          if (!m || !m.base64) return;
          try {
            let cleanBase64 = String(m.base64).trim();
            if (cleanBase64.indexOf("base64,") !== -1) {
              cleanBase64 = cleanBase64.substring(cleanBase64.indexOf("base64,") + 7);
            }
            cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, "");
            const decodedBytes = Utilities.base64Decode(cleanBase64);
            const fileName = (m.name || `modul_${idx + 1}.pdf`).toString().trim();
            const mimeType = resolveMaterialMimeType(fileName, m.type);
            const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
            const driveFile = sessionFolder.createFile(blob);
            try {
              driveFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (efs) {
              try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (efl) {}
            }
            savedFiles.push(`${fileName} (${driveFile.getUrl()})`);
          } catch (fileErr) {
            Logger.log("Gagal simpan berkas modul proposal: " + fileErr.toString());
          }
        });
        if (savedFiles.length > 0) {
          proposalMaterialsSummary = savedFiles.join("\n");
          if (meta["Link silabus materi"]) {
            proposalMaterialsSummary += `\nLink Cloud: ${meta["Link silabus materi"]}`;
          }
        }
      } catch (propErr) {
        Logger.log("Gagal buat folder proposal modul: " + propErr.toString());
      }
    }

    // Petakan data ke urutan header aktual sheet agar tidak terjadi pergeseran kolom
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const rowMap = {
      "Waktu Submit": data.submittedAt || Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss"),
      "ID Training": trainingId,
      "Status Dokumen": data.status || "Diajukan",
      "Jenis Training": meta["Jenis training"] || "Training Internal",
      "Nama Training": meta["Nama training"] || "-",
      "Nama Pengaju": meta["Nama pengaju"] || meta["Leader pengaju"] || "-",
      "Email Pengaju": meta["Email pengaju"] || meta["Email leader"] || "-",
      "Departemen / Divisi": meta["Departemen / divisi"] || "-",
      "Kategori Training": meta["Kategori training"] || "-",
      "Target Level Kemahiran": meta["Target level kemahiran"] || "-",
      "Kategori Kebutuhan Training": meta["Kategori kebutuhan training"] || "-",
      "Tanggal Pengajuan": meta["Tanggal pengajuan"] || "-",
      "Metode Training": meta["Metode training"] || "-",
      "Jadwal Pelaksanaan": meta["Tanggal & jam pelaksanaan"] || "-",
      "Lokasi / Venue": meta["Lokasi / venue"] || "-",
      "Platform & Link Meeting": meetingInfo,
      "Trainer / Fasilitator": meta["Trainer"] || "-",
      "Opsi Vendor (Eksternal)": vendorsSummary || "-",
      "Total Durasi Belajar": meta["Total durasi belajar"] || "-",
      "Jumlah Partisipan (Rencana)": meta["Jumlah partisipan (rencana)"] || "-",
      "Jumlah Peserta Terdaftar": participants.filter(p => p.nama).length,
      "Daftar Peserta (Ringkasan)": participantsSummary || "-",
      "Modul & Sesi (Ringkasan)": modulesSummary || "-",
      "Modul & Materi (File/Link)": proposalMaterialsSummary || meta["Link silabus materi"] || "-",
      "Training Goals": goals,
      "Hasil yang Diharapkan": hasilDiharapkan,
      "Penerapan di Pekerjaan": penerapanKerja,
      "Indikator Keberhasilan": indikator,
      "Waktu Evaluasi": waktuEval,
      "PIC Evaluasi": picEval,
      "Link Form Evaluasi": linkEvaluasi,
      "Status Email Konfirmasi": confirmationEmailStatus,
      "Status Email Reminder H-1": reminderStatus,
      "Status Reminder Approval": slaReminderStatus,
      "ID Event Google Calendar": calendarEventId,
      "Approver": "-",
      "Tanggal Approval": "-",
      "Catatan Approver": "-",
      "Raw Data JSON": JSON.stringify(data)
    };

    const rowData = currentHeaders.map(h => (rowMap[h] !== undefined ? rowMap[h] : "-"));
    sheet.appendRow(rowData);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: "Data saved to Google Sheets successfully",
        id: meta["ID training"] || trainingId,
        roomBooking: bookingResult,
        approverNotification: approverNotifStatus
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// 1.1 HANDLER UPDATE APPROVAL STATUS & CATATAN
// ==============================================================================
function handleUpdateApproval(sheet, data) {
  const trainingId = data.id || data.idTraining || data["ID Training"] || "";
  const status = normalizeApprovalStatus(data.status);
  const approverName = data.approverName || data.approver || "Approver";
  const notes = data.notes || data.catatan || "-";

  if (!trainingId) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "ID training tidak disertakan" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (!status) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Status approval tidak valid. Gunakan 'Disetujui' atau 'Ditolak'." })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Belum ada data pada spreadsheet" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const rawHeaders = values[0].map(h => String(h).trim());
  const headersLower = rawHeaders.map(h => h.toLowerCase());

  const colId = headersLower.indexOf("id training");
  const colDocStatus = headersLower.indexOf("status dokumen");
  const colApprover = headersLower.indexOf("approver");
  const colApprovalDate = headersLower.indexOf("tanggal approval");
  const colApprovalNotes = headersLower.indexOf("catatan approver");
  const colCalEventId = headersLower.indexOf("id event google calendar");
  const colEmailConfirm = headersLower.indexOf("status email konfirmasi");
  const colRawJson = headersLower.indexOf("raw data json");

  if (colId === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Kolom 'ID Training' tidak ditemukan pada sheet" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  let foundRowIdx = -1;
  const targetIdClean = String(trainingId).trim().toUpperCase();

  for (let i = 1; i < values.length; i++) {
    const rowId = String(values[i][colId]).trim().toUpperCase();
    if (rowId === targetIdClean) {
      foundRowIdx = i;
      break;
    }
  }

  if (foundRowIdx === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: `Training dengan ID '${trainingId}' tidak ditemukan` })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const targetRowNum = foundRowIdx + 1;
  const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm");

  if (colDocStatus !== -1) {
    sheet.getRange(targetRowNum, colDocStatus + 1).setValue(status);
  }
  if (colApprover !== -1) {
    sheet.getRange(targetRowNum, colApprover + 1).setValue(approverName);
  }
  if (colApprovalDate !== -1) {
    sheet.getRange(targetRowNum, colApprovalDate + 1).setValue(timestamp);
  }
  if (colApprovalNotes !== -1) {
    sheet.getRange(targetRowNum, colApprovalNotes + 1).setValue(notes);
  }

  // Bangun objek data row untuk keperluan notifikasi email & pemrosesan
  const rowObj = {};
  rawHeaders.forEach((h, idx) => {
    rowObj[h] = values[foundRowIdx][idx];
  });
  rowObj["Status Dokumen"] = status;
  rowObj["Approver"] = approverName;
  rowObj["Tanggal Approval"] = timestamp;
  rowObj["Catatan Approver"] = notes;

  const isApproved = String(status).toLowerCase().includes("setuju") || String(status).toLowerCase().includes("approve");
  const isRejected = String(status).toLowerCase().includes("tolak") || String(status).toLowerCase().includes("reject");

  let calendarEventId = colCalEventId !== -1 ? String(values[foundRowIdx][colCalEventId] || "").trim() : "";
  let confirmationEmailStatus = colEmailConfirm !== -1 ? String(values[foundRowIdx][colEmailConfirm] || "").trim() : "";
  let bookingResult = null;

  if (isApproved) {
    // 1. Ekstrak data meta, participants, dan modules dari Raw Data JSON atau rowObj
    let meta = {};
    let participants = [];
    let modules = [];

    if (colRawJson !== -1 && values[foundRowIdx][colRawJson]) {
      try {
        const parsed = JSON.parse(values[foundRowIdx][colRawJson]);
        meta = parsed.meta || {};
        participants = parsed.participants || [];
        modules = parsed.modules || [];
      } catch (jsonErr) {
        Logger.log("Peringatan parse Raw Data JSON di handleUpdateApproval: " + jsonErr.toString());
      }
    }

    // Fallback data meta jika belum lengkap di JSON
    if (!meta["ID training"]) meta["ID training"] = rowObj["ID Training"] || trainingId;
    if (!meta["Nama training"]) meta["Nama training"] = rowObj["Nama Training"] || "-";
    if (!meta["Lokasi / venue"]) meta["Lokasi / venue"] = rowObj["Lokasi / Venue"] || "-";
    if (!meta["Tanggal & jam pelaksanaan"]) meta["Tanggal & jam pelaksanaan"] = rowObj["Jadwal Pelaksanaan"] || "-";
    if (!meta["Trainer"]) meta["Trainer"] = rowObj["Trainer / Fasilitator"] || "-";
    if (!meta["Nama pengaju"]) meta["Nama pengaju"] = rowObj["Nama Pengaju"] || "-";
    if (!meta["Email pengaju"]) meta["Email pengaju"] = rowObj["Email Pengaju"] || "";
    if (!meta["Departemen / divisi"]) meta["Departemen / divisi"] = rowObj["Departemen / Divisi"] || "-";
    if (!meta["Metode training"]) meta["Metode training"] = rowObj["Metode Training"] || "Onsite";
    if (!meta["Link silabus materi"]) meta["Link silabus materi"] = rowObj["Link Silabus / Materi"] || "";

    // 2. Eksekusi booking ruangan internal & Google Calendar hanya jika belum dibuat sebelumnya
    const needsCalendarBooking = !calendarEventId || calendarEventId === "-" || calendarEventId === "Menunggu Approval" || calendarEventId.toLowerCase().startsWith("gagal");

    if (needsCalendarBooking) {
      try {
        bookingResult = bookMeetingRoom(meta, participants, modules);
        if (bookingResult && bookingResult.booked && bookingResult.eventId) {
          calendarEventId = bookingResult.eventId;
        }
      } catch (bookErr) {
        Logger.log("Peringatan bookMeetingRoom saat approval: " + bookErr.toString());
      }

      if (calendarEventId === "-" || !calendarEventId || calendarEventId === "Menunggu Approval") {
        try {
          calendarEventId = createCalendarEvent(meta, participants, modules);
        } catch (calErr) {
          Logger.log("Gagal createCalendarEvent saat approval: " + calErr.toString());
          calendarEventId = "Gagal: " + calErr.message;
        }
      }

      if (colCalEventId !== -1) {
        sheet.getRange(targetRowNum, colCalEventId + 1).setValue(calendarEventId);
        rowObj["ID Event Google Calendar"] = calendarEventId;
      }
    }

    // 3. Kirim Email Konfirmasi Pendaftaran ke Peserta Terdaftar (Kini resmi berjalan setelah disetujui)
    const needsParticipantEmail = !confirmationEmailStatus || confirmationEmailStatus === "-" || confirmationEmailStatus === "Menunggu Approval" || confirmationEmailStatus.toLowerCase().startsWith("error");

    if (needsParticipantEmail) {
      try {
        confirmationEmailStatus = sendRegistrationEmails(meta, participants, modules);
      } catch (mailErr) {
        Logger.log("Gagal kirim email konfirmasi ke peserta saat approval: " + mailErr.toString());
        confirmationEmailStatus = "Error: " + mailErr.message;
      }

      if (colEmailConfirm !== -1) {
        sheet.getRange(targetRowNum, colEmailConfirm + 1).setValue(confirmationEmailStatus);
        rowObj["Status Email Konfirmasi"] = confirmationEmailStatus;
      }
    }
  } else if (isRejected) {
    // Jika ditolak, tandai status kalender dan email konfirmasi jika sebelumnya berstatus 'Menunggu Approval'
    if (calendarEventId === "Menunggu Approval" || !calendarEventId || calendarEventId === "-") {
      calendarEventId = "Dibatalkan (Ditolak)";
      if (colCalEventId !== -1) {
        sheet.getRange(targetRowNum, colCalEventId + 1).setValue(calendarEventId);
        rowObj["ID Event Google Calendar"] = calendarEventId;
      }
    }
    if (confirmationEmailStatus === "Menunggu Approval" || !confirmationEmailStatus || confirmationEmailStatus === "-") {
      confirmationEmailStatus = "Dibatalkan (Ditolak)";
      if (colEmailConfirm !== -1) {
        sheet.getRange(targetRowNum, colEmailConfirm + 1).setValue(confirmationEmailStatus);
        rowObj["Status Email Konfirmasi"] = confirmationEmailStatus;
      }
    }
  }

  let emailStatus = "Belum terkirim";
  try {
    emailStatus = sendApprovalDecisionEmail(rowObj, status, approverName, notes);
  } catch (emailErr) {
    Logger.log("Gagal mengirim email keputusan approval: " + emailErr.toString());
    emailStatus = "Error: " + emailErr.message;
  }

  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      message: isApproved 
        ? "Status approval berhasil disetujui, ruangan telah di-booked, dan undangan kalender dikirim ke peserta."
        : "Status pengajuan berhasil ditolak.",
      id: trainingId,
      status: status,
      calendarEventId: calendarEventId,
      roomBooking: bookingResult,
      confirmationEmailStatus: confirmationEmailStatus,
      emailStatus: emailStatus
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 1.2 HANDLER HAPUS SUBMISSION DARI SPREADSHEET
// ==============================================================================
function handleDeleteSubmission(sheet, data) {
  const trainingId = String(data.id || data.idTraining || data["ID Training"] || "").trim().toUpperCase();
  if (!trainingId) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "ID training tidak disertakan" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Belum ada data pada spreadsheet" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const headersLower = values[0].map(h => String(h).trim().toLowerCase());
  const colId = headersLower.indexOf("id training");
  if (colId === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Kolom 'ID Training' tidak ditemukan pada sheet" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  let foundRowIdx = -1;
  for (let i = 1; i < values.length; i++) {
    const rowId = String(values[i][colId]).trim().toUpperCase();
    if (rowId === trainingId) {
      foundRowIdx = i + 1; // 1-indexed untuk sheet row
      break;
    }
  }

  if (foundRowIdx === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: `Training dengan ID '${trainingId}' tidak ditemukan di sheet` })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  sheet.deleteRow(foundRowIdx);

  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      message: `Pengajuan training ${trainingId} berhasil dihapus dari spreadsheet`,
      id: trainingId
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 2. SETUP SPREADSHEET HEADERS & INITIAL TEMPLATE
// ==============================================================================
const CONFIG_APPROVERS_SHEET = "Config_Approvers";

const DEFAULT_APPROVER_DIRECTORY = {
  "WEB DEVELOPER":        { name: "Budi Santoso (Lead)", email: "budi.lead@perusahaan.com", title: "Head of Engineering" },
  "MOBILE DEVELOPER":     { name: "Budi Santoso (Lead)", email: "budi.lead@perusahaan.com", title: "Head of Engineering" },
  "UI/UX DESIGN":         { name: "Siti Rahma",         email: "siti.lead@perusahaan.com", title: "Head of Product & Design" },
  "PRODUCT MANAGEMENT":   { name: "Siti Rahma",         email: "siti.lead@perusahaan.com", title: "Head of Product & Design" },
  "FINANCE & ACCOUNTING": { name: "Dedi Firmansyah",     email: "dedi.mgr@perusahaan.com",  title: "Finance & Accounting Manager" },
  "HR & GENERAL AFFAIRS": { name: "Maya Anggraini",     email: "maya.hr@perusahaan.com",   title: "HR & General Affairs Manager" },
  "MARKETING & SALES":    { name: "Hendra Wijaya",      email: "hendra.mkt@perusahaan.com",title: "Marketing Director" },
  "CUSTOMER SUPPORT":     { name: "Ratna Sari",         email: "ratna.cs@perusahaan.com",  title: "Customer Support Lead" },
  "DEFAULT":              { name: "HR Training Team",    email: "training@cpssoft.com",     title: "Training & Development Lead" }
};

const DEPT_CODE_MAP = {
  'HR': 'HR',
  'GA': 'GA',
  'LEGAL': 'LEG',
  'FINANCE': 'FIN',
  'ACCOUNTING': 'ACC',
  'TAX': 'TAX',
  'MARKETING': 'MKT',
  'SALES OPS': 'SOP',
  'SALES ENABLEMENT': 'SEN',
  'TELEMARKETING': 'TLM',
  'PEC': 'PEC',
  'CUSTOMER EXPERIENCE': 'CX',
  'QA': 'QA',
  'WEB DEVELOPER': 'WEB',
  'INTEGRATION': 'INT',
  'MOBILE DEVELOPER': 'MOB',
  'UI/UX DESIGNER': 'UXD',
  'UI/UX DESIGN': 'UXD',
  'AI': 'AI',
  'BUSINESS ANALYST': 'BA',
  'IT INFRASTRUCTURE': 'ITI'
};

/**
 * Menghasilkan ID Training format TRN-YYYYMMDD-DEPT-CATEGORY dari metadata pengajuan
 * Contoh: TRN-20261004-FIN-SS (FINANCE -> FIN, HR -> HR, dsb)
 */
function generateTrainingIdFromMeta(meta, sheet) {
  let datePart = "";
  const tgl = String(meta["Tanggal pengajuan"] || "").trim();
  if (tgl) {
    const cleanTgl = tgl.replace(/[^0-9]/g, "");
    if (cleanTgl.length >= 8) {
      datePart = cleanTgl.substring(0, 8);
    }
  }
  if (!datePart) {
    datePart = Utilities.formatDate(new Date(), TIME_ZONE, "yyyyMMdd");
  }

  const dept = String(meta["Departemen / divisi"] || "").trim().toUpperCase();
  let deptCode = DEPT_CODE_MAP[dept] || dept.replace(/[^A-Z]/g, "").substring(0, 3) || "GEN";

  const cat = String(meta["Kategori training"] || "").trim().toLowerCase();
  const catCode = cat.includes("hard") ? "HS" : "SS";

  const basePrefix = `TRN-${datePart}-${deptCode}-${catCode}`;

  let counter = 0;
  if (sheet && sheet.getLastRow() > 1) {
    try {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIdIdx = headers.map(h => String(h).trim().toLowerCase()).indexOf("id training");
      if (colIdIdx !== -1) {
        const idValues = sheet.getRange(2, colIdIdx + 1, sheet.getLastRow() - 1, 1).getValues();
        idValues.forEach(r => {
          const val = String(r[0] || "").trim().toUpperCase();
          if (val === basePrefix) {
            if (counter === 0) counter = 1;
          } else if (val.startsWith(basePrefix + "-")) {
            const num = parseInt(val.replace(basePrefix + "-", ""), 10);
            if (!isNaN(num) && num > counter) counter = num;
          }
        });
      }
    } catch (e) {}
  }

  return counter > 0 ? `${basePrefix}-${String(counter + 1).padStart(2, "0")}` : basePrefix;
}

/**
 * Menghasilkan ID Training sekuensial format TRN-YYYY-XXX dari baris Google Sheets yang sudah ada.
 */
function generateNextSequentialId(sheet, year) {
  if (!year) year = new Date().getFullYear();
  let maxSeq = 0;
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIdIdx = headers.map(h => String(h).trim().toLowerCase()).indexOf("id training");
      if (colIdIdx !== -1) {
        const idValues = sheet.getRange(2, colIdIdx + 1, lastRow - 1, 1).getValues();
        idValues.forEach(r => {
          const val = String(r[0] || "").trim();
          const match = val.match(new RegExp(`^TRN-${year}-(\\d+)`, "i"));
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
      }
    }
  } catch (err) {
    Logger.log("Peringatan generateNextSequentialId: " + err.toString());
  }
  const nextNum = maxSeq + 1;
  return `TRN-${year}-${String(nextNum).padStart(3, "0")}`;
}

function formatHeaderRow(sheet, totalCols) {
  const headerRange = sheet.getRange(1, 1, 1, totalCols);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#00178F");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
}

function setupSheetHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatHeaderRow(sheet, HEADERS.length);
  } else {
    // Sinkronkan kolom baru jika ada header yang belum tercantum pada row 1
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const currentHeadersLower = currentHeaders.map(h => h.toLowerCase());
    const missingHeaders = HEADERS.filter(h => !currentHeadersLower.includes(h.toLowerCase()));
    if (missingHeaders.length > 0) {
      const startCol = currentHeaders.length + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      formatHeaderRow(sheet, currentHeaders.length + missingHeaders.length);
    }
  }
}

/**
 * ==============================================================================
 * 1. MENU KHUSUS GOOGLE SHEETS (Otomatis muncul di bar menu atas spreadsheet)
 * ==============================================================================
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🎓 TDS Portal Training")
      .addItem("🔄 Format / Reset Sheet Sesuai Preview (resetSheet)", "resetSheet")
      .addItem("🚀 Setup Inisialisasi Sheet Baru", "setupInitialSpreadsheet")
      .addSeparator()
      .addItem("⏰ Cek & Kirim Reminder H-1 Sekarang", "checkAndSendReminders")
      .addItem("📧 Test Kirim Notifikasi Email", "testSendAllEmails")
      .addToUi();
  } catch (e) {
    Logger.log("onOpen non-UI context: " + e.toString());
  }
}

/**
 * ==============================================================================
 * FUNGSI UTAMA: resetSheet (Muncul langsung pada dropdown editor Apps Script)
 * ==============================================================================
 * Menyelaraskan seluruh kolom spreadsheet menjadi 38 kolom persis sesuai preview.
 */
function resetSheet() {
  resetSheetHeadersToPreview();
}

/**
 * ALIAS FUNGSI: resetSheetHeaders
 */
function resetSheetHeaders() {
  resetSheetHeadersToPreview();
}

/**
 * ==============================================================================
 * REFORMAT & SINKRONISASI SHEET DENGAN FORM PREVIEW (ONE-CLICK MIGRATION)
 * ==============================================================================
 * Jalankan fungsi ini dari editor Apps Script kapan saja untuk memperbarui sheet lama!
 * Fitur:
 * 1. Mengubah struktur kolom persis sesuai 38 data yang diajukan di preview.
 * 2. Menghapus kolom usang yang sudah tidak dipakai (Rincian Biaya, Budget, Silabus, dll).
 * 3. Menyelaraskan seluruh data baris historis yang sudah tersimpan agar tetap aman.
 * 4. Otomatis mengekstrak kembali nilai asli dari 'Raw Data JSON' jika tersedia.
 */
function resetSheetHeadersToPreview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME, 0);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    formatHeaderRow(sheet, HEADERS.length);
    Logger.log("✅ Tab 'Training Submissions' berhasil diformat dengan 38 kolom header baru sesuai form & preview!");
    return;
  }

  const oldHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const oldData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const aliasMap = {
    "goals (target)": "Training Goals",
    "tujuan & purpose": "Training Goals",
    "link form evaluasi / post-test": "Link Form Evaluasi"
  };

  const newRows = oldData.map(row => {
    const jsonIdx = oldHeaders.map(h => h.toLowerCase()).indexOf("raw data json");
    let parsedMeta = null;
    let parsedData = null;
    if (jsonIdx !== -1 && row[jsonIdx]) {
      try {
        parsedData = JSON.parse(row[jsonIdx]);
        parsedMeta = parsedData.meta || {};
      } catch (e) {}
    }

    return HEADERS.map(newHeader => {
      if (parsedMeta) {
        if (newHeader === "Training Goals" && (parsedMeta["Training goals"] || parsedMeta["Training plan purpose"])) {
          return parsedMeta["Training goals"] || parsedMeta["Training plan purpose"];
        }
        if (newHeader === "Jenis Training" && parsedMeta["Jenis training"]) {
          return parsedMeta["Jenis training"];
        }
        if (newHeader === "Hasil yang Diharapkan" && (parsedMeta["Hasil yang diharapkan"] || parsedMeta["Expected outcomes"])) {
          return parsedMeta["Hasil yang diharapkan"] || parsedMeta["Expected outcomes"];
        }
        if (newHeader === "Penerapan di Pekerjaan" && (parsedMeta["Penerapan di pekerjaan"] || parsedMeta["Aplikasi / implementasi"])) {
          return parsedMeta["Penerapan di pekerjaan"] || parsedMeta["Aplikasi / implementasi"];
        }
        if (newHeader === "Indikator Keberhasilan" && parsedMeta["Indikator keberhasilan"]) {
          return parsedMeta["Indikator keberhasilan"];
        }
        if (newHeader === "Waktu Evaluasi" && (parsedMeta["Waktu evaluasi"] || parsedMeta["Interval follow-up"])) {
          return parsedMeta["Waktu evaluasi"] || parsedMeta["Interval follow-up"];
        }
        if (newHeader === "PIC Evaluasi" && (parsedMeta["PIC evaluasi"] || parsedMeta["PIC monitoring"])) {
          return parsedMeta["PIC evaluasi"] || parsedMeta["PIC monitoring"];
        }
        if (newHeader === "Opsi Vendor (Eksternal)" && parsedData && parsedData.vendors && parsedData.vendors.length) {
          const vList = parsedData.vendors.filter(v => v.nama).map((v, i) => `${i + 1}. ${v.nama} [Kontak: ${v.kontak || "-"} | Est. Biaya: ${v.biaya || "-"} | Info: ${v.catatan || "-"}]`).join("\n");
          if (vList) return vList;
        }
      }

      const exactIdx = oldHeaders.indexOf(newHeader);
      if (exactIdx !== -1) return row[exactIdx];

      const lowerNew = newHeader.toLowerCase();
      const caseIdx = oldHeaders.map(h => h.toLowerCase()).indexOf(lowerNew);
      if (caseIdx !== -1) return row[caseIdx];

      for (const [oldKey, targetKey] of Object.entries(aliasMap)) {
        if (targetKey.toLowerCase() === lowerNew) {
          const aliasIdx = oldHeaders.map(h => h.toLowerCase()).indexOf(oldKey);
          if (aliasIdx !== -1) return row[aliasIdx];
        }
      }

      return "-";
    });
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, HEADERS.length).setValues(newRows);
  }
  formatHeaderRow(sheet, HEADERS.length);

  Logger.log(`✅ Berhasil merestrukturisasi & memigrasikan ${newRows.length} baris ke format 38 kolom sesuai preview!`);
}

/**
 * FUNGSI SETUP OTOMATIS MASTER SPREADSHEET
 * Jalankan fungsi ini 1 kali dari editor Apps Script pada Google Sheet kosong / baru!
 * Otomatis membuat tab "Training Submissions" (38 kolom lengkap), tab "Config_Approvers", dan tab "Post Training".
 */
function setupInitialSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Inisialisasi Sheet Utama "Training Submissions" sesuai format Preview
  let mainSheet = ss.getSheetByName(SHEET_NAME);
  if (!mainSheet) {
    mainSheet = ss.insertSheet(SHEET_NAME, 0);
  }
  resetSheetHeadersToPreview();

  // 2. Inisialisasi Sheet Rahasia "Config_Approvers"
  let cfgSheet = ss.getSheetByName(CONFIG_APPROVERS_SHEET);
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet(CONFIG_APPROVERS_SHEET, 1);
  }
  if (cfgSheet.getLastRow() === 0) {
    const cfgHeaders = ["Departemen / Divisi", "Nama Approver", "Email Approver", "Keterangan Jabatan"];
    cfgSheet.appendRow(cfgHeaders);
    const hRange = cfgSheet.getRange(1, 1, 1, cfgHeaders.length);
    hRange.setFontWeight("bold");
    hRange.setBackground("#2D4A3E");
    hRange.setFontColor("#FFFFFF");
    cfgSheet.setFrozenRows(1);

    for (const [dept, info] of Object.entries(DEFAULT_APPROVER_DIRECTORY)) {
      if (dept !== "DEFAULT") {
        cfgSheet.appendRow([dept, info.name, info.email, info.title]);
      }
    }
    cfgSheet.appendRow(["DEFAULT", DEFAULT_APPROVER_DIRECTORY.DEFAULT.name, DEFAULT_APPROVER_DIRECTORY.DEFAULT.email, DEFAULT_APPROVER_DIRECTORY.DEFAULT.title]);
  }

  // 3. Inisialisasi Sheet "Post Training" (Unggah Evidence & Hasil Post-Test)
  let postSheet = ss.getSheetByName(POST_TRAINING_SHEET_NAME);
  if (!postSheet) {
    postSheet = ss.insertSheet(POST_TRAINING_SHEET_NAME, 2);
  }
  setupPostTrainingSheet(postSheet);

  Logger.log("=================================================");
  Logger.log("✅ INISIALISASI SPREADSHEET BERHASIL!");
  Logger.log(`- Tab 1: '${SHEET_NAME}' (38 Kolom Sesuai Preview & Form)`);
  Logger.log(`- Tab 2: '${CONFIG_APPROVERS_SHEET}' (Daftar Approver per Divisi)`);
  Logger.log(`- Tab 3: '${POST_TRAINING_SHEET_NAME}' (Bukti Evidence Drive & Post-Test)`);
  Logger.log("=================================================");
}

/**
 * Mengambil nama dan email approver berdasarkan departemen/divisi pengaju.
 * Prioritas:
 * 1. Dari tab 'Config_Approvers' di spreadsheet jika tersedia.
 * 2. Fallback ke DEFAULT_APPROVER_DIRECTORY di kode script jika tab belum diisi.
 */
function getApproverForDepartment(deptName) {
  const cleanDept = String(deptName || "").trim().toUpperCase();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cfgSheet = ss.getSheetByName(CONFIG_APPROVERS_SHEET);
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      const rows = cfgSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const rowDept = String(rows[i][0] || "").trim().toUpperCase();
        if (rowDept === cleanDept || (cleanDept.includes(rowDept) && rowDept.length > 2)) {
          return {
            name: String(rows[i][1] || "Approver").trim(),
            email: String(rows[i][2] || "").trim(),
            title: String(rows[i][3] || "").trim()
          };
        }
      }
      // Cek fallback baris DEFAULT di sheet
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0] || "").trim().toUpperCase() === "DEFAULT") {
          return {
            name: String(rows[i][1] || "Approver").trim(),
            email: String(rows[i][2] || "").trim(),
            title: String(rows[i][3] || "").trim()
          };
        }
      }
    }
  } catch (err) {
    Logger.log("Peringatan membaca tab Config_Approvers: " + err.toString());
  }

  // Fallback ke direktori konstanta kode
  if (cleanDept && DEFAULT_APPROVER_DIRECTORY[cleanDept]) {
    return DEFAULT_APPROVER_DIRECTORY[cleanDept];
  }
  for (const [key, val] of Object.entries(DEFAULT_APPROVER_DIRECTORY)) {
    if (cleanDept.includes(key) || key.includes(cleanDept)) {
      return val;
    }
  }
  return DEFAULT_APPROVER_DIRECTORY.DEFAULT;
}

/**
 * Mengambil daftar email seluruh approver yang berhak menerima notifikasi
 * (Menggabungkan 2-3 approver utama global dan approver spesifik divisi).
 * Dilengkapi proteksi fallback ke email akun aktif Apps Script jika belum diisi email nyata.
 */
function getApproverListForSubmission(deptName) {
  const result = [];
  const seen = new Set();

  const addEmail = (raw) => {
    if (!raw) return;
    const em = String(raw).trim().toLowerCase();
    if (em.includes("@") && em.includes(".") && !seen.has(em)) {
      seen.add(em);
      result.push(em);
    }
  };

  // 1. Tambahkan 2-3 Approver Utama Global
  if (Array.isArray(APPROVER_EMAILS)) {
    APPROVER_EMAILS.forEach(em => {
      if (!em.includes("perusahaan.com")) {
        addEmail(em);
      }
    });
  }

  // 2. Tambahkan Approver spesifik departemen pengaju (jika bukan placeholder)
  const deptApprover = getApproverForDepartment(deptName);
  if (deptApprover && deptApprover.email && !deptApprover.email.includes("perusahaan.com")) {
    addEmail(deptApprover.email);
  }

  // 3. Fallback: Jika seluruh daftar masih placeholder / kosong, gunakan email pemilik akun Google aktif
  if (result.length === 0) {
    try {
      const activeUser = Session.getActiveUser().getEmail();
      if (activeUser && activeUser.includes("@")) {
        addEmail(activeUser);
      }
    } catch (e) {}
  }

  // 4. Jika tetap kosong, kembalikan approver default agar dicatat di log
  if (result.length === 0 && Array.isArray(APPROVER_EMAILS)) {
    APPROVER_EMAILS.forEach(addEmail);
  }

  return result;
}

// ==============================================================================
// 3. PENGIRIMAN EMAIL KONFIRMASI INSTAN KE PESERTA
// ==============================================================================
function sendRegistrationEmails(meta, participants, modules) {
  let validParticipants = (participants || []).filter(p => {
    const email = String(p.email || '').trim();
    return email.includes('@') && email.includes('.');
  });

  // Fallback jika participants kosong tapi ada email pengaju di meta
  if (validParticipants.length === 0 && meta) {
    const pengajuEmail = meta["Email pengaju"] || meta["Email leader"] || meta["Email"] || "";
    if (pengajuEmail && String(pengajuEmail).includes("@")) {
      validParticipants.push({
        nama: meta["Nama pengaju"] || meta["Leader pengaju"] || "Rekan Karyawan",
        email: String(pengajuEmail).trim(),
        departemen: meta["Departemen / divisi"] || ""
      });
    }
  }

  if (validParticipants.length === 0) {
    Logger.log("Peringatan sendRegistrationEmails: Tidak ada email peserta valid dalam data.");
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
    ? `<a href="${meta["Link silabus materi"]}" target="_blank" style="color:#00178F;font-weight:600;text-decoration:underline;">Buka Silabus / Materi Pelatihan &rarr;</a>`
    : "-";

  let sentCount = 0;
  let errorMsgs = [];

  validParticipants.forEach(p => {
    const recipientEmail = String(p.email).trim();
    const recipientName = p.nama || "Rekan Karyawan";
    const subject = `[Konfirmasi Pendaftaran] Pelatihan: ${trainingName} (${trainingId})`;

    let actionBtnHtml = "";
    if (meta["Link meeting online"] && (metode === "Online" || metode === "Hybrid")) {
      actionBtnHtml = `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>
              <td style="border-radius:100px;background:linear-gradient(180deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#FFD3DE;">
                <a href="${meta["Link meeting online"]}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:14.5px;font-weight:700;color:#00178F;text-decoration:none;border-radius:100px;">Masuk ke Link Meeting &nbsp;&#8594;</a>
              </td>
            </tr>
          </table>`;
    } else if (meta["Link silabus materi"] && String(meta["Link silabus materi"]).trim() !== "-" && String(meta["Link silabus materi"]).trim() !== "") {
      actionBtnHtml = `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>
              <td style="border-radius:100px;background:linear-gradient(180deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#FFD3DE;">
                <a href="${meta["Link silabus materi"]}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:14.5px;font-weight:700;color:#00178F;text-decoration:none;border-radius:100px;">Buka Silabus / Materi &nbsp;&#8594;</a>
              </td>
            </tr>
          </table>`;
    }

    const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">&#128197;</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:23px;font-weight:700;color:#00178F;line-height:1.3;">Konfirmasi Pendaftaran &#127881;</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 12px;">
          <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Halo ${recipientName},</p>
          <p style="margin:0 0 20px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">
            Anda telah resmi didaftarkan untuk mengikuti program pelatihan internal berikut. Silahkan mencatat jadwal dan detail pelaksanaannya di bawah ini:
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FBFE;border-radius:12px;border:1px solid #E1E8F8;overflow:hidden;margin-bottom:22px;">
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;width:130px;">ID Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:700;color:#00178F;">${trainingId}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Topik Pelatihan</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jadwal</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${jadwal}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Metode</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${metode}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Lokasi / Link</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${lokasiOrLink}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;font-size:12px;font-weight:600;color:#8D93C2;">Trainer</td>
              <td style="padding:11px 16px;font-size:13.5px;color:#4A4F8F;">${trainer}</td>
            </tr>
            ${meta["Link silabus materi"] && String(meta["Link silabus materi"]).trim() !== "-" && String(meta["Link silabus materi"]).trim() !== "" ? `
            <tr>
              <td style="padding:11px 16px;border-top:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Materi / Silabus</td>
              <td style="padding:11px 16px;border-top:1px solid #EDF1FE;font-size:13.5px;">${silabusLink}</td>
            </tr>` : ''}
          </table>

          <div style="background:rgba(75, 150, 255, 0.08);border-left:4px solid #4B96FF;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#00178F;">
            <strong>Catatan Persiapan:</strong> Mohon hadir 5&ndash;10 menit sebelum sesi dimulai. Pastikan perangkat dan kebutuhan prasyarat telah disiapkan dengan baik.
          </div>

          ${actionBtnHtml}

          <p style="margin:0;font-size:13.5px;color:#4A4F8F;line-height:1.6;">
            Salam hangat,<br>
            <strong style="color:#00178F;">Tim Training &amp; People Development</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Email otomatis dari Training Request System &middot; Jangan reply email ini</p>
        </td>
      </tr>
    </table>
  </div>`;

    const plainText = `Halo ${recipientName},\n\nAnda telah terdaftar dalam pelatihan internal:\nTopik: ${trainingName}\nID: ${trainingId}\nJadwal: ${jadwal}\nLokasi/Link: ${meta["Lokasi / venue"] || meta["Link meeting online"] || "-"}\nTrainer: ${trainer}\n\nSalam,\nTim TnD`;

    try {
      GmailApp.sendEmail(recipientEmail, subject, plainText, {
        htmlBody: htmlBody,
        name: "Training & Development Portal"
      });
      sentCount++;
    } catch (err) {
      Logger.log(`Gagal kirim ke ${recipientEmail}: ${err.toString()}`);
      errorMsgs.push(`${recipientEmail}: ${err.message}`);
    }
  });

  if (errorMsgs.length > 0 && sentCount === 0) {
    return `Error (${errorMsgs[0]})`;
  }
  return `Terkirim (${sentCount}/${validParticipants.length})`;
}

// ==============================================================================
// 3.1 PENGIRIMAN EMAIL HASIL KEPUTUSAN APPROVAL KE PENGAJU
// ==============================================================================
function sendApprovalDecisionEmail(rowObj, status, approverName, notes) {
  const trainingId = rowObj["ID Training"] || "TRN";
  const trainingName = rowObj["Nama Training"] || "Pelatihan Karyawan";
  const pengaju = rowObj["Nama Pengaju"] || rowObj["Leader Pengaju"] || "Leader / Pengaju";
  const departemen = rowObj["Departemen / Divisi"] || "-";
  const jadwal = rowObj["Jadwal Pelaksanaan"] || "-";
  const trainer = rowObj["Trainer / Fasilitator"] || "-";
  const metode = rowObj["Metode Training"] || "-";
  const venue = rowObj["Lokasi / Venue"] || rowObj["Platform & Link Meeting"] || "-";
  const estimasiBiaya = rowObj["Estimasi Biaya"] || "-";
  const budgetDiajukan = rowObj["Budget Diajukan"] || "-";
  const approver = approverName || rowObj["Approver"] || "Approver";
  const catatan = notes || rowObj["Catatan Approver"] || "-";
  const tanggalApproval = rowObj["Tanggal Approval"] || Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm");

  // 1. Temukan email penerima
  let recipientEmail = "";
  let recipientName = pengaju;

  // A. Cek dari Raw Data JSON jika tersedia
  if (rowObj["Raw Data JSON"]) {
    try {
      const rawData = JSON.parse(rowObj["Raw Data JSON"]);
      const meta = rawData.meta || {};
      const participants = rawData.participants || [];

      // Prioritas 1: Field email pengaju langsung di meta
      const metaEmail = meta["Email pengaju"] || meta["Email leader"] || meta["Email"] || meta["email"];
      if (metaEmail && String(metaEmail).includes("@")) {
        recipientEmail = String(metaEmail).trim();
      } else if (participants.length > 0) {
        // Prioritas 2: Email peserta pertama yang valid
        const firstValid = participants.find(p => p.email && p.email.includes("@"));
        if (firstValid) {
          recipientEmail = firstValid.email.trim();
          if (firstValid.nama) {
            recipientName = `${pengaju} (${firstValid.nama})`;
          }
        }
      }
    } catch (e) {
      Logger.log("Gagal mem-parse Raw Data JSON untuk mencari email: " + e.toString());
    }
  }

  // B. Fallback: Kolom email eksplisit di sheet jika ada
  if (!recipientEmail && rowObj["Email Pengaju"] && String(rowObj["Email Pengaju"]).includes("@")) {
    recipientEmail = String(rowObj["Email Pengaju"]).trim();
  }

  // C. Fallback: Ekstrak dari teks ringkasan peserta (format: "1. Nama <email@kantor.com> (Dept)")
  if (!recipientEmail && rowObj["Daftar Peserta (Ringkasan)"]) {
    const summaryStr = String(rowObj["Daftar Peserta (Ringkasan)"]);
    const emailMatch = summaryStr.match(/<([^>]+@[^>]+)>/) || summaryStr.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      recipientEmail = (emailMatch[1] || emailMatch[0]).trim();
    }
  }

  if (!recipientEmail) {
    Logger.log(`Peringatan: Tidak ada alamat email penerima yang valid untuk training ${trainingId}`);
    return "Tidak ada email valid";
  }

  // 2. Styling status (Approved vs Rejected)
  const isApproved = String(status).toLowerCase().includes("setuju") || String(status).toLowerCase().includes("approve");
  const statusLabel = isApproved ? "DISETUJUI" : "DITOLAK";
  const statusBadgeBg = isApproved ? "#2E7D32" : "#D9534F";
  const statusBoxBg = isApproved ? "#E8F5E9" : "#FFEBEE";
  const statusBoxBorder = isApproved ? "#2E7D32" : "#D9534F";
  const statusTextColor = isApproved ? "#1B5E20" : "#B71C1C";
  const nextStepMsg = isApproved
    ? "Pengajuan training ini telah disetujui. Ruangan meeting telah resmi di-booked, dan undangan jadwal Google Calendar serta email konfirmasi resmi telah otomatis dikirimkan ke seluruh peserta terdaftar."
    : "Pengajuan training ini tidak disetujui / ditolak oleh approver. Ruangan tidak di-booked dan tidak ada undangan kalender yang dikirim ke peserta. Silahkan tinjau catatan approver di atas untuk melakukan penyesuaian atau koordinasi lebih lanjut.";

  const subject = `[${status.toUpperCase()}] Pengajuan Training: ${trainingName} (${trainingId})`;

  const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">${isApproved ? '&#9989;' : '&#10060;'}</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#00178F;line-height:1.3;">Status Pengajuan: Training ${trainingId}</h1>
        </td>
      </tr>

      <tr>
        <td style="padding:32px 32px 12px;">
          <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Halo ${recipientName},</p>
          <p style="margin:0 0 20px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">
            Pengajuan program pelatihan karyawan berikut telah ditinjau dan diperbarui status persetujuannya:
          </p>

          <!-- Status Decision Card -->
          <div style="background:${statusBoxBg};border:1px solid ${statusBoxBorder};border-radius:10px;padding:16px 20px;margin-bottom:22px;text-align:center;">
            <span style="display:inline-block;padding:6px 16px;background:${statusBadgeBg};color:#FFFFFF;font-size:12.5px;font-weight:700;letter-spacing:0.05em;border-radius:20px;text-transform:uppercase;margin-bottom:6px;">
              ${statusLabel}
            </span>
            <div style="font-size:13px;color:${statusTextColor};line-height:1.5;margin-top:6px;">
              Ditinjau oleh: <strong>${approver}</strong> &bull; <span>${tanggalApproval}</span>
            </div>
          </div>

          <!-- Training Details Table -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FBFE;border-radius:12px;border:1px solid #E1E8F8;overflow:hidden;margin-bottom:22px;">
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;width:130px;">ID Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:700;color:#00178F;">${trainingId}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Nama Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Pengaju &amp; Divisi</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${pengaju} (${departemen})</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jadwal Pelaksanaan</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${jadwal}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Metode &amp; Lokasi</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${metode} &bull; ${venue}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Trainer</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${trainer}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;font-size:12px;font-weight:600;color:#8D93C2;">Jenis Training</td>
              <td style="padding:11px 16px;font-size:13.5px;font-weight:700;color:#00178F;">${rowObj["Jenis Training"] || "Training Internal"}</td>
            </tr>
          </table>

          <!-- Approver Notes Box -->
          <div style="background:#FFFFFF;border:1px solid #E1E8F8;border-left:4px solid ${statusBadgeBg};padding:14px 18px;border-radius:8px;margin-bottom:22px;">
            <div style="font-size:12px;text-transform:uppercase;font-weight:700;color:${statusBadgeBg};margin-bottom:6px;letter-spacing:0.04em;">
              Catatan dari Approver (${approver}):
            </div>
            <div style="font-size:13.5px;line-height:1.5;color:#00178F;font-style:${catatan !== '-' ? 'normal' : 'italic'};">
              ${catatan !== '-' ? catatan : 'Tidak ada catatan khusus.'}
            </div>
          </div>

          <!-- Next Steps Note -->
          <div style="background:rgba(75, 150, 255, 0.08);border-left:4px solid #4B96FF;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#00178F;">
            <strong>Tindak Lanjut:</strong> ${nextStepMsg}
          </div>

          <p style="margin:0;font-size:13.5px;color:#4A4F8F;line-height:1.6;">
            Salam hangat,<br>
            <strong style="color:#00178F;">Portal Training &amp; Development / HR Team</strong>
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Email otomatis dari Training Request System &middot; Jangan reply email ini</p>
        </td>
      </tr>
    </table>
  </div>`;

  const plainText = `Halo ${recipientName},\n\nStatus pengajuan pelatihan:\nTopik: ${trainingName} (${trainingId})\nStatus: [${status.toUpperCase()}]\nDitinjau oleh: ${approver}\nTanggal Approval: ${tanggalApproval}\nCatatan Approver: ${catatan}\n\nSalam,\nTim Training & Development`;

  GmailApp.sendEmail(recipientEmail, subject, plainText, {
    htmlBody: htmlBody,
    name: "Training & Development Portal"
  });

  return `Terkirim ke ${recipientEmail}`;
}

// ==============================================================================
// 3.2 PENGIRIMAN EMAIL NOTIFIKASI PENGAJUAN BARU KE APPROVER (SLA 3 HARI)
// ==============================================================================
/**
 * Mengirim notifikasi email pengajuan training baru ke 2-3 approver utama (dan approver divisi).
 * Email berisi ringkasan program, SLA review 3 hari kerja, dan tombol 1-klik
 * yang langsung mengarah ke portal approval untuk training ID tersebut (?id=TRN-XXXX).
 */
function sendApproverNotification(meta, participants, modules, trainingId) {
  const deptName = meta["Departemen / divisi"] || "";
  const approverEmails = getApproverListForSubmission(deptName);

  if (!approverEmails || approverEmails.length === 0) {
    Logger.log("Peringatan sendApproverNotification: Tidak ada email approver terdaftar.");
    return "Tidak ada email approver";
  }

  const trainingName = meta["Nama training"] || "Pelatihan Karyawan";
  const idTrn = trainingId || meta["ID training"] || "TRN";
  const pengaju = meta["Nama pengaju"] || meta["Leader pengaju"] || "Pengaju";
  const pengajuEmail = meta["Email pengaju"] || meta["Email leader"] || "-";
  const jadwal = meta["Tanggal & jam pelaksanaan"] || "-";
  const metode = meta["Metode training"] || "Onsite";
  const venue = meta["Lokasi / venue"] || meta["Link meeting online"] || meta["Platform online"] || "-";
  const trainer = meta["Trainer"] || "-";
  const totalBiaya = meta["Budget diajukan"] || meta["Estimasi biaya"] || "-";
  const tujuan = meta["Training plan purpose"] || "-";
  const jmlPeserta = (participants && participants.length) ? participants.length : (meta["Jumlah peserta"] || 0);

  const directApprovalLink = `${APPROVAL_PORTAL_URL}?id=${encodeURIComponent(idTrn)}`;
  const subject = `[MEMERLUKAN PERSETUJUAN] Pengajuan Training: ${trainingName} (${idTrn})`;

  const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">&#128221;</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#00178F;line-height:1.3;">Pengajuan Memerlukan Persetujuan</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 12px;">
          <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Yth. Bapak/Ibu Approver,</p>
          <p style="margin:0 0 20px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">
            Terdapat pengajuan program pelatihan karyawan baru yang memerlukan evaluasi dan persetujuan Anda:
          </p>

          <div style="background:rgba(75, 150, 255, 0.08);border-left:4px solid #4B96FF;border-radius:8px;padding:12px 16px;margin-bottom:22px;font-size:13px;line-height:1.6;color:#00178F;">
            &#9200; <strong>Tenggat Waktu Tinjauan (SLA):</strong> Mohon meninjau pengajuan ini dalam <strong>3 hari kerja</strong> ke depan.
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FBFE;border-radius:12px;border:1px solid #E1E8F8;overflow:hidden;margin-bottom:22px;">
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;width:130px;">ID Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:700;color:#00178F;">${idTrn}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Nama Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Pengaju / Leader</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${pengaju} &bull; ${pengajuEmail} (${deptName || "-"})</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jadwal Pelaksanaan</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${jadwal}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Metode &amp; Lokasi</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${metode} (${venue})</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Trainer</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${trainer}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jumlah Peserta</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${jmlPeserta} orang</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;font-size:12px;font-weight:600;color:#8D93C2;">Jenis Training</td>
              <td style="padding:11px 16px;font-size:13.5px;font-weight:700;color:#00178F;">${meta["Jenis training"] || "Training Internal"}</td>
            </tr>
          </table>

          <div style="text-align:center;margin:24px 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="border-radius:100px;background:#00178F;">
                  <a href="${directApprovalLink}" target="_blank" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;background-color:#00178F;">Tinjau &amp; Berikan Keputusan &nbsp;&#8594;</a>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:12px;color:#8D93C2;">
              Jika tombol di atas tidak merespons, buka tautan langsung berikut:<br>
              <a href="${directApprovalLink}" target="_blank" style="color:#00178F;word-break:break-all;font-weight:600;text-decoration:underline;">${directApprovalLink}</a>
            </p>
          </div>

          <p style="margin:0;font-size:13.5px;color:#4A4F8F;line-height:1.6;">
            Salam hangat,<br>
            <strong style="color:#00178F;">Sistem Pengajuan Training Karyawan</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Email otomatis dari Training Request System &middot; Dokumen ID: ${idTrn}</p>
        </td>
      </tr>
    </table>
  </div>`;

  const plainText = `Yth. Approver,\n\nPengajuan training baru memerlukan persetujuan Anda:\nID: ${idTrn}\nTopik: ${trainingName}\nPengaju: ${pengaju} (${deptName})\nJadwal: ${jadwal}\nBudget: ${totalBiaya}\n\nSilahkan tinjau pada portal approval:\n${directApprovalLink}\n\nSalam,\nSistem Portal Training`;

  let sent = 0;
  approverEmails.forEach(email => {
    try {
      GmailApp.sendEmail(email, subject, plainText, {
        htmlBody: htmlBody,
        name: "Portal Training - Approval Workflow"
      });
      sent++;
    } catch (e) {
      Logger.log(`Gagal kirim notif approver ke ${email}: ${e.toString()}`);
    }
  });

  return `Terkirim (${sent}/${approverEmails.length})`;
}

// ==============================================================================
// 3.3 SCHEDULER PENGINGAT ESKALASI SLA 3 HARI KE APPROVER
// ==============================================================================
/**
 * Memeriksa seluruh pengajuan dengan status 'Diajukan' / 'Menunggu Approval'
 * yang telah melewati batas SLA 3 hari sejak tanggal pengajuan dan belum diproses.
 * Mengirimkan email pengingat eskalasi ke 2-3 approver utama.
 */
function checkAndSendApprovalReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return;

  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = rawHeaders.map(h => String(h).trim().toLowerCase());

  const getCol = (name) => {
    const idx = headersLower.indexOf(name.toLowerCase());
    return idx !== -1 ? idx + 1 : 0;
  };

  const colId = getCol("ID Training");
  const colName = getCol("Nama Training");
  const colDocStatus = getCol("Status Dokumen");
  const colTglPengajuan = getCol("Tanggal Pengajuan");
  const colWaktuSubmit = getCol("Waktu Submit");
  const colPengaju = getCol("Nama Pengaju");
  const colDept = getCol("Departemen / Divisi");
  const colJadwal = getCol("Jadwal Pelaksanaan");
  const colJenis = getCol("Jenis Training");
  const colStatusSla = getCol("Status Reminder Approval");

  const today = new Date();
  const todayStr = Utilities.formatDate(today, TIME_ZONE, "yyyy-MM-dd");

  const data = sheet.getDataRange().getValues();
  let remindedCount = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const status = String(row[colDocStatus - 1] || "").trim().toLowerCase();

    // Hanya periksa dokumen yang statusnya 'Diajukan' atau mengandung 'menunggu'
    if (status !== "diajukan" && !status.includes("menunggu")) {
      continue;
    }

    const trainingId = String(row[colId - 1] || "").trim();
    if (!trainingId) continue;

    // Tentukan tanggal pengajuan
    let submitDate = null;
    const rawTglPengajuan = row[colTglPengajuan - 1] || row[colWaktuSubmit - 1];
    if (rawTglPengajuan) {
      if (rawTglPengajuan instanceof Date) {
        submitDate = rawTglPengajuan;
      } else {
        const parsed = parseDatesFromText(String(rawTglPengajuan));
        if (parsed && parsed.length > 0) {
          submitDate = new Date(`${parsed[0]}T00:00:00`);
        } else {
          submitDate = new Date(rawTglPengajuan);
        }
      }
    }

    if (!submitDate || isNaN(submitDate.getTime())) {
      continue;
    }

    // Hitung selisih hari
    const diffTime = today.getTime() - submitDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Jika sudah 3 hari atau lebih sejak pengajuan
    if (diffDays >= 3) {
      // Cek apakah sudah pernah dikirim reminder hari ini
      const slaStatus = colStatusSla ? String(row[colStatusSla - 1] || "") : "";
      if (slaStatus.includes(todayStr)) {
        Logger.log(`[SLA Approver] Training ${trainingId} sudah dikirim pengingat hari ini.`);
        continue;
      }

      const trainingName = String(row[colName - 1] || "Pelatihan Karyawan");
      const deptName = String(row[colDept - 1] || "");
      const pengaju = String(row[colPengaju - 1] || "Pengaju");
      const jadwal = String(row[colJadwal - 1] || "-");
      const jenisTraining = colJenis ? String(row[colJenis - 1] || "Training Internal").trim() : "Training Internal";

      const approverEmails = getApproverListForSubmission(deptName);
      if (approverEmails.length === 0) continue;

      const directApprovalLink = `${APPROVAL_PORTAL_URL}?id=${encodeURIComponent(trainingId)}`;
      const subject = `[ESKALASI SLA 3 HARI] Pengingat Approval Training: ${trainingName} (${trainingId})`;

      const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">&#9200;</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:21px;font-weight:700;color:#00178F;line-height:1.3;">Pengingat: Training Menunggu Approval (${diffDays} Hari)</h1>
        </td>
      </tr>

      <div style="padding:32px 32px 12px;">
        <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Yth. Bapak/Ibu Approver,</p>
        <p style="margin:0 0 20px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">
          Pengajuan pelatihan berikut diajukan pada <strong>${Utilities.formatDate(submitDate, TIME_ZONE, "yyyy-MM-dd")}</strong> (sudah <strong>${diffDays} hari kalender</strong>) dan hingga saat ini belum menerima keputusan tindakan (Setujui / Tolak):
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FBFE;border-radius:12px;border:1px solid #E1E8F8;overflow:hidden;margin-bottom:22px;">
          <tr>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;width:130px;">ID Training</td>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:700;color:#00178F;">${trainingId}</td>
          </tr>
          <tr>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Topik Pelatihan</td>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${trainingName}</td>
          </tr>
          <tr>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Pengaju</td>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${pengaju} (${deptName})</td>
          </tr>
          <tr>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jadwal</td>
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${jadwal}</td>
          </tr>
          <tr>
            <td style="padding:11px 16px;font-size:12px;font-weight:600;color:#8D93C2;">Jenis Training</td>
            <td style="padding:11px 16px;font-size:13.5px;font-weight:700;color:#00178F;">${jenisTraining}</td>
          </tr>
        </table>

        <div style="text-align:center;margin:24px 0 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td align="center" style="border-radius:100px;background:#00178F;">
                <a href="${directApprovalLink}" target="_blank" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;background-color:#00178F;">Buka &amp; Selesaikan Approval &nbsp;&#8594;</a>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#8D93C2;">
            Jika tombol di atas tidak merespons, buka tautan langsung berikut:<br>
            <a href="${directApprovalLink}" target="_blank" style="color:#00178F;word-break:break-all;font-weight:600;text-decoration:underline;">${directApprovalLink}</a>
          </p>
        </div>

        <p style="margin:0;font-size:13.5px;color:#4A4F8F;line-height:1.6;">
          Mohon kerja samanya agar proses administrasi dan persiapan training dapat berjalan sesuai timeline.<br><br>
          Salam hangat,<br>
          <strong style="color:#00178F;">Sistem Otomatis Portal Training</strong>
        </p>
      </div>

      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Notifikasi eskalasi SLA otomatis untuk ID: ${trainingId} &middot; Jangan reply email ini</p>
        </td>
      </tr>
    </table>
  </div>`;

      const plainText = `Yth. Approver,\n\nPengingat SLA 3 Hari untuk pengajuan training:\nID: ${trainingId}\nTopik: ${trainingName}\nPengaju: ${pengaju} (${deptName})\nStatus: Menunggu Approval sejak ${diffDays} hari lalu.\n\nSilahkan buka tautan berikut untuk memproses:\n${directApprovalLink}\n\nSalam,\nSistem Portal Training`;

      approverEmails.forEach(email => {
        try {
          GmailApp.sendEmail(email, subject, plainText, {
            htmlBody: htmlBody,
            name: "Portal Training - Approval SLA Reminder"
          });
        } catch (e) {
          Logger.log(`Gagal kirim SLA reminder ke ${email}: ${e.toString()}`);
        }
      });

      remindedCount++;
      const timeNow = Utilities.formatDate(today, TIME_ZONE, "yyyy-MM-dd HH:mm");
      if (colStatusSla) {
        sheet.getRange(r + 1, colStatusSla).setValue(`Terkirim (${timeNow})`);
      }
    }
  }

  Logger.log(`[SLA Approver Check Selesai] Total ${remindedCount} pengingat SLA dikirim.`);
}

// ==============================================================================
// 4. GOOGLE CALENDAR EVENT CREATOR (AUTO-BOOKING RUANGAN & AUTO-INVITE)
// ==============================================================================
/**
 * Auto-booking ke Google Calendar ruangan meeting yang dipilih (Mendukung Multi-Sesi).
 * Jika form memiliki beberapa modul sesi (misal 3 sesi), sistem akan membuat
 * jadwal booking terpisah untuk setiap sesi di ruangan tersebut dengan 1 ID Training yang sama.
 */
function bookMeetingRoom(meta, participants, modules) {
  try {
    const lokasi = meta["Lokasi / venue"];
    const roomEmail = ROOM_CALENDAR_MAP[lokasi];
    if (!roomEmail || roomEmail.indexOf('GANTI_DENGAN') === 0) {
      return { booked: false, reason: "Lokasi bukan ruangan meeting internal atau email resource belum diisi" };
    }

    const trainingId = meta["ID training"] || "-";
    const trainingName = meta["Nama training"] || meta["Kategori training"] || "Training";
    const leaderName = meta["Nama pengaju"] || meta["Leader pengaju"] || "-";
    const leaderEmail = (meta["Email pengaju"] || meta["Email leader"] || "").trim().toLowerCase();

    // 1. Kumpulkan seluruh email peserta dari form pengajuan
    const pesertaList = (participants || meta.participants || []);
    const participantEmails = pesertaList
      .filter(p => p.email && String(p.email).includes("@"))
      .map(p => String(p.email).trim().toLowerCase());

    // 2. Gabungkan seluruh tamu untuk Google Calendar:
    // - Email Resource Ruangan (agar kalender ruangan ter-booking otomatis)
    // - Email Pengaju (tampil sebagai Organizer / Host di kalender)
    // - Email Peserta Training (tampil sebagai Guest / Tamu)
    const guestList = [];
    if (roomEmail && roomEmail.includes("@")) {
      guestList.push(roomEmail.trim());
    }
    if (leaderEmail && leaderEmail.includes("@") && !guestList.includes(leaderEmail)) {
      guestList.push(leaderEmail);
    }
    participantEmails.forEach(email => {
      if (!guestList.includes(email)) {
        guestList.push(email);
      }
    });

    const description = [
      `Organizer / Pengaju: ${leaderName}${leaderEmail ? ` <${leaderEmail}>` : ""}`,
      `Departemen: ${meta["Departemen / divisi"] || "-"}`,
      `ID Training: ${trainingId}`,
      `Lokasi / Ruangan: ${lokasi || "-"}`,
      meta["Trainer"] ? `Trainer: ${meta["Trainer"]}` : "",
      participantEmails.length > 0 ? `Daftar Peserta (${participantEmails.length} orang):\n${pesertaList.filter(p => p.nama || p.email).map((p, idx) => `${idx + 1}. ${p.nama || "Peserta"}${p.email ? ` <${p.email}>` : ""} (${p.departemen || "-"})`).join("\n")}` : "",
      meta["Link silabus materi"] ? `Silabus: ${meta["Link silabus materi"]}` : ""
    ].filter(Boolean).join("\n\n");

    // 3. Tentukan sesi-sesi yang akan dibooking (Multi-Sesi)
    let sessionsToBook = [];
    if (modules && Array.isArray(modules) && modules.length > 0) {
      sessionsToBook = modules.filter(m => m && (m.tanggal || meta["Tanggal pelaksanaan (raw)"] || meta["Tanggal & jam pelaksanaan"]));
    }

    if (sessionsToBook.length === 0) {
      // Fallback 1 sesi dari meta top-level
      const tglRaw = meta["Tanggal pelaksanaan (raw)"];
      const jamMulaiRaw = meta["Jam mulai (raw)"] || "09:00";
      const jamSelesaiRaw = meta["Jam selesai (raw)"] || "15:00";
      if (!tglRaw) {
        return { booked: false, reason: "Tanggal pelaksanaan kosong" };
      }
      sessionsToBook.push({
        tanggal: tglRaw,
        jamMulai: jamMulaiRaw,
        jamSelesai: jamSelesaiRaw,
        modul: ""
      });
    }

    const createdEventIds = [];
    const totalSessions = sessionsToBook.length;

    for (let idx = 0; idx < totalSessions; idx++) {
      const sess = sessionsToBook[idx];
      let tgl = sess.tanggal || meta["Tanggal pelaksanaan (raw)"];
      const jmMulai = sess.jamMulai || meta["Jam mulai (raw)"] || "09:00";
      const jmSelesai = sess.jamSelesai || meta["Jam selesai (raw)"] || "15:00";

      let startTime = new Date(`${tgl}T${jmMulai}:00`);
      let endTime = new Date(`${tgl}T${jmSelesai}:00`);
      if (isNaN(startTime.getTime()) && typeof parseDatesFromText === "function") {
        const parsed = parseDatesFromText(String(tgl));
        if (parsed && parsed.length > 0) {
          startTime = new Date(`${parsed[0]}T${jmMulai}:00`);
          endTime = new Date(`${parsed[0]}T${jmSelesai}:00`);
        }
      }

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        continue;
      }

      let sessionTitle = `Training: ${trainingId} - ${trainingName}`;
      if (totalSessions > 1) {
        const modTitle = sess.modul ? `: ${sess.modul}` : "";
        sessionTitle = `[Sesi ${idx + 1}/${totalSessions}] Training: ${trainingId} - ${trainingName}${modTitle}`;
      }

      const event = CalendarApp.createEvent(sessionTitle, startTime, endTime, {
        guests: guestList.join(","),
        description: description,
        sendInvites: Boolean(SEND_CALENDAR_INVITES)
      });

      // Tambahkan alarm notifikasi pop-up dan email reminder
      try {
        event.addPopupReminder(10);
        event.addEmailReminder(10);
        event.addPopupReminder(15);
        event.addEmailReminder(1440);
      } catch (remErr) {}

      createdEventIds.push(event.getId());
    }

    if (createdEventIds.length === 0) {
      return { booked: false, reason: "Gagal membuat event kalender untuk sesi yang diberikan" };
    }

    return { 
      booked: true, 
      eventId: createdEventIds.join(", "), 
      room: lokasi, 
      organizer: leaderEmail || leaderName,
      guestCount: participantEmails.length,
      sessionCount: createdEventIds.length,
      guests: participantEmails 
    };
  } catch (err) {
    return { booked: false, reason: err.toString() };
  }
}

/**
 * Mendapatkan instance Calendar target berdasarkan nama ruangan meeting yang dipilih.
 * Mendukung pencarian ID kalender khusus ruangan di ROOM_CALENDAR_MAP,
 * dan otomatis fallback ke kalender default jika ID kosong atau belum dikonfigurasi.
 */
function getTargetCalendar(roomName) {
  if (!roomName) return CalendarApp.getDefaultCalendar();

  const cleanRoom = String(roomName).trim();
  let calId = ROOM_CALENDAR_MAP[cleanRoom];

  // Pencocokan fleksibel jika roomName mengandung nama planet
  if (!calId) {
    const lower = cleanRoom.toLowerCase();
    for (const key in ROOM_CALENDAR_MAP) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        calId = ROOM_CALENDAR_MAP[key];
        break;
      }
      const planetOnly = key.replace(/Ruangan Meeting\s*/i, '').trim().toLowerCase();
      if (lower.includes(planetOnly)) {
        calId = ROOM_CALENDAR_MAP[key];
        break;
      }
    }
  }

  if (calId && String(calId).trim() !== "" && !String(calId).includes("xxxx")) {
    try {
      const roomCal = CalendarApp.getCalendarById(calId.trim());
      if (roomCal) {
        Logger.log(`[Google Calendar] Auto-booking ke kalender ruangan: ${roomCal.getName()} (${calId})`);
        return roomCal;
      }
    } catch (calErr) {
      Logger.log(`[Google Calendar] Gagal akses kalender ${cleanRoom} (${calId}): ${calErr.message}. Fallback ke kalender default.`);
    }
  }

  Logger.log(`[Google Calendar] Booking ke Kalender Utama (Default) untuk lokasi: ${cleanRoom || "Default"}`);
  return CalendarApp.getDefaultCalendar();
}

/**
 * Membuat event di Google Calendar untuk metode Online / Hybrid / Ruangan Lainnya.
 * Mendukung Multi-Sesi: Jika terdapat 3 modul sesi, sistem membuat 3 event terpisah
 * dengan link Google Meet yang SAMA untuk seluruh sesi, dan 1 ID Training yang seragam.
 */
function createCalendarEvent(meta, participants, modules) {
  const location = meta["Lokasi / venue"] || meta["Link meeting online"] || "";

  // Jika lokasi adalah salah satu ruangan meeting internal yang dikelola oleh bookMeetingRoom,
  // lewati agar tidak membuat event duplikat di kalender utama
  if (ROOM_CALENDAR_MAP[location] && !String(ROOM_CALENDAR_MAP[location]).startsWith('GANTI_DENGAN')) {
    return "Event dikelola via bookMeetingRoom";
  }

  const guestEmails = (participants || [])
    .filter(p => p.email && String(p.email).includes("@"))
    .map(p => String(p.email).trim())
    .join(",");

  const trainingName = meta["Nama training"] || "Pelatihan Karyawan";
  const trainingId = meta["ID training"] || "TRN";

  const description = [
    `Program Pelatihan Karyawan:`,
    `ID Training: ${trainingId}`,
    `Topik: ${trainingName}`,
    `Trainer: ${meta["Trainer"] || "-"}`,
    `Lokasi / Platform: ${location || "-"}`,
    meta["Link silabus materi"] && String(meta["Link silabus materi"]).trim() !== "-" && String(meta["Link silabus materi"]).trim() !== "" ? `Silabus: ${meta["Link silabus materi"]}` : "",
    `\nEmail ini otomatis dibuat oleh Portal Training.`
  ].filter(Boolean).join("\n");

  const calendar = getTargetCalendar(location);

  // Kumpulkan sesi dari tabel modul jika tersedia
  let sessionsToCreate = [];
  if (modules && Array.isArray(modules) && modules.length > 0) {
    sessionsToCreate = modules.filter(m => m && (m.tanggal || meta["Tanggal pelaksanaan (raw)"] || meta["Tanggal & jam pelaksanaan"]));
  }

  const createdEventIds = [];

  if (sessionsToCreate.length > 0) {
    const totalSessions = sessionsToCreate.length;
    for (let idx = 0; idx < totalSessions; idx++) {
      const sess = sessionsToCreate[idx];
      let tgl = sess.tanggal || meta["Tanggal pelaksanaan (raw)"];
      const jmMulai = sess.jamMulai || meta["Jam mulai (raw)"] || "09:00";
      const jmSelesai = sess.jamSelesai || meta["Jam selesai (raw)"] || "15:00";

      let startDate = new Date(`${tgl}T${jmMulai}:00`);
      let endDate = new Date(`${tgl}T${jmSelesai}:00`);
      if (isNaN(startDate.getTime()) && typeof parseDatesFromText === "function") {
        const parsed = parseDatesFromText(String(tgl));
        if (parsed && parsed.length > 0) {
          startDate = new Date(`${parsed[0]}T${jmMulai}:00`);
          endDate = new Date(`${parsed[0]}T${jmSelesai}:00`);
        }
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

      let title = `[Training] ${trainingName} (${trainingId})`;
      if (totalSessions > 1) {
        const modTitle = sess.modul ? `: ${sess.modul}` : "";
        title = `[Sesi ${idx + 1}/${totalSessions}] [Training] ${trainingName} (${trainingId})${modTitle}`;
      }

      const eventOptions = {
        description: description,
        location: location
      };
      if (guestEmails) {
        eventOptions.guests = guestEmails;
        eventOptions.sendInvites = Boolean(SEND_CALENDAR_INVITES);
      }

      try {
        const event = calendar.createEvent(title, startDate, endDate, eventOptions);
        event.addPopupReminder(10);
        event.addEmailReminder(10);
        event.addPopupReminder(15);
        event.addEmailReminder(1440);
        createdEventIds.push(event.getId());
      } catch (evErr) {
        Logger.log(`Gagal membuat event kalender sesi ${idx + 1}: ${evErr.toString()}`);
      }
    }
  }

  // Fallback 1 sesi jika belum ada event terbuat dari modul
  if (createdEventIds.length === 0) {
    let startDate = null;
    let endDate = null;

    // A. Dari Tanggal pelaksanaan raw / teks
    const rawTgl = meta["Tanggal pelaksanaan (raw)"] || meta["Tanggal pelaksanaan"] || meta["Tanggal & jam pelaksanaan"] || "";
    const parsedDates = parseDatesFromText(rawTgl);
    if (parsedDates && parsedDates.length > 0) {
      const tgl = parsedDates[0];
      const startStr = meta["Jam mulai (raw)"] || meta["Jam mulai"] || "09:00";
      const endStr = meta["Jam selesai (raw)"] || meta["Jam selesai"] || "15:00";
      startDate = new Date(`${tgl}T${startStr}:00`);
      endDate = new Date(`${tgl}T${endStr}:00`);
    }

    // B. Fallback dari ID
    if (!startDate || isNaN(startDate.getTime())) {
      const idMatch = String(trainingId).match(/TRN-(\d{4})(\d{2})(\d{2})/i) || String(trainingId).match(/(\d{4})(\d{2})(\d{2})/);
      if (idMatch) {
        const dateIso = `${idMatch[1]}-${idMatch[2]}-${idMatch[3]}`;
        const startStr = meta["Jam mulai (raw)"] || meta["Jam mulai"] || "09:00";
        const endStr = meta["Jam selesai (raw)"] || meta["Jam selesai"] || "15:00";
        startDate = new Date(`${dateIso}T${startStr}:00`);
        endDate = new Date(`${dateIso}T${endStr}:00`);
      }
    }

    if (!startDate || isNaN(startDate.getTime())) {
      return "Jadwal custom (tidak dibuat event kalender otomatis)";
    }

    const title = `[Training] ${trainingName} (${trainingId})`;
    const eventOptions = {
      description: description,
      location: location
    };
    if (guestEmails) {
      eventOptions.guests = guestEmails;
      eventOptions.sendInvites = Boolean(SEND_CALENDAR_INVITES);
    }

    const event = calendar.createEvent(title, startDate, endDate, eventOptions);
    event.addPopupReminder(10);
    event.addEmailReminder(10);
    event.addPopupReminder(15);
    event.addEmailReminder(1440);
    createdEventIds.push(event.getId());
  }

  const calName = calendar.getName() ? ` (${calendar.getName()})` : "";
  return `${createdEventIds.join(", ")}${calName}`;
}

// ==============================================================================
// 5. AUTOMATED DAILY SCHEDULER: EMAIL REMINDER H-1
// ==============================================================================
/**
 * Fungsi ini dipanggil secara otomatis oleh Time-Driven Trigger setiap hari jam 08:00 WIB.
 * Memeriksa seluruh jadwal training pada spreadsheet yang akan berlangsung besok (H-1)
 * atau hari ini, lalu mengirim email pengingat kepada seluruh peserta.
 *
 * Parameter opsional forceTargetId:
 * Jika diisi ID training (misal: "TRN-20260921-WBD-SOFT" atau "ALL"),
 * sistem akan mengirim reminder tanpa batasan tanggal untuk keperluan pengujian.
 */
function checkAndSendReminders(forceTargetId) {
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

  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = rawHeaders.map(h => String(h).trim().toLowerCase());

  const getColIndex = (name) => {
    const idx = headersLower.indexOf(name.toLowerCase());
    return idx !== -1 ? idx + 1 : 0;
  };

  const colId = getColIndex("ID Training");
  const colName = getColIndex("Nama Training");
  const colDocStatus = getColIndex("Status Dokumen");
  const colJadwal = getColIndex("Jadwal Pelaksanaan");
  const colReminder = getColIndex("Status Email Reminder H-1");
  const colJson = getColIndex("Raw Data JSON");
  const colSummaryPeserta = getColIndex("Daftar Peserta (Ringkasan)");
  const colTglPengajuan = getColIndex("Tanggal Pengajuan");

  if (!colReminder) {
    Logger.log("Kolom 'Status Email Reminder H-1' belum ada. Menjalankan sinkronisasi header...");
    setupSheetHeaders(sheet);
  }

  const today = new Date();
  const tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000));
  const tomorrowStr = Utilities.formatDate(tomorrow, TIME_ZONE, "yyyy-MM-dd");
  const todayStr = Utilities.formatDate(today, TIME_ZONE, "yyyy-MM-dd");

  Logger.log(`[Reminder Check] Waktu sekarang: ${Utilities.formatDate(today, TIME_ZONE, "yyyy-MM-dd HH:mm:ss")} WIB`);
  Logger.log(`[Reminder Check] Target tanggal: Besok H-1 (${tomorrowStr}) atau Hari Ini (${todayStr})`);
  if (forceTargetId) {
    Logger.log(`[Reminder Check] MODE FORCE AKTIF untuk target ID: ${forceTargetId}`);
  }

  // Jalankan juga pengecekan SLA Approver (pengajuan training yang menunggu > 3 hari)
  try {
    checkAndSendApprovalReminders();
  } catch (slaErr) {
    Logger.log("Peringatan eksekusi checkAndSendApprovalReminders: " + slaErr.toString());
  }

  const numRows = lastRow - 1;
  const dataRange = sheet.getRange(2, 1, numRows, sheet.getLastColumn()).getValues();

  let remindersSentTotal = 0;

  for (let i = 0; i < dataRange.length; i++) {
    const row = dataRange[i];
    const rowNum = i + 2;
    const trainingId = String(colId ? row[colId - 1] : "").trim();
    const trainingName = String(colName ? row[colName - 1] : "").trim();
    const currentReminderStatus = String(colReminder ? row[colReminder - 1] : "").trim();
    const docStatus = String(colDocStatus ? row[colDocStatus - 1] : "").trim();

    // Mode force untuk testing training tertentu
    const isTargetForced = forceTargetId && (forceTargetId === "ALL" || trainingId.toUpperCase() === String(forceTargetId).trim().toUpperCase());

    if (!isTargetForced) {
      // Lewati jika sudah pernah dikirim reminder
      if (currentReminderStatus.startsWith("Terkirim")) {
        continue;
      }
      // Lewati jika dokumen dibatalkan atau ditolak
      if (docStatus.toLowerCase().includes("batal") || docStatus.toLowerCase().includes("tolak")) {
        continue;
      }
    }

    // Parsing data JSON atau fallback kolom
    let meta = {};
    let modules = [];
    let participants = [];

    const rawJsonStr = colJson ? row[colJson - 1] : "";
    if (rawJsonStr) {
      try {
        const parsed = JSON.parse(rawJsonStr);
        meta = parsed.meta || {};
        modules = parsed.modules || [];
        participants = parsed.participants || [];
      } catch (e) {
        Logger.log(`[Baris ${rowNum}] Gagal parse Raw Data JSON (${e.message}). Menggunakan fallback data kolom.`);
      }
    }

    // Pastikan data meta minimum terisi
    meta["ID training"] = meta["ID training"] || trainingId || "-";
    meta["Nama training"] = meta["Nama training"] || trainingName || "-";
    if (colJadwal && !meta["Tanggal & jam pelaksanaan"]) {
      meta["Tanggal & jam pelaksanaan"] = String(row[colJadwal - 1] || "");
    }

    // Fallback peserta dari kolom "Daftar Peserta (Ringkasan)" jika JSON kosong
    if ((!participants || participants.length === 0) && colSummaryPeserta) {
      participants = extractParticipantsFromSummary(row[colSummaryPeserta - 1]);
    }

    // Ekstraksi seluruh tanggal pelaksanaan training dari berbagai sumber
    const jadwalText = colJadwal ? String(row[colJadwal - 1] || "") : "";
    const tglPengajuanText = colTglPengajuan ? String(row[colTglPengajuan - 1] || "") : "";

    const candidateDates = extractAllTrainingDates(trainingId, modules, jadwalText, tglPengajuanText, meta);
    Logger.log(`[Baris ${rowNum}] ${trainingId}: Tanggal terdeteksi -> [${candidateDates.join(", ")}]`);

    let isMatchDate = false;
    let targetDateStr = "";

    if (isTargetForced) {
      isMatchDate = true;
      targetDateStr = candidateDates[0] || todayStr;
    } else {
      for (let d = 0; d < candidateDates.length; d++) {
        const cDate = candidateDates[d];
        if (cDate === tomorrowStr || cDate === todayStr) {
          isMatchDate = true;
          targetDateStr = cDate;
          break;
        }
      }
    }

    if (isMatchDate) {
      Logger.log(`--> MENGIRIM REMINDER untuk ${trainingId} (${trainingName}) target tanggal: ${targetDateStr}...`);
      const sentResult = sendReminderEmails(meta, participants, modules, targetDateStr);
      
      const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm");
      if (colReminder) {
        sheet.getRange(rowNum, colReminder).setValue(`Terkirim (${timestamp} - ${sentResult})`);
      }
      remindersSentTotal++;
      Logger.log(`--> HASIL: ${sentResult}`);
    }
  }

  Logger.log(`[Reminder Check Selesai] Total training yang dikirimi reminder: ${remindersSentTotal}`);
}

// ==============================================================================
// 5.1 HELPER EKSTRAKSI TANGGAL & PESERTA (SMART PARSER)
// ==============================================================================
/**
 * Mengekstrak seluruh kemungkinan tanggal pelaksanaan:
 * 1. Dari ID Training (format baru: TRN-YYYYMMDD-DEPT-CATEGORY)
 * 2. Dari array modules (m.tanggal)
 * 3. Dari teks jadwal (mendukung bahasa Indonesia: "21 Sep 2026", "21 September 2026", dll)
 * 4. Dari field Tanggal Pengajuan
 */
function extractAllTrainingDates(trainingId, modules, jadwalText, tglPengajuanText, meta) {
  const dates = [];
  const addDate = (d) => {
    if (d && dates.indexOf(d) === -1) {
      dates.push(d);
    }
  };

  // 1. Ekstraksi dari Training ID: TRN-YYYYMMDD-DEPT-CATEGORY
  if (trainingId) {
    const idMatch = String(trainingId).match(/TRN-(\d{4})(\d{2})(\d{2})/i) || String(trainingId).match(/(\d{4})(\d{2})(\d{2})/);
    if (idMatch) {
      addDate(`${idMatch[1]}-${idMatch[2]}-${idMatch[3]}`);
    }
  }

  // 2. Ekstraksi dari array modul
  if (modules && Array.isArray(modules)) {
    modules.forEach(m => {
      if (m && m.tanggal) {
        const t = String(m.tanggal).trim();
        if (t.match(/^\d{4}-\d{2}-\d{2}$/)) {
          addDate(t);
        }
      }
    });
  }

  // 3. Ekstraksi dari teks jadwal pelaksanaan
  if (jadwalText) {
    const parsed = parseDatesFromText(jadwalText);
    parsed.forEach(d => addDate(d));
  }

  // 4. Ekstraksi dari meta Tanggal & jam pelaksanaan
  if (meta && meta["Tanggal & jam pelaksanaan"] && meta["Tanggal & jam pelaksanaan"] !== jadwalText) {
    const parsed = parseDatesFromText(meta["Tanggal & jam pelaksanaan"]);
    parsed.forEach(d => addDate(d));
  }

  // 5. Fallback ke Tanggal Pengajuan jika belum ada tanggal terdeteksi
  if (dates.length === 0) {
    if (tglPengajuanText && tglPengajuanText.match(/^\d{4}-\d{2}-\d{2}$/)) {
      addDate(tglPengajuanText);
    } else if (meta && meta["Tanggal pengajuan"] && String(meta["Tanggal pengajuan"]).match(/^\d{4}-\d{2}-\d{2}$/)) {
      addDate(String(meta["Tanggal pengajuan"]));
    }
  }

  return dates;
}

/**
 * Parsing tanggal dari berbagai format teks (Indonesia, ISO, Slash)
 */
function parseDatesFromText(text) {
  if (!text) return [];
  const results = [];
  const str = String(text);

  // A. ISO format: YYYY-MM-DD
  const isoRegex = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  let mIso;
  while ((mIso = isoRegex.exec(str)) !== null) {
    const y = mIso[1];
    const mo = mIso[2].length === 1 ? '0' + mIso[2] : mIso[2];
    const d = mIso[3].length === 1 ? '0' + mIso[3] : mIso[3];
    results.push(y + '-' + mo + '-' + d);
  }

  // B. Indonesian text: e.g. "21 Sep 2026", "21 September 2026", "05 Jan 2026"
  const indoMonths = {
    jan: "01", januari: "01",
    feb: "02", februari: "02",
    mar: "03", maret: "03",
    apr: "04", april: "04",
    mei: "05",
    jun: "06", juni: "06",
    jul: "07", juli: "07",
    agu: "08", agustus: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10",
    nov: "11", november: "11",
    des: "12", desember: "12"
  };

  const indoRegex = /\b(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{4})\b/g;
  let mIndo;
  while ((mIndo = indoRegex.exec(str)) !== null) {
    const d = mIndo[1].length === 1 ? '0' + mIndo[1] : mIndo[1];
    const mName = mIndo[2].toLowerCase();
    const y = mIndo[3];
    if (indoMonths[mName]) {
      results.push(y + '-' + indoMonths[mName] + '-' + d);
    }
  }

  // C. Slash or dash: DD/MM/YYYY or DD-MM-YYYY (pola [-/] aman dari interpretasi range)
  const slashRegex = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g;
  let mSlash;
  while ((mSlash = slashRegex.exec(str)) !== null) {
    const d = mSlash[1].length === 1 ? '0' + mSlash[1] : mSlash[1];
    const mo = mSlash[2].length === 1 ? '0' + mSlash[2] : mSlash[2];
    const y = mSlash[3];
    const moNum = parseInt(mo, 10);
    if (moNum >= 1 && moNum <= 12) {
      results.push(y + '-' + mo + '-' + d);
    }
  }

  // Filter unik tanpa spread Set
  const uniqueResults = [];
  for (let i = 0; i < results.length; i++) {
    if (uniqueResults.indexOf(results[i]) === -1) {
      uniqueResults.push(results[i]);
    }
  }
  return uniqueResults;
}

/**
 * Ekstraksi nama dan email peserta dari kolom string ringkasan
 * Format per baris: "1. Budi Santoso <budi@kantor.com> (IT)"
 */
function extractParticipantsFromSummary(summaryText) {
  if (!summaryText) return [];
  const lines = String(summaryText).split('\n');
  const list = [];
  lines.forEach(line => {
    const emailMatch = line.match(/<([^>]+@[^>]+)>/) || line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      const email = (emailMatch[1] || emailMatch[0]).trim();
      let name = line.replace(/^[0-9]+\.\s*/, '').replace(/<[^>]+>/, '').replace(/\(.*?\)/g, '').trim();
      list.push({ nama: name || "Peserta", email: email, departemen: "" });
    }
  });
  return list;
}

// ==============================================================================
// 6. HELPER EMAIL REMINDER H-1 TEMPLATE
// ==============================================================================
function sendReminderEmails(meta, participants, modules, executionDate) {
  let validParticipants = (participants || []).filter(p => {
    const email = String(p.email || '').trim();
    return email.includes('@') && email.includes('.');
  });

  // Fallback jika participants kosong tapi ada email pengaju di meta
  if (validParticipants.length === 0 && meta) {
    const pengajuEmail = meta["Email pengaju"] || meta["Email leader"] || meta["Email"] || "";
    if (pengajuEmail && String(pengajuEmail).includes("@")) {
      validParticipants.push({
        nama: meta["Nama pengaju"] || meta["Leader pengaju"] || "Rekan Karyawan",
        email: String(pengajuEmail).trim(),
        departemen: meta["Departemen / divisi"] || ""
      });
    }
  }

  if (validParticipants.length === 0) {
    Logger.log("Peringatan sendReminderEmails: Tidak ada email peserta valid.");
    return "0 email valid";
  }

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
    ? `<a href="${meta["Link silabus materi"]}" target="_blank" style="color:#00178F;font-weight:600;text-decoration:underline;">Tautan Materi / Silabus &rarr;</a>`
    : "-";

  let count = 0;
  let errorMsgs = [];

  validParticipants.forEach(p => {
    const recipientEmail = String(p.email).trim();
    const recipientName = p.nama || "Rekan Karyawan";
    const subject = `[REMINDER H-1] Pelatihan Besok: ${trainingName} (${trainingId})`;

    const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">&#9200;</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:23px;font-weight:700;color:#00178F;line-height:1.3;">Reminder: Pelatihan Besok! &#9200;</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 12px;">
          <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Halo ${recipientName},</p>
          <p style="margin:0 0 20px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">
            Ini adalah pengingat bahwa Anda dijadwalkan untuk mengikuti pelatihan internal berikut yang akan diselenggarakan <strong>besok</strong>:
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FBFE;border-radius:12px;border:1px solid #E1E8F8;overflow:hidden;margin-bottom:22px;">
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;width:130px;">Topik Pelatihan</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:700;color:#00178F;">${trainingName}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">ID Training</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${trainingId} &bull; Metode: ${metode}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Jadwal Waktu</td>
              <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;font-weight:600;color:#00178F;">${jadwal}</td>
            </tr>
            <tr>
              <td style="padding:11px 16px;font-size:12px;font-weight:600;color:#8D93C2;">Tempat / Tautan</td>
              <td style="padding:11px 16px;font-size:13.5px;color:#4A4F8F;">${lokasiOrLink}</td>
            </tr>
            ${meta["Link silabus materi"] && String(meta["Link silabus materi"]).trim() !== "-" && String(meta["Link silabus materi"]).trim() !== "" ? `
            <tr>
              <td style="padding:11px 16px;border-top:1px solid #EDF1FE;font-size:12px;font-weight:600;color:#8D93C2;">Materi / Silabus</td>
              <td style="padding:11px 16px;border-top:1px solid #EDF1FE;font-size:13.5px;">${silabusLink}</td>
            </tr>` : ''}
          </table>

          <div style="background:rgba(75, 150, 255, 0.08);border-left:4px solid #4B96FF;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#00178F;">
            <strong>Checklist Persiapan:</strong>
            <ul style="margin:6px 0 0;padding-left:18px;color:#4A4F8F;">
              <li>Hadir tepat waktu (minimal 5-10 menit sebelum sesi dimulai).</li>
              <li>Pastikan laptop/koneksi internet dalam kondisi stabil jika daring.</li>
              <li>Siapkan materi atau prasyarat yang telah diinformasikan.</li>
            </ul>
          </div>

          <p style="margin:0;font-size:13.5px;color:#4A4F8F;line-height:1.6;">
            Semoga pelatihannya berjalan lancar dan bermanfaat bagi pengembangan kompetensi Anda.<br><br>
            Salam hangat,<br>
            <strong style="color:#00178F;">Tim Training &amp; People Development</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Email otomatis dari Training Request System &middot; Jangan reply email ini</p>
        </td>
      </tr>
    </table>
  </div>`;

    const plainText = `Halo ${recipientName},\n\nReminder pelatihan Anda besok:\nTopik: ${trainingName} (${trainingId})\nWaktu: ${jadwal}\nTempat/Link: ${meta["Lokasi / venue"] || meta["Link meeting online"] || "-"}\n\nSalam,\nTim TnD`;

    try {
      GmailApp.sendEmail(recipientEmail, subject, plainText, {
        htmlBody: htmlBody,
        name: "Training & Development Portal"
      });
      count++;
    } catch (e) {
      Logger.log(`Gagal kirim reminder ke ${recipientEmail}: ${e.toString()}`);
      errorMsgs.push(`${recipientEmail}: ${e.message}`);
    }
  });

  if (errorMsgs.length > 0 && count === 0) {
    return `Gagal (${errorMsgs[0]})`;
  }
  return `${count} email`;
}

// ==============================================================================
// 7. SETUP TRIGGER SCHEDULER OTOMATIS (1-KLIK)
// ==============================================================================
/**
 * Jalankan fungsi ini SATU KALI dari editor Apps Script
 * untuk memasang trigger harian otomatis jam 08:00 pagi WIB.
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

  Logger.log("SUKSES: Trigger harian 'checkAndSendReminders' berhasil dipasang setiap hari pukul 08:00 pagi WIB!");
}

// ==============================================================================
// 8. FUNGSI PENGUJIAN MANUAL & DIAGNOSTIK (TEST RUNNERS)
// ==============================================================================

/**
 * 1. Test Kirim Email Konfirmasi Pendaftaran ke Email Akun Anda Sendiri
 */
function testSendSampleEmail() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("ERROR: Tidak dapat mendeteksi email aktif. Jalankan otorisasi izin script.");
    return;
  }

  const sampleMeta = {
    "ID training": "TRN-20260921-WBD-SOFT",
    "Nama training": "Workshop Google Workspace Automation (Test)",
    "Tanggal & jam pelaksanaan": "21 September 2026, 09:00 - 15:00 WIB",
    "Metode training": "Online",
    "Platform online": "Google Meet",
    "Link meeting online": "https://meet.google.com/abc-defg-hij",
    "Trainer": "Duta TnD",
    "Link silabus materi": "https://drive.google.com"
  };

  const sampleParticipants = [
    { nama: "Testing User", email: myEmail, departemen: "WEB DEVELOPER" }
  ];

  Logger.log(`Menjalankan testSendSampleEmail ke ${myEmail}...`);
  const result = sendRegistrationEmails(sampleMeta, sampleParticipants, []);
  Logger.log("Hasil: " + result);
}

/**
 * 2. Test Kirim Email Reminder H-1 ke Email Akun Anda Sendiri
 */
function testSendReminderEmail() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("ERROR: Tidak dapat mendeteksi email aktif. Jalankan otorisasi izin script.");
    return;
  }

  const sampleMeta = {
    "ID training": "TRN-20260922-WBD-SOFT",
    "Nama training": "Workshop Google Workspace Automation (Reminder Test)",
    "Tanggal & jam pelaksanaan": "Besok, 09:00 - 15:00 WIB",
    "Metode training": "Online",
    "Platform online": "Google Meet",
    "Link meeting online": "https://meet.google.com/abc-defg-hij",
    "Trainer": "Duta TnD",
    "Link silabus materi": "https://drive.google.com"
  };

  const sampleParticipants = [
    { nama: "Testing User (Reminder)", email: myEmail, departemen: "WEB DEVELOPER" }
  ];

  Logger.log(`Menjalankan testSendReminderEmail ke ${myEmail}...`);
  const result = sendReminderEmails(sampleMeta, sampleParticipants, [], "2026-09-22");
  Logger.log("Hasil: " + result);
}

/**
 * 3. Test Kirim Email Keputusan Approval ke Email Akun Anda Sendiri
 */
function testSendApprovalDecisionEmail() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("ERROR: Tidak dapat mendeteksi email aktif. Jalankan otorisasi izin script.");
    return;
  }

  const sampleRow = {
    "ID Training": "TRN-20260921-WBD-SOFT",
    "Nama Training": "Workshop Google Workspace Automation",
    "Nama Pengaju": "Testing Pengaju",
    "Departemen / Divisi": "WEB DEVELOPER",
    "Jadwal Pelaksanaan": "21 September 2026, 09:00 - 15:00 WIB",
    "Metode Training": "Online",
    "Lokasi / Venue": "Google Meet",
    "Trainer / Fasilitator": "Duta TnD",
    "Estimasi Biaya": "Rp 3.500.000",
    "Budget Diajukan": "Rp 3.500.000",
    "Approver": "Manager Development",
    "Catatan Approver": "Disetujui untuk dilaksanakan sesuai jadwal yang diajukan.",
    "Email Pengaju": myEmail
  };

  Logger.log(`Menjalankan testSendApprovalDecisionEmail ke ${myEmail}...`);
  const result = sendApprovalDecisionEmail(sampleRow, "Disetujui", "Manager Development", sampleRow["Catatan Approver"]);
  Logger.log("Hasil: " + result);
}

/**
 * 4. Test Kirim Email Notifikasi Approver Baru ke Email Akun Anda Sendiri
 */
function testSendApproverNotification() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("ERROR: Tidak dapat mendeteksi email aktif. Jalankan otorisasi izin script.");
    return;
  }

  const sampleMeta = {
    "ID training": "TRN-TEST-APPROVER",
    "Nama training": "Workshop Advanced System Architecture",
    "Leader pengaju": "Senior Engineer",
    "Email pengaju": myEmail,
    "Departemen / divisi": "WEB DEVELOPER",
    "Tanggal & jam pelaksanaan": "28 September 2026, 09:00 - 15:00 WIB",
    "Metode training": "Online",
    "Platform online": "Google Meet",
    "Link meeting online": "https://meet.google.com/abc-defg-hij",
    "Trainer": "Head of Engineering",
    "Budget diajukan": "Rp 4.500.000",
    "Training plan purpose": "Standarisasi microservices dan distributed tracing",
    "Jumlah peserta": 5
  };

  Logger.log(`Menjalankan testSendApproverNotification...`);
  const result = sendApproverNotification(sampleMeta, [], [], sampleMeta["ID training"]);
  Logger.log("Hasil: " + result);
}

/**
 * 5. Test Seluruh Email Sekaligus (4-in-1 Test: Konfirmasi, Reminder H-1, Keputusan, Notif Approver)
 */
function testSendAllEmails() {
  Logger.log("=== MEMULAI TEST SEMUA EMAIL (4-IN-1 TEST) ===");
  testSendSampleEmail();
  testSendReminderEmail();
  testSendApprovalDecisionEmail();
  testSendApproverNotification();
  checkEmailQuota();
  Logger.log("=== TEST SEMUA EMAIL SELESAI ===");
}

/**
 * 5. Cek Kuota & Status Izin Pengiriman Email Akun Google
 */
function checkEmailQuota() {
  const quota = MailApp.getRemainingDailyQuota();
  const user = Session.getActiveUser().getEmail();
  Logger.log(`[INFO AKUN] Email Pemilik: ${user}`);
  Logger.log(`[INFO KUOTA] Sisa kuota email Gmail hari ini: ${quota} email`);
  if (quota <= 0) {
    Logger.log("PERINGATAN: Kuota pengiriman email Anda telah habis untuk hari ini!");
  } else {
    Logger.log("STATUS: Pengiriman email siap digunakan.");
  }
}

/**
 * 6. Paksa Kirim Reminder untuk Baris Pertama Data Training pada Sheet
 * Fungsi ini mengabaikan tanggal besok / H-1 dan status lama, sehingga sangat cocok
 * digunakan untuk menguji coba pengiriman reminder langsung dari data aktual di spreadsheet!
 */
function forceSendReminderToFirstRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) {
    Logger.log("Belum ada data submission pada sheet untuk dites.");
    return;
  }
  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = rawHeaders.map(h => String(h).trim().toLowerCase());
  const colIdIdx = headersLower.indexOf("id training");
  if (colIdIdx === -1) {
    Logger.log("Kolom ID Training tidak ditemukan.");
    return;
  }
  const firstId = String(sheet.getRange(2, colIdIdx + 1).getValue()).trim();
  Logger.log(`Memaksa kirim reminder untuk baris pertama dengan ID: '${firstId}'`);
  checkAndSendReminders(firstId);
}

/**
 * 7. Test Auto-Booking Ruangan Google Calendar
 * Jalankan fungsi ini langsung dari editor Apps Script untuk menguji
 * booking kalender ruangan (Neptunus/Saturnus/Mars/Merkurius).
 */
function testCreateRoomCalendarBooking() {
  const myEmail = Session.getActiveUser().getEmail();
  const sampleMeta = {
    "ID training": "TRN-TEST-SATURNUS",
    "Nama training": "Workshop Google Calendar Saturnus",
    "Kategori training": "Teknis",
    "Lokasi / venue": "Ruangan Meeting Saturnus",
    "Tanggal pelaksanaan (raw)": "2026-09-25",
    "Jam mulai (raw)": "10:00",
    "Jam selesai (raw)": "12:00",
    "Trainer": "Trainer Fasilitator",
    "Leader pengaju": "Leader Saturnus",
    "Email pengaju": myEmail,
    "Departemen / divisi": "WEB DEVELOPER",
    "Link silabus materi": "https://drive.google.com"
  };

  const sampleParticipants = [
    { nama: "Test Peserta 1", email: myEmail, departemen: "WEB DEVELOPER" }
  ];

  Logger.log("=== MEMULAI TEST BOOKING KALENDER RUANGAN SATURNUS ===");
  Logger.log(`Target Ruangan: ${sampleMeta["Lokasi / venue"]}`);
  Logger.log(`Email Pengaju: ${sampleMeta["Email pengaju"]}`);
  Logger.log(`Peserta: ${JSON.stringify(sampleParticipants)}`);
  const result = bookMeetingRoom(sampleMeta, sampleParticipants);
  Logger.log(`Hasil booking kalender: ${JSON.stringify(result)}`);
  return result;
}

/**
 * 8.5. Utility Pembersih Data Dummy / Test dari Spreadsheet "Training Submissions"
 * Jalankan fungsi ini dari editor Apps Script untuk membersihkan data dummy secara massal.
 */
function deleteDummySubmissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet tidak ditemukan: " + SHEET_NAME);
    return;
  }
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log("Sheet masih kosong.");
    return;
  }

  const headersLower = data[0].map(h => String(h).trim().toLowerCase());
  const colId = headersLower.indexOf("id training");
  const colNama = headersLower.indexOf("nama training");
  const colPengaju = headersLower.indexOf("nama pengaju");

  const dummyIds = [
    "TRN",
    "TRN-TEST-1234",
    "TRN-2026-001",
    "TRN-2026-002",
    "TRN-20261005-GEN-SS"
  ];

  let deletedCount = 0;
  // Loop dari baris paling bawah ke atas agar indeks baris tidak bergeser saat baris dihapus
  for (let i = data.length - 1; i >= 1; i--) {
    const id = String(data[i][colId] || "").trim().toUpperCase();
    const nama = String(data[i][colNama] || "").trim();
    const pengaju = String(data[i][colPengaju] || "").trim();

    const isDummy = dummyIds.some(d => d.toUpperCase() === id) ||
                    id === "TRN" ||
                    id.startsWith("TRN-TEST") ||
                    nama.toLowerCase().includes("antigravity") ||
                    (nama === "-" && pengaju === "-") ||
                    pengaju === "Test Leader";

    if (isDummy) {
      Logger.log(`Menghapus baris ${i + 1}: ID = "${id}", Nama = "${nama}", Pengaju = "${pengaju}"`);
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  Logger.log(`Pembersihan selesai! Sebanyak ${deletedCount} baris data dummy berhasil dihapus dari sheet.`);
}

// ==============================================================================
// 9. WEB APP GET HANDLER (READ DATA TERSTRUKTUR & CHECK AVAILABILITY)
// ==============================================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = (params.action || "").trim();

    // Aksi 1: Pengecekan ketersediaan ruangan meeting via Google Calendar & Spreadsheet
    if (action === 'checkRooms' || action === 'checkAvailability') {
      return handleCheckRoomAvailability(params);
    }

    // Aksi 2: Pengambilan event terstruktur khusus Kalender Training (FullCalendar)
    if (action === 'getCalendarEvents' || action === 'calendar_events') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      return handleGetCalendarEvents(ss);
    }

    // Aksi 3: Pengambilan seluruh evidence & dokumentasi Post Training (Approver Collection)
    if (action === 'getPostTrainingEvidence' || action === 'getEvidence' || action === 'post_training_evidence') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      return handleGetPostTrainingEvidence(ss);
    }

    // Aksi reset/reformat sheet TIDAK lagi tersedia via URL publik (bisa dipanggil siapa saja).
    // Gunakan menu Spreadsheet "Format / Reset Sheet" atau jalankan resetSheet() dari editor Apps Script.
    if (action === 'resetSheet' || action === 'resetSheetHeaders' || action === 'reformatSheet') {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Aksi tidak dikenal" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi Default: Pengambilan seluruh submission spreadsheet untuk dashboard/approval
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

/**
 * HANDLER PENGAMBILAN EVENT KALENDER TRAINING (FullCalendar JSON Feed)
 * Mengembalikan array JSON event: id, judul, tanggal, jamMulai, jamSelesai, ruangan, pemohon, divisi, kategori, status.
 */
function handleGetCalendarEvents(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0].map(h => String(h).trim());
    const events = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObj = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = row[colIdx];
      });

      let rawJson = null;
      if (rowObj["Raw Data JSON"]) {
        try {
          rawJson = JSON.parse(rowObj["Raw Data JSON"]);
        } catch (e) {}
      }

      const meta = (rawJson && rawJson.meta) || {};
      const modules = (rawJson && Array.isArray(rawJson.modules)) ? rawJson.modules : [];

      const id = String(rowObj["ID Training"] || meta["ID training"] || `TRN-${i}`).trim();
      const judul = String(rowObj["Nama Training"] || meta["Nama training"] || "Untitled Training").trim();
      const pemohon = String(rowObj["Nama Pengaju"] || meta["Nama pengaju"] || meta["Leader pengaju"] || "-").trim();
      const divisi = String(rowObj["Departemen / Divisi"] || meta["Departemen / divisi"] || "-").trim();
      const kategori = String(rowObj["Kategori Training"] || meta["Kategori training"] || "Soft skill").trim();

      const rawStatus = String(rowObj["Status Dokumen"] || meta["Status Dokumen"] || "Pending").toLowerCase();
      let status = "Pending";
      if (rawStatus.includes("setuju") || rawStatus.includes("approved")) {
        status = "Approved";
      } else if (rawStatus.includes("tolak") || rawStatus.includes("rejected")) {
        status = "Rejected";
      }

      const defaultRuangan = String(rowObj["Lokasi / Venue"] || meta["Lokasi / venue"] || meta["Platform online"] || "-").trim();

      if (modules.length > 0) {
        modules.forEach((mod, modIdx) => {
          const modTanggal = (mod.tanggal || "").trim();
          if (modTanggal) {
            events.push({
              id: `${id}_m${modIdx + 1}`,
              trainingId: id,
              judul: modules.length > 1 ? `${judul} (${mod.modul || 'Sesi ' + (modIdx + 1)})` : judul,
              tanggal: modTanggal,
              jamMulai: (mod.jamMulai || "").trim(),
              jamSelesai: (mod.jamSelesai || "").trim(),
              ruangan: (mod.lokasi || defaultRuangan).trim() || defaultRuangan,
              pemohon: pemohon,
              divisi: divisi,
              kategori: kategori,
              status: status
            });
          }
        });
      } else {
        let tgl = "";
        let jamM = "";
        let jamS = "";

        const jadwalStr = String(rowObj["Jadwal Pelaksanaan"] || meta["Tanggal & jam pelaksanaan"] || rowObj["Tanggal Pengajuan"] || "").trim();
        const dateMatch = jadwalStr.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        if (dateMatch) {
          tgl = dateMatch[1];
        }

        const timeMatches = jadwalStr.match(/\b(\d{1,2}:\d{2})\b/g);
        if (timeMatches && timeMatches.length >= 1) {
          jamM = timeMatches[0];
          if (timeMatches.length >= 2) jamS = timeMatches[1];
        }

        if (tgl) {
          events.push({
            id: id,
            trainingId: id,
            judul: judul,
            tanggal: tgl,
            jamMulai: jamM,
            jamSelesai: jamS,
            ruangan: defaultRuangan,
            pemohon: pemohon,
            divisi: divisi,
            kategori: kategori,
            status: status
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify(events)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HANDLER PENGECEKAN KETERSEDIAAN 4 RUANGAN MEETING
 * Memeriksa jadwal Google Calendar untuk setiap ruangan dan cross-check dengan Google Sheet.
 */
function handleCheckRoomAvailability(params) {
  try {
    const dateStr = (params.date || "").trim(); // "YYYY-MM-DD"
    const startTimeStr = (params.startTime || params.start || "09:00").trim();
    const endTimeStr = (params.endTime || params.end || "15:00").trim();

    if (!dateStr) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Parameter 'date' diperlukan (format YYYY-MM-DD)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const normStart = startTimeStr.length === 5 ? startTimeStr : startTimeStr.padStart(5, '0');
    const normEnd = endTimeStr.length === 5 ? endTimeStr : endTimeStr.padStart(5, '0');

    // Parse rentang waktu
    let queryStart = new Date(`${dateStr}T${normStart}:00`);
    let queryEnd = new Date(`${dateStr}T${normEnd}:00`);

    if (isNaN(queryStart.getTime()) && typeof parseDatesFromText === "function") {
      const parsedDates = parseDatesFromText(dateStr);
      if (parsedDates && parsedDates.length > 0) {
        queryStart = new Date(`${parsedDates[0]}T${normStart}:00`);
        queryEnd = new Date(`${parsedDates[0]}T${normEnd}:00`);
      }
    }

    if (isNaN(queryStart.getTime()) || isNaN(queryEnd.getTime())) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `Format tanggal atau jam tidak valid: date=${dateStr}, start=${startTimeStr}, end=${endTimeStr}`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const startMs = queryStart.getTime();
    const endMs = queryEnd.getTime();

    const results = {};

    // Inisialisasi struktur hasil untuk setiap ruangan
    for (const [roomFullName, roomEmail] of Object.entries(ROOM_CALENDAR_MAP)) {
      const shortName = roomFullName.replace("Ruangan Meeting ", "");
      results[roomFullName] = {
        name: shortName,
        fullName: roomFullName,
        available: true,
        conflicts: []
      };
    }

    // 1. Prioritas Utama: Periksa via Google Calendar FreeBusy API (Resmi & Akurat untuk Resource Ruangan)
    const freeBusyData = fetchFreeBusyFromGoogle(queryStart, queryEnd);
    let freeBusySuccess = false;

    if (freeBusyData) {
      freeBusySuccess = true;
      for (const [roomFullName, roomEmail] of Object.entries(ROOM_CALENDAR_MAP)) {
        const calData = freeBusyData[roomEmail];
        if (calData && Array.isArray(calData.busy) && calData.busy.length > 0) {
          for (let i = 0; i < calData.busy.length; i++) {
            const b = calData.busy[i];
            const bStart = new Date(b.start).getTime();
            const bEnd = new Date(b.end).getTime();

            // Interval bentrok: bStart < endMs && bEnd > startMs
            if (bStart < endMs && bEnd > startMs) {
              const startFormatted = Utilities.formatDate(new Date(b.start), TIME_ZONE, "HH:mm");
              const endFormatted = Utilities.formatDate(new Date(b.end), TIME_ZONE, "HH:mm");
              results[roomFullName].available = false;
              results[roomFullName].conflicts.push({
                title: "Ruangan Sedang Digunakan",
                timeRange: `${startFormatted} - ${endFormatted} WIB`
              });
            }
          }
        }
      }
    }

    // 2. Layer Kedua: Jika FreeBusy API tidak memberikan data, coba via CalendarApp native
    if (!freeBusySuccess) {
      for (const [roomFullName, roomEmail] of Object.entries(ROOM_CALENDAR_MAP)) {
        if (!roomEmail || String(roomEmail).startsWith('GANTI_DENGAN')) {
          continue;
        }

        try {
          const cal = CalendarApp.getCalendarById(roomEmail);
          if (cal) {
            const events = cal.getEvents(queryStart, queryEnd);
            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const evStartMs = ev.getStartTime().getTime();
              const evEndMs = ev.getEndTime().getTime();

              if (evStartMs < endMs && evEndMs > startMs) {
                const startFormatted = Utilities.formatDate(ev.getStartTime(), TIME_ZONE, "HH:mm");
                const endFormatted = Utilities.formatDate(ev.getEndTime(), TIME_ZONE, "HH:mm");
                results[roomFullName].available = false;
                results[roomFullName].conflicts.push({
                  title: ev.getTitle() || "Ada Kegiatan Lain",
                  timeRange: `${startFormatted} - ${endFormatted} WIB`
                });
              }
            }
          }
        } catch (calErr) {
          Logger.log(`Warning query calendar ${roomFullName} (${roomEmail}): ${calErr.toString()}`);
        }
      }
    }

    // 3. Layer Ketiga: Cross-check dengan Google Sheet 'Training Submissions' sebagai sumber data pelengkap
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const locIdx = headers.indexOf("Lokasi / Venue");
        const statusIdx = headers.indexOf("Status Dokumen");
        const rawJsonIdx = headers.indexOf("Raw Data JSON");

        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          const status = String(row[statusIdx] || "").trim().toLowerCase();
          if (status === "dibatalkan" || status === "ditolak") continue;

          const venue = String(row[locIdx] || "").trim();
          if (!results[venue]) continue;

          let isConflict = false;
          let conflictRange = "";

          // Coba dari Raw Data JSON
          const rawJsonStr = row[rawJsonIdx];
          if (rawJsonStr && String(rawJsonStr).trim().indexOf(String.fromCharCode(123)) === 0) {
            try {
              const parsed = JSON.parse(rawJsonStr);
              const meta = parsed.meta || {};
              const tglRaw = meta["Tanggal pelaksanaan (raw)"];
              const jmMulai = meta["Jam mulai (raw)"] || "09:00";
              const jmSelesai = meta["Jam selesai (raw)"] || "15:00";

              if (tglRaw) {
                let sheetDateStr = tglRaw;
                if (typeof parseDatesFromText === "function") {
                  const p = parseDatesFromText(tglRaw);
                  if (p && p.length > 0) sheetDateStr = p[0];
                }
                const qDateStr = Utilities.formatDate(queryStart, TIME_ZONE, "yyyy-MM-dd");

                if (sheetDateStr === qDateStr) {
                  const sStart = new Date(`${sheetDateStr}T${jmMulai.length === 5 ? jmMulai : jmMulai.padStart(5, '0')}:00`).getTime();
                  const sEnd = new Date(`${sheetDateStr}T${jmSelesai.length === 5 ? jmSelesai : jmSelesai.padStart(5, '0')}:00`).getTime();
                  if (!isNaN(sStart) && !isNaN(sEnd) && sStart < endMs && sEnd > startMs) {
                    isConflict = true;
                    conflictRange = `${jmMulai} - ${jmSelesai} WIB`;
                  }
                }
              }
            } catch (errJson) {}
          }

          if (isConflict) {
            results[venue].available = false;
            const alreadyLogged = results[venue].conflicts.some(c => c.timeRange === conflictRange);
            if (!alreadyLogged) {
              results[venue].conflicts.push({
                title: "Jadwal Pelatihan Terdaftar",
                timeRange: conflictRange
              });
            }
          }
        }
      }
    } catch (sheetErr) {
      Logger.log(`Warning cross-check sheet: ${sheetErr.toString()}`);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      date: Utilities.formatDate(queryStart, TIME_ZONE, "yyyy-MM-dd"),
      startTime: normStart,
      endTime: normEnd,
      rooms: results
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * QUERY GOOGLE CALENDAR FREEBUSY API
 * Memeriksa slot busy langsung ke server Google Calendar menggunakan OAuth Token.
 * Mampu membaca ketersediaan resource ruangan meskipun kalender diset 'See only free/busy'.
 */
function fetchFreeBusyFromGoogle(queryStart, queryEnd) {
  try {
    const token = ScriptApp.getOAuthToken();
    if (!token) {
      Logger.log("OAuth token tidak tersedia untuk FreeBusy API");
      return null;
    }

    const isoStart = Utilities.formatDate(queryStart, "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const isoEnd = Utilities.formatDate(queryEnd, "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");

    const items = [];
    for (const email of Object.values(ROOM_CALENDAR_MAP)) {
      if (email && email.includes("@") && !String(email).startsWith("GANTI_DENGAN")) {
        items.push({ id: email.trim() });
      }
    }

    if (items.length === 0) return null;

    const payload = {
      timeMin: isoStart,
      timeMax: isoEnd,
      timeZone: TIME_ZONE,
      items: items
    };

    const response = UrlFetchApp.fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    if (status === 200) {
      const data = JSON.parse(response.getContentText());
      return data.calendars || null;
    } else {
      Logger.log(`FreeBusy API HTTP ${status}: ${response.getContentText()}`);
      return null;
    }
  } catch (err) {
    Logger.log(`FreeBusy API Exception: ${err.toString()}`);
    return null;
  }
}

/**
 * TEST RUNNER: DIAGNOSIS IZIN & AKSES KE-4 KALENDER RUANGAN
 * Jalankan fungsi ini dari editor Apps Script untuk melihat apakah akun Anda
 * dapat membaca event dan ketersediaan setiap ruangan meeting.
 */
function testDiagnoseCalendars() {
  Logger.log("=== DIAGNOSIS AKSES KALENDER RUANGAN MEETING ===");
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Uji FreeBusy API
  Logger.log("--- 1. Uji Google Calendar FreeBusy API ---");
  const freeBusy = fetchFreeBusyFromGoogle(now, nextWeek);
  if (freeBusy) {
    Logger.log("FreeBusy API BERHASIL! Respons:");
    Logger.log(JSON.stringify(freeBusy, null, 2));
  } else {
    Logger.log("FreeBusy API mengembalikan null / gagal dipanggil.");
  }

  // 2. Uji CalendarApp.getCalendarById
  Logger.log("--- 2. Uji CalendarApp.getCalendarById ---");
  for (const [name, email] of Object.entries(ROOM_CALENDAR_MAP)) {
    try {
      const cal = CalendarApp.getCalendarById(email);
      if (!cal) {
        Logger.log(`[${name}] (${email}): NULL. Akun Google Anda belum menambahkan kalender ini ke daftar 'Kalender Lainnya' (Other calendars).`);
      } else {
        const events = cal.getEvents(now, nextWeek);
        Logger.log(`[${name}] (${email}): DITEMUKAN. Nama: "${cal.getName()}". Jumlah event 7 hari ke depan: ${events.length}`);
        events.slice(0, 3).forEach(e => {
          Logger.log(`   - ${e.getTitle() || "(Tanpa Judul)"} : ${Utilities.formatDate(e.getStartTime(), TIME_ZONE, "yyyy-MM-dd HH:mm")} s/d ${Utilities.formatDate(e.getEndTime(), TIME_ZONE, "yyyy-MM-dd HH:mm")}`);
        });
      }
    } catch (err) {
      Logger.log(`[${name}] (${email}) ERROR: ${err.toString()}`);
    }
  }

  // 3. Uji Cek Ketersediaan Hari Ini
  Logger.log("--- 3. Uji Fungsi handleCheckRoomAvailability ---");
  const checkResult = testCheckRoomAvailability();
  Logger.log("Hasil Pengecekan Ketersediaan:");
  Logger.log(checkResult);
}

/**
 * TEST RUNNER: PENGECEKAN KETERSEDIAAN RUANGAN
 */
function testCheckRoomAvailability() {
  const sampleDate = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  Logger.log(`Testing check room availability for date: ${sampleDate}`);
  const result = handleCheckRoomAvailability({
    date: sampleDate,
    startTime: "09:00",
    endTime: "15:00"
  });
  return result.getContent();
}

/**
 * 10. HELPER: CETAK LINK GOOGLE SPREADSHEET
 */
function getLinkSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = ss ? ss.getUrl() : "Tidak terhubung ke spreadsheet";
  Logger.log("=== LINK GOOGLE SPREADSHEET ANDA ===");
  Logger.log(url);
  return url;
}

// ==============================================================================
// 11. COMPLETION EMAIL DISPATCHER (EVALUASI TRAINER & POST-TEST)
// ==============================================================================

/**
 * Kirim email "Training Selesai" ke peserta individual dengan tautan evaluasi & post-test.
 */
function sendTrainingCompletionEmail(participantName, participantEmail, evaluationFormUrl) {
  if (!participantEmail) return;
  const targetUrl = evaluationFormUrl || DEFAULT_EVALUATION_URL;
  const subject = "Training Selesai!";
  const htmlBody = `
  <div style="margin:0;padding:32px 16px;background:#F0F1F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,23,143,0.25);">
      <tr>
        <td style="background:linear-gradient(135deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#BFDBFF;padding:36px 32px 30px;" align="center">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;line-height:52px;text-align:center;margin-bottom:14px;">
            <span style="font-size:26px;">&#127891;</span>
          </div>
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00178F;">Training Request System</p>
          <h1 style="margin:0;font-size:23px;font-weight:700;color:#00178F;line-height:1.3;">Training Selesai! &#127881;</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#00178F;font-weight:600;">Halo ${participantName},</p>
          <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">Terima kasih sudah mengikuti dan berpartisipasi aktif dalam sesi pelatihan.</p>
          <p style="margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#4A4F8F;">Semoga ilmu dan keterampilan yang didapatkan dapat memberikan manfaat dan mendukung pekerjaan sehari-hari.</p>
          <p style="margin:0;font-size:14.5px;line-height:1.65;color:#4A4F8F;">Sebagai penutup, silahkan isi evaluasi trainer sekaligus post-test melalui tautan berikut:</p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 34px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:100px;background:linear-gradient(180deg,#EAF1FF 0%,#BFDBFF 50%,#FFD3DE 100%);background-color:#FFD3DE;">
                <a href="${targetUrl}" style="display:inline-block;padding:14px 30px;font-size:14.5px;font-weight:700;color:#00178F;text-decoration:none;border-radius:100px;">Evaluasi Trainer &amp; Post-Test &nbsp;&#8594;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#FAFAFD;border-top:1px solid #EDF1FE;" align="center">
          <p style="margin:0;font-size:11px;color:#9AA3D6;">Email otomatis dari Training Request System &middot; Jangan reply email ini</p>
        </td>
      </tr>
    </table>
  </div>`;

  MailApp.sendEmail({ to: participantEmail, subject: subject, htmlBody: htmlBody });
}

/**
 * Kirim email "Training Selesai" ke SEMUA peserta yang hadir dalam satu submission.
 */
function sendCompletionEmailsToParticipants(meta, participants, evaluationFormUrl) {
  const targetUrl = evaluationFormUrl || (meta && (meta["Link form evaluasi"] || meta["Link evaluasi post test"] || meta["Link Form Evaluasi / Post-Test"])) || DEFAULT_EVALUATION_URL;
  (participants || []).forEach(function (p) {
    if (p.kehadiran === 'Hadir' && p.email) {
      sendTrainingCompletionEmail(p.nama, p.email, targetUrl);
    }
  });
}

/**
 * TEST RUNNER: TEST KIRIM EMAIL TRAINING SELESAI & EVALUASI KE EMAIL ANDA SENDIRI
 */
function testSendCompletionEmail() {
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) {
    Logger.log("ERROR: Tidak dapat mendeteksi email aktif. Jalankan otorisasi izin script.");
    return;
  }
  Logger.log(`Mengirim test email Training Selesai ke: ${myEmail}`);
  sendTrainingCompletionEmail("Rekan Karyawan (Test)", myEmail, DEFAULT_EVALUATION_URL);
  Logger.log("Test email berhasil dikirim!");
}

// ==============================================================================
// 12. POST TRAINING TRAMPOLINE (EVIDENCE UPLOAD & POST-TEST DISPATCHER)
// ==============================================================================

const POST_TRAINING_HEADERS = [
  "Waktu Submit",
  "Tipe Aktivitas",
  "Nama Peserta",
  "Divisi / Departemen",
  "Nama Training",
  "Kategori",
  "Jumlah File",
  "Link Folder Google Drive",
  "Detail File Upload",
  "Skor Post-Test",
  "Jawaban / Catatan",
  "Status"
];

/**
 * Setup header untuk sheet "Post Training".
 */
function setupPostTrainingSheet(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(POST_TRAINING_HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, POST_TRAINING_HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#00178F");
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const currentHeadersLower = currentHeaders.map(h => h.toLowerCase());
    const missingHeaders = POST_TRAINING_HEADERS.filter(h => !currentHeadersLower.includes(h.toLowerCase()));
    if (missingHeaders.length > 0) {
      const startCol = currentHeaders.length + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      const headerRange = sheet.getRange(1, startCol, 1, missingHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#00178F");
      headerRange.setFontColor("#FFFFFF");
    }
  }
}

/**
 * Mendapatkan atau membuat subfolder di dalam folder induk.
 */
function getOrCreateSubFolder(parentFolder, folderName) {
  const safeName = (folderName || "Untitled").toString().trim();
  const folders = parentFolder.getFoldersByName(safeName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(safeName);
}

/**
 * Resolusi tipe MIME berkas modul & materi
 */
function resolveMaterialMimeType(fileName, fallbackType) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return MimeType.PDF;
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".zip")) return MimeType.ZIP;
  if (lower.endsWith(".rar")) return "application/x-rar-compressed";
  return fallbackType || "application/octet-stream";
}

/**
 * Mengambil root folder Google Drive untuk penyimpanan evidence.
 * Jika EVIDENCE_ROOT_FOLDER_ID diisi, gunakan folder tersebut; jika kosong, gunakan My Drive utama akun pelaksana.
 */
function getEvidenceRootFolder() {
  if (typeof EVIDENCE_ROOT_FOLDER_ID === "string" && EVIDENCE_ROOT_FOLDER_ID.trim().length > 0) {
    try {
      return DriveApp.getFolderById(EVIDENCE_ROOT_FOLDER_ID.trim());
    } catch (err) {
      Logger.log("Peringatan: Folder ID EVIDENCE_ROOT_FOLDER_ID tidak valid, beralih ke My Drive utama: " + err.message);
    }
  }
  return DriveApp.getRootFolder();
}

/**
 * Menangani pengunggahan file bukti training (Evidence) ke Google Drive
 * Struktur Folder: Evidence Training / [Divisi] / [Nama Training - Tanggal]
 * Dan mencatat transaksi ke tab "Post Training".
 */
function handlePostTrainingEvidence(ss, data) {
  try {
    let postSheet = ss.getSheetByName(POST_TRAINING_SHEET_NAME);
    if (!postSheet) {
      postSheet = ss.insertSheet(POST_TRAINING_SHEET_NAME);
    }
    setupPostTrainingSheet(postSheet);

    const rootFolder = getEvidenceRootFolder();
    const evidenceMainFolder = getOrCreateSubFolder(rootFolder, "Evidence Training");

    // Pastikan folder utama berizin Domain / Link sharing
    try {
      evidenceMainFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eMainShare) {
      try {
        evidenceMainFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eMainLink) {}
    }

    const divisiClean = (data.divisi || "Umum").toString().trim().replace(/[\/\\:*?"<>|]/g, "_");
    const deptFolder = getOrCreateSubFolder(evidenceMainFolder, divisiClean);

    const trainingNameClean = (data.namaTraining || "Training").toString().trim().replace(/[\/\\:*?"<>|]/g, "_");
    const dateStr = data.tanggal || Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
    const sessionFolderName = `${trainingNameClean} - ${dateStr}`;
    const targetFolder = getOrCreateSubFolder(deptFolder, sessionFolderName);

    // Atur hak akses folder ke Domain Workspace (karyawan cpssoft.com / cppsoft.com) atau siapa pun yang memiliki link
    try {
      targetFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eDomainFolder) {
      try {
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eLinkFolder) {
        Logger.log("Peringatan sharing folder: " + eLinkFolder.toString());
      }
    }

    const savedPhotos = [];
    const savedMaterials = [];

    // Helper resolusi tipe MIME modul & materi
    function resolveMaterialMimeType(fileName, fallbackType) {
      const lower = String(fileName || "").toLowerCase();
      if (lower.endsWith(".pdf")) return MimeType.PDF;
      if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
      if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      if (lower.endsWith(".doc")) return "application/msword";
      if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
      if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (lower.endsWith(".zip")) return MimeType.ZIP;
      if (lower.endsWith(".rar")) return "application/x-rar-compressed";
      return fallbackType || "application/octet-stream";
    }

    // 1. Simpan Foto Dokumentasi ke Sub-folder "📸 Dokumentasi Foto"
    if (Array.isArray(data.files) && data.files.length > 0) {
      const photoFolder = getOrCreateSubFolder(targetFolder, "📸 Dokumentasi Foto");
      try {
        photoFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (ePhotoShare) {
        try { photoFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (ePhotoLink) {}
      }

      data.files.forEach((f, idx) => {
        if (!f || !f.base64) return;
        try {
          // Bersihkan prefix data URL (cth: "data:image/jpeg;base64,") & karakter whitespace
          let cleanBase64 = String(f.base64).trim();
          if (cleanBase64.indexOf("base64,") !== -1) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf("base64,") + 7);
          }
          cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, "");

          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = (f.name || `dokumentasi_${idx + 1}.jpg`).toString().trim();
          const mimeType = f.type || (fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
          const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
          const driveFile = photoFolder.createFile(blob);

          // Berikan akses view untuk karyawan domain/link
          try {
            driveFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (eFileShare) {
            try {
              driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (eLinkShare) {}
          }

          savedPhotos.push({
            name: fileName,
            id: driveFile.getId(),
            url: driveFile.getUrl(),
            category: "Foto Dokumentasi"
          });
        } catch (fileErr) {
          Logger.log("Gagal mengunggah file bukti (" + (f.name || idx) + "): " + fileErr.toString());
        }
      });
    }

    // 2. Simpan Modul & Materi ke Sub-folder "📚 Modul & Materi"
    if (Array.isArray(data.materials) && data.materials.length > 0) {
      const materialFolder = getOrCreateSubFolder(targetFolder, "📚 Modul & Materi");
      try {
        materialFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eMatShare) {
        try { materialFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eMatLink) {}
      }

      data.materials.forEach((m, idx) => {
        if (!m || !m.base64) return;
        try {
          let cleanBase64 = String(m.base64).trim();
          if (cleanBase64.indexOf("base64,") !== -1) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf("base64,") + 7);
          }
          cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, "");

          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = (m.name || `materi_${idx + 1}.pdf`).toString().trim();
          const mimeType = resolveMaterialMimeType(fileName, m.type);
          const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
          const driveFile = materialFolder.createFile(blob);

          try {
            driveFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (eMatFileShare) {
            try {
              driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (eMatLinkShare) {}
          }

          savedMaterials.push({
            name: fileName,
            id: driveFile.getId(),
            url: driveFile.getUrl(),
            category: "Modul & Materi"
          });
        } catch (matErr) {
          Logger.log("Gagal mengunggah modul/materi (" + (m.name || idx) + "): " + matErr.toString());
        }
      });
    }

    const totalSavedFiles = savedPhotos.concat(savedMaterials);
    const totalCount = totalSavedFiles.length;
    const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");

    const detailsParts = [];
    if (savedPhotos.length > 0) {
      detailsParts.push("📸 [Dokumentasi Foto Kegiatan]:\n" + savedPhotos.map((f, i) => `${i + 1}. ${f.name} (${f.url})`).join("\n"));
    }
    if (savedMaterials.length > 0) {
      detailsParts.push("📚 [Modul & Materi Pelatihan]:\n" + savedMaterials.map((f, i) => `${i + 1}. ${f.name} (${f.url})`).join("\n"));
    }
    const fileDetails = detailsParts.join("\n\n");
    const folderUrl = targetFolder.getUrl();

    let activityType = "Unggah Bukti";
    if (savedPhotos.length > 0 && savedMaterials.length > 0) {
      activityType = "Unggah Bukti & Materi";
    } else if (savedMaterials.length > 0) {
      activityType = "Unggah Modul/Materi";
    }

    const currentHeaders = postSheet.getRange(1, 1, 1, postSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const rowMap = {
      "Waktu Submit": timestamp,
      "Tipe Aktivitas": activityType,
      "Nama Peserta": data.namaPeserta || "-",
      "Divisi / Departemen": data.divisi || "-",
      "Nama Training": data.namaTraining || "-",
      "Kategori": data.kategori || "-",
      "Jumlah File": totalCount,
      "Link Folder Google Drive": folderUrl,
      "Detail File Upload": fileDetails || "-",
      "Skor Post-Test": "-",
      "Jawaban / Catatan": "-",
      "Status": "Sukses"
    };

    const newRow = currentHeaders.map(header => {
      return rowMap[header] !== undefined ? rowMap[header] : "-";
    });
    postSheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Evidence & Materi berhasil diunggah ke Google Drive dan dicatat ke spreadsheet",
      folderUrl: folderUrl,
      count: totalCount,
      photoCount: savedPhotos.length,
      materialCount: savedMaterials.length,
      files: totalSavedFiles
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error handlePostTrainingEvidence: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Gagal memproses evidence & materi: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menangani pencatatan hasil Post-Test ke tab "Post Training".
 */
function handlePostTestSubmission(ss, data) {
  try {
    let postSheet = ss.getSheetByName(POST_TRAINING_SHEET_NAME);
    if (!postSheet) {
      postSheet = ss.insertSheet(POST_TRAINING_SHEET_NAME);
    }
    setupPostTrainingSheet(postSheet);

    const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
    const currentHeaders = postSheet.getRange(1, 1, 1, postSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const rowMap = {
      "Waktu Submit": timestamp,
      "Tipe Aktivitas": "Post Test",
      "Nama Peserta": data.namaPeserta || "-",
      "Divisi / Departemen": data.divisi || "-",
      "Nama Training": data.namaTraining || "-",
      "Kategori": data.kategori || "-",
      "Jumlah File": 0,
      "Link Folder Google Drive": "-",
      "Detail File Upload": "-",
      "Skor Post-Test": data.skor !== undefined ? data.skor : "-",
      "Jawaban / Catatan": data.jawaban || "-",
      "Status": "Selesai"
    };

    const newRow = currentHeaders.map(header => {
      return rowMap[header] !== undefined ? rowMap[header] : "-";
    });
    postSheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Hasil post-test berhasil dicatat ke Google Sheets"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error handlePostTestSubmission: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Gagal mencatat post-test: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menangani pencatatan pelaporan sesi Knowledge Sharing ke tab "Post Training".
 */
function handleKnowledgeSharingSubmission(ss, data) {
  try {
    let postSheet = ss.getSheetByName(POST_TRAINING_SHEET_NAME);
    if (!postSheet) {
      postSheet = ss.insertSheet(POST_TRAINING_SHEET_NAME);
    }
    setupPostTrainingSheet(postSheet);

    const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
    const currentHeaders = postSheet.getRange(1, 1, 1, postSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const detailSharing = `Tanggal Sesi: ${data.tanggalSesi || "-"} | Peserta: ${data.jumlahPeserta || 0} orang\nTopik: ${data.topikMateri || "-"}`;
    const rowMap = {
      "Waktu Submit": timestamp,
      "Tipe Aktivitas": "Knowledge Sharing",
      "Nama Peserta": data.namaSpeaker || "-",
      "Divisi / Departemen": data.divisi || "-",
      "Nama Training": data.namaTraining || "-",
      "Kategori": "Internal Sharing",
      "Jumlah File": data.jumlahPeserta ? `${data.jumlahPeserta} Peserta Hadir` : "-",
      "Link Folder Google Drive": data.linkRecording || "-",
      "Detail File Upload": detailSharing,
      "Skor Post-Test": "-",
      "Jawaban / Catatan": data.topikMateri || "-",
      "Status": "Selesai"
    };

    const newRow = currentHeaders.map(header => {
      return rowMap[header] !== undefined ? rowMap[header] : "-";
    });
    postSheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Laporan knowledge sharing berhasil dicatat ke Google Sheets"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error handleKnowledgeSharingSubmission: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Gagal mencatat knowledge sharing: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mengambil seluruh data evidence & dokumentasi dari tab "Post Training" untuk Portal Approver
 */
function handleGetPostTrainingEvidence(ss) {
  try {
    let postSheet = ss.getSheetByName(POST_TRAINING_SHEET_NAME);
    if (!postSheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    const values = postSheet.getDataRange().getValues();
    if (values.length < 2) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    const headers = values[0].map(h => String(h).trim());
    const evidenceList = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObj = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = row[colIdx];
      });

      // Ekstrak tautan file jika ada di dalam detail file
      const detailStr = String(rowObj["Detail File Upload"] || "");
      const fileUrls = [];
      const linkRegex = /https:\/\/drive\.google\.com\/[^\s\)]+/g;
      let match;
      while ((match = linkRegex.exec(detailStr)) !== null) {
        fileUrls.push(match[0]);
      }

      evidenceList.push({
        id: `EVD-${i}`,
        waktuSubmit: rowObj["Waktu Submit"] || "",
        tipeAktivitas: rowObj["Tipe Aktivitas"] || "Unggah Bukti",
        namaPeserta: rowObj["Nama Peserta"] || "-",
        divisi: rowObj["Divisi / Departemen"] || "-",
        namaTraining: rowObj["Nama Training"] || "-",
        kategori: rowObj["Kategori"] || "Soft skill",
        jumlahFile: Number(rowObj["Jumlah File"]) || (fileUrls.length || 0),
        folderUrl: rowObj["Link Folder Google Drive"] || "",
        detailFile: detailStr,
        fileUrls: fileUrls,
        skorPostTest: rowObj["Skor Post-Test"] || "-",
        catatan: rowObj["Jawaban / Catatan"] || "-",
        status: rowObj["Status"] || "Sukses"
      });
    }
    return ContentService.createTextOutput(JSON.stringify(evidenceList)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("Error handleGetPostTrainingEvidence: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * TEST RUNNER: TEST UPLOAD EVIDENCE KE GOOGLE DRIVE & POST TRAINING SHEET
 */
function testUploadEvidenceDummy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const mockPayload = {
    action: "submitPostTrainingEvidence",
    namaTraining: "Workshop Golang Backend",
    namaPeserta: "Tester TDS",
    divisi: "WEB DEVELOPER",
    kategori: "Hard skill",
    tanggal: Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd"),
    files: [
      { name: "test_evidence.png", type: "image/png", base64: dummyBase64 }
    ],
    materials: [
      { name: "modul_pelatihan_golang.pdf", type: "application/pdf", base64: dummyBase64 }
    ]
  };
  const res = handlePostTrainingEvidence(ss, mockPayload);
  Logger.log("Hasil test upload: " + res.getContent());
}

/**
 * UTILITY: ATUR AKSES SELURUH FOLDER BUKTI DI GOOGLE DRIVE KE KARYAWAN DOMAIN / LINK
 * Jalankan fungsi ini 1x dari Editor Apps Script jika ingin memperbarui perizinan folder-folder bukti yang sudah dibuat sebelumnya.
 */
function grantDomainAccessToAllEvidenceFolders() {
  const root = getEvidenceRootFolder();
  const folders = root.getFoldersByName("Evidence Training");
  if (!folders.hasNext()) {
    Logger.log("Folder 'Evidence Training' belum ditemukan di Google Drive.");
    return;
  }
  const mainFolder = folders.next();

  function applySharingRecursive(folder) {
    try {
      folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log("Berhasil set Domain sharing pada folder: " + folder.getName());
    } catch (err) {
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        Logger.log("Berhasil set Link sharing pada folder: " + folder.getName());
      } catch (err2) {
        Logger.log("Gagal set sharing pada folder " + folder.getName() + ": " + err2.toString());
      }
    }

    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      applySharingRecursive(subFolders.next());
    }

    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      try {
        file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (err2) {}
      }
    }
  }

  applySharingRecursive(mainFolder);
  Logger.log("✅ Selesai memperbarui izin akses Domain / Link untuk seluruh folder & file bukti pelatihan!");
}



