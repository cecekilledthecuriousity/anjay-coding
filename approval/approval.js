/**
 * ==============================================================================
 * PORTAL APPROVAL TRAINING KARYAWAN (approval/approval.js)
 * ==============================================================================
 * Logika Frontend: Autentikasi PIN, Sinkronisasi Spreadsheet,
 * Kalkulasi KPI, Filter/Pencarian, Tinjauan Dokumen & Keputusan Approval.
 * Pure Vanilla JavaScript (ES6+).
 * ==============================================================================
 */

// 1. KONFIGURASI & KONSTANTA
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhJcIa9aOpfFLBQqFKuuPmNHMI7dqkKlYLtCRSZYrqquhUsegzW2DJ2p6cFOzIr9O_AQ/exec";
const SUBMISSIONS_STORAGE_KEY = 'training_submissions_master';
const ADMIN_PIN_KEY = 'training_admin_pin';
const DEFAULT_ADMIN_PIN = 'ubahpin123';
const AUTH_TOKEN_KEY = 'approval_auth_token';

// 2. STATE MANAGEMENT
let allSubmissions = [];
let currentFilter = 'all'; // 'all' | 'pending' | 'approved' | 'rejected'
let currentReviewItem = null;

// ==============================================================================
// 3. INISIALISASI APLIKASI
// ==============================================================================
function startApprovalApp() {
  initAuth();
  bindEventHandlers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApprovalApp);
} else {
  startApprovalApp();
}

/**
 * Memeriksa status autentikasi PIN pada sessionStorage.
 */
function initAuth() {
  const isAuthenticated = sessionStorage.getItem(AUTH_TOKEN_KEY) === 'true';
  if (isAuthenticated) {
    showDashboard();
  } else {
    showLoginGate();
  }
}

/**
 * Menghubungkan seluruh event handler DOM
 */
function bindEventHandlers() {
  // Login PIN submission
  const btnPinSubmit = document.getElementById('btnPinSubmit');
  const pinInput = document.getElementById('approvalPinInput');

  if (btnPinSubmit) {
    btnPinSubmit.addEventListener('click', validatePin);
  }

  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        validatePin();
      }
    });

    pinInput.addEventListener('input', () => {
      pinInput.classList.remove('error');
      const errEl = document.getElementById('pinErrorMsg');
      if (errEl) errEl.style.display = 'none';
    });
  }

  // Logout button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', logout);
  }

  // Refresh data button
  const btnRefresh = document.getElementById('btnRefreshData');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchSubmissions(true);
    });
  }

  // Filter tabs
  const tabButtons = document.querySelectorAll('.view-tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      applyFilterAndSearch();
    });
  });

  // Search input
  const searchInput = document.getElementById('approvalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilterAndSearch();
    });
  }

  // Modal decision buttons
  const btnApprove = document.getElementById('btnApproveAction');
  if (btnApprove) {
    btnApprove.addEventListener('click', () => executeApproval('Disetujui'));
  }

  const btnReject = document.getElementById('btnRejectAction');
  if (btnReject) {
    btnReject.addEventListener('click', () => executeApproval('Ditolak'));
  }

  // Modal dismiss helpers
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeReviewModal);
  }

  const modal = document.getElementById('modalReviewApproval');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeReviewModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeReviewModal();
    }
  });
}

// ==============================================================================
// 4. AUTENTIKASI PIN APPROVER
// ==============================================================================
function validatePin() {
  const pinInput = document.getElementById('approvalPinInput');
  const errEl = document.getElementById('pinErrorMsg');
  const enteredPin = (pinInput?.value || '').trim();
  const validPin = (localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN).trim();

  if (!enteredPin) {
    if (errEl) {
      errEl.textContent = 'Silakan masukkan Master PIN.';
      errEl.style.display = 'block';
    }
    if (pinInput) {
      pinInput.classList.add('error');
      pinInput.focus();
    }
    return;
  }

  if (
    enteredPin === validPin ||
    enteredPin.toLowerCase() === validPin.toLowerCase() ||
    enteredPin.toLowerCase() === DEFAULT_ADMIN_PIN.toLowerCase() ||
    enteredPin === DEFAULT_ADMIN_PIN
  ) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'true');
    showToast('Autentikasi berhasil. Selamat datang di Portal Approval.', 'success');
    showDashboard();
  } else {
    if (errEl) {
      errEl.textContent = 'Master PIN salah. Silakan coba lagi (Default: ubahpin123).';
      errEl.style.display = 'block';
    }
    if (pinInput) {
      pinInput.classList.add('error');
      pinInput.focus();
    }

    setTimeout(() => {
      if (errEl) errEl.style.display = 'none';
      if (pinInput) pinInput.classList.remove('error');
    }, 3000);
  }
}

function logout() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  showToast('Sesi approval telah dikunci.', 'info');
  showLoginGate();
}

function showDashboard() {
  const loginGate = document.getElementById('loginGate');
  const dashboardView = document.getElementById('dashboardView');

  if (loginGate) loginGate.style.display = 'none';
  if (dashboardView) dashboardView.style.display = 'block';

  fetchSubmissions();
}

function showLoginGate() {
  const loginGate = document.getElementById('loginGate');
  const dashboardView = document.getElementById('dashboardView');
  const pinInput = document.getElementById('approvalPinInput');
  const errEl = document.getElementById('pinErrorMsg');

  if (dashboardView) dashboardView.style.display = 'none';
  if (loginGate) loginGate.style.display = 'flex';

  if (pinInput) {
    pinInput.value = '';
    pinInput.classList.remove('error');
    setTimeout(() => pinInput.focus(), 80);
  }
  if (errEl) {
    errEl.style.display = 'none';
  }
}

// ==============================================================================
// 5. DATA NORMALIZATION & SINKRONISASI
// ==============================================================================

/**
 * Normalisasi objek data baik dari respon Google Sheets (doGet)
 * maupun format localStorage form submission.
 */
function normalizeSubmission(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  let parsedRawJson = null;
  if (raw['Raw Data JSON']) {
    try {
      parsedRawJson = JSON.parse(raw['Raw Data JSON']);
    } catch (e) {}
  }

  const meta = raw.meta || (parsedRawJson && parsedRawJson.meta) || {};
  const participants = raw.participants || (parsedRawJson && parsedRawJson.participants) || [];
  const modules = raw.modules || (parsedRawJson && parsedRawJson.modules) || [];
  const approvals = raw.approvals || (parsedRawJson && parsedRawJson.approvals) || [];

  const id = String(meta['ID training'] || raw['ID Training'] || raw.id || raw.ID || '-').trim();
  const namaTraining = String(meta['Nama training'] || raw['Nama Training'] || raw.namaTraining || '-').trim();
  const rawStatus = String(raw.status || raw['Status Dokumen'] || meta['Status Dokumen'] || 'Diajukan').trim();

  let status = 'Diajukan';
  let statusClass = 'submitted';

  if (isApproved(rawStatus)) {
    status = 'Disetujui';
    statusClass = 'approved';
  } else if (isRejected(rawStatus)) {
    status = 'Ditolak';
    statusClass = 'rejected';
  } else {
    status = 'Menunggu Approval';
    statusClass = 'submitted';
  }

  const pengaju = String(meta['Nama pengaju'] || meta['Leader pengaju'] || raw['Nama Pengaju'] || raw.pengaju || '-').trim();
  const departemen = String(meta['Departemen / divisi'] || raw['Departemen / Divisi'] || raw.departemen || '-').trim();
  const kategori = String(meta['Kategori training'] || raw['Kategori Training'] || raw.kategori || '-').trim();
  const level = String(meta['Target level kemahiran'] || raw['Target Level Kemahiran'] || raw.level || 'General').trim();
  const jadwal = String(meta['Tanggal & jam pelaksanaan'] || meta['Tanggal pengajuan'] || raw['Jadwal Pelaksanaan'] || raw['Tanggal Pengajuan'] || raw.jadwal || '-').trim();
  const venue = String(meta['Lokasi / venue'] || meta['Platform online'] || meta['Link meeting online'] || raw['Lokasi / Venue'] || raw['Platform & Link Meeting'] || raw.venue || '-').trim();
  const trainer = String(meta['Trainer'] || raw['Trainer / Fasilitator'] || raw.trainer || '-').trim();
  const durasi = String(meta['Total durasi belajar'] || raw['Total Durasi Belajar'] || raw.durasi || '-').trim();
  const budget = String(meta['Budget diajukan'] || meta['Estimasi biaya'] || raw['Budget Diajukan'] || raw['Estimasi Biaya'] || raw.budget || '-').trim();
  const submittedAt = raw.submittedAt || meta['Tanggal pengajuan'] || raw['Waktu Submit'] || raw['Tanggal Pengajuan'] || '-';
  const approver = String(raw.approver || meta['Approver'] || raw['Approver'] || '-').trim();
  const tanggalApproval = String(raw.tanggalApproval || meta['Tanggal Approval'] || raw['Tanggal Approval'] || '-').trim();
  const catatanApprover = String(raw.catatanApprover || meta['Catatan Approver'] || raw['Catatan Approver'] || '-').trim();

  return {
    id,
    namaTraining,
    status,
    statusClass,
    pengaju,
    departemen,
    kategori,
    level,
    jadwal,
    venue,
    trainer,
    durasi,
    budget,
    submittedAt,
    approver,
    tanggalApproval,
    catatanApprover,
    rawEntry: {
      ...raw,
      meta,
      participants,
      modules,
      approvals
    }
  };
}

/**
 * Mengambil data dari backend Google Apps Script dengan fallback ke localStorage.
 */
async function fetchSubmissions(forceRefresh = false) {
  const syncLabel = document.getElementById('syncTimeLabel');
  if (syncLabel) {
    syncLabel.textContent = 'Menghubungkan ke server...';
  }

  let remoteData = null;
  let fetchFailed = false;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'GET',
      cache: forceRefresh ? 'no-cache' : 'default'
    });

    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json)) {
        remoteData = json;
      } else {
        fetchFailed = true;
      }
    } else {
      fetchFailed = true;
    }
  } catch (err) {
    fetchFailed = true;
  }

  // Ambil data lokal untuk penggabungan atau fallback
  let localEntries = [];
  try {
    const rawLocal = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (rawLocal) {
      localEntries = JSON.parse(rawLocal);
    }
  } catch (e) {
    localEntries = [];
  }

  if (!fetchFailed && Array.isArray(remoteData)) {
    // Gabungkan data remote dengan data lokal yang belum tersinkron
    const remoteIds = new Set(remoteData.map(item => String(item['ID Training'] || (item.meta && item.meta['ID training']) || item.id || '').trim()));
    const localOnly = localEntries.filter(item => {
      const locId = String((item.meta && item.meta['ID training']) || item.id || '').trim();
      return locId && !remoteIds.has(locId);
    });

    const combined = [...remoteData, ...localOnly];
    allSubmissions = combined.map(normalizeSubmission).filter(Boolean);

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (syncLabel) {
      syncLabel.textContent = `Disinkronkan: ${hh}:${mm} WIB`;
    }
    if (forceRefresh) {
      showToast('Data berhasil disinkronkan dengan Google Spreadsheet.', 'success');
    }
  } else {
    // Fallback Offline
    allSubmissions = localEntries.map(normalizeSubmission).filter(Boolean);
    if (syncLabel) {
      syncLabel.textContent = 'Mode Offline (Data Lokal)';
    }
    if (forceRefresh) {
      showToast('Server tidak dapat dijangkau. Menampilkan data lokal offline.', 'info');
    }
  }

  renderKPIs();
  applyFilterAndSearch();
}

// ==============================================================================
// 6. KALKULASI & RENDERING KPI
// ==============================================================================
function renderKPIs() {
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiPending = document.getElementById('kpiPending');
  const kpiApproved = document.getElementById('kpiApproved');
  const kpiRejected = document.getElementById('kpiRejected');

  const total = allSubmissions.length;
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  allSubmissions.forEach(sub => {
    if (sub.statusClass === 'approved') {
      approved++;
    } else if (sub.statusClass === 'rejected') {
      rejected++;
    } else {
      pending++;
    }
  });

  if (kpiTotal) kpiTotal.textContent = total;
  if (kpiPending) kpiPending.textContent = pending;
  if (kpiApproved) kpiApproved.textContent = approved;
  if (kpiRejected) kpiRejected.textContent = rejected;
}

// ==============================================================================
// 7. FILTER, PENCARIAN & RENDERING TABEL
// ==============================================================================
function applyFilterAndSearch() {
  const searchInput = document.getElementById('approvalSearchInput');
  const query = (searchInput?.value || '').toLowerCase().trim();

  const filtered = allSubmissions.filter(item => {
    // Filter status tab
    if (currentFilter === 'pending' && item.statusClass !== 'submitted') return false;
    if (currentFilter === 'approved' && item.statusClass !== 'approved') return false;
    if (currentFilter === 'rejected' && item.statusClass !== 'rejected') return false;

    // Filter query pencarian
    if (query) {
      const matchId = (item.id || '').toLowerCase().includes(query);
      const matchName = (item.namaTraining || '').toLowerCase().includes(query);
      const matchPengaju = (item.pengaju || '').toLowerCase().includes(query);
      const matchDept = (item.departemen || '').toLowerCase().includes(query);
      return matchId || matchName || matchPengaju || matchDept;
    }

    return true;
  });

  renderTable(filtered);
}

function renderTable(items) {
  const tbody = document.getElementById('approvalTableBody');
  const emptyState = document.getElementById('approvalEmptyState');
  const table = document.getElementById('approvalTable');

  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (table) table.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';

  tbody.innerHTML = items.map(item => `
    <tr onclick="handleRowClick(event, '${escapeHtml(item.id)}')">
      <td><strong>${escapeHtml(item.id)}</strong></td>
      <td style="font-size:12.5px;color:var(--ink-soft);white-space:nowrap;">${formatDateIndo(item.submittedAt)}</td>
      <td>
        <div style="font-weight:600;color:var(--ink);">${escapeHtml(item.namaTraining)}</div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(item.kategori)} &bull; <span style="color:var(--ink-faint);">${escapeHtml(item.level)}</span></div>
      </td>
      <td>
        <div style="font-weight:500;">${escapeHtml(item.pengaju)}</div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(item.departemen)}</div>
      </td>
      <td>
        <div style="font-size:12.5px;">${escapeHtml(item.jadwal)}</div>
      </td>
      <td>
        <div style="font-weight:600;color:var(--ink);">${escapeHtml(item.budget)}</div>
      </td>
      <td>
        <span class="mini-pill ${item.statusClass}"><span class="dot"></span>${escapeHtml(item.status)}</span>
      </td>
      <td style="text-align:center;">
        <button type="button" class="btn-secondary" style="padding:6px 14px;font-size:12.5px;white-space:nowrap;" onclick="openReviewModal('${escapeHtml(item.id)}')">
          Tinjau Dokumen
        </button>
      </td>
    </tr>
  `).join('');
}

function handleRowClick(event, id) {
  if (event.target.closest('button') || event.target.closest('a')) {
    return;
  }
  openReviewModal(id);
}

// ==============================================================================
// 8. MODAL TINJAUAN DOKUMEN & APPROVAL DECISION
// ==============================================================================
function openReviewModal(id) {
  const item = allSubmissions.find(s => s.id === id);
  if (!item) return;

  currentReviewItem = item;

  // Header Modal
  const modalIdEl = document.getElementById('modalTrainingId');
  const modalPillEl = document.getElementById('modalStatusPill');

  if (modalIdEl) modalIdEl.textContent = item.id;
  if (modalPillEl) {
    modalPillEl.className = `mini-pill ${item.statusClass}`;
    modalPillEl.innerHTML = `<span class="dot"></span>${escapeHtml(item.status)}`;
  }

  // Isi rincian dokumen
  renderModalDetails(item);

  // Form input approver
  const nameInput = document.getElementById('approverNameInput');
  const notesInput = document.getElementById('approverNotesInput');

  if (nameInput) {
    nameInput.value = localStorage.getItem('last_approver_name') || '';
    nameInput.classList.remove('error');
  }
  if (notesInput) {
    notesInput.value = '';
    notesInput.classList.remove('error');
  }

  // Tampilkan modal
  const modal = document.getElementById('modalReviewApproval');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeReviewModal() {
  const modal = document.getElementById('modalReviewApproval');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function renderModalDetails(item) {
  const container = document.getElementById('modalDetailsContent');
  if (!container) return;

  const raw = item.rawEntry || {};
  const meta = raw.meta || {};
  const participants = Array.isArray(raw.participants) ? raw.participants : [];
  const modules = Array.isArray(raw.modules) ? raw.modules : [];

  // 1. Link Silabus
  const silabusUrl = meta['Link silabus materi'] || raw['Link Silabus / Materi'] || '';
  let silabusLinkHtml = '-';
  if (silabusUrl && silabusUrl.startsWith('http')) {
    silabusLinkHtml = `<a href="${escapeHtml(silabusUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:600;text-decoration:underline;display:inline-flex;align-items:center;gap:4px;">Buka Silabus di Google Drive &rarr;</a>`;
  } else if (silabusUrl && silabusUrl !== '-') {
    silabusLinkHtml = escapeHtml(silabusUrl);
  }

  // 2. Link Venue / Meeting
  const venueStr = item.venue;
  let venueHtml = escapeHtml(venueStr);
  if (venueStr && venueStr.includes('http')) {
    const match = venueStr.match(/(https?:\/\/[^\s]+)/);
    if (match) {
      const url = match[1];
      venueHtml = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:600;text-decoration:underline;">${escapeHtml(venueStr)}</a>`;
    }
  }

  // 3. Rincian Biaya
  const feeTrainer = meta['Fee trainer'] || '-';
  const konsumsi = meta['Konsumsi & catering'] || '-';
  const materi = meta['Materi & sertifikat'] || '-';
  const transportCost = meta['Transportasi'] || '-';
  const rincianBiayaText = raw['Rincian Biaya (Fee/Konsumsi/Materi/Venue)'];

  // 4. Daftar Peserta
  let participantsHtml = '';
  if (participants.length > 0) {
    participantsHtml = `
      <div class="tbl-wrap" style="margin-top:6px;margin-bottom:16px;">
        <table class="master" style="font-size:12.5px;">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>Nama Peserta</th>
              <th>Email</th>
              <th>Departemen</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((p, idx) => `
              <tr>
                <td style="color:var(--ink-faint);">${idx + 1}</td>
                <td><strong>${escapeHtml(p.nama || '-')}</strong></td>
                <td>${p.email ? `<a href="mailto:${escapeHtml(p.email)}" style="color:var(--accent);text-decoration:underline;">${escapeHtml(p.email)}</a>` : '-'}</td>
                <td>${escapeHtml(p.departemen || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (raw['Daftar Peserta (Ringkasan)']) {
    participantsHtml = `<div style="font-size:13px;line-height:1.6;white-space:pre-line;background:rgba(255,255,255,0.65);padding:10px 14px;border-radius:var(--radius);border:1px solid var(--line);margin-bottom:16px;">${escapeHtml(raw['Daftar Peserta (Ringkasan)'])}</div>`;
  } else {
    participantsHtml = `<div class="helper-note" style="margin-bottom:16px;">Belum ada peserta terdaftar.</div>`;
  }

  // 5. Modul & Sesi Pelatihan
  let modulesHtml = '';
  if (modules.length > 0) {
    modulesHtml = `
      <div class="tbl-wrap" style="margin-top:6px;margin-bottom:16px;">
        <table class="master" style="font-size:12.5px;">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>Modul / Topik</th>
              <th>Jadwal &amp; Durasi</th>
              <th>PIC / Trainer</th>
              <th>Metode &amp; Lokasi</th>
            </tr>
          </thead>
          <tbody>
            ${modules.map((m, idx) => {
              const timeStr = [m.tanggal, (m.jamMulai && m.jamSelesai ? `${m.jamMulai} - ${m.jamSelesai}` : '')].filter(Boolean).join(', ');
              return `
                <tr>
                  <td style="color:var(--ink-faint);">${idx + 1}</td>
                  <td>
                    <strong>${escapeHtml(m.modul || '-')}</strong>
                    ${m.deskripsi ? `<div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(m.deskripsi)}</div>` : ''}
                  </td>
                  <td>
                    <div>${escapeHtml(timeStr || '-')}</div>
                    <div style="font-size:11.5px;color:var(--ink-soft);">${escapeHtml(m.durasi || '-')}</div>
                  </td>
                  <td>${escapeHtml(m.pic || '-')}</td>
                  <td>${escapeHtml(m.metode || '-')} ${m.lokasi ? `(${escapeHtml(m.lokasi)})` : ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (raw['Modul & Sesi (Ringkasan)']) {
    modulesHtml = `<div style="font-size:13px;line-height:1.6;white-space:pre-line;background:rgba(255,255,255,0.65);padding:10px 14px;border-radius:var(--radius);border:1px solid var(--line);margin-bottom:16px;">${escapeHtml(raw['Modul & Sesi (Ringkasan)'])}</div>`;
  } else {
    modulesHtml = `<div class="helper-note" style="margin-bottom:16px;">Belum ada modul sesi pelatihan.</div>`;
  }

  // 6. Riwayat Approval Sebelumnya
  let approvalHistoryHtml = '';
  if (item.approver && item.approver !== '-') {
    approvalHistoryHtml = `
      <div style="background:rgba(76, 63, 224, 0.05);border:1px solid rgba(76, 63, 224, 0.2);border-radius:var(--radius);padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <strong style="font-size:13.5px;color:var(--ink);">Riwayat Keputusan Approver Sebelumnya:</strong>
          <span class="mini-pill ${item.statusClass}"><span class="dot"></span>${escapeHtml(item.status)}</span>
        </div>
        <div style="font-size:13px;line-height:1.6;color:var(--ink-soft);">
          <div><strong>Reviewer:</strong> ${escapeHtml(item.approver)}</div>
          <div><strong>Waktu:</strong> ${escapeHtml(item.tanggalApproval)}</div>
          ${item.catatanApprover && item.catatanApprover !== '-' ? `<div style="margin-top:4px;"><strong>Catatan:</strong> ${escapeHtml(item.catatanApprover)}</div>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${approvalHistoryHtml}

    <!-- Informasi Program Training -->
    <div class="detail-grid">
      <div class="detail-item">
        <span class="lbl">ID Training</span>
        <span class="val" style="font-weight:700;color:var(--accent);">${escapeHtml(item.id)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Tanggal Pengajuan</span>
        <span class="val">${formatDateIndo(item.submittedAt)}</span>
      </div>
      <div class="detail-item detail-full">
        <span class="lbl">Nama Training</span>
        <span class="val" style="font-size:15px;font-weight:600;color:var(--ink);">${escapeHtml(item.namaTraining)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Nama Pengaju</span>
        <span class="val">${escapeHtml(item.pengaju)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Departemen / Divisi</span>
        <span class="val">${escapeHtml(item.departemen)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Kategori &amp; Level</span>
        <span class="val">${escapeHtml(item.kategori)} &bull; ${escapeHtml(item.level)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Kebutuhan / Urgensi</span>
        <span class="val">${escapeHtml(meta['Kategori kebutuhan training'] || raw['Kategori Kebutuhan Training'] || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Metode Training</span>
        <span class="val">${escapeHtml(meta['Metode training'] || raw['Metode Training'] || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Trainer / Fasilitator</span>
        <span class="val">${escapeHtml(item.trainer)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Jadwal Pelaksanaan</span>
        <span class="val">${escapeHtml(item.jadwal)}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Total Durasi</span>
        <span class="val">${escapeHtml(item.durasi)}</span>
      </div>
      <div class="detail-item detail-full">
        <span class="lbl">Lokasi / Platform Meeting</span>
        <span class="val">${venueHtml}</span>
      </div>
    </div>

    <!-- Tujuan, Sasaran & Silabus -->
    <div style="background:rgba(255,255,255,0.55);border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px;margin-bottom:18px;">
      <div style="font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:10px;">Sasaran &amp; Tujuan Pelatihan</div>
      <div style="font-size:13px;line-height:1.6;color:var(--ink);">
        <div style="margin-bottom:6px;"><strong>Latar Belakang / Purpose:</strong> ${escapeHtml(meta['Training plan purpose'] || raw['Tujuan & Purpose'] || '-')}</div>
        <div style="margin-bottom:6px;"><strong>Target Output / Goals:</strong> ${escapeHtml(meta['Training goals'] || raw['Goals (Target)'] || '-')}</div>
        <div style="margin-bottom:6px;"><strong>Prasyarat &amp; Sertifikasi:</strong> ${escapeHtml(meta['Prasyarat peserta'] || raw['Prasyarat & Output'] || '-')}</div>
        <div><strong>Link Silabus / Materi:</strong> ${silabusLinkHtml}</div>
      </div>
    </div>

    <!-- Rincian Biaya -->
    <div style="background:rgba(255,255,255,0.55);border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <span style="font-weight:700;font-size:13.5px;color:var(--ink);">Rincian Anggaran &amp; Budget</span>
        <span style="font-weight:700;font-size:14px;color:var(--accent);">Budget Diajukan: ${escapeHtml(item.budget)}</span>
      </div>
      ${meta['Fee trainer'] ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;font-size:12.5px;">
          <div style="background:rgba(0,0,0,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--line-soft);">Fee Trainer: <strong>${escapeHtml(feeTrainer)}</strong></div>
          <div style="background:rgba(0,0,0,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--line-soft);">Konsumsi: <strong>${escapeHtml(konsumsi)}</strong></div>
          <div style="background:rgba(0,0,0,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--line-soft);">Materi &amp; Sertifikat: <strong>${escapeHtml(materi)}</strong></div>
          <div style="background:rgba(0,0,0,0.02);padding:8px 12px;border-radius:6px;border:1px solid var(--line-soft);">Transportasi: <strong>${escapeHtml(transportCost)}</strong></div>
        </div>
      ` : `
        <div style="font-size:13px;color:var(--ink-soft);">${escapeHtml(rincianBiayaText || 'Tidak ada perincian biaya tambahan')}</div>
      `}
    </div>

    <!-- Daftar Peserta -->
    <div style="font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:6px;">Daftar Peserta Terdaftar (${participants.length || raw['Jumlah Peserta Terdaftar'] || 0} orang):</div>
    ${participantsHtml}

    <!-- Modul & Sesi -->
    <div style="font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:6px;">Rangkaian Modul Pelatihan:</div>
    ${modulesHtml}
  `;
}

// ==============================================================================
// 9. EKSEKUSI APPROVAL DECISION
// ==============================================================================
async function executeApproval(decision) {
  if (!currentReviewItem) {
    showToast('Tidak ada dokumen training yang aktif ditinjau.', 'error');
    return;
  }

  const nameInput = document.getElementById('approverNameInput');
  const notesInput = document.getElementById('approverNotesInput');

  const approverName = (nameInput?.value || '').trim();
  const notes = (notesInput?.value || '').trim();

  // Validasi Approver Name
  if (!approverName) {
    showToast('Nama Approver / Reviewer wajib diisi.', 'error');
    if (nameInput) {
      nameInput.classList.add('error');
      nameInput.focus();
    }
    return;
  }

  // Validasi Catatan jika Ditolak
  if (decision === 'Ditolak' && !notes) {
    showToast('Catatan / alasan penolakan wajib diisi jika menolak pengajuan.', 'error');
    if (notesInput) {
      notesInput.classList.add('error');
      notesInput.focus();
    }
    return;
  }

  const btnApprove = document.getElementById('btnApproveAction');
  const btnReject = document.getElementById('btnRejectAction');

  const originalApproveHtml = btnApprove?.innerHTML || '';
  const originalRejectHtml = btnReject?.innerHTML || '';

  if (btnApprove) btnApprove.disabled = true;
  if (btnReject) btnReject.disabled = true;

  if (decision === 'Disetujui' && btnApprove) {
    btnApprove.innerHTML = `<span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;"></span> Memproses...`;
  } else if (decision === 'Ditolak' && btnReject) {
    btnReject.innerHTML = `<span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;"></span> Memproses...`;
  }

  const payload = {
    action: "update_approval",
    id: currentReviewItem.id,
    status: decision,
    approverName: approverName,
    notes: notes || '-'
  };

  // 1. Dispatch ke Google Apps Script
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Sync update_approval ke Apps Script tertunda/offline:', err);
  }

  // 2. Update Model In-Memory
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  currentReviewItem.status = decision;
  currentReviewItem.statusClass = decision === 'Disetujui' ? 'approved' : 'rejected';
  currentReviewItem.approver = approverName;
  currentReviewItem.tanggalApproval = timeStr;
  currentReviewItem.catatanApprover = notes || '-';

  // 3. Update Riwayat Lokal jika ada
  try {
    const rawLocal = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (rawLocal) {
      const list = JSON.parse(rawLocal);
      let updated = false;

      for (let i = 0; i < list.length; i++) {
        const entryId = String((list[i].meta && list[i].meta['ID training']) || list[i].id || '').trim();
        if (entryId === String(currentReviewItem.id).trim()) {
          list[i].status = decision;
          list[i].statusClass = decision === 'Disetujui' ? 'approved' : 'rejected';
          list[i].approver = approverName;
          list[i].tanggalApproval = timeStr;
          list[i].catatanApprover = notes || '-';
          if (!list[i].meta) list[i].meta = {};
          list[i].meta['Status Dokumen'] = decision;
          list[i].meta['Approver'] = approverName;
          list[i].meta['Tanggal Approval'] = timeStr;
          list[i].meta['Catatan Approver'] = notes || '-';
          updated = true;
          break;
        }
      }

      if (updated) {
        localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {
    console.error('Error saat memperbarui riwayat lokal:', e);
  }

  // 4. Simpan Nama Approver Terakhir
  localStorage.setItem('last_approver_name', approverName);

  // 5. Feedback Sukses & UI Refresh
  showToast(`Pengajuan ${currentReviewItem.id} berhasil ${decision.toLowerCase()}.`, 'success');
  closeReviewModal();
  renderKPIs();
  applyFilterAndSearch();

  // Reset Tombol
  if (btnApprove) {
    btnApprove.disabled = false;
    btnApprove.innerHTML = originalApproveHtml;
  }
  if (btnReject) {
    btnReject.disabled = false;
    btnReject.innerHTML = originalRejectHtml;
  }
}

// ==============================================================================
// 10. TOAST NOTIFICATION SYSTEM
// ==============================================================================
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

  toast.innerHTML = `<span style="display:flex;align-items:center;">${iconSvg}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ==============================================================================
// 11. HELPER UTILITIES
// ==============================================================================
function isPending(statusStr) {
  const s = String(statusStr || '').toLowerCase();
  if (!s || s.includes('pending') || s.includes('menunggu') || s.includes('diajukan') || s.includes('draft')) {
    return true;
  }
  return false;
}

function isApproved(statusStr) {
  const s = String(statusStr || '').toLowerCase();
  if (isPending(s) || isRejected(s)) return false;
  return s.includes('setuju') || s.includes('approved');
}

function isRejected(statusStr) {
  const s = String(statusStr || '').toLowerCase();
  return s.includes('tolak') || s.includes('reject');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateIndo(dateStr) {
  if (!dateStr || dateStr === '-') return '-';

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }

    const match = String(dateStr).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (match) {
      const parsed = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      return parsed.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch (e) {}

  return String(dateStr);
}

// Expose fungsi ke window untuk kemudahan pemanggilan dari inline listener
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.validatePin = validatePin;
window.logout = logout;
window.fetchSubmissions = fetchSubmissions;
window.executeApproval = executeApproval;
window.handleRowClick = handleRowClick;
