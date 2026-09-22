/**
 * Formulir Training Karyawan - Interactive Logic, Stepper & Sheet Integration
 */

// ==============================================================================
// KONFIGURASI GOOGLE SPREADSHEET (HARDCODE)
// ==============================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhJcIa9aOpfFLBQqFKuuPmNHMI7dqkKlYLtCRSZYrqquhUsegzW2DJ2p6cFOzIr9O_AQ/exec";

// Configuration Keys
const SUBMISSIONS_STORAGE_KEY = 'training_submissions_master';
const ADMIN_PIN_KEY = 'training_admin_pin';
const DEFAULT_ADMIN_PIN = 'ubahpin123';

// State Management
let currentStep = 1;
const totalSteps = 4;
let participantCounter = 0;
let moduleCounter = 0;
let approvalCounter = 0;
let vendorCounter = 0;
let pendingSubmitData = null;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Set default today's date for Tanggal Pengajuan & Pelaksanaan
  const today = new Date().toISOString().split('T')[0];
  const tglPengajuan = document.getElementById('tglPengajuan');
  if (tglPengajuan && !tglPengajuan.value) {
    tglPengajuan.value = today;
  }

  // 2. Setup real-time event listeners for automatic Training ID generation
  const deptSelect = document.getElementById('deptName');
  const customDeptInput = document.getElementById('customDeptInput');
  const catSelect = document.getElementById('category');

  if (tglPengajuan) tglPengajuan.addEventListener('change', updateTrainingId);
  if (deptSelect) deptSelect.addEventListener('change', updateTrainingId);
  if (customDeptInput) customDeptInput.addEventListener('input', updateTrainingId);
  if (catSelect) catSelect.addEventListener('change', updateTrainingId);

  // 3. Initial calculation of Training ID
  updateTrainingId();

  // 4. Seed clean initial rows
  addModule();
  updateParticipantCount();

  // 5. Initial calculations & stepper UI
  calculateScheduleAndDuration();
  updateStepperUI();

  // Handle URL Hash on load
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);
});

// ==========================================
// Stepper Navigation Logic
// ==========================================
function goToStep(step) {
  if (step < 1 || step > totalSteps) return;

  // If moving forward, validate current step required fields
  if (step > currentStep) {
    if (!validateStep(currentStep)) return;
  }

  currentStep = step;
  updateStepperUI();

  if (currentStep === 4) {
    populateReviewSummary();
  }

  // Scroll to top of form
  const formView = document.getElementById('formView');
  if (formView) {
    formView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function nextStep() {
  goToStep(currentStep + 1);
}

function prevStep() {
  goToStep(currentStep - 1);
}

function updateStepperUI() {
  // 1. Panels visibility
  for (let i = 1; i <= totalSteps; i++) {
    const panel = document.getElementById(`stepPanel${i}`);
    if (panel) {
      if (i === currentStep) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    }
  }

  // 2. Desktop Stepper Tabs
  for (let i = 1; i <= totalSteps; i++) {
    const tab = document.getElementById(`stepTab${i}`);
    if (tab) {
      tab.classList.remove('active', 'completed');
      if (i === currentStep) {
        tab.classList.add('active');
      } else if (i < currentStep) {
        tab.classList.add('completed');
      }
    }
  }

  // 3. Progress Bar Fill
  const percent = Math.round((currentStep / totalSteps) * 100);
  const fill = document.getElementById('stepperProgressFill');
  if (fill) fill.style.width = `${percent}%`;

  // 4. Mobile Text
  const stepTitles = [
    'Profil & Sasaran',
    'Pelaksanaan & Peserta',
    'Biaya & Evaluasi',
    'Review & Konfirmasi'
  ];
  const mobileText = document.getElementById('mobileStepText');
  if (mobileText) {
    mobileText.textContent = `Langkah ${currentStep} dari 4: ${stepTitles[currentStep - 1]}`;
  }
  const mobilePercent = document.getElementById('mobileProgressPercent');
  if (mobilePercent) mobilePercent.textContent = `${percent}%`;

  // 5. Bottom Sticky Bar
  const bottomInfo = document.getElementById('bottomStepIndicator');
  if (bottomInfo) {
    bottomInfo.textContent = `Langkah ${currentStep} dari 4: ${stepTitles[currentStep - 1]}`;
  }

  const prevBtn = document.getElementById('prevStepBtn');
  if (prevBtn) prevBtn.disabled = currentStep === 1;

  const nextBtn = document.getElementById('nextStepBtn');
  const submitBtn = document.getElementById('submitBtn');

  if (currentStep === totalSteps) {
    if (nextBtn) nextBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'inline-flex';
  } else {
    if (nextBtn) nextBtn.style.display = 'inline-flex';
    if (submitBtn) submitBtn.style.display = 'none';
  }
}

function validateStep(step) {
  if (step === 1) {
    const idVal = (document.getElementById('trainingId')?.value || '').trim();
    const nameVal = (document.getElementById('trainingName')?.value || '').trim();
    const leaderVal = (document.getElementById('leaderName')?.value || '').trim();
    const deptVal = (document.getElementById('deptName')?.value || '').trim();

    if (!idVal || !nameVal || !leaderVal || !deptVal) {
      showToast('Lengkapi field wajib (ID Training, Nama Training, Leader, Departemen)', 'error');
      if (!nameVal) document.getElementById('trainingName')?.focus();
      else if (!leaderVal) document.getElementById('leaderName')?.focus();
      else if (!deptVal) document.getElementById('deptName')?.focus();
      return false;
    }
  }

  if (step === 2) {
    const participantRows = document.querySelectorAll('#participantBody tr');
    let hasInvalidEmail = false;
    participantRows.forEach(tr => {
      const name = (tr.querySelector('.participant-name') || tr.querySelectorAll('input')[0])?.value.trim();
      const emailInput = tr.querySelector('.participant-email') || tr.querySelectorAll('input')[1];
      const email = emailInput?.value.trim();
      if (name) {
        if (!email || !email.includes('@') || !email.includes('.')) {
          hasInvalidEmail = true;
          if (emailInput) emailInput.classList.add('error');
        } else {
          if (emailInput) emailInput.classList.remove('error');
        }
      }
    });

    if (hasInvalidEmail) {
      showToast('Mohon lengkapi alamat email valid untuk setiap peserta yang didaftarkan.', 'error');
      return false;
    }
  }
  return true;
}

// ==========================================
// Chip Selection (Level & Method)
// ==========================================
function selectChip(type, value, cardEl) {
  if (type === 'level') {
    document.querySelectorAll('#levelChipGrid .chip-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    const input = document.getElementById('levelKemahiran');
    if (input) input.value = value;
  } else if (type === 'method') {
    document.querySelectorAll('#methodChipGrid .chip-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    const input = document.getElementById('metode');
    if (input) input.value = value;

    // Toggle Online platform details
    const onlineRow = document.getElementById('onlineDetailsRow');
    if (onlineRow) {
      if (value === 'Online' || value === 'Hybrid') {
        onlineRow.style.display = 'grid';
      } else {
        onlineRow.style.display = 'none';
      }
    }
  } else if (type === 'jenis') {
    document.querySelectorAll('#jenisChipGrid .chip-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    const input = document.getElementById('jenisTraining');
    if (input) input.value = value;

    // Toggle Vendor details block
    const vendorBlock = document.getElementById('vendorDetailsBlock');
    if (vendorBlock) {
      if (value === 'Training Eksternal') {
        vendorBlock.style.display = 'block';
        const vendorBody = document.getElementById('vendorBody');
        if (vendorBody && vendorBody.children.length === 0) {
          addVendor();
          addVendor();
          addVendor();
        }
      } else {
        vendorBlock.style.display = 'none';
      }
    }
  } else if (type === 'lokasi') {
    document.querySelectorAll('#lokasiChipGrid .chip-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    const input = document.getElementById('lokasi');
    const customInput = document.getElementById('customLokasiInput');

    if (value === 'custom') {
      if (input) input.value = 'custom';
      if (customInput) {
        customInput.style.display = 'block';
        customInput.focus();
      }
    } else {
      if (input) input.value = value;
      if (customInput) {
        customInput.style.display = 'none';
        customInput.value = '';
      }
    }
  }
}

// ==========================================
// Automation Helpers: Auto-generated Training ID
// ==========================================
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
  'AI': 'AI',
  'BUSINESS ANALYST': 'BA',
  'IT INFRASTRUCTURE': 'ITI'
};

const CATEGORY_CODE_MAP = {
  'Soft skill': 'SS',
  'Hard skill': 'HS'
};

function updateTrainingId() {
  const tglInput = document.getElementById('tglPengajuan');
  const deptSelect = document.getElementById('deptName');
  const customDeptInput = document.getElementById('customDeptInput');
  const catSelect = document.getElementById('category');
  const trnIdInput = document.getElementById('trainingId');

  // 1. Komponen Tanggal: YYYYMMDD dari #tglPengajuan
  let datePart = '';
  if (tglInput && tglInput.value) {
    const rawDate = tglInput.value.trim().replace(/-/g, '');
    if (/^\d{8}$/.test(rawDate)) {
      datePart = rawDate;
    }
  }

  // 2. Komponen Departemen: dari DEPT_CODE_MAP atau #customDeptInput (3 huruf pertama uppercase)
  let deptCode = '';
  if (deptSelect && deptSelect.value) {
    const deptVal = deptSelect.value.trim();
    if (deptVal === 'custom') {
      const customVal = (customDeptInput ? customDeptInput.value : '').trim();
      const lettersOnly = customVal.replace(/[^a-zA-Z]/g, '');
      if (lettersOnly.length > 0) {
        deptCode = lettersOnly.substring(0, 3).toUpperCase();
      }
    } else if (DEPT_CODE_MAP[deptVal]) {
      deptCode = DEPT_CODE_MAP[deptVal];
    }
  }

  // 3. Komponen Kategori: dari CATEGORY_CODE_MAP ('Soft skill' -> 'SS', 'Hard skill' -> 'HS')
  let catCode = '';
  if (catSelect && catSelect.value) {
    const catVal = catSelect.value.trim();
    catCode = CATEGORY_CODE_MAP[catVal] || (catVal.toLowerCase() === 'hard skill' ? 'HS' : (catVal.toLowerCase() === 'soft skill' ? 'SS' : ''));
  }

  // 4. Validasi Kelengkapan: Semua komponen (tanggal, dept, kategori) harus valid
  if (datePart && deptCode && catCode) {
    const newId = `TRN-${datePart}-${deptCode}-${catCode}`;
    if (trnIdInput) {
      trnIdInput.value = newId;
      trnIdInput.placeholder = 'TRN-YYYYMMDD-DEPT-CATEGORY';
      trnIdInput.classList.remove('error');
    }
    return newId;
  } else {
    if (trnIdInput) {
      trnIdInput.value = '';
      trnIdInput.placeholder = 'Lengkapi Tanggal, Departemen & Kategori terlebih dahulu';
    }
    return '';
  }
}

function handleDeptChange(selectEl) {
  const customInput = document.getElementById('customDeptInput');
  if (selectEl.value === 'custom') {
    if (customInput) {
      customInput.style.display = 'block';
      customInput.focus();
    }
  } else {
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  }
  updateTrainingId();
}

function handleTopScheduleChange() {
  calculateScheduleAndDuration();
}

function syncModuleRowToSchedule(el) {
  calculateScheduleAndDuration();
}

function calculateMinutesBetween(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function formatMinutes(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '-';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours} jam ${mins} menit`;
  if (hours > 0) return `${hours} jam`;
  return `${mins} menit`;
}

function formatDateId(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRangeId(dateStr1, dateStr2) {
  if (!dateStr1) return '';
  if (!dateStr2 || dateStr1 === dateStr2) return formatDateId(dateStr1);

  const p1 = dateStr1.split('-').map(Number);
  const p2 = dateStr2.split('-').map(Number);
  const d1 = new Date(p1[0], p1[1] - 1, p1[2]);
  const d2 = new Date(p2[0], p2[1] - 1, p2[2]);

  const day1 = d1.getDate();
  const day2 = d2.getDate();
  const month1 = d1.toLocaleDateString('id-ID', { month: 'short' });
  const month2 = d2.toLocaleDateString('id-ID', { month: 'short' });
  const year1 = d1.getFullYear();
  const year2 = d2.getFullYear();

  if (year1 === year2) {
    if (month1 === month2) {
      return `${day1} – ${day2} ${month1} ${year1}`;
    }
    return `${day1} ${month1} – ${day2} ${month2} ${year1}`;
  }
  return `${day1} ${month1} ${year1} – ${day2} ${month2} ${year2}`;
}

function calculateScheduleAndDuration() {
  const moduleRows = document.querySelectorAll('#moduleBody tr');
  const tglDisplay = document.getElementById('tglPelaksanaan');
  const jamDisplay = document.getElementById('jamPelaksanaan');
  const jamHiddenMulai = document.getElementById('jamMulai');
  const jamHiddenSelesai = document.getElementById('jamSelesai');
  const lokasiDisplay = document.getElementById('lokasi');
  const totalDuration = document.getElementById('totalDuration');
  const jadwalHidden = document.getElementById('jadwal');

  let totalMinutes = 0;
  const dates = [];
  const startTimes = [];
  const endTimes = [];
  const locations = [];

  moduleRows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    // inputs[0]: Tanggal (type=date)
    // inputs[1]: Jam Mulai (type=time)
    // inputs[2]: Jam Selesai (type=time)
    // inputs[3]: Nama Modul (text)
    // inputs[4]: Durasi (text readonly)
    // inputs[5]: Fasilitator (text)
    // inputs[6]: Lokasi / Platform (text)
    // inputs[7]: Deskripsi Aktivitas (text)
    const tgl = inputs[0] ? inputs[0].value : '';
    const mulai = inputs[1] ? inputs[1].value : '';
    const selesai = inputs[2] ? inputs[2].value : '';
    const durInput = inputs[4];
    const loc = inputs[6] ? inputs[6].value.trim() : '';

    if (tgl) dates.push(tgl);
    if (mulai) startTimes.push(mulai);
    if (selesai) endTimes.push(selesai);
    if (loc) locations.push(loc);

    // Update kolom Durasi read-only di tiap baris
    const diff = calculateMinutesBetween(mulai, selesai);
    if (diff > 0) {
      const durStr = formatMinutes(diff);
      if (durInput) {
        durInput.value = durStr;
        durInput.setAttribute('value', durStr);
      }
      totalMinutes += diff;
    } else {
      if (durInput) {
        durInput.value = '-';
        durInput.setAttribute('value', '-');
      }
    }
  });

  // 1. Total Durasi Belajar
  const totalDurStr = totalMinutes > 0 ? formatMinutes(totalMinutes) : '-';
  if (totalDuration) {
    totalDuration.value = totalDurStr;
    totalDuration.setAttribute('value', totalDurStr);
  }

  // 2. Tanggal Pelaksanaan
  const uniqueDates = [...new Set(dates.filter(Boolean))].sort();
  let dateText = '';
  if (uniqueDates.length === 0) {
    dateText = '';
  } else if (uniqueDates.length === 1) {
    dateText = formatDateId(uniqueDates[0]);
  } else {
    dateText = formatDateRangeId(uniqueDates[0], uniqueDates[uniqueDates.length - 1]);
  }
  if (tglDisplay) {
    tglDisplay.value = dateText;
    tglDisplay.setAttribute('value', dateText);
  }

  // 3. Jam Mulai & Selesai
  let timeText = '';
  let earliest = '';
  let latest = '';
  if (startTimes.length > 0 && endTimes.length > 0) {
    const sortedStarts = [...startTimes].sort();
    const sortedEnds = [...endTimes].sort();
    earliest = sortedStarts[0];
    latest = sortedEnds[sortedEnds.length - 1];
    timeText = `${earliest} – ${latest}`;
  } else if (startTimes.length > 0) {
    earliest = [...startTimes].sort()[0];
    timeText = `${earliest} – -`;
  }
  if (jamDisplay) {
    jamDisplay.value = timeText || '-';
    jamDisplay.setAttribute('value', timeText || '-');
  }
  if (jamHiddenMulai && earliest) {
    jamHiddenMulai.value = earliest;
    jamHiddenMulai.setAttribute('value', earliest);
  }
  if (jamHiddenSelesai && latest) {
    jamHiddenSelesai.value = latest;
    jamHiddenSelesai.setAttribute('value', latest);
  }

  // 4. Lokasi / Ruangan (hanya jika tidak menggunakan chip grid lokasi)
  if (!document.getElementById('lokasiChipGrid')) {
    const distinctLocs = [...new Set(locations)];
    let locText = '';
    if (distinctLocs.length === 0) {
      locText = '';
    } else if (distinctLocs.length === 1) {
      locText = distinctLocs[0];
    } else {
      locText = `${distinctLocs.length} lokasi berbeda`;
    }
    if (lokasiDisplay) {
      lokasiDisplay.value = locText;
      lokasiDisplay.setAttribute('value', locText);
    }
  }

  // 5. Hidden Jadwal text for data-field="Tanggal & jam pelaksanaan"
  let scheduleText = '';
  if (moduleRows.length <= 1) {
    if (dateText && timeText) {
      scheduleText = `${dateText}, ${timeText} WIB`;
    } else if (dateText) {
      scheduleText = dateText;
    } else if (timeText) {
      scheduleText = `${timeText} WIB`;
    }
  } else {
    if (uniqueDates.length <= 1) {
      scheduleText = (dateText && timeText)
        ? `${dateText}, ${timeText} WIB (${moduleRows.length} Sesi)`
        : (dateText ? `${dateText} (${moduleRows.length} Sesi)` : `${timeText} WIB (${moduleRows.length} Sesi)`);
    } else {
      scheduleText = `${dateText} (${moduleRows.length} Sesi)`;
    }
  }
  if (jadwalHidden) {
    jadwalHidden.value = scheduleText;
  }
}

const DEPT_OPTIONS = [
  'HR',
  'GA',
  'LEGAL',
  'FINANCE',
  'ACCOUNTING',
  'TAX',
  'MARKETING',
  'SALES OPS',
  'SALES ENABLEMENT',
  'TELEMARKETING',
  'PEC',
  'CUSTOMER EXPERIENCE',
  'QA',
  'WEB DEVELOPER',
  'INTEGRATION',
  'MOBILE DEVELOPER',
  'UI/UX DESIGNER',
  'AI',
  'BUSINESS ANALYST',
  'IT INFRASTRUCTURE'
];

// ==========================================
// Dynamic Rows: Participants
// ==========================================
function addParticipant(name = '', email = '', dept = '') {
  // Backward compatibility jika dipanggil addParticipant(name, dept)
  if (email && !dept && !email.includes('@')) {
    dept = email;
    email = '';
  }

  participantCounter++;
  const tbody = document.getElementById('participantBody');
  const deptSelect = document.getElementById('deptName');
  let currentDept = '';
  if (deptSelect && deptSelect.value && deptSelect.value !== 'custom') {
    currentDept = deptSelect.value;
  }
  const targetDept = (dept || currentDept || '').trim();

  let optionsHtml = '<option value="">Pilih departemen</option>';
  let matched = false;
  DEPT_OPTIONS.forEach(d => {
    const isSelected = targetDept && targetDept.toUpperCase() === d.toUpperCase();
    if (isSelected) matched = true;
    optionsHtml += `<option value="${d}" ${isSelected ? 'selected' : ''}>${d}</option>`;
  });
  if (targetDept && !matched) {
    optionsHtml += `<option value="${targetDept}" selected>${targetDept}</option>`;
  }

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="color:var(--ink-faint);font-size:13px;width:36px;">${participantCounter}</td>
    <td style="min-width:180px;"><input type="text" class="participant-name" placeholder="Nama lengkap karyawan" value="${name}"></td>
    <td style="min-width:220px;"><input type="email" class="participant-email" placeholder="nama.karyawan@perusahaan.com" value="${email}"></td>
    <td style="width:200px;">
      <select class="participant-dept">
        ${optionsHtml}
      </select>
    </td>
    <td style="width:40px;"><button type="button" class="row-remove" onclick="removeRow(this)" title="Hapus baris">&times;</button></td>
  `;
  tbody.appendChild(tr);
  updateParticipantCount();
}

function setAttendance(btn, state) {
  const wrap = btn.parentElement;
  const isAlreadyActive = btn.classList.contains(state === 'present' ? 'active-present' : 'active-absent');
  wrap.querySelectorAll('button').forEach(b => b.classList.remove('active-present', 'active-absent'));
  if (!isAlreadyActive) {
    btn.classList.add(state === 'present' ? 'active-present' : 'active-absent');
  }
}

function updateParticipantCount() {
  const rows = document.getElementById('participantBody').querySelectorAll('tr').length;
  const countEl = document.getElementById('participantCount');
  if (countEl) {
    countEl.textContent = `${rows} peserta terdaftar`;
  }
  const plannedEl = document.getElementById('plannedParticipants');
  if (plannedEl) {
    plannedEl.value = rows;
  }
}

// Quick Import from Excel Textarea (Mendukung Nama, Email, Dept)
function importPesertaFromText() {
  const textarea = document.getElementById('excelPasteArea');
  if (!textarea || !textarea.value.trim()) {
    showToast('Teks daftar peserta masih kosong.', 'error');
    return;
  }

  const lines = textarea.value.split('\n');
  let addedCount = 0;
  const deptSelect = document.getElementById('deptName');
  const fallbackDept = (deptSelect && deptSelect.value !== 'custom') ? deptSelect.value : '';

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    let parts = [];
    if (cleanLine.includes('\t')) {
      parts = cleanLine.split('\t').map(p => p.trim());
    } else if (cleanLine.includes(' - ')) {
      parts = cleanLine.split(' - ').map(p => p.trim());
    } else if (cleanLine.includes(';')) {
      parts = cleanLine.split(';').map(p => p.trim());
    } else if (cleanLine.includes(',')) {
      parts = cleanLine.split(',').map(p => p.trim());
    } else {
      parts = [cleanLine];
    }

    let name = parts[0] || '';
    let email = '';
    let dept = fallbackDept;

    if (parts.length >= 3) {
      name = parts[0];
      // Cek apakah parts[1] atau parts[2] adalah email
      if (parts[1].includes('@')) {
        email = parts[1];
        dept = parts[2] || fallbackDept;
      } else if (parts[2].includes('@')) {
        dept = parts[1] || fallbackDept;
        email = parts[2];
      } else {
        email = parts[1];
        dept = parts[2];
      }
    } else if (parts.length === 2) {
      if (parts[1].includes('@')) {
        email = parts[1];
      } else {
        dept = parts[1];
      }
    }

    if (name) {
      addParticipant(name, email, dept);
      addedCount++;
    }
  });

  textarea.value = '';
  closeModal('modalQuickPasteExcel');
  showToast(`Berhasil menambahkan ${addedCount} peserta!`, 'success');
}

// ==========================================
// Dynamic Rows: Modules
// ==========================================
function addModule(tanggal = '', jamMulai = '', jamSelesai = '', mod = '', pic = '', method = '', lokasi = '', desc = '') {
  moduleCounter++;
  const tbody = document.getElementById('moduleBody');
  if (!tbody) return;

  const lastRow = document.querySelector('#moduleBody tr:last-child');
  let fallbackDate = new Date().toISOString().split('T')[0];
  if (lastRow) {
    const lastInputs = lastRow.querySelectorAll('input');
    if (lastInputs[0] && lastInputs[0].value) fallbackDate = lastInputs[0].value;
  }

  const defaultDate = tanggal || fallbackDate;
  const defaultStart = jamMulai || '09:00';
  const defaultEnd = jamSelesai || '15:00';
  const diff = calculateMinutesBetween(defaultStart, defaultEnd);
  const rowDur = diff > 0 ? formatMinutes(diff) : '-';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="color:var(--ink-faint);font-size:13px;width:36px;">${moduleCounter}</td>
    <td style="width:130px;"><input type="date" value="${defaultDate}" onchange="calculateScheduleAndDuration()"></td>
    <td style="width:105px;"><input type="time" value="${defaultStart}" onchange="calculateScheduleAndDuration()"></td>
    <td style="width:105px;"><input type="time" value="${defaultEnd}" onchange="calculateScheduleAndDuration()"></td>
    <td style="min-width:160px;"><input type="text" placeholder="Nama modul / topik" value="${mod}"></td>
    <td style="width:120px;"><input type="text" readonly style="background:#FAF9F5;font-weight:600;color:var(--ink);text-align:center;" value="${rowDur}" placeholder="-"></td>
    <td style="width:140px;"><input type="text" placeholder="Fasilitator / PIC" value="${pic}"></td>
    <td style="width:125px;">
      <select>
        <option value="">Pilih</option>
        <option ${method === 'Lecture' ? 'selected' : ''}>Lecture</option>
        <option ${method === 'Praktik' ? 'selected' : ''}>Praktik</option>
        <option ${method === 'Diskusi' ? 'selected' : ''}>Diskusi</option>
        <option ${method === 'Studi kasus' ? 'selected' : ''}>Studi kasus</option>
      </select>
    </td>
    <td style="width:160px;"><input type="text" placeholder="Sama seperti default" value="${lokasi}" oninput="calculateScheduleAndDuration()" onchange="calculateScheduleAndDuration()"></td>
    <td style="min-width:170px;"><input type="text" placeholder="Deskripsi ringkas aktivitas" value="${desc}"></td>
    <td style="width:40px;"><button type="button" class="row-remove" onclick="removeRow(this)" title="Hapus baris">&times;</button></td>
  `;
  tbody.appendChild(tr);
  calculateScheduleAndDuration();
}

// ==========================================
// Dynamic Rows: Vendors (Opsi Vendor Eksternal)
// ==========================================
function addVendor(nama = '', kontak = '', biaya = '', catatan = '') {
  vendorCounter++;
  const tbody = document.getElementById('vendorBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="color:var(--ink-faint);font-size:13px;width:36px;">${vendorCounter}</td>
    <td><input type="text" placeholder="Nama vendor / lembaga" value="${nama}"></td>
    <td style="width:180px;"><input type="text" placeholder="No. telp / email / PIC" value="${kontak}"></td>
    <td style="width:160px;"><input type="text" placeholder="Rp 0" value="${biaya}" oninput="formatRupiah(this)"></td>
    <td><input type="text" placeholder="Catatan / link penawaran" value="${catatan}"></td>
    <td style="width:40px;"><button type="button" class="row-remove" onclick="removeRow(this)" title="Hapus baris">&times;</button></td>
  `;
  tbody.appendChild(tr);
}

// ==========================================
// Dynamic Rows: Approval Workflow
// ==========================================
function addApproval(role = '', name = '', date = '') {
  const wrap = document.getElementById('approvalSteps');
  if (!wrap) return;
  approvalCounter++;
  const div = document.createElement('div');
  div.className = 'approval-step';
  div.innerHTML = `
    <div class="step-badge voice">${approvalCounter}</div>
    <div>
      <span class="field-label">Role / Otoritas</span>
      <input type="text" placeholder="cth. Line Manager" value="${role}">
    </div>
    <div>
      <span class="field-label">Nama Approver</span>
      <input type="text" placeholder="Nama lengkap" value="${name}">
    </div>
    <div>
      <span class="field-label">Tanggal Approval</span>
      <input type="date" value="${date}">
    </div>
    <button type="button" class="row-remove" style="margin-top:14px;" onclick="removeApproval(this)" title="Hapus level">&times;</button>
  `;
  wrap.appendChild(div);
}

function removeApproval(btn) {
  const step = btn.closest('.approval-step');
  step.remove();
  renumberApprovals();
}

function renumberApprovals() {
  const steps = document.querySelectorAll('#approvalSteps .approval-step');
  approvalCounter = steps.length;
  steps.forEach((step, i) => {
    const badge = step.querySelector('.step-badge');
    if (badge) badge.textContent = i + 1;
  });
}

function removeRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  tr.remove();
  renumber(tbody);
}

function renumber(tbody) {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const firstCol = row.querySelector('td');
    if (firstCol) firstCol.textContent = i + 1;
  });
  if (tbody.id === 'participantBody') {
    participantCounter = rows.length;
    updateParticipantCount();
  }
  if (tbody.id === 'moduleBody') {
    moduleCounter = rows.length;
    calculateScheduleAndDuration();
  }
  if (tbody.id === 'vendorBody') {
    vendorCounter = rows.length;
  }
}

// ==========================================
// Budget Calculation & Breakdown
// ==========================================
function formatRupiah(input) {
  let digits = input.value.replace(/\D/g, '');
  if (digits === '') {
    input.value = '';
    return;
  }
  digits = digits.replace(/^0+(?=\d)/, '');
  const formatted = 'Rp ' + new Intl.NumberFormat('id-ID').format(parseInt(digits, 10));
  input.value = formatted;
}

function rupiahToNumber(str) {
  const digits = (str || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function calcBudgetBreakdown() {
  const fee = rupiahToNumber(document.getElementById('budgetFee')?.value);
  const konsumsi = rupiahToNumber(document.getElementById('budgetKonsumsi')?.value);
  const materi = rupiahToNumber(document.getElementById('budgetMateri')?.value);
  const transport = rupiahToNumber(document.getElementById('budgetTransport')?.value);

  const total = fee + konsumsi + materi + transport;
  const estInput = document.getElementById('estBudget');
  if (estInput) {
    estInput.value = total > 0 ? 'Rp ' + new Intl.NumberFormat('id-ID').format(total) : '';
  }
}

// ==========================================
// Navigation & Admin Gate
// ==========================================
function handleHashNavigation() {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#admin' || hash === '#master' || hash === '#data') {
    requestAdminAccess();
  } else if (hash === '#approval' || hash === '#approver') {
    requestApprovalAccess();
  } else {
    switchView('form');
  }
}

function requestApprovalAccess() {
  const isApproved = sessionStorage.getItem('approval_auth_token') === 'true';
  if (isApproved) {
    window.location.href = 'approval/index.html';
  } else {
    openModal('modalApprovalPin');
    const pinInput = document.getElementById('approvalGatePinInput');
    const errEl = document.getElementById('approvalGatePinError');
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
    if (pinInput) {
      pinInput.value = '';
      pinInput.classList.remove('error');
      setTimeout(() => pinInput.focus(), 150);
    }
  }
}

function verifyAndOpenApproval() {
  const pinInput = document.getElementById('approvalGatePinInput');
  const errEl = document.getElementById('approvalGatePinError');
  const enteredPin = (pinInput?.value || '').trim();
  const storedPin = (localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN).trim();

  if (
    pinInput &&
    (enteredPin === storedPin ||
     enteredPin.toLowerCase() === storedPin.toLowerCase() ||
     enteredPin.toLowerCase() === DEFAULT_ADMIN_PIN.toLowerCase() ||
     enteredPin === DEFAULT_ADMIN_PIN)
  ) {
    sessionStorage.setItem('approval_auth_token', 'true');
    closeModal('modalApprovalPin');
    showToast('Akses Portal Approval berhasil diverifikasi.', 'success');
    setTimeout(() => {
      window.location.href = 'approval/index.html';
    }, 200);
  } else if (pinInput) {
    pinInput.classList.add('error');
    if (errEl) {
      errEl.textContent = 'PIN Approval salah. Silakan coba lagi.';
      errEl.style.display = 'block';
    }
    showToast('PIN Approval salah. Silakan coba lagi (Default: ubahpin123).', 'error');
    setTimeout(() => pinInput.classList.remove('error'), 1500);
  }
}

function cancelApprovalPin() {
  closeModal('modalApprovalPin');
  const errEl = document.getElementById('approvalGatePinError');
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#approval' || hash === '#approver') {
    history.replaceState(null, null, window.location.pathname + window.location.search);
  }
}

function requestAdminAccess() {
  const isUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';
  if (isUnlocked) {
    switchView('master');
  } else {
    openModal('modalAdminPin');
    const pinInput = document.getElementById('adminPinInput');
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 150);
    }
  }
}

function checkAdminPin() {
  const pinInput = document.getElementById('adminPinInput');
  const enteredPin = (pinInput?.value || '').trim();
  const storedPin = (localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN).trim();
  if (
    pinInput &&
    (enteredPin === storedPin ||
     enteredPin.toLowerCase() === storedPin.toLowerCase() ||
     enteredPin.toLowerCase() === DEFAULT_ADMIN_PIN.toLowerCase() ||
     enteredPin === DEFAULT_ADMIN_PIN)
  ) {
    sessionStorage.setItem('admin_unlocked', 'true');
    closeModal('modalAdminPin');
    showToast('Akses Master Data berhasil dibuka.', 'success');
    switchView('master');
  } else if (pinInput) {
    pinInput.classList.add('error');
    showToast('PIN Admin salah. Silakan coba lagi (Default: ubahpin123).', 'error');
    setTimeout(() => pinInput.classList.remove('error'), 1500);
  }
}

function cancelAdminPin() {
  closeModal('modalAdminPin');
  if (window.location.hash === '#admin' || window.location.hash === '#master' || window.location.hash === '#data') {
    history.replaceState(null, null, window.location.pathname + window.location.search);
  }
  switchView('form');
}

function lockAdminAccess() {
  sessionStorage.removeItem('admin_unlocked');
  switchView('form');
  showToast('Sesi Master Data telah dikunci.', 'info');
}

function switchView(view) {
  const formView = document.getElementById('formView');
  const masterView = document.getElementById('masterView');
  const stickyBar = document.getElementById('stickyBottomBar');

  if (view === 'form') {
    if (formView) formView.style.display = '';
    if (masterView) masterView.style.display = 'none';
    if (stickyBar) stickyBar.style.display = '';
    if (window.location.hash === '#admin' || window.location.hash === '#master' || window.location.hash === '#data') {
      history.replaceState(null, null, window.location.pathname + window.location.search);
    }
  } else {
    if (formView) formView.style.display = 'none';
    if (masterView) masterView.style.display = '';
    if (stickyBar) stickyBar.style.display = 'none';
    if (window.location.hash !== '#master') {
      window.location.hash = '#master';
    }
    switchAdminTab(adminCurrentTab || 'dashboard');
    loadMasterData();
  }
}

// ==========================================
// Executive Review Summary Populator (Step 4)
// ==========================================
function populateReviewSummary() {
  const data = collectFormData();
  const m = data.meta;

  const setRev = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  setRev('revId', m['ID training']);

  let jenisDisplay = m['Jenis training'] || 'Training Internal';
  if (jenisDisplay === 'Training Eksternal') {
    const vendorCount = (data.vendors || []).filter(v => v.nama).length;
    jenisDisplay = `${jenisDisplay} (${vendorCount} Opsi Vendor)`;
  }
  setRev('revJenis', jenisDisplay);
  setRev('revName', m['Nama training']);
  const leaderDisplay = (m['Nama pengaju'] || m['Leader pengaju'] || '-') + (m['Email pengaju'] ? ` <${m['Email pengaju']}>` : '');
  setRev('revLeader', leaderDisplay);
  setRev('revDept', m['Departemen / divisi']);
  setRev('revCategory', `${m['Kategori training'] || '-'} (${m['Target level kemahiran'] || 'All Level'})`);
  setRev('revNeed', m['Kategori kebutuhan training'] || '-');
  setRev('revSchedule', m['Tanggal & jam pelaksanaan']);

  let venueDisplay = m['Lokasi / venue'] || '-';
  if (m['Metode training'] === 'Online' || m['Metode training'] === 'Hybrid') {
    const platform = m['Platform online'] || 'Online';
    const link = m['Link meeting online'] ? ` (${m['Link meeting online']})` : '';
    venueDisplay = `${venueDisplay} [${platform}${link}]`;
  }
  setRev('revVenue', venueDisplay);
  setRev('revTrainer', m['Trainer']);

  const countPeserta = (data.participants || []).filter(p => p.nama).length;
  const countEmail = (data.participants || []).filter(p => p.email).length;
  setRev('revDurationParticipants', `${m['Total durasi belajar'] || '-'} • ${countPeserta} Peserta (${countEmail} Email terdaftar)`);
  setRev('revBudget', m['Budget diajukan'] || m['Estimasi biaya'] || 'Rp 0');
}

// ==========================================
// Form Data Collection & Validation
// ==========================================
function collectFormData() {
  calculateScheduleAndDuration();

  const meta = {};
  document.querySelectorAll('#formView [data-field]').forEach(el => {
    meta[el.dataset.field] = el.value || '';
  });

  // Handle custom department if selected
  if (meta['Departemen / divisi'] === 'custom') {
    const custom = document.getElementById('customDeptInput');
    meta['Departemen / divisi'] = custom && custom.value.trim() ? custom.value.trim() : 'Lainnya';
  }

  // Ensure schedule, duration, and participant counts are fresh
  meta['Tanggal & jam pelaksanaan'] = document.getElementById('jadwal')?.value || meta['Tanggal & jam pelaksanaan'] || '';
  meta['Tanggal pelaksanaan (raw)'] = document.getElementById('tglPelaksanaan')?.value || meta['Tanggal pelaksanaan (raw)'] || '';
  meta['Jam mulai (raw)'] = document.getElementById('jamMulai')?.value || meta['Jam mulai (raw)'] || '';
  meta['Jam selesai (raw)'] = document.getElementById('jamSelesai')?.value || meta['Jam selesai (raw)'] || '';
  meta['Total durasi belajar'] = document.getElementById('totalDuration')?.value || meta['Total durasi belajar'] || '';
  meta['Jumlah partisipan (rencana)'] = document.getElementById('plannedParticipants')?.value || meta['Jumlah partisipan (rencana)'] || '';
  meta['Lokasi / venue'] = document.getElementById('lokasi')?.value || meta['Lokasi / venue'] || '';

  // Handle custom location if selected
  if (meta['Lokasi / venue'] === 'custom') {
    const customLoc = document.getElementById('customLokasiInput');
    meta['Lokasi / venue'] = customLoc && customLoc.value.trim() ? customLoc.value.trim() : 'Lainnya';
  }

  // Aliases for compatibility
  meta['Nama pengaju'] = meta['Nama pengaju'] || meta['Leader pengaju'] || '';
  meta['Leader pengaju'] = meta['Nama pengaju'];

  meta['Hasil yang diharapkan'] = meta['Hasil yang diharapkan'] || meta['Expected outcomes'] || '';
  meta['Expected outcomes'] = meta['Hasil yang diharapkan'];

  meta['Penerapan di pekerjaan'] = meta['Penerapan di pekerjaan'] || meta['Aplikasi / implementasi'] || '';
  meta['Aplikasi / implementasi'] = meta['Penerapan di pekerjaan'];

  meta['Waktu evaluasi'] = meta['Waktu evaluasi'] || meta['Interval follow-up'] || '';
  meta['Interval follow-up'] = meta['Waktu evaluasi'];

  meta['PIC evaluasi'] = meta['PIC evaluasi'] || meta['PIC monitoring'] || '';
  meta['PIC monitoring'] = meta['PIC evaluasi'];

  const vendors = [];
  if (meta['Jenis training'] === 'Training Eksternal') {
    document.querySelectorAll('#vendorBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      vendors.push({
        nama: inputs[0] ? inputs[0].value.trim() : '',
        kontak: inputs[1] ? inputs[1].value.trim() : '',
        biaya: inputs[2] ? inputs[2].value.trim() : '',
        catatan: inputs[3] ? inputs[3].value.trim() : ''
      });
    });
  }

  const participants = [];
  document.querySelectorAll('#participantBody tr').forEach(tr => {
    const inputName = tr.querySelector('.participant-name') || tr.querySelectorAll('input')[0];
    const inputEmail = tr.querySelector('.participant-email') || tr.querySelectorAll('input')[1];
    const selectDept = tr.querySelector('.participant-dept') || tr.querySelector('select');
    participants.push({
      nama: inputName ? inputName.value.trim() : '',
      email: inputEmail ? inputEmail.value.trim().toLowerCase() : '',
      departemen: selectDept ? selectDept.value.trim() : ''
    });
  });

  const modules = [];
  document.querySelectorAll('#moduleBody tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    const selects = tr.querySelectorAll('select');
    modules.push({
      tanggal: inputs[0] ? inputs[0].value : '',
      jamMulai: inputs[1] ? inputs[1].value : '',
      jamSelesai: inputs[2] ? inputs[2].value : '',
      modul: inputs[3] ? inputs[3].value.trim() : '',
      durasi: inputs[4] ? inputs[4].value : '',
      pic: inputs[5] ? inputs[5].value.trim() : '',
      metode: selects[0] ? selects[0].value : '',
      lokasi: inputs[6] ? inputs[6].value.trim() : '',
      deskripsi: inputs[7] ? inputs[7].value.trim() : ''
    });
  });

  const approvals = [];
  document.querySelectorAll('#approvalSteps .approval-step').forEach(step => {
    const inputs = step.querySelectorAll('input');
    approvals.push({
      role: inputs[0] ? inputs[0].value.trim() : '',
      nama: inputs[1] ? inputs[1].value.trim() : '',
      tanggal: inputs[2] ? inputs[2].value : ''
    });
  });

  return {
    meta,
    vendors,
    participants,
    modules,
    approvals,
    status: 'Diajukan',
    statusClass: 'submitted'
  };
}

// ==========================================
// Submission Workflow (Modal & Sync)
// ==========================================
function submitPlan() {
  const data = collectFormData();
  const idValue = (data.meta['ID training'] || '').trim();
  const nameValue = (data.meta['Nama training'] || '').trim();
  const leader = (data.meta['Nama pengaju'] || data.meta['Leader pengaju'] || '').trim();
  const leaderEmail = (data.meta['Email pengaju'] || '').trim();
  const dept = (data.meta['Departemen / divisi'] || '').trim();

  if (!idValue || !nameValue || !leader || !leaderEmail || !dept) {
    showToast('Lengkapi field wajib (ID Training, Nama Training, Nama Pengaju, Email Pengaju, Departemen)', 'error');
    goToStep(1);
    return;
  }
  if (!leaderEmail.includes('@') || !leaderEmail.includes('.')) {
    showToast('Format Email Pengaju tidak valid (contoh: nama.pengaju@perusahaan.com)', 'error');
    goToStep(1);
    return;
  }

  pendingSubmitData = data;

  const countPeserta = (data.participants || []).filter(p => p.nama).length;
  const countEmail = (data.participants || []).filter(p => p.email).length;
  const summaryBox = document.getElementById('confirmSummaryBox');
  if (summaryBox) {
    let jenisSummary = data.meta['Jenis training'] || 'Training Internal';
    if (jenisSummary === 'Training Eksternal') {
      const vCount = (data.vendors || []).filter(v => v.nama).length;
      jenisSummary += ` (${vCount} opsi vendor)`;
    }
    summaryBox.innerHTML = `
      <div><strong>ID Training:</strong> ${data.meta['ID training']}</div>
      <div><strong>Nama Training:</strong> ${data.meta['Nama training'] || '-'}</div>
      <div><strong>Jenis Training:</strong> ${jenisSummary}</div>
      <div><strong>Nama Pengaju:</strong> ${data.meta['Nama pengaju'] || data.meta['Leader pengaju']} (${data.meta['Departemen / divisi']})</div>
      <div><strong>Kategori:</strong> ${data.meta['Kategori training']} / ${data.meta['Metode training']} [${data.meta['Target level kemahiran'] || 'General'}]</div>
      ${data.meta['Kategori kebutuhan training'] ? `<div><strong>Urgensi Kebutuhan:</strong> ${data.meta['Kategori kebutuhan training']}</div>` : ''}
      <div><strong>Jadwal:</strong> ${data.meta['Tanggal & jam pelaksanaan']}</div>
      <div><strong>Jumlah Peserta:</strong> ${countPeserta} orang terdaftar (${countEmail} memiliki email)</div>
      <div><strong>Budget Diajukan:</strong> ${data.meta['Budget diajukan'] || 'Rp 0'}</div>
    `;
  }

  openModal('modalConfirmSubmit');
}

async function confirmAndExecuteSubmit() {
  if (!pendingSubmitData) return;
  const data = pendingSubmitData;
  closeModal('modalConfirmSubmit');

  const btn = document.getElementById('submitBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Mengirim...`;

  const entry = {
    ...data,
    id: data.meta['ID training'],
    submittedAt: new Date().toISOString()
  };

  // 1. Simpan ke Local Master Data
  saveToLocalStorage(entry);

  // 2. Kirim ke Google Apps Script (Spreadsheet)
  const scriptUrl = GOOGLE_SCRIPT_URL.trim();
  let sheetSaved = false;

  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(entry)
      });
      sheetSaved = true;
    } catch (err) {
      console.warn('Sync ke Google Sheet tertunda/offline:', err);
      sheetSaved = false;
    }
  }

  btn.disabled = false;
  btn.innerHTML = originalHtml;

  // Tampilkan Success Modal
  populateSuccessModal(data, sheetSaved, scriptUrl);
  openModal('modalSuccessSubmit');
  showToast('Pengajuan training berhasil disimpan!', 'success');

  // Reset form langsung agar bersih kembali untuk pengajuan berikutnya
  resetForm();
}

// ==========================================
// Form Reset Helper
// ==========================================
function resetForm() {
  const formView = document.getElementById('formView');
  if (formView) {
    // 1. Clear text, email, number, url, and textarea inputs (preserve auto-calculated IDs)
    formView.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input[type="url"], textarea').forEach(input => {
      if (input.id !== 'trainingId' && input.id !== 'totalDuration' && input.id !== 'plannedParticipants') {
        input.value = '';
      }
      input.classList.remove('error');
    });

    // 2. Reset selects to first option
    formView.querySelectorAll('select').forEach(sel => {
      sel.selectedIndex = 0;
      sel.classList.remove('error');
    });
  }

  // 3. Reset custom dept input
  const customDept = document.getElementById('customDeptInput');
  if (customDept) {
    customDept.style.display = 'none';
    customDept.value = '';
  }

  // 4. Reset dates & times to default
  const today = new Date().toISOString().split('T')[0];
  const tglPengajuan = document.getElementById('tglPengajuan');
  if (tglPengajuan) tglPengajuan.value = today;
  const tglPelaksanaan = document.getElementById('tglPelaksanaan');
  if (tglPelaksanaan) tglPelaksanaan.value = '';
  const jamPelaksanaan = document.getElementById('jamPelaksanaan');
  if (jamPelaksanaan) jamPelaksanaan.value = '';
  // Reset Lokasi Chips & Custom Lokasi Input
  const lokasiChips = document.querySelectorAll('#lokasiChipGrid .chip-card');
  lokasiChips.forEach(c => c.classList.remove('selected'));
  const lokasi = document.getElementById('lokasi');
  if (lokasi) lokasi.value = '';
  const customLokasi = document.getElementById('customLokasiInput');
  if (customLokasi) {
    customLokasi.style.display = 'none';
    customLokasi.value = '';
  }

  // 5. Reset Level Chips (Beginner)
  const levelChips = document.querySelectorAll('#levelChipGrid .chip-card');
  levelChips.forEach((c, idx) => {
    if (idx === 0) c.classList.add('selected');
    else c.classList.remove('selected');
  });
  const levelKemahiran = document.getElementById('levelKemahiran');
  if (levelKemahiran) levelKemahiran.value = 'Beginner';

  // 6. Reset Jenis Training Chips (Training Internal)
  const jenisChips = document.querySelectorAll('#jenisChipGrid .chip-card');
  jenisChips.forEach((c, idx) => {
    if (idx === 1) c.classList.add('selected');
    else c.classList.remove('selected');
  });
  const jenisTraining = document.getElementById('jenisTraining');
  if (jenisTraining) jenisTraining.value = 'Training Internal';
  const vendorBlock = document.getElementById('vendorDetailsBlock');
  if (vendorBlock) vendorBlock.style.display = 'none';
  const vBody = document.getElementById('vendorBody');
  if (vBody) {
    vBody.innerHTML = '';
    vendorCounter = 0;
  }

  // 7. Reset Method Chips (Onsite)
  const methodChips = document.querySelectorAll('#methodChipGrid .chip-card');
  methodChips.forEach((c, idx) => {
    if (idx === 0) c.classList.add('selected');
    else c.classList.remove('selected');
  });
  const metode = document.getElementById('metode');
  if (metode) metode.value = 'Onsite';
  const onlineRow = document.getElementById('onlineDetailsRow');
  if (onlineRow) onlineRow.style.display = 'none';

  // 7. Reset standard dropdown defaults
  const category = document.getElementById('category');
  if (category) category.value = 'Soft Skill';
  const waktuEvaluasi = document.getElementById('waktuEvaluasi');
  if (waktuEvaluasi) waktuEvaluasi.value = 'Setelah training';
  const onlinePlatform = document.getElementById('onlinePlatform');
  if (onlinePlatform) onlinePlatform.value = 'Google Meet';

  // 8. Reset Tables to clean initial state
  const pBody = document.getElementById('participantBody');
  if (pBody) {
    pBody.innerHTML = '';
    participantCounter = 0;
    updateParticipantCount();
  }

  const mBody = document.getElementById('moduleBody');
  if (mBody) {
    mBody.innerHTML = '';
    moduleCounter = 0;
    addModule();
  }

  const appWrap = document.getElementById('approvalSteps');
  if (appWrap) {
    appWrap.innerHTML = '';
    approvalCounter = 0;
  }

  // 11. Update Training ID & recalculate schedule & duration
  updateTrainingId();
  calculateScheduleAndDuration();

  // 12. Reset Stepper to Step 1
  currentStep = 1;
  updateStepperUI();
  pendingSubmitData = null;

  // 13. Remove any remaining error classes
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  // 14. Scroll to top
  const fv = document.getElementById('formView');
  if (fv) {
    fv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function saveToLocalStorage(entry) {
  let list = [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) {
    list = [];
  }
  list.unshift(entry);
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
}

function populateSuccessModal(data, sheetSaved, scriptUrl) {
  const box = document.getElementById('successSummaryBox');
  if (!box) return;

  const m = data.meta;
  let sheetStatusNote = '';
  if (scriptUrl) {
    sheetStatusNote = sheetSaved
      ? `<div style="color:var(--moss);font-weight:600;margin-top:6px;">&#10003; Berhasil tersinkron ke Google Spreadsheet & Email konfirmasi otomatis terkirim</div>`
      : `<div style="color:var(--danger);font-weight:600;margin-top:6px;">&#9888; Pengiriman ke Google Sheet sedang diproses, data aman di riwayat lokal.</div>`;
  } else {
    sheetStatusNote = `<div style="color:var(--clay);margin-top:6px;"><small>Data tersimpan di riwayat lokal.</small></div>`;
  }

  box.innerHTML = `
    <div><strong>ID:</strong> ${m['ID training']}</div>
    <div><strong>Diajukan oleh:</strong> ${m['Nama pengaju'] || m['Leader pengaju']} (${m['Departemen / divisi']})</div>
    <div><strong>Status:</strong> ${data.status}</div>
    ${sheetStatusNote}
  `;
}

// ==========================================
// Email Draft Generator
// ==========================================
function buildMailBody(data) {
  const m = data.meta;
  const participantNames = (data.participants || []).filter(p => p.nama).map(p => p.nama).join(', ');
  const lines = [
    'Halo Rekan-rekan Peserta Training,',
    '',
    'Anda telah didaftarkan untuk mengikuti program pelatihan internal berikut:',
    '--------------------------------------------------',
    'Topik Pelatihan     : ' + (m['Nama training'] || '-'),
    'ID Training         : ' + (m['ID training'] || '-'),
    'Jadwal Pelaksanaan : ' + (m['Tanggal & jam pelaksanaan'] || '-'),
    'Metode Pelatihan    : ' + (m['Metode training'] || '-'),
    'Lokasi / Link Meet  : ' + (m['Lokasi / venue'] || '-'),
    'Trainer / Pemateri  : ' + (m['Trainer'] || '-'),
    '--------------------------------------------------',
    'Daftar Peserta      : ' + (participantNames || '-'),
    '',
    'Catatan Persiapan:',
    '• Mohon hadir 5-10 menit sebelum sesi dimulai.',
    '• Pastikan laptop dan koneksi internet dalam kondisi stabil jika daring.',
    '• Siapkan materi / prasyarat pelatihan yang telah diinformasikan.',
    '',
    'Salam hangat,',
    'Tim Training & People Development'
  ];
  return lines.join('\n');
}

function openMailDraft(data) {
  const m = data.meta;
  const subject = `[Undangan Pelatihan] ${m['Nama training'] || 'Training'} (${m['ID training'] || 'TRN'})`;
  const body = buildMailBody(data);
  
  // Ambil semua email peserta yang valid
  const participantEmails = (data.participants || [])
    .map(p => (p.email || '').trim())
    .filter(e => e.includes('@') && e.includes('.'));

  // Tujukan langsung ke email peserta, fallback ke training@cpssoft.com jika belum ada peserta ber-email
  const toList = participantEmails.length > 0 ? participantEmails.join(',') : 'training@cpssoft.com';
  
  // Gunakan Direct Gmail Web Compose URL (langsung membuka tab Gmail tanpa dialog 'mailto' OS)
  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toList)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  const modalMailLink = document.getElementById('modalSuccessEmailLink');
  if (modalMailLink) {
    modalMailLink.href = gmailWebUrl;
    modalMailLink.setAttribute('target', '_blank');
    modalMailLink.setAttribute('rel', 'noopener noreferrer');
    if (participantEmails.length > 0) {
      modalMailLink.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        Buka di Gmail Web (${participantEmails.length} Peserta)
      `;
    } else {
      modalMailLink.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        Buka di Gmail Web (Opsional)
      `;
    }
  }
}

// ==========================================
// Master Data & Training Dashboard Handling
// ==========================================
let adminCurrentTab = 'dashboard';
let calCurrentDate = new Date();
let calSelectedDateStr = null;
let cachedEntries = [];

const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function switchAdminTab(tab) {
  adminCurrentTab = tab;
  const dashBtn = document.getElementById('tabBtnDashboard');
  const listBtn = document.getElementById('tabBtnDataList');
  const dashPane = document.getElementById('adminTabDashboard');
  const listPane = document.getElementById('adminTabDataList');

  if (tab === 'dashboard') {
    if (dashBtn) dashBtn.classList.add('active');
    if (listBtn) listBtn.classList.remove('active');
    if (dashPane) dashPane.style.display = 'block';
    if (listPane) listPane.style.display = 'none';
  } else {
    if (dashBtn) dashBtn.classList.remove('active');
    if (listBtn) listBtn.classList.add('active');
    if (dashPane) dashPane.style.display = 'none';
    if (listPane) listPane.style.display = 'block';
  }
}

function extractDateYMD(str) {
  if (!str) return null;
  const matchYMD = String(str).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (matchYMD) return `${matchYMD[1]}-${matchYMD[2]}-${matchYMD[3]}`;
  const matchDMY = String(str).match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (matchDMY) {
    const day = matchDMY[1].padStart(2, '0');
    const month = matchDMY[2].padStart(2, '0');
    const year = matchDMY[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function formatDateIndo(dateStr, withDayName = false) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const options = withDayName
        ? { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
      return d.toLocaleDateString('id-ID', options);
    }
  } catch (e) {}
  return dateStr;
}

function getAllTrainingSessions(entries) {
  const sessions = [];
  if (!entries || !Array.isArray(entries)) return sessions;

  entries.forEach((entry, entryIndex) => {
    const m = entry.meta || {};
    let hasModuleDate = false;

    if (entry.modules && Array.isArray(entry.modules)) {
      entry.modules.forEach(mod => {
        const d = extractDateYMD(mod.tanggal);
        if (d) {
          hasModuleDate = true;
          sessions.push({
            date: d,
            id: m['ID training'] || 'TRN',
            trainingName: m['Nama training'] || '-',
            modulName: mod.modul || m['Nama training'] || 'Modul Pelatihan',
            time: (mod.jamMulai && mod.jamSelesai ? `${mod.jamMulai}–${mod.jamSelesai}` : (mod.durasi || '-')),
            lokasi: mod.lokasi || m['Lokasi / venue'] || '-',
            status: entry.status || 'Diajukan',
            statusClass: entry.statusClass || 'draft',
            entry: entry,
            entryIndex: entryIndex
          });
        }
      });
    }

    if (!hasModuleDate) {
      const fallbackDate = extractDateYMD(m['Tanggal & jam pelaksanaan']) ||
                           extractDateYMD(m['Tanggal pengajuan']) ||
                           extractDateYMD(entry.submittedAt);
      if (fallbackDate) {
        sessions.push({
          date: fallbackDate,
          id: m['ID training'] || 'TRN',
          trainingName: m['Nama training'] || '-',
          modulName: m['Nama training'] || 'Sesi Pelatihan',
          time: m['Total durasi belajar'] || '-',
          lokasi: m['Lokasi / venue'] || '-',
          status: entry.status || 'Diajukan',
          statusClass: entry.statusClass || 'draft',
          entry: entry,
          entryIndex: entryIndex
        });
      }
    }
  });

  return sessions;
}

function renderDashboardKPIs(entries) {
  const currentYear = new Date().getFullYear();

  // 1. Total Training (Tahun Berjalan)
  const thisYearEntries = (entries || []).filter(e => {
    if (e.submittedAt && new Date(e.submittedAt).getFullYear() === currentYear) return true;
    if (e.meta && e.meta['Tanggal pengajuan'] && e.meta['Tanggal pengajuan'].startsWith(String(currentYear))) return true;
    if (e.modules && e.modules.some(m => m.tanggal && m.tanggal.startsWith(String(currentYear)))) return true;
    if (e.meta && e.meta['Tanggal & jam pelaksanaan'] && e.meta['Tanggal & jam pelaksanaan'].includes(String(currentYear))) return true;
    return false;
  });

  const totalThisYearEl = document.getElementById('kpiTotalTraining');
  if (totalThisYearEl) totalThisYearEl.textContent = thisYearEntries.length;

  const totalSubEl = document.getElementById('kpiTotalTrainingSub');
  if (totalSubEl) {
    totalSubEl.textContent = `Tahun ${currentYear} (${(entries || []).length} total)`;
  }

  // 2. Status Breakdown: Pending / Approved / Rejected
  let pendingCount = 0, approvedCount = 0, rejectedCount = 0;
  (entries || []).forEach(e => {
    const s = (e.status || '').toLowerCase();
    const sc = (e.statusClass || '').toLowerCase();
    if (sc === 'approved' || s.includes('disetujui') || s.includes('approved')) {
      approvedCount++;
    } else if (sc === 'rejected' || s.includes('ditolak') || s.includes('rejected')) {
      rejectedCount++;
    } else {
      pendingCount++;
    }
  });

  const pendingEl = document.getElementById('kpiPendingCount');
  if (pendingEl) {
    pendingEl.innerHTML = `${pendingCount} <span style="font-size:13px;font-weight:500;color:var(--ink-soft);">Pending</span>`;
  }

  const statusSubEl = document.getElementById('kpiStatusBreakdown');
  if (statusSubEl) {
    statusSubEl.innerHTML = `
      <span class="mini-pill approved" style="padding:2px 7px;font-size:11px;"><span class="dot"></span>${approvedCount} Approved</span>
      <span class="mini-pill rejected" style="padding:2px 7px;font-size:11px;"><span class="dot"></span>${rejectedCount} Rejected</span>
    `;
  }

  // 3. Total Budget Diajukan
  let totalDiajukan = 0;
  (entries || []).forEach(e => {
    const m = e.meta || {};
    totalDiajukan += rupiahToNumber(m['Budget diajukan'] || m['Estimasi biaya'] || '0');
  });

  const budgetDiajukanEl = document.getElementById('kpiBudgetDiajukan');
  if (budgetDiajukanEl) {
    budgetDiajukanEl.textContent = 'Rp ' + new Intl.NumberFormat('id-ID').format(totalDiajukan);
  }

  const budgetRealisasiEl = document.getElementById('kpiBudgetRealisasi');
  if (budgetRealisasiEl) {
    budgetRealisasiEl.textContent = 'Akumulasi pengajuan';
  }

  // 4. Jenis Training
  let internalCount = 0, eksternalCount = 0, mandiriCount = 0;
  (entries || []).forEach(e => {
    const j = ((e.meta && e.meta['Jenis training']) || '').toLowerCase();
    if (j.includes('eksternal')) eksternalCount++;
    else if (j.includes('mandiri')) mandiriCount++;
    else internalCount++;
  });

  const jenisTotalEl = document.getElementById('kpiJenisTotal');
  if (jenisTotalEl) {
    jenisTotalEl.textContent = `${(entries || []).length} Program`;
  }

  const jenisSubEl = document.getElementById('kpiJenisBreakdown');
  if (jenisSubEl) {
    jenisSubEl.textContent = `${internalCount} Internal • ${eksternalCount} Eksternal • ${mandiriCount} Mandiri`;
  }
}

function prevCalMonth() {
  calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
  renderCalendar();
}

function nextCalMonth() {
  calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const titleEl = document.getElementById('calMonthTitle');
  if (!grid || !titleEl) return;

  const year = calCurrentDate.getFullYear();
  const month = calCurrentDate.getMonth();
  titleEl.textContent = `${INDO_MONTH_NAMES[month]} ${year}`;

  const allSessions = getAllTrainingSessions(cachedEntries);
  const sessionsByDate = {};
  allSessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  grid.innerHTML = '';

  // 1. Previous month padding cells
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    cell.textContent = dayNum;
    grid.appendChild(cell);
  }

  // 2. Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.dataset.date = dateStr;

    if (dateStr === todayStr) {
      cell.classList.add('today');
    }

    if (dateStr === calSelectedDateStr) {
      cell.classList.add('selected');
    }

    const daySessions = sessionsByDate[dateStr] || [];
    if (daySessions.length > 0) {
      cell.classList.add('has-training');
      const isPast = dateStr < todayStr;
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'cal-dots';

      const dotCount = Math.min(daySessions.length, 3);
      for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('span');
        dot.className = `cal-dot ${isPast ? 'past' : 'upcoming'}`;
        dotsWrap.appendChild(dot);
      }
      cell.innerHTML = `<span>${d}</span>`;
      cell.appendChild(dotsWrap);

      cell.title = `${daySessions.length} sesi training (${isPast ? 'Selesai' : 'Akan datang'})`;
    } else {
      cell.textContent = d;
    }

    cell.addEventListener('click', () => {
      selectCalDate(dateStr, daySessions);
    });

    grid.appendChild(cell);
  }

  // 3. Next month padding cells
  const totalCells = firstDayWeekday + daysInMonth;
  const rem = totalCells % 7;
  const nextPadding = rem === 0 ? 0 : 7 - rem;
  for (let n = 1; n <= nextPadding; n++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    cell.textContent = n;
    grid.appendChild(cell);
  }

  // If a date is currently selected in this month, update selected panel
  if (calSelectedDateStr) {
    selectCalDate(calSelectedDateStr, sessionsByDate[calSelectedDateStr] || [], false);
  }
}

function selectCalDate(dateStr, sessions, updateCalVisual = true) {
  calSelectedDateStr = dateStr;

  if (updateCalVisual) {
    document.querySelectorAll('#calGrid .cal-cell').forEach(c => {
      if (c.dataset.date === dateStr) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  }

  const titleEl = document.getElementById('selectedDateTitle');
  const badgeEl = document.getElementById('selectedDateBadge');
  const listEl = document.getElementById('selectedDateList');
  if (!titleEl || !badgeEl || !listEl) return;

  const formattedDate = formatDateIndo(dateStr, true);
  titleEl.textContent = `Sesi: ${formattedDate}`;

  const count = (sessions || []).length;
  badgeEl.textContent = `${count} Sesi`;

  if (count === 0) {
    listEl.innerHTML = `<div class="session-empty-state">Tidak ada jadwal training pada tanggal ini.</div>`;
    return;
  }

  listEl.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML = `
      <div class="session-item-head">
        <span class="session-item-id">${s.id}</span>
        <span class="mini-pill ${s.statusClass}"><span class="dot"></span>${s.status}</span>
      </div>
      <div class="session-item-modul">${s.modulName}</div>
      <div class="session-item-meta">
        <span>⏰ ${s.time}</span>
        <span>📍 ${s.lokasi}</span>
      </div>
    `;
    item.title = 'Klik untuk melihat detail lengkap submission';
    item.addEventListener('click', () => {
      showDetail(s.entry, s.entryIndex);
    });
    listEl.appendChild(item);
  });
}

function renderUpcomingSessions(entries) {
  const listEl = document.getElementById('upcomingList');
  const countBadge = document.getElementById('upcomingCountBadge');
  if (!listEl) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const allSessions = getAllTrainingSessions(entries);

  // Filter future or today sessions & sort nearest first
  const upcoming = allSessions
    .filter(s => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const top5 = upcoming.slice(0, 5);

  if (countBadge) {
    countBadge.textContent = `${upcoming.length} Agenda`;
  }

  if (top5.length === 0) {
    listEl.innerHTML = `<div class="session-empty-state">Belum ada agenda training mendatang.</div>`;
    return;
  }

  listEl.innerHTML = '';
  top5.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML = `
      <div class="session-item-head">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="upcoming-date-badge">${formatDateIndo(s.date)}</span>
          <span class="session-item-id">${s.id}</span>
        </div>
        <span class="mini-pill ${s.statusClass}"><span class="dot"></span>${s.status}</span>
      </div>
      <div class="session-item-modul">${s.modulName}</div>
      <div class="session-item-meta">
        <span>⏰ ${s.time}</span>
        <span>📍 ${s.lokasi}</span>
      </div>
    `;
    item.title = 'Klik untuk melihat detail lengkap submission';
    item.addEventListener('click', () => {
      showDetail(s.entry, s.entryIndex);
    });
    listEl.appendChild(item);
  });
}

function renderDashboard(entries) {
  renderDashboardKPIs(entries);
  renderCalendar();
  renderUpcomingSessions(entries);
}

function loadMasterData() {
  const tbody = document.getElementById('masterBody');
  const empty = document.getElementById('masterEmpty');
  const detailPanel = document.getElementById('detailPanel');
  if (detailPanel) detailPanel.innerHTML = '';

  let entries = [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch (e) {
    entries = [];
  }

  cachedEntries = entries;
  renderDashboard(entries);

  if (!entries || entries.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (tbody) tbody.innerHTML = '';

  entries.forEach((entry, idx) => {
    const m = entry.meta || {};
    const cls = entry.statusClass || 'draft';
    const date = entry.submittedAt
      ? new Date(entry.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m['ID training'] || '-'}</strong></td>
      <td>${m['Nama training'] || '-'}</td>
      <td>${m['Nama pengaju'] || m['Leader pengaju'] || '-'}</td>
      <td>${m['Departemen / divisi'] || '-'}</td>
      <td>${m['Kategori training'] || '-'} [${m['Target level kemahiran'] || 'General'}]</td>
      <td><span class="mini-pill ${cls}"><span class="dot"></span>${entry.status || 'Diajukan'}</span></td>
      <td>${(entry.participants || []).filter(p => p.nama).length} peserta</td>
      <td>${date}</td>
    `;
    tr.addEventListener('click', () => showDetail(entry, idx));
    tbody.appendChild(tr);
  });
}

function showDetail(entry, index) {
  const m = entry.meta || {};
  const panel = document.getElementById('detailPanel');
  if (!panel) return;

  const participantsList = (entry.participants || []).filter(p => p.nama)
    .map(p => `• <strong>${p.nama}</strong> ${p.email ? '(&lt;' + p.email + '&gt;)' : ''} &mdash; ${p.departemen || '-'}`)
    .join('<br>') || 'Belum ada peserta terdaftar.';

  const modulesList = (entry.modules || []).filter(mo => mo.modul)
    .map(mo => {
      const scheduleInfo = [mo.tanggal, (mo.jamMulai && mo.jamSelesai ? `${mo.jamMulai}–${mo.jamSelesai}` : '')].filter(Boolean).join(' ');
      const loc = mo.lokasi || m['Lokasi / venue'] || '';
      const locInfo = loc ? ` [${loc}]` : '';
      return `• <strong>${mo.modul}</strong> (${mo.durasi || '-'}${scheduleInfo ? ' • ' + scheduleInfo : ''}) &mdash; Fasilitator: ${mo.pic || '-'} [${mo.metode || '-'}]${locInfo}<br><small style="color:var(--ink-soft);padding-left:14px;display:inline-block;">${mo.deskripsi || ''}</small>`;
    })
    .join('<br>') || 'Belum ada modul.';

  const approvalsList = (entry.approvals || []).filter(ap => ap && ap.role)
    .map(ap => `• <strong>${ap.role}:</strong> ${ap.nama || '(Belum diisi)'} ${ap.tanggal ? '&mdash; ' + ap.tanggal : ''}`)
    .join('<br>');

  const vendorsList = (entry.vendors || []).filter(v => v.nama)
    .map(v => `• <strong>${v.nama}</strong> &mdash; Kontak: ${v.kontak || '-'} | Est. Biaya: ${v.biaya || '-'} ${v.catatan ? ' (' + v.catatan + ')' : ''}`)
    .join('<br>');

  panel.innerHTML = `
    <div class="detail-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 class="voice" style="margin:0;">${m['ID training'] || 'Detail Submission'}</h3>
        <button type="button" class="btn-secondary" style="color:var(--danger);border-color:#F5C6BE;" onclick="deleteSubmission(${index})">Hapus Catatan</button>
      </div>
      <div class="review-grid">
        <div class="review-item"><label>Jenis Training</label><div>${m['Jenis training'] || 'Training Internal'}</div></div>
        <div class="review-item"><label>Nama Training</label><div>${m['Nama training'] || '-'}</div></div>
        <div class="review-item"><label>Nama Pengaju</label><div>${m['Nama pengaju'] || m['Leader pengaju'] || '-'}</div></div>
        <div class="review-item"><label>Departemen / Divisi</label><div>${m['Departemen / divisi'] || '-'}</div></div>
        <div class="review-item"><label>Kategori & Level</label><div>${m['Kategori training'] || '-'} (${m['Target level kemahiran'] || 'General'})</div></div>
        <div class="review-item"><label>Kebutuhan (Urgensi)</label><div>${m['Kategori kebutuhan training'] || '-'}</div></div>
        <div class="review-item"><label>Metode Training</label><div>${m['Metode training'] || '-'}</div></div>
        <div class="review-item"><label>Jadwal Pelaksanaan</label><div>${m['Tanggal & jam pelaksanaan'] || '-'}</div></div>
        <div class="review-item"><label>Lokasi / Venue</label><div>${m['Lokasi / venue'] || '-'}</div></div>
        <div class="review-item"><label>Trainer</label><div>${m['Trainer'] || '-'}</div></div>
        <div class="review-item"><label>Budget Diajukan</label><div>${m['Budget diajukan'] || '-'}</div></div>
      </div>
      <div style="font-weight:600;margin:14px 0 6px;">Tujuan & Goals:</div>
      <div style="font-size:13px;line-height:1.6;margin-bottom:12px;">
        <div><strong>Purpose:</strong> ${m['Training plan purpose'] || '-'}</div>
        <div><strong>Goals:</strong> ${m['Training goals'] || '-'}</div>
        ${m['Link silabus materi'] ? `<div><strong>Link Silabus:</strong> <a href="${m['Link silabus materi']}" target="_blank">${m['Link silabus materi']}</a></div>` : ''}
      </div>
      <div style="font-weight:600;margin:14px 0 6px;">Evaluasi & Follow-up:</div>
      <div style="font-size:13px;line-height:1.6;margin-bottom:12px;">
        <div><strong>Hasil yang Diharapkan:</strong> ${m['Hasil yang diharapkan'] || m['Expected outcomes'] || '-'}</div>
        <div><strong>Penerapan di Pekerjaan:</strong> ${m['Penerapan di pekerjaan'] || m['Aplikasi / implementasi'] || '-'}</div>
        <div><strong>Indikator Keberhasilan:</strong> ${m['Indikator keberhasilan'] || '-'}</div>
        <div><strong>Waktu Evaluasi:</strong> ${m['Waktu evaluasi'] || m['Interval follow-up'] || '-'} | <strong>PIC:</strong> ${m['PIC evaluasi'] || m['PIC monitoring'] || '-'}</div>
      </div>
      ${vendorsList ? `<div style="font-weight:600;margin:14px 0 6px;">Opsi Vendor (Eksternal):</div><div style="font-size:13px;line-height:1.7;">${vendorsList}</div>` : ''}
      <div style="font-weight:600;margin:14px 0 6px;">Daftar Peserta:</div>
      <div style="font-size:13px;line-height:1.7;">${participantsList}</div>
      <div style="font-weight:600;margin:14px 0 6px;">Modul Training:</div>
      <div style="font-size:13px;line-height:1.7;">${modulesList}</div>
      ${approvalsList ? `<div style="font-weight:600;margin:14px 0 6px;">Alur Approval:</div><div style="font-size:13px;line-height:1.7;">${approvalsList}</div>` : ''}
    </div>
  `;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function deleteSubmission(index) {
  if (!confirm('Apakah Anda yakin ingin menghapus data submission ini dari riwayat lokal?')) return;
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      list.splice(index, 1);
      localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
      showToast('Data submission berhasil dihapus.', 'info');
      loadMasterData();
    }
  } catch (e) {
    showToast('Gagal menghapus data.', 'error');
  }
}

// ==========================================
// Modal Helpers
// ==========================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    const isPinModal = e.target.id === 'modalAdminPin';
    const isApprovalPinModal = e.target.id === 'modalApprovalPin';
    e.target.classList.remove('active');
    document.body.style.overflow = '';
    if (isPinModal) {
      cancelAdminPin();
    } else if (isApprovalPinModal) {
      cancelApprovalPin();
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const adminModal = document.getElementById('modalAdminPin');
    const wasPinActive = adminModal && adminModal.classList.contains('active');
    const approvalModal = document.getElementById('modalApprovalPin');
    const wasApprovalPinActive = approvalModal && approvalModal.classList.contains('active');
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
    if (wasPinActive) {
      cancelAdminPin();
    } else if (wasApprovalPinActive) {
      cancelApprovalPin();
    }
  }
});

// ==========================================
// Toast Notification System
// ==========================================
function showToast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  if (type === 'success') {
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  }

  toast.innerHTML = `<span style="display:flex;align-items:center;">${iconSvg}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ==========================================
// Export to CSV Feature
// ==========================================
function exportToCsv() {
  let entries = [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch (e) {
    entries = [];
  }

  if (entries.length === 0) {
    showToast('Belum ada data untuk diekspor.', 'error');
    return;
  }

  const headers = ['ID Training', 'Nama Training', 'Jenis Training', 'Nama Pengaju', 'Departemen', 'Kategori', 'Urgensi Kebutuhan', 'Level', 'Metode', 'Jadwal', 'Lokasi', 'Trainer', 'Jumlah Peserta', 'Budget Diajukan', 'Status', 'Tanggal Dikirim'];
  const rows = entries.map(entry => {
    const m = entry.meta || {};
    const countPeserta = (entry.participants || []).filter(p => p.nama).length;
    return [
      `"${(m['ID training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Nama training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Jenis training'] || 'Training Internal').replace(/"/g, '""')}"`,
      `"${(m['Nama pengaju'] || m['Leader pengaju'] || '').replace(/"/g, '""')}"`,
      `"${(m['Departemen / divisi'] || '').replace(/"/g, '""')}"`,
      `"${(m['Kategori training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Kategori kebutuhan training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Target level kemahiran'] || 'General').replace(/"/g, '""')}"`,
      `"${(m['Metode training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Tanggal & jam pelaksanaan'] || '').replace(/"/g, '""')}"`,
      `"${(m['Lokasi / venue'] || '').replace(/"/g, '""')}"`,
      `"${(m['Trainer'] || '').replace(/"/g, '""')}"`,
      countPeserta,
      `"${(m['Budget diajukan'] || '').replace(/"/g, '""')}"`,
      `"${(entry.status || '').replace(/"/g, '""')}"`,
      `"${entry.submittedAt || ''}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Training_Submissions_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('File CSV berhasil diunduh.', 'success');
}

// Expose fungsi ke window untuk kemudahan pemanggilan dari inline event
window.updateTrainingId = updateTrainingId;
window.requestApprovalAccess = requestApprovalAccess;
window.verifyAndOpenApproval = verifyAndOpenApproval;
window.cancelApprovalPin = cancelApprovalPin;
