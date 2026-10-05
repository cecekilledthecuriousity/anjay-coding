/**
 * ==============================================================================
 * PORTAL APPROVAL TRAINING KARYAWAN (approval/approval.js)
 * ==============================================================================
 * Logika Frontend: Autentikasi PIN, Sinkronisasi Spreadsheet, Navigasi Multi-Halaman TDS,
 * Dashboard Eksekutif, Kalender Interaktif, Rekap Laporan & Keputusan Approval.
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
let currentApprPage = 'dashboard';
let apprCalDate = new Date();
let deepLinkHandled = false;

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// ==========================================
// Sidebar Collapse Management (Desktop / Tablet)
// ==========================================
const SIDEBAR_COLLAPSE_KEY = 'tds_sidebar_collapsed';

function applySidebarCollapse(collapsed, animate = true) {
  const sidebar = document.getElementById('tdsSidebar');
  const layout = document.querySelector('.tds-layout');
  const toggleBtn = document.getElementById('btnToggleSidebar');

  if (!sidebar) return;

  if (collapsed) {
    sidebar.classList.add('collapsed');
    if (layout) layout.classList.add('sidebar-collapsed');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('title', 'Luaskan Sidebar (Ctrl+B)');
    }
  } else {
    sidebar.classList.remove('collapsed');
    if (layout) layout.classList.remove('sidebar-collapsed');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.setAttribute('title', 'Kecilkan Sidebar (Ctrl+B)');
    }
  }

  // Trigger resize event after transition so FullCalendar / tables adapt smoothly
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, animate ? 280 : 0);
}

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('tdsSidebar');
  if (!sidebar) return;
  const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
  const nextState = !isCurrentlyCollapsed;

  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, nextState ? 'true' : 'false');
  } catch (e) {
    // Graceful fallback if localStorage is disabled
  }

  applySidebarCollapse(nextState, true);
}

function initSidebarCollapse() {
  let isCollapsed = false;
  try {
    isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'true';
  } catch (e) {
    isCollapsed = false;
  }

  // Apply saved state immediately on desktop screens (> 768px)
  if (window.innerWidth > 768 && isCollapsed) {
    applySidebarCollapse(true, false);
  }

  const toggleBtn = document.getElementById('btnToggleSidebar');
  if (toggleBtn) {
    toggleBtn.onclick = function(e) {
      if (e) e.preventDefault();
      toggleSidebarCollapse();
    };
  }

  // Keyboard shortcut: Ctrl+B or Cmd+B
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || activeEl?.isContentEditable) {
        return;
      }
      e.preventDefault();
      toggleSidebarCollapse();
    }
  });
}

window.applySidebarCollapse = applySidebarCollapse;
window.toggleSidebarCollapse = toggleSidebarCollapse;
window.initSidebarCollapse = initSidebarCollapse;

// ==============================================================================
// 3. INISIALISASI APLIKASI
// ==============================================================================
function startApprovalApp() {
  initAuth();
  bindEventHandlers();
  initSidebarCollapse();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApprovalApp);
} else {
  startApprovalApp();
}

/**
 * Ekstraksi ID Training dari URL parameter query (?id=, ?trn=, ?submission=) atau hash (#TRN-...)
 */
function getDeepLinkIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  let targetId = urlParams.get('id') || urlParams.get('trn') || urlParams.get('trainingId') || urlParams.get('submission');
  if (!targetId && window.location.hash) {
    const hash = window.location.hash;
    const match = hash.match(/(TRN-[a-zA-Z0-9_-]+)/i);
    if (match) {
      targetId = match[1];
    } else {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      targetId = hashParams.get('id') || hashParams.get('trn');
    }
  }
  return targetId ? String(targetId).trim() : null;
}

/**
 * Memeriksa status autentikasi PIN pada sessionStorage.
 */
function initAuth() {
  const initialDeepId = getDeepLinkIdFromUrl();
  if (initialDeepId) {
    showToast(`Memuat pengajuan ${initialDeepId}...`, 'info', 2500);
  }
  // Langsung tampilkan seluruh portal approval secara lengkap (tanpa gerbang PIN)
  showDashboard();
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
// 4. AUTENTIKASI PIN & NAVIGASI
// ==============================================================================
function validatePin() {
  const pinInput = document.getElementById('approvalPinInput');
  const errEl = document.getElementById('pinErrorMsg');
  const enteredPin = (pinInput?.value || '').trim();
  const validPin = (localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN).trim();

  if (!enteredPin) {
    if (errEl) {
      errEl.textContent = 'Silahkan masukkan Master PIN.';
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
      errEl.textContent = 'Master PIN salah. Silahkan coba lagi (Default: ubahpin123).';
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
  const approvalAppLayout = document.getElementById('approvalAppLayout');

  if (loginGate) loginGate.style.display = 'none';
  if (approvalAppLayout) approvalAppLayout.style.display = 'block';

  goToApprPage('dashboard');
  fetchSubmissions();
}

function showLoginGate() {
  const loginGate = document.getElementById('loginGate');
  const approvalAppLayout = document.getElementById('approvalAppLayout');
  const pinInput = document.getElementById('approvalPinInput');
  const errEl = document.getElementById('pinErrorMsg');

  if (approvalAppLayout) approvalAppLayout.style.display = 'none';
  if (loginGate) loginGate.style.display = 'flex';

  // Cek jika terdapat parameter URL deep-link
  const deepNotice = document.getElementById('deepLinkNotice');
  const deepTarget = document.getElementById('deepLinkTargetId');
  const targetId = getDeepLinkIdFromUrl();
  if (deepNotice && deepTarget) {
    if (targetId) {
      deepTarget.textContent = targetId;
      deepNotice.style.display = 'block';
    } else {
      deepNotice.style.display = 'none';
    }
  }

  if (pinInput) {
    pinInput.value = '';
    pinInput.classList.remove('error');
    setTimeout(() => pinInput.focus(), 80);
  }
  if (errEl) {
    errEl.style.display = 'none';
  }
}

function goToApprPage(page) {
  if (!page) page = 'dashboard';
  currentApprPage = page;

  // 1. Update status aktif tombol navigasi sidebar
  document.querySelectorAll('.tds-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === page);
  });

  // 2. Tampilkan HANYA section yang dipilih (per-section terpisah)
  document.querySelectorAll('.tds-page').forEach(sec => {
    const isTarget = sec.id === `page-${page}`;
    sec.classList.toggle('active', isTarget);
    sec.style.display = isTarget ? 'block' : 'none';
  });

  // 3. Scroll halus ke atas
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 4. Inisialisasi atau update layout spesifik section
  if (page === 'calendar') {
    if (!apprCalendarInstance) {
      initApprFullCalendar();
    } else {
      setTimeout(() => {
        apprCalendarInstance.updateSize();
        renderApprMiniCalendar();
      }, 50);
    }
  } else if (page === 'reports') {
    renderDashboardStats();
  } else if (page === 'dashboard') {
    renderUrgentPendingList();
    renderDashboardStats();
  } else if (page === 'queue') {
    applyFilterAndSearch();
  } else if (page === 'evidence') {
    fetchEvidenceData();
  }
}
window.goToApprPage = goToApprPage;

// ==============================================================================
// 5. DATA NORMALIZATION & SINKRONISASI
// ==============================================================================

const DELETED_SUBMISSIONS_KEY = 'tds_appr_deleted_submission_ids';

/**
 * Mengambil daftar ID pengajuan yang telah dihapus oleh Approver dari localStorage
 */
function getDeletedSubmissionIds() {
  try {
    const raw = localStorage.getItem(DELETED_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Menyimpan ID pengajuan yang dihapus ke dalam localStorage blacklist
 */
function addDeletedSubmissionId(id) {
  if (!id) return;
  const list = getDeletedSubmissionIds();
  const cleanId = String(id).trim().toUpperCase();
  if (!list.includes(cleanId)) {
    list.push(cleanId);
    try {
      localStorage.setItem(DELETED_SUBMISSIONS_KEY, JSON.stringify(list));
    } catch (e) {}
  }
}

/**
 * Memeriksa apakah suatu baris merupakan data dummy pengujian atau telah dihapus oleh approver
 */
function isDummyOrDeletedSubmission(id, namaTraining, pengaju) {
  const cleanId = String(id || '').trim().toUpperCase();
  const cleanNama = String(namaTraining || '').trim();
  const cleanPengaju = String(pengaju || '').trim();

  // 1. Cek apakah ID telah dihapus secara eksplisit oleh Approver
  const deletedIds = getDeletedSubmissionIds();
  if (deletedIds.includes(cleanId)) {
    return true;
  }

  // 2. Daftar ID dummy / test yang perlu dihilangkan dari antrean
  const knownDummyIds = [
    'TRN',
    'TRN-TEST-1234',
    'TRN-2026-001',
    'TRN-2026-002',
    'TRN-20261005-GEN-SS'
  ];

  if (knownDummyIds.includes(cleanId)) {
    return true;
  }

  if (cleanId.startsWith('TRN-TEST')) {
    return true;
  }

  // 3. Cek apakah data tidak memiliki nama atau merupakan submission uji coba
  if (
    !cleanNama ||
    cleanNama === '-' ||
    cleanNama.toLowerCase().includes('antigravity') ||
    cleanPengaju === 'Test Leader' ||
    (cleanPengaju === '-' && cleanNama === '-')
  ) {
    return true;
  }

  return false;
}

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
  const pengaju = String(meta['Nama pengaju'] || meta['Leader pengaju'] || raw['Nama Pengaju'] || raw.pengaju || '-').trim();

  // Filter pengajuan yang merupakan dummy atau sudah dihapus
  if (isDummyOrDeletedSubmission(id, namaTraining, pengaju)) {
    return null;
  }

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
  renderUrgentPendingList();
  renderDashboardStats();
  applyFilterAndSearch();
  renderApprCalendar();
  fetchEvidenceData();
  checkUrlDeepLink();
}

/**
 * Otomatis membuka modal review jika terdapat URL parameter ?id=TRN-XXXX atau query/hash pendukung
 */
function checkUrlDeepLink(isRetry = false) {
  if (deepLinkHandled) return;
  const targetId = getDeepLinkIdFromUrl();
  if (!targetId) return;

  const cleanId = String(targetId).trim().toUpperCase();
  const norm = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const targetNorm = norm(targetId);

  const item = allSubmissions.find(s => {
    if (!s || !s.id) return false;
    const sId = String(s.id).trim().toUpperCase();
    return sId === cleanId || norm(sId) === targetNorm;
  });

  if (item) {
    deepLinkHandled = true;
    setTimeout(() => {
      openReviewModal(item.id);
      showToast(`Membuka pengajuan training ${item.id} secara otomatis.`, 'success');
    }, 150);
  } else if (!isRetry && allSubmissions.length > 0) {
    // Retry sekali dengan sinkronisasi paksa jika dokumen baru saja disubmit ke spreadsheet
    setTimeout(() => {
      fetchSubmissions(true).then(() => {
        checkUrlDeepLink(true);
      });
    }, 400);
  } else if (isRetry || allSubmissions.length > 0) {
    showToast(`Pengajuan training ${cleanId} tidak ditemukan di sistem.`, 'error', 4500);
  }
}

// ==============================================================================
// 6. KALKULASI & RENDERING KPI & DASHBOARD
// ==============================================================================
function renderKPIs() {
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiPending = document.getElementById('kpiPending');
  const kpiApproved = document.getElementById('kpiApproved');
  const kpiRejected = document.getElementById('kpiRejected');
  const sidebarBadge = document.getElementById('sidebarPendingBadge');

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

  if (sidebarBadge) {
    sidebarBadge.textContent = pending;
    sidebarBadge.style.display = pending > 0 ? 'inline-block' : 'none';
  }
}

function renderUrgentPendingList() {
  const container = document.getElementById('dashUrgentList');
  if (!container) return;

  const pendingItems = allSubmissions.filter(item => item.statusClass === 'submitted');

  if (pendingItems.length === 0) {
    container.innerHTML = `
      <div style="background:rgba(46,125,50,0.06);border:1px dashed rgba(46,125,50,0.25);border-radius:12px;padding:24px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:rgba(46,125,50,0.12);color:#2E7D32;margin-bottom:8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div style="font-weight:700;color:var(--ink);font-size:15px;">Semua Pengajuan Telah Ditinjau!</div>
        <div style="color:var(--ink-soft);font-size:12.5px;margin-top:2px;">Tidak ada dokumen proposal training yang menunggu keputusan approval saat ini.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingItems.slice(0, 6).map(item => `
    <div class="session-item" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 18px;background:var(--panel-strong);border:1px solid var(--line);border-radius:12px;margin-bottom:8px;">
      <div style="flex:1;min-width:240px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--accent);">${escapeHtml(item.id)}</span>
          <span class="mini-pill submitted" style="font-size:11px;padding:1px 7px;"><span class="dot"></span>Menunggu Approval</span>
          <span style="font-size:11.5px;color:var(--ink-faint);">${formatDateIndo(item.submittedAt)}</span>
        </div>
        <div style="font-size:14.5px;font-weight:700;color:var(--ink);">${escapeHtml(item.namaTraining)}</div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px;">
          Pengaju: <strong>${escapeHtml(item.pengaju)}</strong> &bull; Divisi: ${escapeHtml(item.departemen)} &bull; Budget: <strong style="color:var(--ink);">${escapeHtml(item.budget)}</strong>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button type="button" class="btn-primary" style="font-size:12.5px;padding:7px 14px;gap:5px;box-shadow:0 4px 12px rgba(0,23,143,0.25);" onclick="openReviewModal('${escapeHtml(item.id)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Tinjau &amp; Putuskan
        </button>
      </div>
    </div>
  `).join('');
}

function renderDashboardStats() {
  const deptContainer = document.getElementById('dashDeptDistribution');
  const totalDeptsEl = document.getElementById('dashTotalDepts');
  const upcomingListEl = document.getElementById('dashUpcomingApprovedList');

  const depts = {};
  let totalBudgetApprovedNum = 0;
  let totalBudgetPendingNum = 0;
  let totalBudgetNum = 0;

  allSubmissions.forEach(sub => {
    const d = sub.departemen || 'Lainnya';
    if (!depts[d]) depts[d] = { total: 0, approved: 0, pending: 0, rejected: 0 };
    depts[d].total++;
    if (sub.statusClass === 'approved') depts[d].approved++;
    else if (sub.statusClass === 'rejected') depts[d].rejected++;
    else depts[d].pending++;

    const b = parseRupiah(sub.budget);
    totalBudgetNum += b;
    if (sub.statusClass === 'approved') totalBudgetApprovedNum += b;
    else if (sub.statusClass === 'submitted') totalBudgetPendingNum += b;
  });

  const deptKeys = Object.keys(depts);
  if (totalDeptsEl) totalDeptsEl.textContent = `${deptKeys.length} Divisi`;

  // 1. Department Breakdown widget
  if (deptContainer) {
    if (deptKeys.length === 0) {
      deptContainer.innerHTML = '<div style="color:var(--ink-faint);font-size:13px;text-align:center;padding:12px;">Belum ada data pengajuan.</div>';
    } else {
      deptContainer.innerHTML = deptKeys.map(d => {
        const item = depts[d];
        const pct = Math.round((item.approved / (item.total || 1)) * 100);
        return `
          <div style="padding:10px 12px;background:rgba(255,255,255,0.7);border:1px solid var(--line-soft);border-radius:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:600;font-size:13px;color:var(--ink);">${escapeHtml(d)}</span>
              <span style="font-size:12px;color:var(--ink-soft);">${item.total} proposal (${item.approved} disetujui)</span>
            </div>
            <div style="height:6px;background:var(--line-soft);border-radius:10px;overflow:hidden;">
              <div style="height:100%;background:#2E7D32;width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Budget KPIs
  const kpiBudAppr = document.getElementById('dashKpiBudgetApproved');
  const kpiBudPend = document.getElementById('dashKpiBudgetPending');
  if (kpiBudAppr) kpiBudAppr.textContent = formatRupiah(totalBudgetApprovedNum);
  if (kpiBudPend) kpiBudPend.textContent = `Menunggu otorisasi: ${formatRupiah(totalBudgetPendingNum)}`;

  // 3. Upcoming Approved Trainings
  if (upcomingListEl) {
    const approvedSubs = allSubmissions.filter(s => s.statusClass === 'approved');
    if (approvedSubs.length === 0) {
      upcomingListEl.innerHTML = '<div style="color:var(--ink-faint);font-size:13px;text-align:center;padding:16px;">Belum ada pelatihan disetujui dalam jadwal.</div>';
    } else {
      upcomingListEl.innerHTML = approvedSubs.slice(0, 4).map(sub => `
        <div class="session-item" style="padding:10px 14px;background:rgba(255,255,255,0.7);border:1px solid var(--line-soft);border-radius:10px;margin-bottom:6px;">
          <div style="font-size:11.5px;color:var(--accent);font-weight:600;">${escapeHtml(sub.jadwal || '-')}</div>
          <div style="font-weight:600;font-size:13.5px;color:var(--ink);">${escapeHtml(sub.namaTraining)}</div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">Trainer: ${escapeHtml(sub.trainer || '-')} &bull; Venue: ${escapeHtml(sub.venue || '-')}</div>
        </div>
      `).join('');
    }
  }

  // 4. Reports Page Elements
  const repApprRate = document.getElementById('repApprovalRate');
  const repApprRateSub = document.getElementById('repApprovalRateSub');
  const repBudAppr = document.getElementById('repBudgetApproved');
  const repBudTot = document.getElementById('repBudgetTotal');
  const repDeptTable = document.getElementById('repDeptTableBody');

  const total = allSubmissions.length;
  const approvedCount = allSubmissions.filter(s => s.statusClass === 'approved').length;
  const ratePct = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  if (repApprRate) repApprRate.textContent = `${ratePct}%`;
  if (repApprRateSub) repApprRateSub.textContent = `${approvedCount} dari ${total} proposal disetujui`;
  if (repBudAppr) repBudAppr.textContent = formatRupiah(totalBudgetApprovedNum);
  if (repBudTot) repBudTot.textContent = formatRupiah(totalBudgetNum);

  if (repDeptTable) {
    if (deptKeys.length === 0) {
      repDeptTable.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:20px;">Belum ada data pengajuan.</td></tr>';
    } else {
      repDeptTable.innerHTML = deptKeys.map(d => {
        const item = depts[d];
        let deptApprovedBud = 0;
        allSubmissions.filter(s => s.departemen === d && s.statusClass === 'approved').forEach(s => {
          deptApprovedBud += parseRupiah(s.budget);
        });
        return `
          <tr>
            <td><strong>${escapeHtml(d)}</strong></td>
            <td style="text-align:center;">${item.total}</td>
            <td style="text-align:center;"><span class="mini-pill submitted" style="padding:1px 6px;">${item.pending}</span></td>
            <td style="text-align:center;"><span class="mini-pill approved" style="padding:1px 6px;">${item.approved}</span></td>
            <td style="text-align:center;"><span class="mini-pill rejected" style="padding:1px 6px;">${item.rejected}</span></td>
            <td style="text-align:right;font-weight:600;">${formatRupiah(deptApprovedBud)}</td>
          </tr>
        `;
      }).join('');
    }
  }
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
      <td style="text-align:center;white-space:nowrap;">
        <div style="display:inline-flex;gap:6px;align-items:center;">
          <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px;white-space:nowrap;" onclick="openReviewModal('${escapeHtml(item.id)}')">
            Tinjau
          </button>
          <button type="button" class="btn-secondary" style="padding:6px 8px;font-size:12px;color:var(--danger);border-color:rgba(220,38,38,0.25);background:#FFF;" title="Hapus Pengajuan ${escapeHtml(item.id)}" onclick="deleteSubmission('${escapeHtml(item.id)}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
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
// 8. KALENDER TRAINING & FULLCALENDAR INTERACTIVE SCHEDULE (approval/approval.js)
// ==============================================================================
let apprCalendarInstance = null;
let rawApprCalendarEvents = [];
let apprMiniCalDate = new Date();
let activeApprCalView = 'dayGridMonth';

const APPR_ROOM_COLOR_MAP = {
  'Neptunus': '#2563EB',
  'Saturnus': '#7C3AED',
  'Mars': '#EA580C',
  'Merkurius': '#059669',
  'Lainnya': '#64748B'
};

const APPR_STATUS_COLOR_MAP = {
  'Approved': '#16A34A',
  'Pending': '#EAB308',
  'Rejected': '#DC2626'
};

function getApprRoomNormKey(roomStr) {
  const r = String(roomStr || '').toLowerCase();
  if (r.includes('neptunus')) return 'Neptunus';
  if (r.includes('saturnus')) return 'Saturnus';
  if (r.includes('mars')) return 'Mars';
  if (r.includes('merkurius')) return 'Merkurius';
  return 'Lainnya';
}

function initApprFullCalendar() {
  const mountEl = document.getElementById('fullCalendarMountAppr');
  if (!mountEl) return;

  if (typeof FullCalendar === 'undefined') {
    console.warn('FullCalendar library belum termuat dari CDN.');
    return;
  }

  if (apprCalendarInstance) {
    apprCalendarInstance.updateSize();
    renderApprMiniCalendar();
    return;
  }

  apprCalendarInstance = new FullCalendar.Calendar(mountEl, {
    locale: 'id',
    initialView: activeApprCalView,
    headerToolbar: false, // Custom header controls
    height: 'auto',
    expandRows: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    allDaySlot: true,
    dayMaxEvents: false, // Tampilkan seluruh event sekaligus tanpa pembatasan +more
    navLinks: true,
    navLinkDayClick: function(date) {
      apprCalendarInstance.gotoDate(date);
      switchApprCalView('timeGridDay');
    },
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    datesSet: function(info) {
      updateApprCalTitle(info);
      renderApprMiniCalendar();
    },
    eventContent: function(arg) {
      const ev = arg.event;
      const props = ev.extendedProps || {};
      const timeStr = arg.timeText || (props.jamMulai ? `${props.jamMulai} - ${props.jamSelesai || ''}` : '');
      const room = props.ruangan || '';
      const title = ev.title;

      const container = document.createElement('div');
      container.className = 'fc-custom-event-pill';

      let html = '';
      if (timeStr) {
        html += `<div class="fc-custom-event-time">${escapeHtml(timeStr)}${room ? ` &bull; ${escapeHtml(room)}` : ''}</div>`;
      }
      html += `<div class="fc-custom-event-title">${escapeHtml(title)}</div>`;

      container.innerHTML = html;
      return { domNodes: [container] };
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      openApprEventDetailModal(info.event);
    }
  });

  apprCalendarInstance.render();
  fetchApprCalendarEvents();
}
window.initApprFullCalendar = initApprFullCalendar;
window.renderApprCalendar = initApprFullCalendar;

function updateApprCalTitle(info) {
  const titleEl = document.getElementById('apprCalActiveTitle');
  if (!titleEl) return;

  if (apprCalendarInstance) {
    const curDate = apprCalendarInstance.getDate();
    apprMiniCalDate = new Date(curDate);
    
    const view = apprCalendarInstance.view;
    if (view.type === 'dayGridMonth') {
      titleEl.textContent = `${INDO_MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
    } else if (view.type === 'timeGridWeek') {
      const start = view.currentStart;
      const end = new Date(view.currentEnd);
      end.setDate(end.getDate() - 1);
      titleEl.textContent = `${start.getDate()} ${INDO_MONTHS[start.getMonth()]} - ${end.getDate()} ${INDO_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    } else if (view.type === 'timeGridDay') {
      titleEl.textContent = `${curDate.getDate()} ${INDO_MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
    } else {
      titleEl.textContent = view.title || `${INDO_MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
    }
  }
}

function goToApprCalToday() {
  if (apprCalendarInstance) {
    apprCalendarInstance.today();
    updateApprCalTitle();
    renderApprMiniCalendar();
  }
}
window.goToApprCalToday = goToApprCalToday;

function goToApprCalPrev() {
  if (apprCalendarInstance) {
    apprCalendarInstance.prev();
    updateApprCalTitle();
    renderApprMiniCalendar();
  }
}
window.goToApprCalPrev = goToApprCalPrev;

function goToApprCalNext() {
  if (apprCalendarInstance) {
    apprCalendarInstance.next();
    updateApprCalTitle();
    renderApprMiniCalendar();
  }
}
window.goToApprCalNext = goToApprCalNext;

function switchApprCalView(viewName) {
  activeApprCalView = viewName;
  if (apprCalendarInstance) {
    apprCalendarInstance.changeView(viewName);
    updateApprCalTitle();
  }

  const btnDay = document.getElementById('btnApprViewDay');
  const btnWeek = document.getElementById('btnApprViewWeek');
  const btnMonth = document.getElementById('btnApprViewMonth');

  if (btnDay) btnDay.classList.toggle('active', viewName === 'timeGridDay');
  if (btnWeek) btnWeek.classList.toggle('active', viewName === 'timeGridWeek');
  if (btnMonth) btnMonth.classList.toggle('active', viewName === 'dayGridMonth');
}
window.switchApprCalView = switchApprCalView;

function toggleApprCalSidebarFilter() {
  const sidebar = document.getElementById('apprCalFilterSidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}
window.toggleApprCalSidebarFilter = toggleApprCalSidebarFilter;

async function fetchApprCalendarEvents(forceRefresh = false) {
  const loadingEl = document.getElementById('apprCalLoadingState');
  const emptyEl = document.getElementById('apprCalEmptyState');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';

  let fetchedEvents = null;

  try {
    const url = `${GOOGLE_SCRIPT_URL}${GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?'}action=getCalendarEvents&_ts=${Date.now()}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json)) {
        fetchedEvents = json;
      } else if (json && json.status === 'success' && Array.isArray(json.data)) {
        fetchedEvents = json.data;
      } else if (json && Array.isArray(json.events)) {
        fetchedEvents = json.events;
      }
    }
  } catch (err) {
    console.warn('Gagal fetch event kalender dari Apps Script, menggunakan fallback data lokal:', err);
  }

  if (!fetchedEvents || fetchedEvents.length === 0) {
    fetchedEvents = buildCalendarEventsFromSubmissions(allSubmissions);
  }

  // Filter event kalender dari ID dummy / yang telah dihapus
  if (Array.isArray(fetchedEvents)) {
    fetchedEvents = fetchedEvents.filter(ev => {
      const subId = ev.submissionId || ev.id || '';
      return !isDummyOrDeletedSubmission(subId, ev.judul || ev.title, ev.pemohon);
    });
  }

  rawApprCalendarEvents = fetchedEvents;

  populateApprDivisionFilters();
  filterAndRenderApprCalendar();

  if (loadingEl) loadingEl.style.display = 'none';
}
window.fetchApprCalendarEvents = fetchApprCalendarEvents;

function buildCalendarEventsFromSubmissions(submissions) {
  const events = [];
  if (!Array.isArray(submissions)) return events;

  submissions.forEach(sub => {
    const raw = sub.rawEntry || {};
    const modules = Array.isArray(raw.modules) ? raw.modules : [];

    let status = 'Pending';
    if (sub.statusClass === 'approved' || sub.status === 'Disetujui') status = 'Approved';
    else if (sub.statusClass === 'rejected' || sub.status === 'Ditolak') status = 'Rejected';

    if (modules.length > 0) {
      modules.forEach((mod, idx) => {
        const d = (mod.tanggal || '').trim();
        if (d) {
          const jamMulai = (mod.jamMulai || '09:00').trim();
          const jamSelesai = (mod.jamSelesai || '16:00').trim();
          events.push({
            id: `${sub.id}-mod-${idx}`,
            submissionId: sub.id,
            judul: mod.modul ? `${sub.namaTraining} - ${mod.modul}` : sub.namaTraining,
            tanggal: d,
            jamMulai: jamMulai,
            jamSelesai: jamSelesai,
            ruangan: mod.lokasi || sub.venue || 'Neptunus',
            pemohon: sub.pengaju,
            divisi: sub.departemen,
            kategori: sub.kategori || 'Soft skill',
            status: status,
            notes: mod.deskripsi || sub.durasi || ''
          });
        }
      });
    }

    // Jika tidak ada modul bertanggal, cek sub.jadwal
    const match = String(sub.jadwal).match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match) {
      const d = match[1];
      if (!events.some(e => e.submissionId === sub.id)) {
        events.push({
          id: sub.id,
          submissionId: sub.id,
          judul: sub.namaTraining,
          tanggal: d,
          jamMulai: '09:00',
          jamSelesai: '16:00',
          ruangan: sub.venue || 'Neptunus',
          pemohon: sub.pengaju,
          divisi: sub.departemen,
          kategori: sub.kategori || 'Soft skill',
          status: status,
          notes: sub.durasi || ''
        });
      }
    }
  });

  return events;
}

function populateApprDivisionFilters() {
  const container = document.getElementById('apprDivisionFilterList');
  if (!container) return;

  const divs = new Set();
  rawApprCalendarEvents.forEach(e => {
    if (e.divisi && e.divisi.trim()) divs.add(e.divisi.trim());
  });

  // Tambahkan divisi standar jika data masih sedikit
  ['HR', 'GA', 'FINANCE', 'MARKETING', 'WEB DEVELOPER', 'CUSTOMER EXPERIENCE', 'AI'].forEach(d => divs.add(d));

  const sortedDivs = Array.from(divs).sort();
  const colors = ['#2563EB', '#7C3AED', '#EA580C', '#059669', '#DB2777', '#4F46E5', '#0891B2', '#D97706'];

  container.innerHTML = sortedDivs.map((d, idx) => {
    const col = colors[idx % colors.length];
    return `
      <label class="cal-checkbox-item">
        <input type="checkbox" name="apprDivisionFilter" value="${escapeHtml(d)}" checked onchange="onApprCalendarFilterChange()">
        <span class="cal-checkbox-indicator" style="background:${col};"></span>
        <span class="cal-checkbox-label">${escapeHtml(d)}</span>
      </label>
    `;
  }).join('');
}

function selectAllApprDivisions(checkAll = true) {
  document.querySelectorAll('input[name="apprDivisionFilter"]').forEach(cb => {
    cb.checked = checkAll;
  });
  onApprCalendarFilterChange();
}
window.selectAllApprDivisions = selectAllApprDivisions;

function onApprCalendarFilterChange() {
  filterAndRenderApprCalendar();
}
window.onApprCalendarFilterChange = onApprCalendarFilterChange;

function filterAndRenderApprCalendar() {
  if (!apprCalendarInstance) return;

  const selectedDivisions = Array.from(document.querySelectorAll('input[name="apprDivisionFilter"]:checked')).map(cb => cb.value);
  const selectedStatuses = Array.from(document.querySelectorAll('input[name="apprStatusFilter"]:checked')).map(cb => cb.value);

  const filtered = rawApprCalendarEvents.filter(ev => {
    // 1. Division Filter
    const evDiv = (ev.divisi || '').trim();
    const divMatches = selectedDivisions.length === 0 || selectedDivisions.includes(evDiv);

    // 2. Status Filter
    const evStatus = (ev.status || 'Pending').trim();
    let normStatus = 'Pending';
    if (evStatus.toLowerCase().includes('approv') || evStatus.toLowerCase().includes('setuju')) normStatus = 'Approved';
    else if (evStatus.toLowerCase().includes('reject') || evStatus.toLowerCase().includes('tolak')) normStatus = 'Rejected';
    const statusMatches = selectedStatuses.includes(normStatus);

    return divMatches && statusMatches;
  });

  const emptyEl = document.getElementById('apprCalEmptyState');
  if (emptyEl) {
    emptyEl.style.display = filtered.length === 0 ? 'flex' : 'none';
  }

  // Convert to FullCalendar Event Objects
  const fcEvents = filtered.map(ev => {
    let normStatus = 'Pending';
    if ((ev.status || '').toLowerCase().includes('approv') || (ev.status || '').toLowerCase().includes('setuju')) normStatus = 'Approved';
    else if ((ev.status || '').toLowerCase().includes('reject') || (ev.status || '').toLowerCase().includes('tolak')) normStatus = 'Rejected';

    const color = APPR_STATUS_COLOR_MAP[normStatus] || '#EAB308';
    const hasTime = ev.jamMulai && ev.jamMulai.trim();
    const isAllDay = !hasTime;

    let start = ev.tanggal;
    let end = undefined;

    if (hasTime) {
      start = `${ev.tanggal}T${ev.jamMulai}:00`;
      if (ev.jamSelesai && ev.jamSelesai.trim()) {
        end = `${ev.tanggal}T${ev.jamSelesai}:00`;
      }
    }

    return {
      id: String(ev.id),
      title: ev.judul || 'Pelatihan Karyawan',
      start: start,
      end: end,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      textColor: '#FFFFFF',
      extendedProps: {
        ...ev,
        normStatus: normStatus
      }
    };
  });

  apprCalendarInstance.removeAllEvents();
  apprCalendarInstance.addEventSource(fcEvents);
  renderApprMiniCalendar();
}

function renderApprMiniCalendar() {
  const titleEl = document.getElementById('apprMiniCalTitle');
  const gridEl = document.getElementById('apprMiniCalGrid');
  if (!titleEl || !gridEl) return;

  const y = apprMiniCalDate.getFullYear();
  const m = apprMiniCalDate.getMonth();
  titleEl.textContent = `${INDO_MONTHS[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay();
  const startDay = firstDay === 0 ? 7 : firstDay; // Senin = 1
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const curActiveDate = apprCalendarInstance ? apprCalendarInstance.getDate() : today;
  const activeDateStr = `${curActiveDate.getFullYear()}-${String(curActiveDate.getMonth() + 1).padStart(2, '0')}-${String(curActiveDate.getDate()).padStart(2, '0')}`;

  const eventDates = new Set();
  rawApprCalendarEvents.forEach(e => {
    if (e.tanggal) eventDates.add(e.tanggal.trim());
  });

  let cells = [];

  // Prev month padding
  for (let i = startDay - 2; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push(`<div class="mini-cell other-month">${d}</div>`);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === activeDateStr;
    const hasEvent = eventDates.has(dateStr);

    let cls = 'mini-cell';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    if (hasEvent) cls += ' has-event';

    cells.push(`
      <div class="${cls}" onclick="onApprMiniCalDayClick('${dateStr}')" title="${dateStr}">
        ${d}
      </div>
    `);
  }

  // Next month padding
  const total = cells.length;
  const rem = (7 - (total % 7)) % 7;
  for (let n = 1; n <= rem; n++) {
    cells.push(`<div class="mini-cell other-month">${n}</div>`);
  }

  gridEl.innerHTML = cells.join('');
}

function prevApprMiniCalMonth() {
  apprMiniCalDate.setMonth(apprMiniCalDate.getMonth() - 1);
  renderApprMiniCalendar();
}
window.prevApprMiniCalMonth = prevApprMiniCalMonth;

function nextApprMiniCalMonth() {
  apprMiniCalDate.setMonth(apprMiniCalDate.getMonth() + 1);
  renderApprMiniCalendar();
}
window.nextApprMiniCalMonth = nextApprMiniCalMonth;

function onApprMiniCalDayClick(dateStr) {
  if (apprCalendarInstance) {
    apprCalendarInstance.gotoDate(dateStr);
    updateApprCalTitle();
    renderApprMiniCalendar();
  }
}
window.onApprMiniCalDayClick = onApprMiniCalDayClick;

// Detail Modal Handler (Read-Only)
function openApprEventDetailModal(fcEvent) {
  const modal = document.getElementById('modalApprEventDetail');
  if (!modal) return;

  const props = fcEvent.extendedProps || {};
  const status = props.normStatus || props.status || 'Pending';

  let statusBadgeClass = 'submitted';
  let statusLabel = 'Menunggu Approval (Pending)';
  if (status === 'Approved') {
    statusBadgeClass = 'approved';
    statusLabel = 'Disetujui (Approved)';
  } else if (status === 'Rejected') {
    statusBadgeClass = 'rejected';
    statusLabel = 'Ditolak (Rejected)';
  }

  const badgeEl = document.getElementById('apprCalDetailStatusBadge');
  if (badgeEl) {
    badgeEl.className = `mini-pill ${statusBadgeClass}`;
    badgeEl.textContent = statusLabel;
  }

  const idEl = document.getElementById('apprCalDetailId');
  if (idEl) idEl.textContent = props.submissionId || props.id || '-';

  const judulEl = document.getElementById('apprCalDetailJudul');
  if (judulEl) judulEl.textContent = fcEvent.title || props.judul || '-';

  const katEl = document.getElementById('apprCalDetailKategori');
  if (katEl) katEl.textContent = props.kategori || 'General Skill';

  const waktuEl = document.getElementById('apprCalDetailWaktu');
  if (waktuEl) {
    const tgl = formatDateIndo(props.tanggal || fcEvent.startStr);
    const jam = props.jamMulai ? `${props.jamMulai} - ${props.jamSelesai || ''} WIB` : 'All Day';
    waktuEl.textContent = `${tgl}, ${jam}`;
  }

  const roomNameEl = document.getElementById('apprCalDetailRoomName');
  const roomDotEl = document.getElementById('apprCalDetailRoomDot');
  if (roomNameEl) roomNameEl.textContent = props.ruangan || 'Ruangan Belum Ditentukan';
  if (roomDotEl) {
    const roomKey = getApprRoomNormKey(props.ruangan);
    roomDotEl.style.background = APPR_ROOM_COLOR_MAP[roomKey] || '#64748B';
  }

  const pemohonEl = document.getElementById('apprCalDetailPemohon');
  if (pemohonEl) pemohonEl.textContent = props.pemohon || '-';

  const divisiEl = document.getElementById('apprCalDetailDivisi');
  if (divisiEl) divisiEl.textContent = props.divisi || '-';

  const extraEl = document.getElementById('apprCalDetailExtra');
  const extraWrap = document.getElementById('apprCalDetailExtraWrap');
  if (extraEl) {
    const extraInfo = props.notes || props.deskripsi || 'Silahkan periksa detail pengajuan pada menu antrean approval jika membutuhkan dokumen pengajuan lengkap.';
    extraEl.textContent = extraInfo;
    if (extraWrap) extraWrap.style.display = 'block';
  }

  modal.classList.add('active');
}
window.openApprEventDetailModal = openApprEventDetailModal;

function closeApprEventDetailModal() {
  const modal = document.getElementById('modalApprEventDetail');
  if (modal) modal.classList.remove('active');
}
window.closeApprEventDetailModal = closeApprEventDetailModal;

// Setup outside-click listener for modalApprEventDetail
document.addEventListener('DOMContentLoaded', () => {
  const modalDetail = document.getElementById('modalApprEventDetail');
  if (modalDetail) {
    modalDetail.addEventListener('click', (e) => {
      if (e.target === modalDetail) {
        closeApprEventDetailModal();
      }
    });
  }
});

// ==============================================================================
// 9. EXPORT LAPORAN CSV
// ==============================================================================
function exportApprovalCsv() {
  if (!allSubmissions || allSubmissions.length === 0) {
    showToast('Tidak ada data pengajuan untuk diekspor.', 'error');
    return;
  }

  const headers = [
    'ID Training',
    'Tanggal Pengajuan',
    'Nama Training',
    'Kategori',
    'Level Kemahiran',
    'Pengaju',
    'Departemen',
    'Jadwal',
    'Lokasi/Venue',
    'Trainer',
    'Budget',
    'Status Approval',
    'Approver',
    'Tanggal Approval',
    'Catatan Approver'
  ];

  const escapeCsv = (val) => {
    const s = String(val || '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = allSubmissions.map(item => [
    escapeCsv(item.id),
    escapeCsv(item.submittedAt),
    escapeCsv(item.namaTraining),
    escapeCsv(item.kategori),
    escapeCsv(item.level),
    escapeCsv(item.pengaju),
    escapeCsv(item.departemen),
    escapeCsv(item.jadwal),
    escapeCsv(item.venue),
    escapeCsv(item.trainer),
    escapeCsv(item.budget),
    escapeCsv(item.status),
    escapeCsv(item.approver),
    escapeCsv(item.tanggalApproval),
    escapeCsv(item.catatanApprover)
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekap_approval_training_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('File CSV berhasil diunduh.', 'success');
}
window.exportApprovalCsv = exportApprovalCsv;

// ==============================================================================
// 10. MODAL TINJAUAN DOKUMEN & APPROVAL DECISION
// ==============================================================================
function openReviewModal(id) {
  const cleanId = String(id || '').trim().toUpperCase();
  const norm = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const targetNorm = norm(id);
  const item = allSubmissions.find(s => {
    if (!s || !s.id) return false;
    const sId = String(s.id).trim().toUpperCase();
    return sId === cleanId || norm(sId) === targetNorm;
  }) || allSubmissions.find(s => s.id === id);
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
    nameInput.value = localStorage.getItem('last_approver_name') || 'Fernanda Rusli';
    nameInput.classList.remove('error');
  }
  if (notesInput) {
    notesInput.value = '';
    notesInput.classList.remove('error');
  }

  // Reset status tombol keputusan
  const btnApprove = document.getElementById('btnApproveAction');
  const btnReject = document.getElementById('btnRejectAction');
  if (btnApprove) {
    btnApprove.disabled = false;
    btnApprove.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Setujui Training`;
  }
  if (btnReject) {
    btnReject.disabled = false;
    btnReject.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Tolak Training`;
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

  // Link Silabus
  const silabusUrl = meta['Link silabus materi'] || raw['Link Silabus / Materi'] || '';
  let silabusLinkHtml = '<span style="color:var(--ink-faint);font-size:13px;">Tidak dilampirkan</span>';
  if (silabusUrl && silabusUrl.startsWith('http')) {
    silabusLinkHtml = `
      <a href="${escapeHtml(silabusUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding:6px 14px;font-size:12.5px;gap:7px;display:inline-flex;align-items:center;color:var(--ink);border-color:rgba(0,23,143,0.18);background:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#2563EB;">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Buka Silabus di Google Drive</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    `;
  } else if (silabusUrl && silabusUrl !== '-') {
    silabusLinkHtml = escapeHtml(silabusUrl);
  }

  // Rincian Peserta
  let participantsHtml = '<div style="color:var(--ink-faint);font-size:13px;padding:14px;text-align:center;background:rgba(0,0,0,0.02);border-radius:10px;">Tidak ada daftar peserta tersimpan.</div>';
  if (participants.length > 0) {
    participantsHtml = `
      <div class="tbl-wrap" style="max-height:220px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;margin-bottom:18px;background:#FFF;">
        <table class="master" style="font-size:12.5px;margin:0;">
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">#</th>
              <th>Nama Lengkap</th>
              <th>Email</th>
              <th>Departemen / Divisi</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((p, idx) => {
              const pNama = p.nama || p.name || '-';
              const initial = pNama.charAt(0).toUpperCase() || '?';
              return `
                <tr>
                  <td style="text-align:center;color:var(--ink-faint);font-weight:600;">${idx + 1}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:9px;">
                      <div style="width:26px;height:26px;border-radius:50%;background:rgba(0,23,143,0.08);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">
                        ${escapeHtml(initial)}
                      </div>
                      <span style="font-weight:600;color:var(--ink);">${escapeHtml(pNama)}</span>
                    </div>
                  </td>
                  <td style="color:var(--ink-soft);">${escapeHtml(p.email || '-')}</td>
                  <td>
                    <span class="mini-pill" style="font-size:11px;padding:2px 8px;">${escapeHtml(p.departemen || p.divisi || p.department || '-')}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rangkaian Modul
  let modulesHtml = '<div style="color:var(--ink-faint);font-size:13px;padding:14px;text-align:center;background:rgba(0,0,0,0.02);border-radius:10px;">Tidak ada rincian modul.</div>';
  if (modules.length > 0) {
    modulesHtml = `
      <div class="tbl-wrap" style="max-height:220px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;margin-bottom:18px;background:#FFF;">
        <table class="master" style="font-size:12.5px;margin:0;">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Waktu</th>
              <th>Nama Modul</th>
              <th>Fasilitator / PIC</th>
              <th>Durasi</th>
            </tr>
          </thead>
          <tbody>
            ${modules.map(m => `
              <tr>
                <td style="white-space:nowrap;font-weight:600;color:var(--ink);">${escapeHtml(m.tanggal || '-')}</td>
                <td style="white-space:nowrap;color:var(--ink-soft);">${escapeHtml(m.jamMulai || '')} - ${escapeHtml(m.jamSelesai || '')} WIB</td>
                <td style="font-weight:600;color:var(--ink);">${escapeHtml(m.modul || m.name || '-')}</td>
                <td>${escapeHtml(m.pic || '-')}</td>
                <td><span class="mini-pill" style="font-size:11px;padding:2px 8px;">${escapeHtml(m.durasi || '-')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Purpose / Goals Box
  const purposeText = meta['Purpose / latar belakang'] || '';
  const goalsText = meta['Goals / tujuan terukur'] || '';
  let purposeGoalsHtml = '';
  if (purposeText || goalsText) {
    purposeGoalsHtml = `
      <div style="background:#FFFFFF;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:18px;box-shadow:var(--shadow-sm);">
        <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:12px;display:flex;align-items:center;gap:7px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          Sasaran &amp; Tujuan Pelatihan
        </div>
        ${purposeText ? `
          <div style="margin-bottom:10px;">
            <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Latar Belakang (Purpose):</div>
            <div style="font-size:13px;color:var(--ink);line-height:1.55;">${escapeHtml(purposeText)}</div>
          </div>
        ` : ''}
        ${goalsText ? `
          <div>
            <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Tujuan Terukur (Goals):</div>
            <div style="font-size:13px;color:var(--ink);line-height:1.55;">${escapeHtml(goalsText)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Approver decision stamp (if already reviewed)
  let decisionStampHtml = '';
  if (item.approver && item.approver !== '-') {
    const isAppr = item.statusClass === 'approved';
    decisionStampHtml = `
      <div style="background:${isAppr ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)'};border:1.5px solid ${isAppr ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'};border-radius:14px;padding:16px 20px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
          <span style="font-weight:700;font-size:13.5px;color:${isAppr ? '#15803D' : '#DC2626'};display:flex;align-items:center;gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${isAppr ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'}
            </svg>
            Keputusan Approver: ${escapeHtml(item.status)}
          </span>
          <span style="font-size:12px;color:var(--ink-soft);">${escapeHtml(item.tanggalApproval || '-')}</span>
        </div>
        <div style="font-size:13px;color:var(--ink);margin-bottom:4px;">
          Oleh: <strong>${escapeHtml(item.approver)}</strong>
        </div>
        ${item.catatanApprover ? `
          <div style="font-size:12.5px;color:var(--ink-soft);font-style:italic;background:#FFF;padding:10px 14px;border-radius:8px;border:1px solid var(--line-soft);margin-top:8px;line-height:1.5;">
            &ldquo;${escapeHtml(item.catatanApprover)}&rdquo;
          </div>
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Top Executive Hero Card -->
    <div style="background:linear-gradient(135deg, #FFFFFF 0%, #F5F8FF 100%);border:1px solid rgba(0,23,143,0.12);border-radius:16px;padding:22px 24px;margin-bottom:18px;box-shadow:0 4px 16px -4px rgba(0,23,143,0.06);">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;">
        <span class="mini-pill" style="font-weight:700;font-size:11.5px;background:rgba(0,23,143,0.08);color:var(--ink);">${escapeHtml(item.departemen || 'Semua Divisi')}</span>
        <span class="mini-pill" style="font-size:11.5px;">${escapeHtml(item.kategori || 'Pelatihan')} &bull; ${escapeHtml(item.level || 'All Level')}</span>
        ${meta['Metode training'] ? `<span class="mini-pill" style="font-size:11.5px;background:rgba(75,150,255,0.14);color:var(--ink);">${escapeHtml(meta['Metode training'])}</span>` : ''}
        <span class="mini-pill ${item.statusClass}" style="margin-left:auto;font-weight:700;font-size:11.5px;"><span class="dot"></span>${escapeHtml(item.status)}</span>
      </div>
      
      <h2 class="voice" style="font-size:21px;font-weight:700;color:var(--ink);line-height:1.35;margin:0 0 16px;">
        ${escapeHtml(item.namaTraining)}
      </h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:10px;padding-top:14px;border-top:1px solid rgba(0,23,143,0.08);">
        <div style="background:#FFF;border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Leader Pengaju</div>
          <div style="font-size:13.5px;font-weight:700;color:var(--ink);">${escapeHtml(item.pengaju)}</div>
        </div>
        <div style="background:#FFF;border:1px solid rgba(0,23,143,0.14);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Komitmen Budget</div>
          <div style="font-size:15px;font-weight:700;color:#00178F;">${escapeHtml(item.budget)}</div>
        </div>
        <div style="background:#FFF;border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Jadwal Pelaksanaan</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);">${escapeHtml(item.jadwal)}</div>
        </div>
        <div style="background:#FFF;border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Total Durasi</div>
          <div style="font-size:13.5px;font-weight:700;color:var(--ink);">${escapeHtml(item.durasi)}</div>
        </div>
      </div>
    </div>

    <!-- Logistics Grid -->
    <div class="detail-grid" style="margin-bottom:18px;">
      <div class="detail-item">
        <span class="lbl">Fasilitator / Trainer</span>
        <span class="val" style="font-weight:600;">${escapeHtml(item.trainer || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="lbl">Lokasi / Ruangan / Venue</span>
        <span class="val" style="font-weight:600;">${escapeHtml(item.venue || '-')}</span>
      </div>
      <div class="detail-item detail-full">
        <span class="lbl">Silabus &amp; Materi Pembelajaran</span>
        <span class="val" style="margin-top:4px;">${silabusLinkHtml}</span>
      </div>
    </div>

    <!-- Approver Decision History (if any) -->
    ${decisionStampHtml}

    <!-- Purpose & Goals -->
    ${purposeGoalsHtml}

    <!-- Daftar Peserta -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:13.5px;color:var(--ink);display:flex;align-items:center;gap:6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Daftar Peserta Terdaftar
      </div>
      <span class="mini-pill" style="font-size:11px;font-weight:700;padding:2px 8px;">${participants.length || raw['Jumlah Peserta Terdaftar'] || 0} Orang</span>
    </div>
    ${participantsHtml}

    <!-- Modul & Sesi -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:13.5px;color:var(--ink);display:flex;align-items:center;gap:6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        Rangkaian Modul Pelatihan
      </div>
      <span class="mini-pill" style="font-size:11px;font-weight:700;padding:2px 8px;">${modules.length} Modul</span>
    </div>
    ${modulesHtml}
  `;
}

// ==============================================================================
// 11. EKSEKUSI APPROVAL DECISION
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
    showToast('Silahkan isi kolom "Nama Approver / Reviewer" terlebih dahulu sebelum menyetujui.', 'error');
    if (nameInput) {
      nameInput.classList.add('error');
      nameInput.focus();
      nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Validasi Catatan jika Ditolak
  if (decision === 'Ditolak' && !notes) {
    showToast('Catatan / alasan penolakan wajib diisi jika menolak pengajuan.', 'error');
    if (notesInput) {
      notesInput.classList.add('error');
      notesInput.focus();
      notesInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  if (decision === 'Disetujui') {
    showToast(`Pengajuan ${currentReviewItem.id} berhasil disetujui. Ruangan meeting ter-booking & undangan kalender terkirim ke peserta.`, 'success');
  } else {
    showToast(`Pengajuan ${currentReviewItem.id} berhasil ditolak.`, 'info');
  }
  closeReviewModal();
  renderKPIs();
  renderUrgentPendingList();
  renderDashboardStats();
  applyFilterAndSearch();
  renderApprCalendar();

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

/**
 * Menghapus dokumen pengajuan training dari antrean approver & sinkronisasi ke server
 */
async function deleteSubmission(id) {
  if (!id) return;
  const cleanId = String(id).trim().toUpperCase();
  const item = allSubmissions.find(s => String(s.id).trim().toUpperCase() === cleanId);
  const displayTitle = item ? item.namaTraining : cleanId;

  const confirmed = confirm(`Apakah Anda yakin ingin menghapus pengajuan training "${displayTitle}" (${cleanId})?\n\nData yang dihapus tidak akan ditampilkan lagi di antrean portal approver.`);
  if (!confirmed) return;

  // 1. Simpan ke blacklist ID terhapus lokal
  addDeletedSubmissionId(cleanId);

  // 2. Hapus dari riwayat localStorage lokal
  try {
    const rawLocal = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (rawLocal) {
      let list = JSON.parse(rawLocal);
      if (Array.isArray(list)) {
        list = list.filter(entry => {
          const locId = String((entry.meta && entry.meta['ID training']) || entry.id || '').trim().toUpperCase();
          return locId !== cleanId;
        });
        localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}

  // 3. Hapus dari memori array allSubmissions
  allSubmissions = allSubmissions.filter(s => String(s.id).trim().toUpperCase() !== cleanId);

  // 4. Tutup modal jika dokumen yang dihapus sedang ditinjau
  if (currentReviewItem && String(currentReviewItem.id).trim().toUpperCase() === cleanId) {
    closeReviewModal();
  }

  // 5. Update seluruh tampilan portal approver
  renderKPIs();
  renderUrgentPendingList();
  renderDashboardStats();
  applyFilterAndSearch();
  renderApprCalendar();

  showToast(`Pengajuan ${cleanId} berhasil dihapus dari antrean approval.`, 'info');

  // 6. Kirim permintaan sinkronisasi hapus ke Google Apps Script backend
  try {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete_submission',
        id: cleanId
      })
    }).catch(err => console.warn('Gagal sinkronisasi hapus ke spreadsheet:', err));
  } catch (e) {}
}

function handleModalDeleteSubmission() {
  if (!currentReviewItem) return;
  deleteSubmission(currentReviewItem.id);
}

// ==============================================================================
// 12. TOAST NOTIFICATION SYSTEM
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
// 13. HELPER UTILITIES
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

function parseRupiah(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[^\d]/g, '');
  return parseInt(clean, 10) || 0;
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

// Expose fungsi ke window untuk kemudahan pemanggilan dari inline listener
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.validatePin = validatePin;
window.logout = logout;
window.fetchSubmissions = fetchSubmissions;
window.executeApproval = executeApproval;
window.handleRowClick = handleRowClick;
window.deleteSubmission = deleteSubmission;
window.handleModalDeleteSubmission = handleModalDeleteSubmission;

// ==============================================================================
// 14. EVIDENCE & DOKUMENTASI COLLECTION (POST TRAINING INTEGRATION)
// ==============================================================================
let allEvidenceList = [];
let filteredEvidenceList = [];
let evidenceSearchQuery = '';
let evidenceDivFilter = 'all';
let evidenceCatFilter = 'all';
let currentViewingEvidence = null;
const EVIDENCE_LOCAL_STORAGE_KEY = 'tds_post_training_evidence_list';

// Koleksi evidence murni dari submission nyata (data dummy dibersihkan)
const SAMPLE_EVIDENCE_COLLECTION = [];

/**
 * Mengambil data evidence & dokumentasi dari Google Apps Script dan sinkronisasi dengan localStorage.
 */
async function fetchEvidenceData(forceRefresh = false) {
  let remoteEvidence = [];
  let fetchOk = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getPostTrainingEvidence`, {
      method: 'GET',
      cache: forceRefresh ? 'no-cache' : 'default',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        remoteEvidence = json;
        fetchOk = true;
      }
    }
  } catch (err) {
    // Tangani offline atau endpoint belum deploy
    fetchOk = false;
  }

  // Ambil cache lokal dari localStorage dan bersihkan dari sampel dummy lama
  let localEvidence = [];
  try {
    const rawLocal = localStorage.getItem(EVIDENCE_LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        localEvidence = parsed.filter(item => {
          const evId = String(item.id || '').toUpperCase();
          const trnId = String(item.idTraining || '').toUpperCase();
          return !evId.startsWith('EVD-SAMPLE') && trnId !== 'TRN-2026-001' && trnId !== 'TRN-2026-002' && trnId !== 'TRN-2026-003';
        });
        localStorage.setItem(EVIDENCE_LOCAL_STORAGE_KEY, JSON.stringify(localEvidence));
      }
    }
  } catch (e) {
    localEvidence = [];
  }

  // Gabungkan remote dan local
  let mergedMap = new Map();

  // 1. Masukkan sampel awal sebagai baseline (kosong jika tidak ada)
  SAMPLE_EVIDENCE_COLLECTION.forEach(sample => {
    mergedMap.set(sample.namaTraining.toLowerCase().trim(), { ...sample });
  });

  // 2. Timpa / gabungkan dengan data remote (filter dummy)
  if (fetchOk && Array.isArray(remoteEvidence) && remoteEvidence.length > 0) {
    remoteEvidence.forEach(rem => {
      const nameKey = (rem.namaTraining || '').toLowerCase().trim();
      const remTrnId = String(rem.idTraining || rem.id || '').trim().toUpperCase();
      if (!nameKey || isDummyOrDeletedSubmission(remTrnId, rem.namaTraining, rem.namaPeserta)) return;

      const existing = mergedMap.get(nameKey) || {};
      mergedMap.set(nameKey, {
        ...existing,
        id: rem.id || existing.id || ('EVD-' + Date.now()),
        namaTraining: rem.namaTraining,
        namaPeserta: rem.namaPeserta || existing.namaPeserta || '-',
        divisi: rem.divisi || existing.divisi || '-',
        kategori: rem.kategori || existing.kategori || 'Soft skill',
        waktuSubmit: rem.waktuSubmit || existing.waktuSubmit || '-',
        jumlahFile: Number(rem.jumlahFile) || existing.jumlahFile || 0,
        folderUrl: rem.folderUrl || existing.folderUrl || '',
        detailFile: rem.detailFile || existing.detailFile || '',
        skorPostTest: (rem.skorPostTest && rem.skorPostTest !== '-') ? rem.skorPostTest : (existing.skorPostTest || '-'),
        catatan: (rem.catatan && rem.catatan !== '-') ? rem.catatan : (existing.catatan || '-'),
        status: 'Selesai & Berdokumentasi',
        photos: existing.photos || []
      });
    });
  }

  // 3. Gabungkan dengan unggahan lokal terbaru (filter dummy)
  localEvidence.forEach(loc => {
    const nameKey = (loc.namaTraining || '').toLowerCase().trim();
    const locTrnId = String(loc.idTraining || loc.id || '').trim().toUpperCase();
    if (!nameKey || isDummyOrDeletedSubmission(locTrnId, loc.namaTraining, loc.namaPeserta)) return;

    const existing = mergedMap.get(nameKey) || {};
    mergedMap.set(nameKey, {
      ...existing,
      ...loc,
      photos: (loc.photos && loc.photos.length > 0) ? loc.photos : (existing.photos || []),
      status: 'Selesai & Berdokumentasi'
    });
  });

  // 4. Korelasikan dengan proposal asli di allSubmissions jika cocok
  allEvidenceList = Array.from(mergedMap.values()).map(evItem => {
    const matchedSub = allSubmissions.find(s => {
      const sName = (s.judul || (s.meta && s.meta['Nama training']) || '').toLowerCase().trim();
      return sName === evItem.namaTraining.toLowerCase().trim();
    });

    if (matchedSub) {
      return {
        ...evItem,
        idTraining: matchedSub.id || evItem.idTraining || 'TRN-XXXX',
        trainer: matchedSub.trainer || evItem.trainer || '-',
        tanggalTraining: matchedSub.jadwal || evItem.tanggalTraining || '-',
        proposalRef: matchedSub
      };
    }
    return evItem;
  });

  // Update badge di sidebar navigation
  const sidebarBadge = document.getElementById('sidebarEvidenceBadge');
  if (sidebarBadge) {
    sidebarBadge.textContent = allEvidenceList.length;
    sidebarBadge.style.display = allEvidenceList.length > 0 ? 'inline-block' : 'none';
  }

  populateEvidenceDivFilter();
  applyEvidenceFilterAndRender();

  if (forceRefresh) {
    showToast('Koleksi evidence berhasil disinkronkan.', 'success');
  }
}
window.fetchEvidenceData = fetchEvidenceData;

/**
 * Mengisi dropdown filter divisi secara dinamis dari data evidence
 */
function populateEvidenceDivFilter() {
  const sel = document.getElementById('evidenceDivFilter');
  if (!sel) return;

  const currentVal = sel.value;
  const divs = new Set();
  allEvidenceList.forEach(e => {
    if (e.divisi && e.divisi !== '-') divs.add(e.divisi.trim());
  });

  const sortedDivs = Array.from(divs).sort();
  let html = '<option value="all">Semua Departemen / Divisi</option>';
  sortedDivs.forEach(d => {
    html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
  });
  sel.innerHTML = html;

  if (currentVal && (currentVal === 'all' || divs.has(currentVal))) {
    sel.value = currentVal;
  }
}

/**
 * Handler saat input search atau filter divisi berubah
 */
function onEvidenceFilterChange() {
  const input = document.getElementById('evidenceSearchInput');
  const sel = document.getElementById('evidenceDivFilter');
  evidenceSearchQuery = input ? input.value.trim().toLowerCase() : '';
  evidenceDivFilter = sel ? sel.value : 'all';
  applyEvidenceFilterAndRender();
}
window.onEvidenceFilterChange = onEvidenceFilterChange;

/**
 * Filter berdasarkan kategori (All, Hard skill, Soft skill)
 */
function setEvidenceCategoryFilter(cat) {
  evidenceCatFilter = cat || 'all';

  const btnAll = document.getElementById('btnEvCatAll');
  const btnHard = document.getElementById('btnEvCatHard');
  const btnSoft = document.getElementById('btnEvCatSoft');

  if (btnAll) btnAll.classList.toggle('active', evidenceCatFilter === 'all');
  if (btnHard) btnHard.classList.toggle('active', evidenceCatFilter === 'Hard skill');
  if (btnSoft) btnSoft.classList.toggle('active', evidenceCatFilter === 'Soft skill');

  applyEvidenceFilterAndRender();
}
window.setEvidenceCategoryFilter = setEvidenceCategoryFilter;

/**
 * Reset seluruh filter pencarian evidence
 */
function resetEvidenceFilters() {
  evidenceSearchQuery = '';
  evidenceDivFilter = 'all';
  evidenceCatFilter = 'all';

  const input = document.getElementById('evidenceSearchInput');
  const sel = document.getElementById('evidenceDivFilter');
  if (input) input.value = '';
  if (sel) sel.value = 'all';

  setEvidenceCategoryFilter('all');
}
window.resetEvidenceFilters = resetEvidenceFilters;

/**
 * Menghitung KPI dan me-render kartu galeri evidence
 */
function applyEvidenceFilterAndRender() {
  const container = document.getElementById('evidenceGridContainer');
  const emptyState = document.getElementById('evidenceEmptyState');
  if (!container) return;

  // Filter items
  filteredEvidenceList = allEvidenceList.filter(item => {
    // 1. Division filter
    if (evidenceDivFilter !== 'all' && item.divisi !== evidenceDivFilter) {
      return false;
    }

    // 2. Category filter
    if (evidenceCatFilter !== 'all') {
      const itemCat = (item.kategori || '').toLowerCase();
      if (itemCat !== evidenceCatFilter.toLowerCase()) {
        return false;
      }
    }

    // 3. Search query
    if (evidenceSearchQuery) {
      const q = evidenceSearchQuery;
      const matchName = (item.namaTraining || '').toLowerCase().includes(q);
      const matchPic = (item.namaPeserta || '').toLowerCase().includes(q);
      const matchDiv = (item.divisi || '').toLowerCase().includes(q);
      const matchId = (item.idTraining || '').toLowerCase().includes(q);
      if (!matchName && !matchPic && !matchDiv && !matchId) {
        return false;
      }
    }

    return true;
  });

  // Kalkulasi KPI
  const kpiTotal = document.getElementById('kpiEvidenceTotal');
  const kpiFiles = document.getElementById('kpiEvidenceFiles');
  const kpiAvgScore = document.getElementById('kpiEvidenceAvgScore');
  const kpiTopDept = document.getElementById('kpiEvidenceTopDept');

  const totalPrograms = filteredEvidenceList.length;
  let totalFiles = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const deptCounts = {};

  filteredEvidenceList.forEach(item => {
    totalFiles += (Number(item.jumlahFile) || (item.photos ? item.photos.length : 0) || 0);

    const numScore = parseFloat(String(item.skorPostTest).replace(/[^\d.]/g, ''));
    if (!isNaN(numScore) && numScore > 0) {
      scoreSum += numScore;
      scoreCount++;
    }

    if (item.divisi && item.divisi !== '-') {
      deptCounts[item.divisi] = (deptCounts[item.divisi] || 0) + 1;
    }
  });

  let topDept = '-';
  let topCount = 0;
  Object.keys(deptCounts).forEach(d => {
    if (deptCounts[d] > topCount) {
      topCount = deptCounts[d];
      topDept = d;
    }
  });

  if (kpiTotal) kpiTotal.textContent = totalPrograms;
  if (kpiFiles) kpiFiles.textContent = totalFiles;
  if (kpiAvgScore) {
    kpiAvgScore.textContent = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) + ' / 100' : '-';
  }
  if (kpiTopDept) {
    kpiTopDept.textContent = topDept;
    kpiTopDept.title = topDept;
  }

  // Tampilkan Empty State jika kosong
  if (filteredEvidenceList.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Render Kartu Koleksi
  container.innerHTML = filteredEvidenceList.map((item, idx) => {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    const photoCount = Number(item.jumlahFile) || photos.length || 0;
    const catClass = (item.kategori || '').toLowerCase().includes('hard') ? 'hard-skill' : 'soft-skill';

    // Collage header HTML
    let coverHtml = '';
    if (photos.length >= 3) {
      coverHtml = `
        <div class="evidence-cover-collage" onclick="openEvidenceDetailModal('${escapeHtml(item.id)}')">
          <img src="${photos[0].dataUrl}" alt="Bukti 1" class="evidence-cover-thumb" onerror="this.src='https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400'">
          <img src="${photos[1].dataUrl}" alt="Bukti 2" class="evidence-cover-thumb" onerror="this.src='https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400'">
          <img src="${photos[2].dataUrl}" alt="Bukti 3" class="evidence-cover-thumb" onerror="this.src='https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400'">
        </div>
      `;
    } else if (photos.length > 0) {
      coverHtml = `
        <div style="width:100%;height:100%;cursor:pointer;" onclick="openEvidenceDetailModal('${escapeHtml(item.id)}')">
          <img src="${photos[0].dataUrl}" alt="Cover Bukti" class="evidence-cover-thumb" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `;
    } else {
      coverHtml = `
        <div class="evidence-cover-fallback" onclick="openEvidenceDetailModal('${escapeHtml(item.id)}')">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span style="font-size:12px;font-weight:600;">Dokumentasi Google Drive</span>
        </div>
      `;
    }

    const driveBtnHtml = item.folderUrl && item.folderUrl !== '-' ? `
      <a href="${escapeHtml(item.folderUrl)}" target="_blank" rel="noopener" class="btn-secondary" style="padding:6px 12px;font-size:12px;gap:5px;text-decoration:none;" title="Buka Folder Drive">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        <span>Drive</span>
      </a>
    ` : '';

    return `
      <div class="evidence-collection-card">
        <div class="evidence-card-cover">
          ${coverHtml}
          <div class="evidence-cover-overlay-tags">
            <span class="mini-pill" style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.9);color:var(--ink);box-shadow:var(--shadow-sm);">${escapeHtml(item.kategori || 'Soft skill')}</span>
            <span class="mini-pill approved" style="font-size:11px;padding:2px 8px;box-shadow:var(--shadow-sm);">Selesai</span>
          </div>
        </div>

        <div class="evidence-card-body">
          <h3 class="evidence-card-title">${escapeHtml(item.namaTraining)}</h3>
          
          <div class="evidence-card-meta">
            <span style="font-family:monospace;font-weight:700;color:var(--accent);">${escapeHtml(item.idTraining || 'TRN-XXXX')}</span>
            <span>&bull;</span>
            <span style="font-weight:600;color:var(--ink);">${escapeHtml(item.divisi || '-')}</span>
          </div>

          <div class="evidence-card-info-table">
            <div class="evidence-info-row">
              <span class="evidence-info-label">PIC / Peserta:</span>
              <span class="evidence-info-val">${escapeHtml(item.namaPeserta || '-')}</span>
            </div>
            <div class="evidence-info-row">
              <span class="evidence-info-label">Pelaksanaan:</span>
              <span class="evidence-info-val">${escapeHtml(item.tanggalTraining || item.waktuSubmit || '-')}</span>
            </div>
            <div class="evidence-info-row">
              <span class="evidence-info-label">Skor Post-Test:</span>
              <span class="evidence-info-val" style="color:${item.skorPostTest !== '-' ? '#16A34A' : 'var(--ink)'};font-weight:700;">
                ${escapeHtml(item.skorPostTest !== '-' ? item.skorPostTest + ' / 100' : 'Belum Diisi')}
              </span>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:4px;">
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--accent);background:rgba(63,90,68,0.08);padding:6px 12px;border-radius:8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              ${photoCount} Foto Dokumentasi
            </span>
          </div>
        </div>

        <div class="evidence-card-actions">
          <button type="button" class="btn-primary" onclick="openEvidenceDetailModal('${escapeHtml(item.id)}')" style="flex:1;justify-content:center;padding:10px 16px;font-size:13px;font-weight:600;border-radius:9px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <span>Lihat Galeri &amp; Bukti</span>
          </button>
          ${driveBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Membuka Modal Detail Evidence & Galeri Foto
 */
function openEvidenceDetailModal(evidenceId) {
  const item = allEvidenceList.find(e => String(e.id) === String(evidenceId));
  if (!item) return;

  currentViewingEvidence = item;

  const modal = document.getElementById('modalEvidenceDetail');
  if (!modal) return;

  document.getElementById('modalEvTitle').textContent = item.namaTraining || 'Dokumentasi Pelatihan';
  document.getElementById('modalEvId').textContent = item.idTraining || 'TRN-XXXX';
  document.getElementById('modalEvCat').textContent = item.kategori || 'Soft skill';
  document.getElementById('modalEvDivisi').textContent = item.divisi || '-';
  document.getElementById('modalEvUploader').textContent = item.namaPeserta || '-';
  document.getElementById('modalEvDate').textContent = item.waktuSubmit || '-';
  document.getElementById('modalEvScore').textContent = item.skorPostTest !== '-' ? `${item.skorPostTest} / 100` : 'Belum Ada Skor Post-Test';

  // Drive link banner
  const driveBanner = document.getElementById('modalEvDriveBanner');
  const driveLink = document.getElementById('modalEvDriveLink');
  if (driveBanner && driveLink) {
    if (item.folderUrl && item.folderUrl !== '-') {
      driveBanner.style.display = 'flex';
      driveLink.href = item.folderUrl;
    } else {
      driveBanner.style.display = 'none';
    }
  }

  // Galeri Foto
  const galleryGrid = document.getElementById('modalEvGalleryGrid');
  const photoCountEl = document.getElementById('modalEvPhotoCount');
  const photos = Array.isArray(item.photos) ? item.photos : [];
  if (photoCountEl) photoCountEl.textContent = Number(item.jumlahFile) || photos.length || 0;

  if (galleryGrid) {
    if (photos.length > 0) {
      galleryGrid.innerHTML = photos.map((p, i) => `
        <div class="evidence-gallery-item" onclick="openEvidenceLightbox('${escapeHtml(p.dataUrl || p.url)}', '${escapeHtml(p.name || `Foto ${i + 1}`)}')">
          <img src="${escapeHtml(p.dataUrl || p.url)}" alt="${escapeHtml(p.name || 'Bukti')}" loading="lazy">
          <div class="evidence-gallery-zoom-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </div>
        </div>
      `).join('');
    } else {
      galleryGrid.innerHTML = `
        <div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--ink-soft);font-size:13px;background:rgba(0,0,0,0.02);border:1px dashed var(--line);border-radius:8px;">
          Foto asli tersimpan di folder Google Drive. Silahkan klik tombol "Buka Folder Drive" di atas untuk meninjau seluruh foto resolusi penuh.
        </div>
      `;
    }
  }

  // Catatan Post-Test
  const catatanWrap = document.getElementById('modalEvCatatanWrap');
  const catatanEl = document.getElementById('modalEvCatatan');
  if (catatanWrap && catatanEl) {
    if (item.catatan && item.catatan !== '-') {
      catatanWrap.style.display = 'block';
      catatanEl.textContent = item.catatan;
    } else {
      catatanWrap.style.display = 'none';
    }
  }

  // Rincian File List
  const fileListWrap = document.getElementById('modalEvFileListWrap');
  const fileListEl = document.getElementById('modalEvFileList');
  if (fileListWrap && fileListEl) {
    if (item.detailFile && item.detailFile !== '-') {
      fileListWrap.style.display = 'block';
      fileListEl.textContent = item.detailFile;
    } else {
      fileListWrap.style.display = 'none';
    }
  }

  modal.classList.add('active');
}
window.openEvidenceDetailModal = openEvidenceDetailModal;

/**
 * Menutup Modal Detail Evidence
 */
function closeEvidenceDetailModal() {
  const modal = document.getElementById('modalEvidenceDetail');
  if (modal) modal.classList.remove('active');
  currentViewingEvidence = null;
}
window.closeEvidenceDetailModal = closeEvidenceDetailModal;

/**
 * Lightbox Zoom Foto Resolusi Penuh
 */
function openEvidenceLightbox(imgSrc, caption) {
  const lb = document.getElementById('modalEvidenceLightbox');
  const img = document.getElementById('evidenceLightboxImg');
  const cap = document.getElementById('evidenceLightboxCaption');
  if (!lb || !img) return;

  img.src = imgSrc;
  if (cap) cap.textContent = caption || '';
  lb.classList.add('active');
}
window.openEvidenceLightbox = openEvidenceLightbox;

function closeEvidenceLightbox() {
  const lb = document.getElementById('modalEvidenceLightbox');
  if (lb) lb.classList.remove('active');
}
window.closeEvidenceLightbox = closeEvidenceLightbox;

/**
 * Membuka modal review proposal awal dari dokumen evidence
 */
function openReviewModalFromEvidence() {
  if (!currentViewingEvidence) return;
  const trainingName = (currentViewingEvidence.namaTraining || '').toLowerCase().trim();
  const targetId = currentViewingEvidence.idTraining;

  closeEvidenceDetailModal();

  // Cari di allSubmissions
  const matched = allSubmissions.find(s => {
    if (targetId && targetId !== 'TRN-XXXX' && String(s.id).trim().toUpperCase() === String(targetId).trim().toUpperCase()) {
      return true;
    }
    const sName = (s.judul || (s.meta && s.meta['Nama training']) || '').toLowerCase().trim();
    return sName === trainingName;
  });

  if (matched) {
    setTimeout(() => {
      openReviewModal(matched.id);
    }, 100);
  } else {
    showToast(`Dokumen pengajuan awal untuk "${currentViewingEvidence.namaTraining}" tidak ditemukan di database.`, 'info');
  }
}
window.openReviewModalFromEvidence = openReviewModalFromEvidence;

// ==============================================================================
// 17. OFFICIAL AUTHORIZATION SHEET (LEMBAR OTORISASI FORMAL A4) & PRINT LOGIC
// ==============================================================================

/**
 * Menyusun struktur HTML dokumen Lembar Otorisasi Pelatihan berstandar formal A4
 * @param {Object} item Data pengajuan dari allSubmissions atau currentReviewItem
 * @returns {string} String HTML dokumen formal
 */
function buildAuthSheetHtml(item) {
  if (!item) return '<div style="padding:20px;text-align:center;">Data pengajuan tidak valid.</div>';

  const raw = item.rawEntry || {};
  const meta = raw.meta || {};
  const participants = Array.isArray(raw.participants) ? raw.participants : [];
  const modules = Array.isArray(raw.modules) ? raw.modules : [];
  const approvals = Array.isArray(raw.approvals) ? raw.approvals : [];

  const trainingId = item.id || meta['ID training'] || 'TRN-XXXX';
  const trainingName = item.judul || item.namaTraining || meta['Nama training'] || 'Program Pelatihan Karyawan';
  const leaderName = item.pengaju || meta['Leader pengaju'] || '-';
  const deptName = item.departemen || item.divisi || meta['Departemen / divisi'] || '-';
  const skillCategory = item.kategori || meta['Kategori'] || 'Soft skill';
  const skillLevel = item.level || meta['Target level kemahiran'] || 'All Level';
  const method = meta['Metode training'] || (item.venue && item.venue.toLowerCase().includes('meet') ? 'Online' : 'Onsite');
  const venue = item.venue || meta['Lokasi / venue'] || meta['Platform online'] || '-';
  const trainer = item.trainer || meta['Trainer'] || '-';
  const duration = item.durasi || meta['Total durasi belajar'] || '-';
  const schedule = item.jadwal || meta['Tanggal & jam pelaksanaan'] || item.waktu || '-';

  // Purpose & Goals
  const purpose = meta['Purpose / latar belakang'] || meta['Purpose'] || '-';
  const goals = meta['Goals / tujuan terukur'] || meta['Goals'] || '-';

  // Budget
  const estCost = item.budget || meta['Estimasi biaya'] || 'Rp 0';
  const apprBudget = item.budgetDisetujui || meta['Budget disetujui'] || estCost;
  const feeTrainer = meta['Fee trainer / instruktur'] || '-';
  const feeKonsumsi = meta['Konsumsi peserta'] || '-';
  const feeMateri = meta['Materi / modul pelatihan'] || '-';
  const feeVenue = meta['Sewa venue / ruangan'] || '-';
  const feeLain = meta['Lain-lain'] || '-';

  // Status handling
  const statusStr = String(item.status || 'Pending').trim();
  const isApproved = statusStr.toLowerCase().includes('approv');
  const isRejected = statusStr.toLowerCase().includes('reject') || statusStr.toLowerCase().includes('tolak');

  let stampClass = 'pending';
  let stampText = 'DALAM PROSES / PENDING';
  let badgeClass = 'pending';
  let badgeText = 'MENUNGGU / PENDING';

  if (isApproved) {
    stampClass = 'approved';
    stampText = 'DISETUJUI / APPROVED';
    badgeClass = 'approved';
    badgeText = 'DISANGGUPI / APPROVED';
  } else if (isRejected) {
    stampClass = 'rejected';
    stampText = 'DITOLAK / REJECTED';
    badgeClass = 'rejected';
    badgeText = 'DITOLAK / REJECTED';
  }

  // QR Code URL (SVG / High-Res PNG)
  const qrDataText = `TDS-AUTH|ID:${trainingId}|STATUS:${statusStr}|APPR:${item.approver || 'PENDING'}|DATE:${item.tanggalApproval || item.waktu || ''}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(qrDataText)}`;

  // Approver Data
  const approverName = (item.approver && item.approver !== '-') ? item.approver : (isApproved ? 'Tim Otorisasi HR / GM' : '-');
  const approvalDate = (item.tanggalApproval && item.tanggalApproval !== '-') ? item.tanggalApproval : (isApproved ? 'Telah Disetujui' : '-');
  const submitDate = item.waktu || meta['Waktu submit'] || 'Tercatat di Sistem';

  // Participants Table
  let participantsRows = '';
  if (participants.length > 0) {
    participantsRows = participants.map((p, idx) => `
      <tr>
        <td style="text-align:center;width:32px;">${idx + 1}</td>
        <td style="font-weight:600;">${escapeHtml(p.nama || p.name || '-')}</td>
        <td>${escapeHtml(p.email || '-')}</td>
        <td>${escapeHtml(p.departemen || p.divisi || deptName)}</td>
      </tr>
    `).join('');
  } else {
    participantsRows = `<tr><td colspan="4" style="text-align:center;font-style:italic;color:#6B7264;padding:10px;">Daftar peserta terdaftar: ${escapeHtml(raw['Jumlah Peserta Terdaftar'] || '1')} Orang</td></tr>`;
  }

  // Modules Table
  let modulesRows = '';
  if (modules.length > 0) {
    modulesRows = modules.map((m, idx) => `
      <tr>
        <td style="text-align:center;width:32px;">${idx + 1}</td>
        <td style="font-weight:600;">${escapeHtml(m.modul || m.namaModul || `Sesi ${idx + 1}`)}</td>
        <td>${escapeHtml(m.tanggal || schedule)}</td>
        <td>${escapeHtml(m.jamMulai && m.jamSelesai ? `${m.jamMulai} - ${m.jamSelesai}` : (m.durasi || '-'))}</td>
        <td>${escapeHtml(m.pic || trainer)}</td>
      </tr>
    `).join('');
  } else {
    modulesRows = `
      <tr>
        <td style="text-align:center;">1</td>
        <td style="font-weight:600;">Pelaksanaan Utama (${escapeHtml(trainingName)})</td>
        <td>${escapeHtml(schedule)}</td>
        <td>${escapeHtml(duration)}</td>
        <td>${escapeHtml(trainer)}</td>
      </tr>
    `;
  }

  return `
    <div class="auth-sheet-top-rule">
      <div class="auth-sheet-brand">
        <img src="../favicon/logo.svg" alt="TDS" class="auth-sheet-logo" onerror="this.src='../favicon/apple-touch-icon.png'">
        <div>
          <div class="auth-sheet-org-name">Training &amp; Development System &bull; Human Capital</div>
          <div class="auth-sheet-doc-title">LEMBAR PERSETUJUAN &amp; OTORISASI PELATIHAN</div>
          <div class="auth-sheet-doc-sub">Internal Employee Development &amp; Training Plan Authorization</div>
        </div>
      </div>
      <div class="auth-sheet-stamp-box">
        <div class="auth-sheet-stamp-badge ${badgeClass}">${badgeText}</div>
        <div class="auth-sheet-doc-meta">NO. DOKUMEN: <strong>${escapeHtml(trainingId)}</strong></div>
      </div>
    </div>

    <!-- 1. PROFIL PROGRAM -->
    <div class="auth-sheet-sec-title">1. Profil Program Pelatihan</div>
    <table class="auth-sheet-meta-table">
      <tr>
        <td class="lbl">Nama Training:</td>
        <td class="val" colspan="3" style="font-size:13px;font-weight:700;color:var(--moss,#3F5A44);">${escapeHtml(trainingName)}</td>
      </tr>
      <tr>
        <td class="lbl">Leader Pengaju:</td>
        <td class="val">${escapeHtml(leaderName)}</td>
        <td class="lbl">Departemen / Divisi:</td>
        <td class="val">${escapeHtml(deptName)}</td>
      </tr>
      <tr>
        <td class="lbl">Kategori &amp; Level:</td>
        <td class="val">${escapeHtml(skillCategory)} &bull; ${escapeHtml(skillLevel)}</td>
        <td class="lbl">Metode &amp; Durasi:</td>
        <td class="val">${escapeHtml(method)} &bull; ${escapeHtml(duration)}</td>
      </tr>
      <tr>
        <td class="lbl">Trainer / Fasilitator:</td>
        <td class="val">${escapeHtml(trainer)}</td>
        <td class="lbl">Lokasi / Platform:</td>
        <td class="val">${escapeHtml(venue)}</td>
      </tr>
    </table>

    <!-- 2. SASARAN & TUJUAN -->
    <div class="auth-sheet-sec-title">2. Latar Belakang &amp; Sasaran Pelatihan</div>
    <div class="auth-sheet-box-text">
      <div style="margin-bottom:6px;"><strong>Latar Belakang &amp; Urgensi:</strong> ${escapeHtml(purpose)}</div>
      <div><strong>Tujuan Terukur (KPI / Goals):</strong> ${escapeHtml(goals)}</div>
    </div>

    <!-- 3. RANGKAIAN MODUL -->
    <div class="auth-sheet-sec-title">3. Rangkaian Modul Pelatihan</div>
    <table class="auth-sheet-data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Modul / Materi Pelatihan</th>
          <th>Tanggal</th>
          <th>Waktu / Durasi</th>
          <th>Trainer / PIC</th>
        </tr>
      </thead>
      <tbody>
        ${modulesRows}
      </tbody>
    </table>

    <!-- 4. DAFTAR PESERTA -->
    <div class="auth-sheet-sec-title">4. Daftar Peserta Terdaftar (${participants.length || raw['Jumlah Peserta Terdaftar'] || 1} Peserta)</div>
    <table class="auth-sheet-data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Nama Lengkap Peserta</th>
          <th>Email Kantor</th>
          <th>Divisi / Departemen</th>
        </tr>
      </thead>
      <tbody>
        ${participantsRows}
      </tbody>
    </table>

    <!-- 5. RINCIAN ANGGARAN -->
    <div class="auth-sheet-sec-title">5. Rincian Anggaran &amp; Komitmen Biaya</div>
    <table class="auth-sheet-data-table">
      <thead>
        <tr>
          <th>Komponen Biaya</th>
          <th>Keterangan / Breakdown</th>
          <th style="text-align:right;">Nominal (Rp)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Fee Trainer / Instruktur</td>
          <td>Narasumber &amp; Sertifikasi Trainer</td>
          <td style="text-align:right;">${escapeHtml(feeTrainer !== '-' ? feeTrainer : estCost)}</td>
        </tr>
        ${feeKonsumsi !== '-' ? `<tr><td>Konsumsi Peserta</td><td>Konsumsi &amp; Refreshment Sesi</td><td style="text-align:right;">${escapeHtml(feeKonsumsi)}</td></tr>` : ''}
        ${feeMateri !== '-' ? `<tr><td>Materi &amp; Ujian Modul</td><td>Modul Fisik / Digital &amp; Lab Praktik</td><td style="text-align:right;">${escapeHtml(feeMateri)}</td></tr>` : ''}
        ${feeVenue !== '-' ? `<tr><td>Ruangan / Venue</td><td>Sewa Ruangan / Fasilitas Onsite</td><td style="text-align:right;">${escapeHtml(feeVenue)}</td></tr>` : ''}
        ${feeLain !== '-' ? `<tr><td>Biaya Lain-lain</td><td>Operasional Tambahan</td><td style="text-align:right;">${escapeHtml(feeLain)}</td></tr>` : ''}
        <tr style="background:#F2F4F0;font-weight:700;">
          <td colspan="2" style="text-align:right;text-transform:uppercase;">Total Komitmen Budget:</td>
          <td style="text-align:right;color:var(--moss,#3F5A44);font-size:12.5px;">${escapeHtml(apprBudget)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 6. MATRIKS TANDA TANGAN OTORISASI -->
    <div class="auth-sheet-sec-title">6. Matriks Otorisasi &amp; Tanda Tangan Digital</div>
    <div class="auth-sig-matrix">
      <!-- 1. Leader Pengaju -->
      <div class="auth-sig-col">
        <div class="auth-sig-role">1. Pemohon (Leader)</div>
        <div class="auth-sig-space">
          <div class="auth-sig-stamp-digital">TERDAFTAR &bull; DIAJUKAN</div>
        </div>
        <div class="auth-sig-name">${escapeHtml(leaderName)}</div>
        <div class="auth-sig-date">${escapeHtml(submitDate)}</div>
      </div>

      <!-- 2. Direct Supervisor -->
      <div class="auth-sig-col">
        <div class="auth-sig-role">2. Direct Supervisor</div>
        <div class="auth-sig-space">
          <div class="auth-sig-stamp-digital ${stampClass}">${isApproved ? 'VERIFIED' : (isRejected ? 'REJECTED' : 'PENDING')}</div>
        </div>
        <div class="auth-sig-name">${approvals[0] ? escapeHtml(approvals[0].nama || approvals[0].role) : (isApproved ? 'Atasan Langsung' : 'Belum Diverifikasi')}</div>
        <div class="auth-sig-date">${approvals[0] && approvals[0].tanggal ? escapeHtml(approvals[0].tanggal) : (isApproved ? escapeHtml(approvalDate) : 'Menunggu Verifikasi')}</div>
      </div>

      <!-- 3. Approver Management / HR -->
      <div class="auth-sig-col">
        <div class="auth-sig-role">3. Otorisasi (HR / GM)</div>
        <div class="auth-sig-space">
          <div class="auth-sig-stamp-digital ${stampClass}">${stampText}</div>
        </div>
        <div class="auth-sig-name">${approverName !== '-' ? escapeHtml(approverName) : (isRejected ? 'Ditolak Tanpa Otorisasi' : 'Belum Ditandatangani')}</div>
        <div class="auth-sig-date">${approvalDate !== '-' ? escapeHtml(approvalDate) : 'Menunggu Keputusan'}</div>
      </div>
    </div>

    <!-- 7. FOOTER AUDIT & QR CODE -->
    <div class="auth-sheet-footer">
      <div class="auth-sheet-qr-box">
        <img src="${qrCodeUrl}" alt="QR Verifikasi" class="auth-sheet-qr-img" onerror="this.style.display='none'">
        <div>
          <div style="font-weight:700;font-size:11px;color:#1F2421;margin-bottom:2px;">VERIFIKASI KEABSAHAN DOKUMEN OTORISASI</div>
          <div style="font-size:10px;color:#6B7264;font-family:monospace;">ID: ${escapeHtml(trainingId)} &bull; STATUS: ${escapeHtml(statusStr)}</div>
        </div>
      </div>
      <div class="auth-sheet-legal-text">
        Dokumen ini diterbitkan secara otomatis oleh Training &amp; Development System (TDS). Berkas ini memiliki kekuatan pembuktian otorisasi internal yang sah untuk keperluan audit, pelaksanaan pelatihan, dan pencairan anggaran.
      </div>
    </div>
  `;
}

/**
 * Membuka Modal Pratinjau Lembar Otorisasi berdasarkan ID Training
 * @param {string} trainingId ID Pelatihan
 */
function openAuthSheetModal(trainingId) {
  let item = null;
  if (trainingId) {
    const cleanId = String(trainingId).trim().toUpperCase();
    item = allSubmissions.find(s => s && s.id && String(s.id).trim().toUpperCase() === cleanId);
  }
  if (!item && currentReviewItem) {
    item = currentReviewItem;
  }
  if (!item) {
    showToast('Dokumen pengajuan training tidak ditemukan.', 'warning');
    return;
  }

  const printArea = document.getElementById('authSheetPrintArea');
  const modal = document.getElementById('modalAuthSheetPreview');
  if (!printArea || !modal) return;

  printArea.innerHTML = buildAuthSheetHtml(item);
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Listener keyboard Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeAuthSheetModal();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);
}

/**
 * Pemicu pratinjau lembar otorisasi dari submission yang sedang aktif dibuka di modal review
 */
function openAuthSheetFromCurrentReview() {
  if (currentReviewItem) {
    openAuthSheetModal(currentReviewItem.id);
  } else {
    showToast('Silahkan pilih salah satu pengajuan untuk melihat lembar otorisasi.', 'info');
  }
}

/**
 * Menutup Modal Pratinjau Lembar Otorisasi
 */
function closeAuthSheetModal() {
  const modal = document.getElementById('modalAuthSheetPreview');
  if (modal) {
    modal.style.display = 'none';
    const reviewModal = document.getElementById('modalReviewApproval');
    if (!reviewModal || !reviewModal.classList.contains('active')) {
      document.body.style.overflow = '';
    }
  }
}

/**
 * Memicu dialog cetak / Simpan PDF native browser
 */
function printAuthSheet() {
  window.print();
}

// Ekspor ke window scope
window.buildAuthSheetHtml = buildAuthSheetHtml;
window.openAuthSheetModal = openAuthSheetModal;
window.openAuthSheetFromCurrentReview = openAuthSheetFromCurrentReview;
window.closeAuthSheetModal = closeAuthSheetModal;
window.printAuthSheet = printAuthSheet;


