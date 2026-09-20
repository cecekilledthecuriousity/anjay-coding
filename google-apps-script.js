/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: FORMULIR TRAINING KARYAWAN -> SPREADSHEET
 * ==============================================================================
 * Petunjuk Penggunaan:
 * 1. Buka Google Sheets Anda yang terhubung dengan form ini.
 * 2. Klik menu "Extensions" (Ekstensi) > "Apps Script".
 * 3. Salin dan timpa SELURUH kode di Apps Script dengan isi file ini.
 * 4. Klik tombol "Save" (ikon disket).
 * 5. Klik "Deploy" > "Manage deployments" > klik ikon Pensil (Edit) > Version: "New version" > Klik "Deploy".
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
  "Raw Data JSON"
];

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Buat Sheet jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Buat header jika sheet masih baru/kosong
    if (sheet.getLastRow() === 0) {
      setupSheetHeaders(sheet);
    }

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

    // Format ringkasan peserta
    const participantsSummary = participants
      .filter(p => p.nama)
      .map((p, idx) => `${idx + 1}. ${p.nama} (${p.departemen || "-"})`)
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
      JSON.stringify(data)
    ];

    sheet.appendRow(rowData);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", message: "Data saved to Google Sheets successfully", id: meta["ID training"] })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheetHeaders(sheet) {
  sheet.appendRow(HEADERS);
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#3F5A44");
  headerRange.setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);
}

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
