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
const totalSteps = 2;
let participantCounter = 0;
let moduleCounter = 0;
let approvalCounter = 0;
let vendorCounter = 0;
let pendingSubmitData = null;

// ==========================================
// Custom Date Picker Component (Notion / Linear Style Popover)
// ==========================================
const datePickerState = {};

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Pilih tanggal';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${day} ${monthNames[month] || ''} ${year}`;
}
window.formatDisplayDate = formatDisplayDate;

function setDatePickerValue(fieldId, dateStr) {
  const input = document.getElementById(fieldId);
  const display = document.getElementById(fieldId + '_display');
  if (input) {
    input.value = dateStr || '';
    input.setAttribute('value', dateStr || '');
  }
  if (display) {
    display.textContent = formatDisplayDate(dateStr);
  }
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      datePickerState[fieldId] = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  }
}
window.setDatePickerValue = setDatePickerValue;

function toggleDatePicker(fieldId) {
  const popover = document.getElementById(fieldId + '_popover');
  const wrap = popover?.closest('.date-picker-wrap');
  if (!popover) return;
  const isOpen = popover.style.display !== 'none';
  
  // Close all other open popovers
  document.querySelectorAll('.date-picker-popover').forEach(p => {
    p.style.display = 'none';
    p.closest('.date-picker-wrap')?.classList.remove('open');
  });

  if (!isOpen) {
    const existingVal = document.getElementById(fieldId)?.value;
    if (existingVal) {
      const parts = existingVal.split('-');
      if (parts.length === 3) {
        datePickerState[fieldId] = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        datePickerState[fieldId] = new Date();
      }
    } else if (!datePickerState[fieldId]) {
      datePickerState[fieldId] = new Date();
    }

    if (wrap) wrap.classList.add('open');
    popover.style.display = 'block';
    renderDatePicker(fieldId);

    // Smart positioning if inside table to prevent clipping by overflow-x: auto
    const trigger = wrap?.querySelector('.date-picker-trigger');
    if (trigger && popover.closest('table')) {
      const rect = trigger.getBoundingClientRect();
      popover.style.position = 'fixed';
      popover.style.zIndex = '9999';
      let top = rect.bottom + 6;
      let left = rect.left;
      if (top + 340 > window.innerHeight && rect.top > 350) {
        top = rect.top - 340;
      }
      if (left + 310 > window.innerWidth) {
        left = Math.max(10, window.innerWidth - 320);
      }
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    } else {
      popover.style.position = 'absolute';
      popover.style.zIndex = '100';
      popover.style.top = 'calc(100% + 8px)';
      popover.style.left = '0';
    }
  }
}
window.toggleDatePicker = toggleDatePicker;

function renderDatePicker(fieldId) {
  const popover = document.getElementById(fieldId + '_popover');
  if (!popover) return;
  const viewDate = datePickerState[fieldId] || new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const selectedVal = document.getElementById(fieldId)?.value || '';
  let selYear = -1, selMonth = -1, selDay = -1;
  if (selectedVal) {
    const parts = selectedVal.split('-');
    if (parts.length === 3) {
      selYear = parseInt(parts[0], 10);
      selMonth = parseInt(parts[1], 10) - 1;
      selDay = parseInt(parts[2], 10);
    }
  }

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let daysHtml = '';
  // Days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const prevD = daysInPrevMonth - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYearVal = month === 0 ? year - 1 : year;
    daysHtml += `<button type="button" class="dp-day outside-month" onclick="selectDate('${fieldId}', ${prevYearVal}, ${prevMonthIdx}, ${prevD})">${prevD}</button>`;
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const classes = ['dp-day'];
    if (year === todayYear && month === todayMonth && d === todayDate) classes.push('today');
    if (year === selYear && month === selMonth && d === selDay) classes.push('selected');
    daysHtml += `<button type="button" class="${classes.join(' ')}" onclick="selectDate('${fieldId}', ${year}, ${month}, ${d})">${d}</button>`;
  }
  // Days of next month to fill 7-col grid
  const totalCells = startOffset + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYearVal = month === 11 ? year + 1 : year;
    daysHtml += `<button type="button" class="dp-day outside-month" onclick="selectDate('${fieldId}', ${nextYearVal}, ${nextMonthIdx}, ${d})">${d}</button>`;
  }

  popover.innerHTML = `
    <div class="dp-header">
      <button type="button" class="dp-nav-btn" onclick="shiftDatePickerMonth('${fieldId}', -1)" title="Bulan sebelumnya" aria-label="Bulan sebelumnya">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <span class="dp-title">${monthNames[month]} ${year}</span>
      <button type="button" class="dp-nav-btn" onclick="shiftDatePickerMonth('${fieldId}', 1)" title="Bulan berikutnya" aria-label="Bulan berikutnya">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
    <div class="dp-weekdays"><span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span></div>
    <div class="dp-days">${daysHtml}</div>
    <div class="dp-footer">
      <button type="button" class="dp-footer-btn dp-btn-clear" onclick="clearDatePicker('${fieldId}')">Hapus</button>
      <button type="button" class="dp-footer-btn dp-btn-today" onclick="selectToday('${fieldId}')">Hari Ini</button>
    </div>
  `;
}
window.renderDatePicker = renderDatePicker;

function shiftDatePickerMonth(fieldId, delta) {
  const d = datePickerState[fieldId] || new Date();
  datePickerState[fieldId] = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  renderDatePicker(fieldId);
}
window.shiftDatePickerMonth = shiftDatePickerMonth;

function selectDate(fieldId, year, month, day) {
  const mStr = String(month + 1).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const iso = `${year}-${mStr}-${dStr}`;
  const input = document.getElementById(fieldId);
  if (input) {
    input.value = iso;
    input.setAttribute('value', iso);
  }
  datePickerState[fieldId] = new Date(year, month, day);

  const displayEl = document.getElementById(fieldId + '_display');
  if (displayEl) {
    displayEl.textContent = formatDisplayDate(iso);
  }
  const popover = document.getElementById(fieldId + '_popover');
  if (popover) {
    popover.style.display = 'none';
    popover.closest('.date-picker-wrap')?.classList.remove('open');
  }
  if (input) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
window.selectDate = selectDate;

function selectToday(fieldId) {
  const t = new Date();
  selectDate(fieldId, t.getFullYear(), t.getMonth(), t.getDate());
}
window.selectToday = selectToday;

function clearDatePicker(fieldId) {
  const input = document.getElementById(fieldId);
  if (input) {
    input.value = '';
    input.setAttribute('value', '');
  }
  const displayEl = document.getElementById(fieldId + '_display');
  if (displayEl) {
    displayEl.textContent = 'Pilih tanggal';
  }
  const popover = document.getElementById(fieldId + '_popover');
  if (popover) {
    popover.style.display = 'none';
    popover.closest('.date-picker-wrap')?.classList.remove('open');
  }
  datePickerState[fieldId] = new Date();
  if (input) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
window.clearDatePicker = clearDatePicker;

// ==========================================
// Custom Time Picker Component (Antislop Popover Style)
// ==========================================
const timePickerState = {};

const TIME_PRESETS = [
  { t: '08:00', label: 'Pagi' },
  { t: '09:00', label: 'Standar' },
  { t: '10:00', label: 'Sesi 2' },
  { t: '12:00', label: 'Ishoma' },
  { t: '13:00', label: 'Siang' },
  { t: '15:00', label: 'Sore 1' },
  { t: '16:00', label: 'Sore 2' },
  { t: '17:00', label: 'Selesai' }
];

const TIME_HOURS = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
const TIME_MINUTES = ['00', '15', '30', '45', '10', '20', '40', '50'];

function toggleTimePicker(targetInputOrId, event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  let input = typeof targetInputOrId === 'string' ? document.getElementById(targetInputOrId) : targetInputOrId;
  if (!input) return;

  const fieldId = input.id || ('tp_' + Math.random().toString(36).substring(2, 9));
  if (!input.id) input.id = fieldId;

  // Tutup date picker yang sedang terbuka
  document.querySelectorAll('.date-picker-popover').forEach(p => {
    p.style.display = 'none';
    p.closest('.date-picker-wrap')?.classList.remove('open');
  });

  // Ambil elemen popover atau buat jika belum ada
  let popover = document.getElementById(fieldId + '_popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = fieldId + '_popover';
    popover.className = 'time-picker-popover';
    const wrap = input.closest('.datetime-field-wrap') || input.parentElement;
    wrap.appendChild(popover);
  }

  const isCurrentlyOpen = popover.style.display === 'block';

  // Tutup semua time picker popover
  document.querySelectorAll('.time-picker-popover').forEach(p => {
    p.style.display = 'none';
    p.closest('.datetime-field-wrap')?.classList.remove('open');
  });

  // Jika sebelumnya terbuka, aksi toggle adalah menutupnya
  if (isCurrentlyOpen) {
    return;
  }

  const currentVal = input.value || '09:00';
  let [hh, mm] = currentVal.split(':');
  hh = hh ? hh.padStart(2, '0') : '09';
  mm = mm ? mm.padStart(2, '0') : '00';
  timePickerState[fieldId] = { hour: hh, minute: mm };

  renderTimePicker(fieldId);
  popover.style.display = 'block';
  input.closest('.datetime-field-wrap')?.classList.add('open');

  // Posisi cerdas jika di dalam tabel/card yang dapat di-scroll
  if (popover.closest('table') || popover.closest('.tbl-wrap') || popover.closest('.session-card')) {
    const rect = input.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.zIndex = '9999';
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + 280 > window.innerHeight && rect.top > 290) {
      top = rect.top - 280;
    }
    if (left + 290 > window.innerWidth) {
      left = Math.max(10, window.innerWidth - 300);
    }
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  } else {
    popover.style.position = 'absolute';
    popover.style.zIndex = '250';
    popover.style.top = 'calc(100% + 6px)';
    popover.style.left = '0';
  }
}
window.toggleTimePicker = toggleTimePicker;

function renderTimePicker(fieldId) {
  const popover = document.getElementById(fieldId + '_popover');
  if (!popover) return;
  const state = timePickerState[fieldId] || { hour: '09', minute: '00' };
  const currentVal = `${state.hour}:${state.minute}`;

  let presetsHtml = '';
  TIME_PRESETS.forEach(p => {
    const isSel = p.t === currentVal;
    presetsHtml += `
      <button type="button" class="tp-preset-btn ${isSel ? 'selected' : ''}" onclick="selectTimeValue('${fieldId}', '${p.t}')">
        <span class="tp-preset-time">${p.t}</span>
        <span class="tp-preset-desc">${p.label}</span>
      </button>
    `;
  });

  let hoursHtml = '';
  TIME_HOURS.forEach(h => {
    const isSel = h === state.hour;
    hoursHtml += `<button type="button" class="tp-chip-btn ${isSel ? 'selected' : ''}" onclick="selectTimeHour('${fieldId}', '${h}')">${h}</button>`;
  });

  let minsHtml = '';
  TIME_MINUTES.forEach(m => {
    const isSel = m === state.minute;
    minsHtml += `<button type="button" class="tp-chip-btn ${isSel ? 'selected' : ''}" onclick="selectTimeMinute('${fieldId}', '${m}')">${m}</button>`;
  });

  popover.innerHTML = `
    <div class="tp-header">
      <div class="tp-preview-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span class="tp-preview-time" id="${fieldId}_preview">${currentVal}</span>
        <span class="tp-preview-badge">WIB</span>
      </div>
      <button type="button" class="tp-close-btn" onclick="closeTimePicker('${fieldId}')" title="Selesai &amp; Tutup" aria-label="Tutup">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div style="margin-bottom:12px;">
      <div class="tp-section-label">Pilihan Cepat</div>
      <div class="tp-presets-grid">${presetsHtml}</div>
    </div>

    <div>
      <div class="tp-section-label">Kustom Waktu</div>
      <div class="tp-custom-grid">
        <div class="tp-hours-row" style="margin-bottom:6px;">
          <span class="tp-sub-label">Jam</span>
          <div class="tp-chips-scroll">${hoursHtml}</div>
        </div>
        <div class="tp-mins-row">
          <span class="tp-sub-label">Menit</span>
          <div class="tp-chips-scroll">${minsHtml}</div>
        </div>
      </div>
    </div>

    <div class="dp-footer">
      <button type="button" class="dp-footer-btn dp-btn-clear" onclick="selectTimeValue('${fieldId}', '09:00')">Reset (09:00)</button>
      <button type="button" class="dp-footer-btn dp-btn-today" onclick="closeTimePicker('${fieldId}')">Terapkan</button>
    </div>
  `;
}
window.renderTimePicker = renderTimePicker;

function selectTimeValue(fieldId, timeStr) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const [hh, mm] = timeStr.split(':');
  timePickerState[fieldId] = { hour: hh, minute: mm };
  input.value = timeStr;
  input.setAttribute('value', timeStr);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeTimePicker(fieldId);
}
window.selectTimeValue = selectTimeValue;

function selectTimeHour(fieldId, h) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const state = timePickerState[fieldId] || { hour: '09', minute: '00' };
  state.hour = h;
  timePickerState[fieldId] = state;
  const newVal = `${state.hour}:${state.minute}`;
  input.value = newVal;
  input.setAttribute('value', newVal);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  renderTimePicker(fieldId);
}
window.selectTimeHour = selectTimeHour;

function selectTimeMinute(fieldId, m) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const state = timePickerState[fieldId] || { hour: '09', minute: '00' };
  state.minute = m;
  timePickerState[fieldId] = state;
  const newVal = `${state.hour}:${state.minute}`;
  input.value = newVal;
  input.setAttribute('value', newVal);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  renderTimePicker(fieldId);
}
window.selectTimeMinute = selectTimeMinute;

function closeTimePicker(fieldId) {
  const popover = document.getElementById(fieldId + '_popover');
  if (popover) {
    popover.style.display = 'none';
    popover.closest('.datetime-field-wrap')?.classList.remove('open');
  }
}
window.closeTimePicker = closeTimePicker;

// Pengikatan listener klik langsung ke seluruh field waktu & ikon prefix
function bindAllTimePickers() {
  document.querySelectorAll('.datetime-field-wrap').forEach(wrap => {
    const input = wrap.querySelector('input[type="time"], input[type="text"]');
    if (input && !input.dataset.tpBound) {
      input.dataset.tpBound = 'true';
      input.addEventListener('click', function(e) {
        toggleTimePicker(this, e);
      });
    }
    const icon = wrap.querySelector('.datetime-prefix-icon');
    if (icon && !icon.dataset.tpBound) {
      icon.dataset.tpBound = 'true';
      icon.addEventListener('click', function(e) {
        const inp = this.closest('.datetime-field-wrap')?.querySelector('input');
        if (inp) toggleTimePicker(inp, e);
      });
    }
  });

  // Untuk baris sesi dinamis
  document.querySelectorAll('.session-edit-start, .session-edit-end').forEach(input => {
    if (!input.dataset.tpBound) {
      input.dataset.tpBound = 'true';
      input.addEventListener('click', function(e) {
        toggleTimePicker(this, e);
      });
    }
  });
}
window.bindAllTimePickers = bindAllTimePickers;

// Tutup popover jika pengguna mengklik di luar area picker
document.addEventListener('click', function(e) {
  // Jangan tutup jika klik terjadi di dalam popover itu sendiri
  if (e.target.closest('.date-picker-popover') || e.target.closest('.time-picker-popover')) {
    return;
  }

  // Tutup Date Picker jika klik di luar
  if (!e.target.closest('.date-picker-wrap')) {
    document.querySelectorAll('.date-picker-popover').forEach(p => {
      p.style.display = 'none';
      p.closest('.date-picker-wrap')?.classList.remove('open');
    });
  }

  // Tutup Time Picker jika klik di luar
  if (!e.target.closest('.datetime-field-wrap') && !e.target.closest('.session-time-inputs-wrap')) {
    document.querySelectorAll('.time-picker-popover').forEach(p => {
      p.style.display = 'none';
      p.closest('.datetime-field-wrap')?.classList.remove('open');
    });
  }
});

// Jalankan pengikatan awal saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAllTimePickers);
} else {
  bindAllTimePickers();
}

// Tutup popover fixed saat scroll agar tidak lepas posisi
window.addEventListener('scroll', function() {
  document.querySelectorAll('.date-picker-popover, .time-picker-popover').forEach(p => {
    if (p.style.display !== 'none' && p.style.position === 'fixed') {
      p.style.display = 'none';
      p.closest('.date-picker-wrap, .datetime-field-wrap')?.classList.remove('open');
    }
  });
}, true);

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

  // Trigger resize event after transition so charts, tables & FullCalendar adapt
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

  // Apply saved state immediately if desktop screen (> 768px)
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

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Set default today's date for Tanggal Pengajuan & Pelaksanaan
  const today = new Date().toISOString().split('T')[0];
  const tglPengajuan = document.getElementById('tglPengajuan');
  if (tglPengajuan && !tglPengajuan.value) {
    setDatePickerValue('tglPengajuan', today);
  } else if (tglPengajuan && tglPengajuan.value) {
    setDatePickerValue('tglPengajuan', tglPengajuan.value);
  }
  const tglPelaksanaan = document.getElementById('tglPelaksanaan');
  if (tglPelaksanaan && tglPelaksanaan.value) {
    setDatePickerValue('tglPelaksanaan', tglPelaksanaan.value);
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

  // 4. Seed clean initial rows & pre-generate Google Meet link
  addModule();
  updateParticipantCount();
  setupDirectTablePaste();
  const initialMeetingUrl = document.getElementById('meetingUrl');
  if (initialMeetingUrl && !initialMeetingUrl.value) {
    const defaultMeetLink = `https://meet.google.com/${generateGoogleMeetCode()}`;
    initialMeetingUrl.value = defaultMeetLink;
    initialMeetingUrl.setAttribute('value', defaultMeetLink);
  }

  // 5. Initial calculations & stepper UI
  calculateScheduleAndDuration();
  updateStepperUI();

  // Load calendar data
  loadCalendarEntries();

  // Handle URL Hash on load
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);

  // Secret admin/approver shortcut: Alt+A or Ctrl+Shift+A
  window.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 'a' || e.key === 'A')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) ||
        (e.metaKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))) {
      e.preventDefault();
      requestAdminAccess();
    }
  });

  // Collapsible Sidebar setup
  initSidebarCollapse();
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

  if (currentStep === 2) {
    if (typeof fetchRoomAvailability === 'function') {
      fetchRoomAvailability();
    }
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
    'Pelaksanaan & Evaluasi'
  ];
  const mobileText = document.getElementById('mobileStepText');
  if (mobileText) {
    mobileText.textContent = `Langkah ${currentStep} dari 2: ${stepTitles[currentStep - 1]}`;
  }
  const mobilePercent = document.getElementById('mobileProgressPercent');
  if (mobilePercent) mobilePercent.textContent = `${percent}%`;

  // 5. Bottom Sticky Bar
  const bottomInfo = document.getElementById('bottomStepIndicator');
  if (bottomInfo) {
    bottomInfo.textContent = `Langkah ${currentStep} dari 2: ${stepTitles[currentStep - 1]}`;
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
    let idVal = (document.getElementById('trainingId')?.value || '').trim();
    if (!idVal) {
      idVal = updateTrainingId();
    }
    const nameVal = (document.getElementById('trainingName')?.value || '').trim();
    const leaderVal = (document.getElementById('leaderName')?.value || '').trim();
    const deptVal = (document.getElementById('deptName')?.value || '').trim();

    if (!nameVal || !leaderVal || !deptVal) {
      if (!nameVal) {
        showToast('Mohon lengkapi Nama Training / Topik Pelatihan.', 'error');
        document.getElementById('trainingName')?.focus();
      } else if (!leaderVal) {
        showToast('Mohon lengkapi Nama Pengaju dengan nama lengkap resmi Anda.', 'error');
        document.getElementById('leaderName')?.focus();
      } else if (!deptVal) {
        showToast('Mohon pilih Departemen / Divisi pengaju.', 'error');
        document.getElementById('deptName')?.focus();
      }
      return false;
    }
  }

  if (step === 2) {
    const tglVal = (document.getElementById('tglPelaksanaan')?.value || '').trim();
    if (!tglVal) {
      showToast('Mohon tentukan Tanggal Pelaksanaan training terlebih dahulu.', 'error');
      const trigger = document.getElementById('tglPelaksanaan')?.closest('.date-picker-wrap')?.querySelector('.date-picker-trigger');
      if (trigger) trigger.focus();
      return false;
    }

    const metode = document.getElementById('metode')?.value || 'Onsite';
    if (metode === 'Onsite') {
      const lokasi = (document.getElementById('lokasi')?.value || '').trim();
      const customVal = (document.getElementById('customLokasiInput')?.value || '').trim();
      if (!lokasi || (lokasi === 'custom' && !customVal)) {
        showToast('Mohon pilih Ruangan Meeting atau ketik nama/alamat lokasi ruangan jika memilih Lainnya.', 'error');
        (document.getElementById('roomDropdownTrigger') || document.getElementById('lokasiSelect'))?.focus();
        return false;
      }
    }

    const participantRows = document.querySelectorAll('#participantBody tr');
    let hasInvalidEmail = false;
    participantRows.forEach(tr => {
      if (tr.id === 'participantEmptyRow') return;
      const name = (tr.querySelector('.participant-name') || tr.querySelectorAll('input')[0])?.value.trim();
      const emailInput = tr.querySelector('.participant-email') || tr.querySelectorAll('input')[1];
      const email = emailInput?.value.trim();
      if (name) {
        // Email peserta bersifat opsional; jika diisi, validasi formatnya
        if (email && (!email.includes('@') || !email.includes('.'))) {
          hasInvalidEmail = true;
          if (emailInput) emailInput.classList.add('error');
        } else {
          if (emailInput) emailInput.classList.remove('error');
        }
      }
    });

    if (hasInvalidEmail) {
      showToast('Format email peserta tidak valid (contoh: nama@perusahaan.com).', 'error');
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

    const lokasiSection = document.getElementById('lokasiSection');
    const onlineSection = document.getElementById('onlineConfigSection');
    const onlinePlatform = document.getElementById('onlinePlatform')?.value || 'Google Meet';

    if (value === 'Online') {
      // 1. Online: Sembunyikan ruangan fisik sepenuhnya & langsung munculkan link meeting
      if (lokasiSection) lokasiSection.style.display = 'none';
      if (onlineSection) onlineSection.style.display = 'block';
      const lokasiInput = document.getElementById('lokasi');
      if (lokasiInput) lokasiInput.value = onlinePlatform;
      handleOnlinePlatformChange(onlinePlatform);
      syncLocationToModules();
    } else if (value === 'Onsite') {
      // 2. Onsite: Tampilkan ruangan fisik, sembunyikan konfigurasi online
      if (lokasiSection) lokasiSection.style.display = 'block';
      if (onlineSection) onlineSection.style.display = 'none';
      // Reset kembali ke pilihan ruangan yang sedang aktif jika ada
      const activeRoom = document.getElementById('lokasiSelect')?.value || document.querySelector('#roomDropdownMenu .room-dropdown-item.selected')?.getAttribute('data-room') || document.querySelector('#lokasiChipGrid .chip-card.selected')?.getAttribute('data-room') || '';
      const customVal = document.getElementById('customLokasiInput')?.value || '';
      const lokasiInput = document.getElementById('lokasi');
      if (lokasiInput) lokasiInput.value = (activeRoom === 'custom' ? customVal : activeRoom);
      syncLocationToModules();
      scheduleRoomAvailabilityCheck();
    } else if (value === 'Hybrid') {
      // 3. Hybrid: Tampilkan keduanya (ruangan fisik & meeting online)
      if (lokasiSection) lokasiSection.style.display = 'block';
      if (onlineSection) onlineSection.style.display = 'block';
      handleOnlinePlatformChange(onlinePlatform);
      syncLocationToModules();
      scheduleRoomAvailabilityCheck();
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
    if (cardEl.classList.contains('chip-busy')) {
      const conflictMsg = cardEl.getAttribute('data-conflict') || 'ada kegiatan lain pada jam tersebut';
      showToast(`Ruangan ini terdeteksi sibuk (${conflictMsg}). Anda tetap dapat memilihnya atau memilih ruangan lain yang bertanda "Tersedia".`, 'warning');
    }
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

const ROOM_ICONS = {
  'Ruangan Meeting Neptunus': `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="#4C6FE0"/></svg>`,
  'Ruangan Meeting Saturnus': `<svg viewBox="0 0 24 24" width="24" height="24"><ellipse cx="12" cy="13" rx="11" ry="3.2" fill="none" stroke="#D9A441" stroke-width="1.6" transform="rotate(-18 12 13)"/><circle cx="12" cy="12" r="6" fill="#E8C170"/></svg>`,
  'Ruangan Meeting Mars': `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="#C1440E"/></svg>`,
  'Ruangan Meeting Merkurius': `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="#9AA0A6"/></svg>`,
  'custom': `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  'default': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
};

function toggleRoomDropdown() {
  const tgl = document.getElementById('tglPelaksanaan')?.value;
  if (!tgl) {
    showToast('Silakan tentukan tanggal pelaksanaan di atas terlebih dahulu untuk mengecek ketersediaan ruangan.', 'info');
    const tglDisplay = document.getElementById('tglPelaksanaan_display');
    if (tglDisplay) {
      tglDisplay.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const wrap = tglDisplay.closest('.date-picker-wrap');
      if (wrap) {
        wrap.classList.add('field-highlight');
        setTimeout(() => wrap.classList.remove('field-highlight'), 1600);
      }
    }
    return;
  }
  const container = document.getElementById('roomDropdownContainer');
  const trigger = document.getElementById('roomDropdownTrigger');
  if (!container) return;
  const isOpen = container.classList.toggle('open');
  if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeRoomDropdown() {
  const container = document.getElementById('roomDropdownContainer');
  const trigger = document.getElementById('roomDropdownTrigger');
  if (container) container.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function selectCustomRoom(roomValue) {
  if (roomValue && roomValue !== 'custom') {
    const itemEl = document.querySelector(`#roomDropdownMenu .room-dropdown-item[data-room="${roomValue}"]`);
    if (itemEl && itemEl.classList.contains('room-busy')) {
      const conflictMsg = itemEl.getAttribute('data-conflict') || 'ada kegiatan lain pada jam tersebut';
      showToast(`Ruangan ${roomValue.replace('Ruangan Meeting ', '')} sedang terpakai (${conflictMsg}). Hanya ruangan yang bertanda "Tersedia" yang dapat dipilih.`, 'warning');
      return;
    }
  }

  const hiddenInput = document.getElementById('lokasi');
  const selectMirror = document.getElementById('lokasiSelect');
  const customInput = document.getElementById('customLokasiInput');
  const triggerIcon = document.getElementById('roomTriggerIcon');
  const triggerLabel = document.getElementById('roomTriggerLabel');
  const triggerBadge = document.getElementById('roomTriggerBadge');

  if (selectMirror) selectMirror.value = roomValue;

  // Highlight selected item in menu
  document.querySelectorAll('#roomDropdownMenu .room-dropdown-item').forEach(item => {
    if (roomValue && item.getAttribute('data-room') === roomValue) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  if (!roomValue) {
    if (hiddenInput) hiddenInput.value = '';
    if (triggerIcon) triggerIcon.innerHTML = ROOM_ICONS['default'];
    if (triggerLabel) {
      triggerLabel.textContent = 'Pilih Ruangan Meeting...';
      triggerLabel.classList.add('placeholder');
    }
    if (triggerBadge) triggerBadge.style.display = 'none';
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  } else if (roomValue === 'custom') {
    if (hiddenInput) hiddenInput.value = customInput?.value.trim() || 'custom';
    if (triggerIcon) triggerIcon.innerHTML = ROOM_ICONS['custom'];
    if (triggerLabel) {
      triggerLabel.textContent = 'Lainnya / Ruangan Eksternal';
      triggerLabel.classList.remove('placeholder');
    }
    if (triggerBadge) {
      triggerBadge.className = 'room-avail-badge avail-custom';
      triggerBadge.textContent = 'Eksternal';
      triggerBadge.style.display = 'inline-flex';
    }
    if (customInput) {
      customInput.style.display = 'block';
      customInput.focus();
    }
  } else {
    if (hiddenInput) hiddenInput.value = roomValue;
    if (triggerIcon) triggerIcon.innerHTML = ROOM_ICONS[roomValue] || ROOM_ICONS['default'];
    if (triggerLabel) {
      triggerLabel.textContent = roomValue;
      triggerLabel.classList.remove('placeholder');
    }
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = '';
    }

    const itemEl = document.querySelector(`#roomDropdownMenu .room-dropdown-item[data-room="${roomValue}"]`);
    const itemBadge = itemEl?.querySelector('.room-avail-badge');
    if (triggerBadge && itemBadge) {
      triggerBadge.className = itemBadge.className;
      triggerBadge.textContent = itemBadge.textContent;
      triggerBadge.style.display = 'inline-flex';
    } else if (triggerBadge) {
      triggerBadge.style.display = 'none';
    }
  }

  closeRoomDropdown();
  updateRoomStatusNotice(roomValue);
  syncLocationToModules();
}

function handleLokasiSelectChange(value) {
  selectCustomRoom(value);
}

function handleCustomLokasiInput(text) {
  const input = document.getElementById('lokasi');
  if (input) input.value = text.trim() || 'custom';
  syncLocationToModules();
}

function syncLocationToModules() {
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();
  document.querySelectorAll('#moduleBody .module-location').forEach(input => {
    if (!input.value || input.dataset.autoSynced === 'true' || input.value.startsWith('Ruangan Meeting') || input.value === 'Google Meet' || input.value === 'Zoom Meeting' || input.value === 'Microsoft Teams') {
      input.value = topLokasi;
      input.dataset.autoSynced = 'true';
    }
  });
  document.querySelectorAll('#moduleBody .session-venue-name').forEach(span => {
    span.textContent = topLokasi || 'Sesuai Ruangan Utama';
  });
}

function updateRoomStatusNotice(selectedRoom) {
  const notice = document.getElementById('roomStatusNotice');
  if (!notice) return;

  if (!selectedRoom) {
    notice.style.display = 'none';
    notice.innerHTML = '';
    return;
  }

  const planetIcon = ROOM_ICONS[selectedRoom] || '';

  if (selectedRoom === 'custom') {
    notice.style.display = 'flex';
    notice.innerHTML = `<span style="background:var(--accent-tint);color:var(--ink);border:1px solid var(--accent-tint-strong);font-size:12px;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;font-weight:500;">
      <span style="display:inline-flex;align-items:center;justify-content:center;">${ROOM_ICONS['custom']}</span>
      <span>Silahkan ketik nama gedung / alamat venue pada kolom di bawah.</span>
    </span>`;
    return;
  }

  const topDate = document.getElementById('tglPelaksanaan')?.value || '';
  const topStart = document.getElementById('jamMulai')?.value || '09:00';
  const topEnd = document.getElementById('jamSelesai')?.value || '15:00';
  const cacheKey = `${topDate}_${topStart}_${topEnd}`;
  const cachedRooms = roomAvailabilityCache.get(cacheKey);

  if (isCheckingRoomAvail) {
    notice.style.display = 'flex';
    notice.innerHTML = `<span style="color:var(--accent);font-size:12px;display:inline-flex;align-items:center;gap:6px;">
      <span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span> Memeriksa kalender ruangan...
    </span>`;
    return;
  }

  const cleanName = selectedRoom.replace('Ruangan Meeting ', '');
  if (cachedRooms && cachedRooms[selectedRoom]) {
    const info = cachedRooms[selectedRoom];
    if (info.available) {
      notice.style.display = 'flex';
      notice.innerHTML = `<span style="background:rgba(44,122,75,0.09);color:#1F5E36;border:1px solid rgba(44,122,75,0.22);font-size:12px;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;font-weight:500;">
        <span style="display:inline-flex;align-items:center;justify-content:center;">${planetIcon}</span>
        <span>Ruangan <strong>${cleanName}</strong> siap &amp; tersedia untuk jam ${topStart} - ${topEnd} WIB.</span>
      </span>`;
    } else {
      const conflict = info.conflicts && info.conflicts[0] ? info.conflicts[0].timeRange : 'Ada jadwal lain';
      notice.style.display = 'flex';
      notice.innerHTML = `<span style="background:rgba(210,72,59,0.09);color:#96271D;border:1px solid rgba(210,72,59,0.22);font-size:12px;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;font-weight:500;">
        <span style="display:inline-flex;align-items:center;justify-content:center;">${planetIcon}</span>
        <span>Ruangan <strong>${cleanName}</strong> terdeteksi sibuk (${conflict}). Anda tetap dapat mengajukannya atau pilih ruangan lain yang kosong.</span>
      </span>`;
    }
  } else {
    notice.style.display = 'flex';
    notice.innerHTML = `<span style="background:rgba(44,122,75,0.09);color:#1F5E36;border:1px solid rgba(44,122,75,0.22);font-size:12px;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;font-weight:500;">
      <span style="display:inline-flex;align-items:center;justify-content:center;">${planetIcon}</span>
      <span>Ruangan <strong>${cleanName}</strong> terpilih.</span>
    </span>`;
  }
}

function generateGoogleMeetCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const randPart = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  };
  return `${randPart(3)}-${randPart(4)}-${randPart(3)}`;
}

function regenerateGoogleMeetLink() {
  const meetingUrl = document.getElementById('meetingUrl');
  if (meetingUrl) {
    const code = generateGoogleMeetCode();
    const link = `https://meet.google.com/${code}`;
    meetingUrl.value = link;
    meetingUrl.setAttribute('value', link);
    showToast(`Link Google Meet baru berhasil dibuat: ${code}`, 'success');
  }
}

function copyMeetUrl() {
  const meetingUrl = document.getElementById('meetingUrl');
  if (meetingUrl && meetingUrl.value) {
    navigator.clipboard.writeText(meetingUrl.value).then(() => {
      showToast('Tautan Google Meet berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      meetingUrl.select();
      document.execCommand('copy');
      showToast('Tautan Google Meet berhasil disalin!', 'success');
    });
  }
}

function handleOnlinePlatformChange(platform) {
  const label = document.getElementById('meetingUrlLabel');
  const meetNotice = document.getElementById('meetAutoNotice');
  const meetingUrl = document.getElementById('meetingUrl');
  const meetingUrlHint = document.getElementById('meetingUrlHint');
  const btnCopy = document.getElementById('btnCopyMeetUrl');
  const btnRegen = document.getElementById('btnRegenMeetUrl');
  const metode = document.getElementById('metode')?.value;

  if (platform === 'Google Meet') {
    if (label) label.textContent = 'Tautan Google Meet';
    if (meetNotice) {
      meetNotice.style.display = 'flex';
      meetNotice.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span>Link Google Meet ini akan digunakan untuk seluruh sesi pelatihan (Sesi 1, 2, dst.) dan otomatis tertaut di Google Calendar seluruh peserta.</span>
      `;
    }
    if (meetingUrl) {
      if (!meetingUrl.value || !meetingUrl.value.includes('meet.google.com/')) {
        const meetCode = generateGoogleMeetCode();
        const fullMeetLink = `https://meet.google.com/${meetCode}`;
        meetingUrl.value = fullMeetLink;
        meetingUrl.setAttribute('value', fullMeetLink);
      }
      meetingUrl.placeholder = 'https://meet.google.com/...';
    }
    if (meetingUrlHint) {
      meetingUrlHint.textContent = '(Otomatis Digenerate)';
      meetingUrlHint.style.color = 'var(--moss)';
      meetingUrlHint.style.fontWeight = '600';
    }
    if (btnCopy) btnCopy.style.display = 'inline-flex';
    if (btnRegen) btnRegen.style.display = 'inline-flex';
  } else if (platform === 'Zoom Meeting') {
    if (label) label.textContent = 'Tautan Zoom Meeting';
    if (meetNotice) {
      meetNotice.style.display = 'flex';
      meetNotice.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Tautan Zoom Meeting bersifat opsional. Boleh dikosongkan jika vendor eksternal belum membagikan link saat pendaftaran.</span>
      `;
    }
    if (meetingUrl) {
      if (meetingUrl.value.includes('meet.google.com/')) meetingUrl.value = '';
      meetingUrl.placeholder = 'https://zoom.us/j/... (opsional - boleh dikosongkan jika link menyusul)';
    }
    if (meetingUrlHint) {
      meetingUrlHint.textContent = '(Opsional / Boleh Kosong)';
      meetingUrlHint.style.color = 'var(--ink-soft)';
      meetingUrlHint.style.fontWeight = 'normal';
    }
    if (btnCopy) btnCopy.style.display = 'none';
    if (btnRegen) btnRegen.style.display = 'none';
  } else if (platform === 'Microsoft Teams') {
    if (label) label.textContent = 'Tautan Microsoft Teams';
    if (meetNotice) {
      meetNotice.style.display = 'flex';
      meetNotice.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Tautan Teams bersifat opsional. Boleh dikosongkan jika belum tersedia.</span>
      `;
    }
    if (meetingUrl) {
      if (meetingUrl.value.includes('meet.google.com/')) meetingUrl.value = '';
      meetingUrl.placeholder = 'https://teams.microsoft.com/... (opsional - boleh dikosongkan)';
    }
    if (meetingUrlHint) {
      meetingUrlHint.textContent = '(Opsional / Boleh Kosong)';
      meetingUrlHint.style.color = 'var(--ink-soft)';
      meetingUrlHint.style.fontWeight = 'normal';
    }
    if (btnCopy) btnCopy.style.display = 'none';
    if (btnRegen) btnRegen.style.display = 'none';
  } else {
    if (label) label.textContent = 'Tautan Platform Meeting';
    if (meetNotice) {
      meetNotice.style.display = 'flex';
      meetNotice.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Tautan meeting / LMS bersifat opsional. Boleh dikosongkan jika link menyusul.</span>
      `;
    }
    if (meetingUrl) {
      if (meetingUrl.value.includes('meet.google.com/')) meetingUrl.value = '';
      meetingUrl.placeholder = 'https://... (opsional - boleh dikosongkan)';
    }
    if (meetingUrlHint) {
      meetingUrlHint.textContent = '(Opsional / Boleh Kosong)';
      meetingUrlHint.style.color = 'var(--ink-soft)';
      meetingUrlHint.style.fontWeight = 'normal';
    }
    if (btnCopy) btnCopy.style.display = 'none';
    if (btnRegen) btnRegen.style.display = 'none';
  }

  // Update nilai lokasi jika metode Online murni
  if (metode === 'Online') {
    const lokasiInput = document.getElementById('lokasi');
    if (lokasiInput) lokasiInput.value = platform;
  }
}

// ==========================================
// Google Calendar Room Availability & Visual Calendar Modal
// ==========================================
const ROOM_CALENDAR_URLS = {
  'Ruangan Meeting Neptunus': 'https://calendar.google.com/calendar/embed?src=c_1881kdt0gqog6js3lg0umkabhcc5s%40resource.calendar.google.com&ctz=Asia%2FJakarta',
  'Ruangan Meeting Saturnus': 'https://calendar.google.com/calendar/embed?src=c_1888qp0vkrf3mi6ri2sci3qi57o62%40resource.calendar.google.com&ctz=Asia%2FJakarta',
  'Ruangan Meeting Mars': 'https://calendar.google.com/calendar/embed?src=c_188af71f94iieh7oif5rf055i47pi%40resource.calendar.google.com&ctz=Asia%2FJakarta',
  'Ruangan Meeting Merkurius': 'https://calendar.google.com/calendar/embed?src=c_188850vcfda0kjn4lgnm6olsfs098%40resource.calendar.google.com&ctz=Asia%2FJakarta'
};

const roomAvailabilityCache = new Map();
let roomCheckDebounceTimer = null;
let isCheckingRoomAvail = false;

function scheduleRoomAvailabilityCheck() {
  clearTimeout(roomCheckDebounceTimer);
  roomCheckDebounceTimer = setTimeout(() => {
    fetchRoomAvailability(false);
  }, 400);
}

async function fetchRoomAvailability(force = false) {
  const topDate = document.getElementById('tglPelaksanaan')?.value || '';
  const topStart = document.getElementById('jamMulai')?.value || '09:00';
  const topEnd = document.getElementById('jamSelesai')?.value || '15:00';

  const dateInput = document.querySelector('#moduleBody .module-date');
  const startInput = document.querySelector('#moduleBody .module-start') || document.querySelector('#moduleBody input[type="time"]');
  const endInput = document.querySelector('#moduleBody .module-end');

  const dateVal = topDate || (dateInput ? dateInput.value : '') || (document.getElementById('tglPelaksanaan')?.dataset?.rawDate || '');
  const startTimeVal = topStart || (startInput ? startInput.value : '') || '09:00';
  const endTimeVal = topEnd || (endInput ? endInput.value : '') || '15:00';

  const infoEl = document.getElementById('roomAvailInfo');

  if (!dateVal) {
    if (infoEl) infoEl.innerHTML = '<span style="color:var(--ink-soft);"><span style="color:var(--ink-faint);">●</span> Menunggu tanggal &amp; jam di atas</span>';
    resetRoomBadges('Tentukan Jadwal');
    return;
  }

  const cacheKey = `${dateVal}_${startTimeVal}_${endTimeVal}`;
  if (!force && roomAvailabilityCache.has(cacheKey)) {
    renderRoomAvailability(roomAvailabilityCache.get(cacheKey));
    return;
  }

  if (isCheckingRoomAvail) return;
  isCheckingRoomAvail = true;

  setRoomBadgesChecking();
  if (infoEl) {
    infoEl.innerHTML = `<span style="color:var(--accent);display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Memeriksa kalender...</span>`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max, don't hold up UI

    const url = `${GOOGLE_SCRIPT_URL}?action=checkRooms&date=${encodeURIComponent(dateVal)}&startTime=${encodeURIComponent(startTimeVal)}&endTime=${encodeURIComponent(endTimeVal)}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-cache', signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json();

    if (json && json.success && json.rooms) {
      roomAvailabilityCache.set(cacheKey, json.rooms);
      renderRoomAvailability(json.rooms);
    } else {
      handleRoomCheckFallback('Ketersediaan belum disinkron');
    }
  } catch (err) {
    handleRoomCheckFallback('Tersedia (Default)');
  } finally {
    isCheckingRoomAvail = false;
  }
}

function setRoomBadgesChecking() {
  document.querySelectorAll('#roomDropdownMenu .room-dropdown-item:not([data-room="custom"])').forEach(item => {
    const badge = item.querySelector('.room-avail-badge');
    if (badge) {
      badge.className = 'room-avail-badge avail-checking';
      badge.textContent = 'Mengecek...';
    }
  });
  document.querySelectorAll('#lokasiChipGrid .room-chip:not([data-room="custom"])').forEach(chip => {
    const badge = chip.querySelector('.room-avail-badge');
    if (badge) {
      badge.className = 'room-avail-badge avail-checking';
      badge.textContent = 'Mengecek...';
    }
  });
  const currentSelected = document.getElementById('lokasiSelect')?.value || document.getElementById('lokasi')?.value;
  if (currentSelected && currentSelected !== 'custom') {
    const triggerBadge = document.getElementById('roomTriggerBadge');
    if (triggerBadge) {
      triggerBadge.className = 'room-avail-badge avail-checking';
      triggerBadge.textContent = 'Mengecek...';
      triggerBadge.style.display = 'inline-flex';
    }
  }
  if (currentSelected && typeof updateRoomStatusNotice === 'function') {
    updateRoomStatusNotice(currentSelected);
  }
}

function resetRoomBadges(statusText = 'Tersedia') {
  document.querySelectorAll('#roomDropdownMenu .room-dropdown-item').forEach(item => {
    item.classList.remove('room-busy');
    item.removeAttribute('data-conflict');
    const badge = item.querySelector('.room-avail-badge');
    if (badge) {
      if (item.getAttribute('data-room') === 'custom') {
        badge.className = 'room-avail-badge avail-custom';
        badge.textContent = 'Eksternal';
      } else {
        badge.className = 'room-avail-badge avail-free';
        badge.textContent = statusText;
      }
    }
  });
  document.querySelectorAll('#lokasiChipGrid .room-chip').forEach(chip => {
    chip.classList.remove('chip-busy');
    chip.removeAttribute('data-conflict');
    const badge = chip.querySelector('.room-avail-badge');
    if (badge) {
      if (chip.getAttribute('data-room') === 'custom') {
        badge.className = 'room-avail-badge avail-custom';
        badge.textContent = 'Eksternal';
      } else {
        badge.className = 'room-avail-badge avail-free';
        badge.textContent = statusText;
      }
    }
  });

  const currentSelected = document.getElementById('lokasiSelect')?.value || document.getElementById('lokasi')?.value;
  if (currentSelected && currentSelected !== 'custom') {
    const triggerBadge = document.getElementById('roomTriggerBadge');
    if (triggerBadge) {
      triggerBadge.className = 'room-avail-badge avail-free';
      triggerBadge.textContent = statusText;
      triggerBadge.style.display = 'inline-flex';
    }
  }
  if (currentSelected && typeof updateRoomStatusNotice === 'function') {
    updateRoomStatusNotice(currentSelected);
  }
}

function handleRoomCheckFallback(note = '') {
  resetRoomBadges('Tersedia');
  const infoEl = document.getElementById('roomAvailInfo');
  if (infoEl) {
    infoEl.innerHTML = `<span style="color:var(--ink-soft);"><span style="color:#2C7A4B;font-weight:600;">● 4 Ruangan Siap Dipilih</span></span>`;
  }
}

function renderRoomAvailability(rooms) {
  if (!rooms) return;
  let availableCount = 0;
  let totalInternal = 0;

  for (const [roomName, info] of Object.entries(rooms)) {
    totalInternal++;

    // Update Custom Room Dropdown Menu Items
    const item = document.querySelector(`#roomDropdownMenu .room-dropdown-item[data-room="${roomName}"]`);
    if (item) {
      const badge = item.querySelector('.room-avail-badge');
      if (info.available) {
        availableCount++;
        item.classList.remove('room-busy');
        item.removeAttribute('data-conflict');
        if (badge) {
          badge.className = 'room-avail-badge avail-free';
          badge.textContent = 'Tersedia';
        }
      } else {
        item.classList.add('room-busy');
        const conflict = info.conflicts && info.conflicts[0] ? info.conflicts[0] : null;
        const timeRange = conflict ? conflict.timeRange : 'Ada Jadwal';
        item.setAttribute('data-conflict', timeRange);
        if (badge) {
          badge.className = 'room-avail-badge avail-busy';
          badge.textContent = `Terpakai (${timeRange.replace(' WIB', '')})`;
        }
      }
    } else {
      if (info.available) availableCount++;
    }

    // Fallback: update chip if present
    const chip = document.querySelector(`#lokasiChipGrid .room-chip[data-room="${roomName}"]`);
    if (chip) {
      const badge = chip.querySelector('.room-avail-badge');
      if (info.available) {
        chip.classList.remove('chip-busy');
        chip.removeAttribute('data-conflict');
        if (badge) {
          badge.className = 'room-avail-badge avail-free';
          badge.textContent = 'Tersedia';
        }
      } else {
        chip.classList.add('chip-busy');
        const conflict = info.conflicts && info.conflicts[0] ? info.conflicts[0] : null;
        const timeRange = conflict ? conflict.timeRange : 'Ada Jadwal';
        chip.setAttribute('data-conflict', timeRange);
        if (badge) {
          badge.className = 'room-avail-badge avail-busy';
          badge.textContent = `Terpakai (${timeRange.replace(' WIB', '')})`;
        }
      }
    }
  }

  // Update Trigger Badge if a room is currently active, or reset if it is now busy
  const currentSelected = document.getElementById('lokasiSelect')?.value || document.getElementById('lokasi')?.value;
  if (currentSelected && currentSelected !== 'custom') {
    const activeItem = document.querySelector(`#roomDropdownMenu .room-dropdown-item[data-room="${currentSelected}"]`);
    if (activeItem && activeItem.classList.contains('room-busy')) {
      const conflictMsg = activeItem.getAttribute('data-conflict') || 'ada kegiatan lain pada jam tersebut';
      showToast(`Ruangan ${currentSelected.replace('Ruangan Meeting ', '')} terpakai pada jam ini (${conflictMsg}). Silakan pilih ruangan lain yang bertanda Tersedia.`, 'warning');
      selectCustomRoom('');
    } else if (activeItem) {
      const activeBadge = activeItem.querySelector('.room-avail-badge');
      const triggerBadge = document.getElementById('roomTriggerBadge');
      if (triggerBadge && activeBadge) {
        triggerBadge.className = activeBadge.className;
        triggerBadge.textContent = activeBadge.textContent;
        triggerBadge.style.display = 'inline-flex';
      }
    }
  }

  if (currentSelected && typeof updateRoomStatusNotice === 'function') {
    updateRoomStatusNotice(currentSelected);
  }

  const infoEl = document.getElementById('roomAvailInfo');
  if (infoEl) {
    if (availableCount === totalInternal) {
      infoEl.innerHTML = `<span style="color:#2C7A4B;font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Semua Ruangan (${availableCount}) Tersedia</span>`;
    } else if (availableCount > 0) {
      infoEl.innerHTML = `<span style="color:var(--ink-soft);font-weight:600;"><span style="color:#2C7A4B;">${availableCount}</span> dari ${totalInternal} Ruangan Tersedia</span>`;
    } else {
      infoEl.innerHTML = `<span style="color:#B3264E;font-weight:600;">Semua Ruangan Terpakai pada jam ini</span>`;
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
  const trnIdInput = document.getElementById('trainingId');
  const tglInput = document.getElementById('tglPengajuan');
  const deptSelect = document.getElementById('deptName');
  const customDeptInput = document.getElementById('customDeptInput');
  const catSelect = document.getElementById('category');

  // 1. Komponen Tanggal: YYYYMMDD dari #tglPengajuan (fallback ke hari ini jika kosong)
  let datePart = '';
  if (tglInput && tglInput.value) {
    const rawDate = tglInput.value.trim().replace(/-/g, '');
    if (/^\d{8}$/.test(rawDate)) {
      datePart = rawDate;
    }
  }
  if (!datePart) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    datePart = `${y}${m}${d}`;
  }

  // 2. Komponen Departemen: dari DEPT_CODE_MAP atau #customDeptInput
  let deptCode = 'GEN';
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
    } else {
      const lettersOnly = deptVal.replace(/[^a-zA-Z]/g, '');
      if (lettersOnly.length > 0) {
        deptCode = lettersOnly.substring(0, 3).toUpperCase();
      }
    }
  }

  // 3. Komponen Kategori: Soft skill -> SS, Hard skill -> HS
  let catCode = 'SS';
  if (catSelect && catSelect.value) {
    const catVal = catSelect.value.trim();
    catCode = CATEGORY_CODE_MAP[catVal] || (catVal.toLowerCase().includes('hard') ? 'HS' : 'SS');
  }

  // 4. Base prefix dengan format TRN-YYYYMMDD-DEPT-CAT (misal: TRN-20261004-FIN-SS)
  const basePrefix = `TRN-${datePart}-${deptCode}-${catCode}`;

  // 5. Cek duplikasi di riwayat lokal / cache jika ada
  let allEntries = [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) allEntries = JSON.parse(raw);
  } catch (err) {}
  if (typeof cachedEntries !== 'undefined' && Array.isArray(cachedEntries) && cachedEntries.length > 0) {
    allEntries = allEntries.concat(cachedEntries);
  }

  let counter = 0;
  allEntries.forEach(entry => {
    const idStr = String((entry.meta && entry.meta['ID training']) || entry['ID Training'] || entry.id || entry.idTraining || '').trim().toUpperCase();
    if (idStr === basePrefix) {
      if (counter === 0) counter = 1;
    } else if (idStr.startsWith(basePrefix + '-')) {
      const num = parseInt(idStr.replace(basePrefix + '-', ''), 10);
      if (!isNaN(num) && num > counter) {
        counter = num;
      }
    }
  });

  const finalId = counter > 0 ? `${basePrefix}-${String(counter + 1).padStart(2, '0')}` : basePrefix;

  if (trnIdInput) {
    trnIdInput.value = finalId;
    trnIdInput.placeholder = `TRN-${datePart}-${deptCode}-${catCode}`;
    trnIdInput.classList.remove('error');
  }
  return finalId;
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

function formatDateLongId(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
window.formatDateLongId = formatDateLongId;

// ==========================================
// Smart Schedule Pattern & Recurring Generator
// ==========================================
let currentSchedulePattern = 'single';

function formatIsoDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setSchedulePattern(pattern) {
  const normPattern = pattern === 'multi' ? 'weekly' : pattern;
  currentSchedulePattern = normPattern;

  // Update tabs
  const btnSingle = document.getElementById('patternSingleBtn');
  const btnWeekly = document.getElementById('patternWeeklyBtn');
  const btnConsec = document.getElementById('patternConsecutiveBtn');
  if (btnSingle) btnSingle.classList.toggle('active', normPattern === 'single');
  if (btnWeekly) btnWeekly.classList.toggle('active', normPattern === 'weekly');
  if (btnConsec) btnConsec.classList.toggle('active', normPattern === 'consecutive');

  // Update panels
  const panelSingle = document.getElementById('singleSchedulePanel');
  const panelWeekly = document.getElementById('weeklySchedulePanel');
  const panelConsec = document.getElementById('consecutiveSchedulePanel');
  if (panelSingle) panelSingle.style.display = normPattern === 'single' ? 'block' : 'none';
  if (panelWeekly) panelWeekly.style.display = normPattern === 'weekly' ? 'block' : 'none';
  if (panelConsec) panelConsec.style.display = normPattern === 'consecutive' ? 'block' : 'none';

  if (normPattern === 'weekly') {
    initWeeklyPanelDefaults();
  } else if (normPattern === 'consecutive') {
    initConsecPanelDefaults();
  } else {
    handleMainScheduleChange();
  }
}

function initWeeklyPanelDefaults() {
  const weeklyStart = document.getElementById('weeklyStartDate');
  const targetDay = parseInt(document.getElementById('weeklySelectedDay')?.value || '3', 10); // default 3 = Rabu

  if (weeklyStart && !weeklyStart.value) {
    const now = new Date();
    const todayDay = now.getDay();
    let daysToAdd = (targetDay - todayDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd);
    const dateStr = formatIsoDate(nextDate);
    weeklyStart.value = dateStr;
    const disp = document.getElementById('weeklyStartDate_display');
    if (disp) disp.textContent = formatDisplayDate(dateStr);
  }
  onWeeklyConfigChange();
}

function initConsecPanelDefaults() {
  const consecStart = document.getElementById('consecStartDate');
  if (consecStart && !consecStart.value) {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dateStr = formatIsoDate(nextDate);
    consecStart.value = dateStr;
    const disp = document.getElementById('consecStartDate_display');
    if (disp) disp.textContent = formatDisplayDate(dateStr);
  }
  onConsecConfigChange();
}

function selectWeeklyDay(dayNum, dayName) {
  const hiddenDay = document.getElementById('weeklySelectedDay');
  const hiddenName = document.getElementById('weeklySelectedDayName');
  if (hiddenDay) hiddenDay.value = dayNum;
  if (hiddenName) hiddenName.value = dayName;

  document.querySelectorAll('.day-chip-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-day') === String(dayNum));
  });

  const weeklyStart = document.getElementById('weeklyStartDate');
  if (weeklyStart && weeklyStart.value) {
    const parts = weeklyStart.value.split('-').map(Number);
    const currDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const currDay = currDate.getDay();
    let diff = (dayNum - currDay + 7) % 7;
    if (diff !== 0) {
      currDate.setDate(currDate.getDate() + diff);
      const newDateStr = formatIsoDate(currDate);
      weeklyStart.value = newDateStr;
      const disp = document.getElementById('weeklyStartDate_display');
      if (disp) disp.textContent = formatDisplayDate(newDateStr);
    }
  }
  onWeeklyConfigChange();
}

function setWeeklyCount(count) {
  const inp = document.getElementById('weeklySessionCount');
  if (inp) inp.value = count;
  document.querySelectorAll('#weeklySchedulePanel .quick-count-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(String(count)));
  });
  onWeeklyConfigChange();
}

function setConsecCount(count) {
  const inp = document.getElementById('consecDayCount');
  if (inp) inp.value = count;
  document.querySelectorAll('#consecutiveSchedulePanel .quick-count-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(String(count)));
  });
  onConsecConfigChange();
}

function onWeeklyConfigChange() {
  const dayName = document.getElementById('weeklySelectedDayName')?.value || 'Rabu';
  const startVal = document.getElementById('weeklyStartDate')?.value || '';
  const count = parseInt(document.getElementById('weeklySessionCount')?.value || '4', 10);
  const startJam = document.getElementById('weeklyJamMulai')?.value || '09:00';
  const endJam = document.getElementById('weeklyJamSelesai')?.value || '12:00';

  const diffMin = calculateMinutesBetween(startJam, endJam);
  const totalMin = diffMin * count;
  const durStr = totalMin > 0 ? formatMinutes(totalMin) : '-';

  const summaryEl = document.getElementById('mainScheduleLiveSummaryText');
  if (summaryEl) {
    if (startVal) {
      const parts = startVal.split('-').map(Number);
      const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const endDate = new Date(parts[0], parts[1] - 1, parts[2] + ((count - 1) * 7));
      summaryEl.innerHTML = `<strong>Multi-Hari (On Going):</strong> Setiap hari <strong>${dayName}</strong> (${count} Sesi &bull; ${durStr}) &bull; ${formatDisplayDate(formatIsoDate(startDate))} s/d ${formatDisplayDate(formatIsoDate(endDate))} (${startJam} - ${endJam} WIB)`;
    } else {
      summaryEl.innerHTML = `<strong>Multi-Hari (On Going):</strong> Setiap hari <strong>${dayName}</strong> (${count} Sesi &bull; ${startJam} - ${endJam} WIB) &bull; <em>Pilih tanggal mulai di atas</em>`;
    }
  }

  const badgeText = document.getElementById('mainScheduleDurationText');
  if (badgeText && durStr !== '-') badgeText.textContent = `${durStr} Pembelajaran`;
}

function onConsecConfigChange() {
  const startVal = document.getElementById('consecStartDate')?.value || '';
  const count = parseInt(document.getElementById('consecDayCount')?.value || '3', 10);
  const startJam = document.getElementById('consecJamMulai')?.value || '09:00';
  const endJam = document.getElementById('consecJamSelesai')?.value || '16:00';

  const diffMin = calculateMinutesBetween(startJam, endJam);
  const totalMin = diffMin * count;
  const durStr = totalMin > 0 ? formatMinutes(totalMin) : '-';

  const summaryEl = document.getElementById('mainScheduleLiveSummaryText');
  if (summaryEl) {
    if (startVal) {
      const parts = startVal.split('-').map(Number);
      const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const endDate = new Date(parts[0], parts[1] - 1, parts[2] + (count - 1));
      summaryEl.innerHTML = `<strong>Hari Berturut-turut:</strong> ${count} Hari (${durStr}) &bull; ${formatDisplayDate(formatIsoDate(startDate))} s/d ${formatDisplayDate(formatIsoDate(endDate))} (${startJam} - ${endJam} WIB)`;
    } else {
      summaryEl.innerHTML = `<strong>Hari Berturut-turut:</strong> ${count} Hari (${startJam} - ${endJam} WIB) &bull; <em>Pilih tanggal mulai di atas</em>`;
    }
  }

  const badgeText = document.getElementById('mainScheduleDurationText');
  if (badgeText && durStr !== '-') badgeText.textContent = `${durStr} Pembelajaran`;
}

function applyWeeklySchedule() {
  const dayName = document.getElementById('weeklySelectedDayName')?.value || 'Rabu';
  const targetDay = parseInt(document.getElementById('weeklySelectedDay')?.value || '3', 10);
  let startVal = document.getElementById('weeklyStartDate')?.value || '';
  const count = Math.max(1, Math.min(24, parseInt(document.getElementById('weeklySessionCount')?.value || '4', 10)));
  const startJam = document.getElementById('weeklyJamMulai')?.value || '09:00';
  const endJam = document.getElementById('weeklyJamSelesai')?.value || '12:00';
  const trainerVal = (document.getElementById('trainer')?.value || '').trim();
  const currentLoc = (document.getElementById('lokasi')?.value || '').trim();

  if (!startVal) {
    const now = new Date();
    const todayDay = now.getDay();
    let daysToAdd = (targetDay - todayDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd);
    startVal = formatIsoDate(nextDate);
    const startInp = document.getElementById('weeklyStartDate');
    if (startInp) startInp.value = startVal;
    const disp = document.getElementById('weeklyStartDate_display');
    if (disp) disp.textContent = formatDisplayDate(startVal);
  }

  // Clear existing module body
  const tbody = document.getElementById('moduleBody');
  if (tbody) tbody.innerHTML = '';
  moduleCounter = 0;

  // Generate sessions
  const parts = startVal.split('-').map(Number);
  const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);

  for (let i = 0; i < count; i++) {
    const sessionDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + (i * 7));
    const sessionDateStr = formatIsoDate(sessionDate);
    addModule(sessionDateStr, startJam, endJam, '', trainerVal, 'Workshop Hands-on', currentLoc, '');
  }

  // Sync to top single inputs for backward compatibility
  const tglInput = document.getElementById('tglPelaksanaan');
  if (tglInput) {
    tglInput.value = startVal;
    const disp = document.getElementById('tglPelaksanaan_display');
    if (disp) disp.textContent = formatDisplayDate(startVal);
  }
  const jamMulai = document.getElementById('jamMulai');
  if (jamMulai) jamMulai.value = startJam;
  const jamSelesai = document.getElementById('jamSelesai');
  if (jamSelesai) jamSelesai.value = endJam;

  calculateScheduleAndDuration();
  syncLocationToModules();

  const endDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + ((count - 1) * 7));
  const endDateStr = formatIsoDate(endDate);

  const scheduleText = `Setiap hari ${dayName} (${count} Sesi: ${formatDisplayDate(startVal)} - ${formatDisplayDate(endDateStr)}), ${startJam} - ${endJam} WIB`;
  const jadwalField = document.getElementById('jadwal');
  if (jadwalField) jadwalField.value = scheduleText;

  showToast(`Berhasil membuat ${count} sesi pelatihan setiap hari ${dayName} (${startJam} - ${endJam} WIB). Ruangan akan ter-booked untuk seluruh sesi ini.`, 'success');

  if (currentLoc && (document.getElementById('metode')?.value === 'Onsite' || document.getElementById('metode')?.value === 'Hybrid')) {
    scheduleRoomAvailabilityCheck();
  }
}

function applyConsecutiveSchedule() {
  let startVal = document.getElementById('consecStartDate')?.value || '';
  const count = Math.max(1, Math.min(14, parseInt(document.getElementById('consecDayCount')?.value || '3', 10)));
  const startJam = document.getElementById('consecJamMulai')?.value || '09:00';
  const endJam = document.getElementById('consecJamSelesai')?.value || '16:00';
  const trainerVal = (document.getElementById('trainer')?.value || '').trim();
  const currentLoc = (document.getElementById('lokasi')?.value || '').trim();

  if (!startVal) {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    startVal = formatIsoDate(nextDate);
    const startInp = document.getElementById('consecStartDate');
    if (startInp) startInp.value = startVal;
    const disp = document.getElementById('consecStartDate_display');
    if (disp) disp.textContent = formatDisplayDate(startVal);
  }

  // Clear existing module body
  const tbody = document.getElementById('moduleBody');
  if (tbody) tbody.innerHTML = '';
  moduleCounter = 0;

  // Generate consecutive days
  const parts = startVal.split('-').map(Number);
  let curDate = new Date(parts[0], parts[1] - 1, parts[2]);

  for (let i = 0; i < count; i++) {
    if (curDate.getDay() === 0) {
      curDate.setDate(curDate.getDate() + 1); // skip Sunday to Monday
    }
    const sessionDateStr = formatIsoDate(curDate);
    addModule(sessionDateStr, startJam, endJam, '', trainerVal, 'Workshop Hands-on', currentLoc, '');
    curDate.setDate(curDate.getDate() + 1);
  }

  // Sync to top single inputs
  const tglInput = document.getElementById('tglPelaksanaan');
  if (tglInput) {
    tglInput.value = startVal;
    const disp = document.getElementById('tglPelaksanaan_display');
    if (disp) disp.textContent = formatDisplayDate(startVal);
  }
  const jamMulai = document.getElementById('jamMulai');
  if (jamMulai) jamMulai.value = startJam;
  const jamSelesai = document.getElementById('jamSelesai');
  if (jamSelesai) jamSelesai.value = endJam;

  calculateScheduleAndDuration();
  syncLocationToModules();

  showToast(`Berhasil membuat ${count} hari pelatihan berturut-turut (${startJam} - ${endJam} WIB). Ruangan akan ter-booked untuk seluruh sesi ini.`, 'success');

  if (currentLoc && (document.getElementById('metode')?.value === 'Onsite' || document.getElementById('metode')?.value === 'Hybrid')) {
    scheduleRoomAvailabilityCheck();
  }
}

window.setSchedulePattern = setSchedulePattern;
window.selectWeeklyDay = selectWeeklyDay;
window.setWeeklyCount = setWeeklyCount;
window.setConsecCount = setConsecCount;
window.onWeeklyConfigChange = onWeeklyConfigChange;
window.onConsecConfigChange = onConsecConfigChange;
window.applyWeeklySchedule = applyWeeklySchedule;
window.applyConsecutiveSchedule = applyConsecutiveSchedule;

let singleDaySplitMode = 1;

function getDayNameId(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[d.getDay()] || '';
}
window.getDayNameId = getDayNameId;

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return 0;
  return h * 60 + (m || 0);
}

function formatMinutesToTime(totalMin) {
  const normalized = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function updateModuleRowTimes(row, date, start, end) {
  if (!row) return;
  const dateInp = row.querySelector('.module-date, .session-edit-date');
  const startInp = row.querySelector('.module-start, .session-edit-start');
  const endInp = row.querySelector('.module-end, .session-edit-end');
  const dayBadge = row.querySelector('.session-day-label');

  if (date && dateInp) {
    dateInp.value = date;
    if (dayBadge) {
      const dayName = getDayNameId(date);
      dayBadge.textContent = dayName ? `(${dayName})` : '';
    }
  }
  if (start && startInp) startInp.value = start;
  if (end && endInp) endInp.value = end;

  const diff = calculateMinutesBetween(start, end);
  const durStr = diff > 0 ? formatMinutes(diff) : '-';
  const durPill = row.querySelector('.session-dur-pill');
  if (durPill) durPill.textContent = durStr;
  const durHidden = row.querySelector('.module-duration');
  if (durHidden) durHidden.value = durStr;
}

function setSingleDaySplit(count) {
  singleDaySplitMode = count;
  const btn1 = document.getElementById('singleSplitOneBtn');
  const btn2 = document.getElementById('singleSplitTwoBtn');
  const rowOne = document.getElementById('singleOneSessionRow');
  const rowTwo = document.getElementById('singleTwoSessionRow');

  if (btn1) btn1.classList.toggle('active', count === 1);
  if (btn2) btn2.classList.toggle('active', count === 2);

  if (rowOne) rowOne.style.display = count === 1 ? 'grid' : 'none';
  if (rowTwo) rowTwo.style.display = count === 2 ? 'block' : 'none';

  const tglInput = document.getElementById('tglPelaksanaan');
  const tgl = tglInput ? tglInput.value : '';
  const topTrainer = (document.getElementById('trainer')?.value || '').trim();
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();

  if (count === 1) {
    const start = document.getElementById('jamMulai')?.value || '09:00';
    const end = document.getElementById('jamSelesai')?.value || '15:00';
    const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
    if (moduleRows.length === 2 && moduleRows[0].dataset.splitAuto === 'true' && moduleRows[1].dataset.splitAuto === 'true') {
      moduleRows[1].remove();
      moduleCounter = Math.max(0, moduleCounter - 1);
    }
    const firstRow = document.querySelector('#moduleBody .session-compact-item');
    if (firstRow) {
      delete firstRow.dataset.splitAuto;
      updateModuleRowTimes(firstRow, tgl, start, end);
      renumberSessions();
    } else if (tgl) {
      addModule(tgl, start, end, '', topTrainer, 'Workshop', topLokasi, '');
    }
  } else if (count === 2) {
    const s1Start = document.getElementById('singleSplit1Mulai')?.value || '09:00';
    const s1End = document.getElementById('singleSplit1Selesai')?.value || '12:00';
    const s2Start = document.getElementById('singleSplit2Mulai')?.value || '13:00';
    const s2End = document.getElementById('singleSplit2Selesai')?.value || '16:00';

    const jamMulai = document.getElementById('jamMulai');
    if (jamMulai) jamMulai.value = s1Start;
    const jamSelesai = document.getElementById('jamSelesai');
    if (jamSelesai) jamSelesai.value = s2End;

    const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
    if (moduleRows.length <= 1) {
      if (moduleRows.length === 1) {
        const r1 = moduleRows[0];
        r1.dataset.splitAuto = 'true';
        updateModuleRowTimes(r1, tgl || (r1.querySelector('.module-date')?.value || ''), s1Start, s1End);
        addModule(tgl || (r1.querySelector('.module-date')?.value || ''), s2Start, s2End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
        const lastRow = document.querySelector('#moduleBody .session-compact-item:last-child');
        if (lastRow) lastRow.dataset.splitAuto = 'true';
      } else if (tgl) {
        addModule(tgl, s1Start, s1End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
        const r1 = document.querySelector('#moduleBody .session-compact-item:last-child');
        if (r1) r1.dataset.splitAuto = 'true';
        addModule(tgl, s2Start, s2End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
        const r2 = document.querySelector('#moduleBody .session-compact-item:last-child');
        if (r2) r2.dataset.splitAuto = 'true';
      }
    } else if (moduleRows.length === 2 && moduleRows[0].dataset.splitAuto === 'true' && moduleRows[1].dataset.splitAuto === 'true') {
      updateModuleRowTimes(moduleRows[0], tgl, s1Start, s1End);
      updateModuleRowTimes(moduleRows[1], tgl, s2Start, s2End);
    }
  }

  handleMainScheduleChange();
}

function handleSingleSplitInputsChange() {
  const s1Start = document.getElementById('singleSplit1Mulai')?.value || '09:00';
  const s1End = document.getElementById('singleSplit1Selesai')?.value || '12:00';
  const s2Start = document.getElementById('singleSplit2Mulai')?.value || '13:00';
  const s2End = document.getElementById('singleSplit2Selesai')?.value || '16:00';

  const jamMulai = document.getElementById('jamMulai');
  if (jamMulai) jamMulai.value = s1Start;
  const jamSelesai = document.getElementById('jamSelesai');
  if (jamSelesai) jamSelesai.value = s2End;

  const tgl = document.getElementById('tglPelaksanaan')?.value || '';
  const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
  if (moduleRows.length >= 2 && moduleRows[0].dataset.splitAuto === 'true' && moduleRows[1].dataset.splitAuto === 'true') {
    updateModuleRowTimes(moduleRows[0], tgl, s1Start, s1End);
    updateModuleRowTimes(moduleRows[1], tgl, s2Start, s2End);
  }

  calculateScheduleAndDuration();
}

function addSessionSameDay() {
  const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
  const topTrainer = (document.getElementById('trainer')?.value || '').trim();
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();
  const topDate = document.getElementById('tglPelaksanaan')?.value || '';

  let targetDate = topDate || formatIsoDate(new Date());
  let targetStart = '13:00';
  let targetEnd = '16:00';

  if (moduleRows.length > 0) {
    const lastRow = moduleRows[moduleRows.length - 1];
    const lastDate = lastRow.querySelector('.module-date, .session-edit-date')?.value;
    const lastEnd = lastRow.querySelector('.module-end, .session-edit-end')?.value || '12:00';

    if (lastDate) targetDate = lastDate;

    // Hitung jam mulai berikutnya secara cerdas
    const endMinutes = parseTimeToMinutes(lastEnd);
    if (endMinutes <= 12 * 60) {
      targetStart = '13:00';
      targetEnd = '16:00';
    } else if (endMinutes < 15 * 60) {
      const startMin = endMinutes + 30;
      const endMin = Math.min(21 * 60, startMin + 120);
      targetStart = formatMinutesToTime(startMin);
      targetEnd = formatMinutesToTime(endMin);
    } else {
      const startMin = endMinutes + 15;
      const endMin = Math.min(22 * 60, startMin + 90);
      targetStart = formatMinutesToTime(startMin);
      targetEnd = formatMinutesToTime(endMin);
    }
  }

  addModule(targetDate, targetStart, targetEnd, '', topTrainer, 'Workshop Hands-on', topLokasi, '');

  const lastItem = document.querySelector('#moduleBody .session-compact-item:last-child');
  if (lastItem) {
    const startInp = lastItem.querySelector('.session-edit-start, .module-start');
    if (startInp) {
      startInp.focus();
      startInp.classList.add('highlight-pulse');
      setTimeout(() => startInp.classList.remove('highlight-pulse'), 1500);
    }
    lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const dayName = getDayNameId(targetDate);
  showToast(`Sesi tambahan dibuat: ${dayName ? dayName + ', ' : ''}${formatDisplayDate(targetDate)} (${targetStart} - ${targetEnd} WIB). Anda dapat langsung mengedit tanggal dan jamnya di baris sesi ini.`, 'success');
}

function addSessionDifferentDay() {
  const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
  const topTrainer = (document.getElementById('trainer')?.value || '').trim();
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();
  const topDate = document.getElementById('tglPelaksanaan')?.value || '';
  const topStart = document.getElementById('jamMulai')?.value || '09:00';
  const topEnd = document.getElementById('jamSelesai')?.value || '15:00';

  let baseDateStr = topDate || formatIsoDate(new Date());
  let targetStart = topStart;
  let targetEnd = topEnd;

  if (moduleRows.length > 0) {
    const lastRow = moduleRows[moduleRows.length - 1];
    const lastDate = lastRow.querySelector('.module-date, .session-edit-date')?.value;
    const lastStart = lastRow.querySelector('.module-start, .session-edit-start')?.value;
    const lastEnd = lastRow.querySelector('.module-end, .session-edit-end')?.value;

    if (lastDate) baseDateStr = lastDate;
    if (lastStart) targetStart = lastStart;
    if (lastEnd) targetEnd = lastEnd;
  }

  // Hitung tanggal berikutnya (+1 hari atau +7 hari jika weekly)
  let nextDateStr = baseDateStr;
  const parts = baseDateStr.split('-').map(Number);
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (currentSchedulePattern === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1); // lewati hari Minggu
    }
    nextDateStr = formatIsoDate(d);
  }

  addModule(nextDateStr, targetStart, targetEnd, '', topTrainer, 'Workshop Hands-on', topLokasi, '');

  const lastItem = document.querySelector('#moduleBody .session-compact-item:last-child');
  if (lastItem) {
    const dateInp = lastItem.querySelector('.session-edit-date, .module-date');
    if (dateInp) {
      dateInp.focus();
      dateInp.classList.add('highlight-pulse');
      setTimeout(() => dateInp.classList.remove('highlight-pulse'), 1500);
    }
    lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const dayName = getDayNameId(nextDateStr);
  showToast(`Sesi di hari berbeda dibuat: ${dayName ? dayName + ', ' : ''}${formatDisplayDate(nextDateStr)} (${targetStart} - ${targetEnd} WIB). Silakan ubah hari, tanggal, atau jamnya langsung di kotak yang tersedia.`, 'success');
}

window.setSingleDaySplit = setSingleDaySplit;
window.handleSingleSplitInputsChange = handleSingleSplitInputsChange;
window.addSessionSameDay = addSessionSameDay;
window.addSessionDifferentDay = addSessionDifferentDay;

function handleMainScheduleChange() {
  const tglInput = document.getElementById('tglPelaksanaan');
  const startInput = document.getElementById('jamMulai');
  const endInput = document.getElementById('jamSelesai');

  const tgl = tglInput ? tglInput.value : '';
  const start = startInput ? startInput.value : '09:00';
  const end = endInput ? endInput.value : '15:00';

  if (currentSchedulePattern === 'single' && singleDaySplitMode === 2) {
    const s1Start = document.getElementById('singleSplit1Mulai')?.value || '09:00';
    const s1End = document.getElementById('singleSplit1Selesai')?.value || '12:00';
    const s2Start = document.getElementById('singleSplit2Mulai')?.value || '13:00';
    const s2End = document.getElementById('singleSplit2Selesai')?.value || '16:00';

    if (startInput) startInput.value = s1Start;
    if (endInput) endInput.value = s2End;

    const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item');
    const topTrainer = (document.getElementById('trainer')?.value || '').trim();
    const topLokasi = (document.getElementById('lokasi')?.value || '').trim();

    if (moduleRows.length >= 2 && moduleRows[0].dataset.splitAuto === 'true' && moduleRows[1].dataset.splitAuto === 'true') {
      updateModuleRowTimes(moduleRows[0], tgl, s1Start, s1End);
      updateModuleRowTimes(moduleRows[1], tgl, s2Start, s2End);
    } else if (moduleRows.length === 0 && tgl) {
      addModule(tgl, s1Start, s1End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
      const r1 = document.querySelector('#moduleBody .session-compact-item:last-child');
      if (r1) r1.dataset.splitAuto = 'true';
      addModule(tgl, s2Start, s2End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
      const r2 = document.querySelector('#moduleBody .session-compact-item:last-child');
      if (r2) r2.dataset.splitAuto = 'true';
    } else if (moduleRows.length === 1) {
      updateModuleRowTimes(moduleRows[0], tgl, s1Start, s1End);
      moduleRows[0].dataset.splitAuto = 'true';
      addModule(tgl, s2Start, s2End, '', topTrainer, 'Workshop Hands-on', topLokasi, '');
      const r2 = document.querySelector('#moduleBody .session-compact-item:last-child');
      if (r2) r2.dataset.splitAuto = 'true';
    }
  } else {
    // Sinkronkan ke modul pertama jika hanya memiliki 1 sesi / modul
    const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item, #moduleBody tr');
    if (moduleRows.length <= 1) {
      if (moduleRows.length === 0) {
        if (tgl) {
          const topTrainer = (document.getElementById('trainer')?.value || '').trim();
          const topLokasi = (document.getElementById('lokasi')?.value || '').trim();
          addModule(tgl, start, end, '', topTrainer, 'Workshop', topLokasi, '');
        }
      } else {
        const firstRow = moduleRows[0];
        updateModuleRowTimes(firstRow, tgl, start, end);
      }
    }
  }

  calculateScheduleAndDuration();

  // Update room dropdown placeholder label if still unselected
  const triggerLabel = document.getElementById('roomTriggerLabel');
  const currentLoc = document.getElementById('lokasi')?.value;
  if (tgl && triggerLabel && (!currentLoc || triggerLabel.classList.contains('placeholder'))) {
    triggerLabel.textContent = 'Pilih Ruangan Meeting...';
  } else if (!tgl && triggerLabel && (!currentLoc || triggerLabel.classList.contains('placeholder'))) {
    triggerLabel.textContent = 'Pilih Ruangan Meeting (Tentukan jadwal di atas)...';
  }

  // Pengecekan ketersediaan ruangan langsung (jika Onsite atau Hybrid)
  const metode = document.getElementById('metode')?.value || 'Onsite';
  if (metode === 'Onsite' || metode === 'Hybrid') {
    scheduleRoomAvailabilityCheck();
  }
}

function syncTrainerToModules() {
  const trainerVal = (document.getElementById('trainer')?.value || '').trim();
  const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item, #moduleBody tr');
  moduleRows.forEach(row => {
    const picInput = row.querySelector('.module-pic');
    if (picInput && (!picInput.value || picInput.dataset.autoSynced === 'true')) {
      picInput.value = trainerVal;
      picInput.dataset.autoSynced = 'true';
    }
  });
  calculateScheduleAndDuration();
}

function handleTopScheduleChange() {
  handleMainScheduleChange();
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
  const moduleRows = document.querySelectorAll('#moduleBody .session-compact-item, #moduleBody tr');
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
    const tglInput = tr.querySelector('.module-date');
    const startInput = tr.querySelector('.module-start');
    const endInput = tr.querySelector('.module-end');
    const durInput = tr.querySelector('.module-duration');
    const durBadge = tr.querySelector('.module-dur-badge, .session-dur-pill');
    const locInput = tr.querySelector('.module-location');

    const tgl = tglInput ? tglInput.value : '';
    const mulai = startInput ? startInput.value : '';
    const selesai = endInput ? endInput.value : '';
    const loc = locInput ? locInput.value.trim() : '';

    if (tgl) dates.push(tgl);
    if (mulai) startTimes.push(mulai);
    if (selesai) endTimes.push(selesai);
    if (loc) locations.push(loc);

    // Update kolom Durasi di tiap baris
    const diff = calculateMinutesBetween(mulai, selesai);
    if (diff > 0) {
      const durStr = formatMinutes(diff);
      if (durInput) {
        durInput.value = durStr;
        durInput.setAttribute('value', durStr);
      }
      if (durBadge) {
        durBadge.textContent = durStr;
      }
      totalMinutes += diff;
    } else {
      if (durInput) {
        durInput.value = '-';
        durInput.setAttribute('value', '-');
      }
      if (durBadge) {
        durBadge.textContent = '-';
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
  if (tglDisplay && !tglDisplay.value && uniqueDates.length > 0) {
    tglDisplay.value = uniqueDates[0];
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
  if (jamHiddenMulai && earliest && !jamHiddenMulai.value) {
    jamHiddenMulai.value = earliest;
    jamHiddenMulai.setAttribute('value', earliest);
  }
  if (jamHiddenSelesai && latest && !jamHiddenSelesai.value) {
    jamHiddenSelesai.value = latest;
    jamHiddenSelesai.setAttribute('value', latest);
  }
  if (jamHiddenSelesai && latest) {
    jamHiddenSelesai.value = latest;
    jamHiddenSelesai.setAttribute('value', latest);
  }

  // 4. Lokasi / Ruangan (hanya jika tidak menggunakan chip grid lokasi atau dropdown lokasi)
  if (!document.getElementById('lokasiChipGrid') && !document.getElementById('lokasiSelect')) {
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

  // 6. Update Executive Schedule Card (Pill & Live Summary)
  const durationTextEl = document.getElementById('mainScheduleDurationText');
  const liveSummaryTextEl = document.getElementById('mainScheduleLiveSummaryText');
  const curTopDate = tglDisplay ? tglDisplay.value : '';
  const curStart = (jamHiddenMulai ? jamHiddenMulai.value : '') || '09:00';
  const curEnd = (jamHiddenSelesai ? jamHiddenSelesai.value : '') || '15:00';
  const curMinutes = calculateMinutesBetween(curStart, curEnd);
  const curDurFormatted = curMinutes > 0 ? formatMinutes(curMinutes) : '';

  if (durationTextEl) {
    if (totalDurStr && totalDurStr !== '-') {
      durationTextEl.textContent = `${totalDurStr} Pembelajaran`;
    } else if (curDurFormatted) {
      durationTextEl.textContent = `${curDurFormatted} Pembelajaran`;
    } else {
      durationTextEl.textContent = 'Durasi Otomatis';
    }
  }

  if (liveSummaryTextEl) {
    const trainerVal = (document.getElementById('trainer')?.value || '').trim();
    const trainerSnippet = trainerVal ? ` &bull; Fasilitator: <strong>${trainerVal}</strong>` : '';
    if (moduleRows.length > 1) {
      if (uniqueDates.length === 1 && uniqueDates[0]) {
        const longDate = formatDateLongId(uniqueDates[0]);
        liveSummaryTextEl.innerHTML = `<strong>${longDate}</strong> &bull; <strong>${moduleRows.length} Sesi di Hari yang Sama</strong> &bull; Total <strong>${totalDurStr !== '-' ? totalDurStr : '-'} Pembelajaran</strong>${trainerSnippet}`;
      } else {
        liveSummaryTextEl.innerHTML = `<strong>${dateText || 'Multi-sesi'}</strong> &bull; <strong>${totalDurStr !== '-' ? totalDurStr : '6 Jam'} Pembelajaran</strong> (${moduleRows.length} Sesi Terjadwal)${trainerSnippet}`;
      }
    } else if (curTopDate) {
      const longDate = formatDateLongId(curTopDate);
      if (curStart && curEnd && curMinutes > 0) {
        liveSummaryTextEl.innerHTML = `<strong>${longDate}</strong> &bull; <strong>${curStart} - ${curEnd} WIB</strong> (${curDurFormatted || totalDurStr})${trainerSnippet}`;
      } else {
        liveSummaryTextEl.innerHTML = `<strong>${longDate}</strong> &bull; <em>Tentukan jam pelaksanaan</em>${trainerSnippet}`;
      }
    } else {
      if (curStart && curEnd && curMinutes > 0) {
        liveSummaryTextEl.innerHTML = `Rentang Jam: <strong>${curStart} - ${curEnd} WIB</strong> (${curDurFormatted}) &bull; <em>Pilih tanggal pelaksanaan di atas</em>${trainerSnippet}`;
      } else {
        liveSummaryTextEl.innerHTML = `<em>Silahkan pilih tanggal dan jam pelaksanaan pelatihan</em>${trainerSnippet}`;
      }
    }
  }

  const sessionBadge = document.getElementById('moduleSessionBadge');
  if (sessionBadge) {
    if (moduleRows.length > 0) {
      sessionBadge.textContent = `${moduleRows.length} Sesi Terjadwal`;
      sessionBadge.style.display = 'inline-flex';
    } else {
      sessionBadge.style.display = 'none';
    }
  }

  if (typeof scheduleRoomAvailabilityCheck === 'function') {
    scheduleRoomAvailabilityCheck();
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
function addParticipant(a1 = '', a2 = '', a3 = 'present', a4 = '') {
  let name = a1 || '';
  let email = '';
  let dept = '';

  // Dukungan fleksibel untuk berbagai format pemanggilan:
  // 1. addParticipant(name, dept, attendance, email)
  if (a4 || (a3 && a3 !== 'present' && a3.includes('@'))) {
    dept = a2 || '';
    email = a4 || (a3.includes('@') ? a3 : '');
  }
  // 2. addParticipant(name, email, dept)
  else if (a2 && a2.includes('@')) {
    email = a2;
    dept = (a3 && a3 !== 'present') ? a3 : '';
  }
  // 3. addParticipant(name, dept)
  else if (a2 && !a2.includes('@') && (!a3 || a3 === 'present')) {
    dept = a2;
    email = '';
  }
  // 4. Default fallback
  else {
    email = a2 || '';
    dept = (a3 && a3 !== 'present') ? a3 : '';
  }

  const tbody = document.getElementById('participantBody');
  const emptyRow = document.getElementById('participantEmptyRow');
  if (emptyRow) emptyRow.remove();

  const currentRows = tbody ? Array.from(tbody.querySelectorAll('tr')).filter(r => r.id !== 'participantEmptyRow') : [];
  participantCounter = currentRows.length + 1;

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
    <td style="width:190px;"><input type="email" class="participant-email" placeholder="nama@email.com" value="${email}"></td>
    <td style="width:200px;">
      <select class="participant-dept">
        ${optionsHtml}
      </select>
    </td>
    <td style="width:40px;"><button type="button" class="row-remove" onclick="removeRow(this)" title="Hapus baris">&times;</button></td>
  `;
  if (tbody) tbody.appendChild(tr);
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
  const tbody = document.getElementById('participantBody');
  if (!tbody) return;
  const validRows = Array.from(tbody.querySelectorAll('tr')).filter(r => r.id !== 'participantEmptyRow');
  const rows = validRows.length;
  const countEl = document.getElementById('participantCount');
  if (countEl) {
    countEl.textContent = `${rows} peserta terdaftar`;
  }
  const plannedEl = document.getElementById('plannedParticipants');
  if (plannedEl) {
    plannedEl.value = rows;
  }

  if (rows === 0 && !document.getElementById('participantEmptyRow')) {
    const emptyTr = document.createElement('tr');
    emptyTr.id = 'participantEmptyRow';
    emptyTr.innerHTML = `
      <td colspan="5" style="text-align:center;padding:26px 16px;color:var(--ink-soft);font-size:13px;line-height:1.6;">
        <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:6px;color:var(--ink);font-weight:600;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          <span>Belum Ada Peserta Terdaftar</span>
        </div>
        <div>Gunakan tombol <strong>Quick Paste dari Excel</strong> di bawah untuk memasukkan daftar peserta secara instan, atau klik <strong>Tambah Peserta</strong>.</div>
      </td>
    `;
    tbody.appendChild(emptyTr);
  }
}

// Helper: Parse satu baris data peserta dari clipboard / text area
function parseParticipantLine(line, fallbackDept = '') {
  const cleanLine = line.trim();
  if (!cleanLine) return null;

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

  // Abaikan baris header seperti "Nama", "Email", "Departemen", "No"
  const lowerName = name.toLowerCase();
  if (lowerName === 'nama' || lowerName === 'nama lengkap' || lowerName === 'nama karyawan' || lowerName === 'nama peserta' || lowerName === 'name' || lowerName === 'no') {
    return null;
  }

  if (parts.length >= 3) {
    name = parts[0];
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

  if (!name && !email) return null;
  return { name, email, dept };
}

// Download Template Peserta CSV / Excel Format Langsung dari Browser
function downloadPesertaTemplate() {
  const csvContent = "Nama Lengkap,Email,Departemen\n" +
    "Budi Santoso,budi@cpssoft.com,WEB DEVELOPER\n" +
    "Siti Rahmawati,siti@cpssoft.com,QA\n" +
    "Ahmad Fauzi,ahmad@cpssoft.com,FINANCE\n" +
    "Dewi Lestari,dewi@cpssoft.com,MARKETING\n" +
    "Rian Pratama,rian@cpssoft.com,CUSTOMER EXPERIENCE";

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'template_peserta_training.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Template peserta (.CSV) berhasil diunduh! Buka di Excel atau Google Sheets.', 'success');
}
window.downloadPesertaTemplate = downloadPesertaTemplate;

// Handle Unggah File CSV Langsung di Modal
function handleParticipantCsvFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const pasteArea = document.getElementById('excelPasteArea');
    if (pasteArea) {
      pasteArea.value = text;
    }
    showToast(`File "${file.name}" berhasil dibaca. Mengimpor ke tabel peserta...`, 'info');
    importPesertaFromText();
    e.target.value = '';
  };
  reader.onerror = () => {
    showToast('Gagal membaca file CSV.', 'error');
    e.target.value = '';
  };
  reader.readAsText(file);
}
window.handleParticipantCsvFile = handleParticipantCsvFile;

// Quick Import from Excel Textarea (Mendukung Nama, Email, Dept)
function importPesertaFromText() {
  const textarea = document.getElementById('excelPasteArea');
  if (!textarea || !textarea.value.trim()) {
    showToast('Teks daftar peserta masih kosong. Silahkan tempelkan data dari Excel terlebih dahulu.', 'error');
    return;
  }

  const lines = textarea.value.split('\n');
  const deptSelect = document.getElementById('deptName');
  const fallbackDept = (deptSelect && deptSelect.value !== 'custom') ? deptSelect.value : '';

  const tbody = document.getElementById('participantBody');
  if (tbody) {
    // Bersihkan placeholder empty state & baris kosong yang belum diisi
    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
      if (row.id === 'participantEmptyRow') {
        row.remove();
        return;
      }
      const nameIn = (row.querySelector('.participant-name') || row.querySelectorAll('input')[0])?.value.trim();
      const emailIn = (row.querySelector('.participant-email') || row.querySelectorAll('input')[1])?.value.trim();
      if (!nameIn && !emailIn) {
        row.remove();
      }
    });
  }

  let addedCount = 0;
  lines.forEach(line => {
    const item = parseParticipantLine(line, fallbackDept);
    if (item && (item.name || item.email)) {
      addParticipant(item.name, item.email, item.dept);
      addedCount++;
    }
  });

  if (tbody) renumber(tbody);

  textarea.value = '';
  closeModal('modalQuickPasteExcel');

  if (addedCount > 0) {
    showToast(`Tabel berhasil terisi ${addedCount} peserta dari Excel!`, 'success');
  } else {
    showToast('Tidak ada data peserta valid yang dapat dibaca.', 'warning');
  }
}

// Direct Table Paste Listener (Ctrl+V langsung pada area tabel peserta)
function setupDirectTablePaste() {
  const participantSection = document.getElementById('participantBody')?.closest('section');
  if (!participantSection) return;

  participantSection.addEventListener('paste', (e) => {
    // Abaikan jika user sedang paste di textarea modal Quick Paste
    if (e.target && e.target.id === 'excelPasteArea') return;

    const clipData = e.clipboardData || window.clipboardData;
    if (!clipData) return;
    const text = clipData.getData('text');
    if (!text) return;

    const lines = text.trim().split('\n');
    const isMultiLine = lines.length > 1;
    const hasTabs = text.includes('\t');
    const hasEmail = text.includes('@');

    // Jika yang di-paste berbentuk baris/kolom tabular atau data email jamak
    if (isMultiLine || (hasTabs && hasEmail)) {
      e.preventDefault();

      const deptSelect = document.getElementById('deptName');
      const fallbackDept = (deptSelect && deptSelect.value !== 'custom') ? deptSelect.value : '';

      const tbody = document.getElementById('participantBody');
      if (tbody) {
        // Bersihkan placeholder empty state & baris kosong
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
          if (row.id === 'participantEmptyRow') {
            row.remove();
            return;
          }
          const nameIn = (row.querySelector('.participant-name') || row.querySelectorAll('input')[0])?.value.trim();
          const emailIn = (row.querySelector('.participant-email') || row.querySelectorAll('input')[1])?.value.trim();
          if (!nameIn && !emailIn) {
            row.remove();
          }
        });
      }

      let count = 0;
      lines.forEach(line => {
        const item = parseParticipantLine(line, fallbackDept);
        if (item && (item.name || item.email)) {
          addParticipant(item.name, item.email, item.dept);
          count++;
        }
      });

      if (tbody) renumber(tbody);

      if (count > 0) {
        showToast(`Tabel berhasil terisi ${count} peserta langsung dari Excel!`, 'success');
      }
    }
  });
}

// ==========================================
// Dynamic Rows: Modules
// ==========================================
function addModule(tanggal = '', jamMulai = '', jamSelesai = '', mod = '', pic = '', method = '', lokasi = '', desc = '') {
  moduleCounter++;
  const mBody = document.getElementById('moduleBody');
  if (!mBody) return;

  const topDate = document.getElementById('tglPelaksanaan')?.value || '';
  const topStart = document.getElementById('jamMulai')?.value || '09:00';
  const topEnd = document.getElementById('jamSelesai')?.value || '15:00';
  const topTrainer = (document.getElementById('trainer')?.value || '').trim();
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();

  const lastItem = document.querySelector('#moduleBody .session-compact-item:last-child');
  let fallbackDate = topDate || new Date().toISOString().split('T')[0];
  let fallbackStart = topStart;
  let fallbackEnd = topEnd;
  if (lastItem) {
    const lastDate = lastItem.querySelector('.module-date')?.value;
    const lastStart = lastItem.querySelector('.module-start')?.value;
    const lastEnd = lastItem.querySelector('.module-end')?.value;
    if (lastStart) fallbackStart = lastStart;
    if (lastEnd) fallbackEnd = lastEnd;
    if (lastDate) {
      const parts = lastDate.split('-').map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (currentSchedulePattern === 'weekly') {
          d.setDate(d.getDate() + 7);
        } else {
          d.setDate(d.getDate() + 1);
          if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
        }
        fallbackDate = formatIsoDate(d);
      }
    }
  }

  const defaultDate = tanggal || fallbackDate;
  const defaultStart = jamMulai || fallbackStart;
  const defaultEnd = jamSelesai || fallbackEnd;
  const defaultPic = pic || topTrainer;
  const defaultLokasi = lokasi || topLokasi;
  const defaultMethod = method || (document.getElementById('metode')?.value || 'Workshop');

  const diff = calculateMinutesBetween(defaultStart, defaultEnd);
  const rowDur = diff > 0 ? formatMinutes(diff) : '-';

  const formattedDate = defaultDate ? formatDateLongId(defaultDate) : 'Tanggal belum ditentukan';
  const displayTopic = mod ? mod : '';
  const currentCount = document.querySelectorAll('#moduleBody .session-compact-item').length + 1;
  const dayName = defaultDate ? getDayNameId(defaultDate) : '';
  const dayNameBadge = dayName ? `(${dayName})` : '';

  const item = document.createElement('div');
  item.className = 'session-compact-item';
  item.id = `sessionItem_${moduleCounter}`;
  item.setAttribute('data-session-index', moduleCounter);

  item.innerHTML = `
    <div class="session-card-header">
      <div class="session-header-left">
        <span class="session-badge-num">Sesi ${currentCount}</span>
        <div class="session-venue-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span class="session-venue-name">${defaultLokasi || 'Sesuai Ruangan Utama'}</span>
        </div>
      </div>
      <div class="session-header-right">
        <span class="session-dur-pill">${rowDur}</span>
        <button type="button" class="session-delete-btn" onclick="removeIntegratedSession(this)" title="Hapus sesi ini">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <div class="session-card-controls">
      <div class="session-time-group">
        <div class="session-input-subgroup">
          <label class="session-sublabel">Tanggal:</label>
          <div class="session-date-field-wrap">
            <input type="date" class="session-edit-date module-date" value="${defaultDate}" onchange="onSessionInlineChange('${moduleCounter}')" title="Ubah tanggal sesi ini">
            <span class="session-day-label">${dayNameBadge}</span>
          </div>
        </div>
        <div class="session-input-subgroup">
          <label class="session-sublabel">Jam Sesi:</label>
          <div class="session-time-inputs-wrap">
            <input type="time" class="session-edit-start module-start" value="${defaultStart}" onchange="onSessionInlineChange('${moduleCounter}')" title="Jam mulai">
            <span class="session-time-sep">s/d</span>
            <input type="time" class="session-edit-end module-end" value="${defaultEnd}" onchange="onSessionInlineChange('${moduleCounter}')" title="Jam selesai">
            <span class="datetime-suffix-badge">WIB</span>
          </div>
        </div>
      </div>
      <div class="session-topic-group">
        <input type="text" class="session-topic-input module-title" placeholder="Topik / Judul Materi Sesi ${currentCount} (Opsional)" value="${escapeHtml(displayTopic)}">
      </div>
    </div>

    <!-- Hidden compatibility inputs -->
    <input type="hidden" class="module-duration" value="${rowDur}">
    <input type="hidden" class="module-pic" value="${defaultPic}" ${defaultPic && defaultPic === topTrainer ? 'data-auto-synced="true"' : ''}>
    <input type="hidden" class="module-method" value="${defaultMethod}">
    <input type="hidden" class="module-location" value="${defaultLokasi}" data-auto-synced="true">
    <input type="hidden" class="module-desc" value="${escapeHtml(desc)}">
  `;

  mBody.appendChild(item);
  renumberSessions();
  calculateScheduleAndDuration();
}

function removeIntegratedSession(btn) {
  const item = btn.closest('.session-compact-item');
  if (!item) return;
  item.remove();
  renumberSessions();
  calculateScheduleAndDuration();
}

function renumberSessions() {
  const items = document.querySelectorAll('#moduleBody .session-compact-item');
  items.forEach((item, idx) => {
    const num = idx + 1;
    const badge = item.querySelector('.session-badge-num');
    if (badge) badge.textContent = `Sesi ${num}`;
    const topicInp = item.querySelector('.session-topic-input');
    if (topicInp && topicInp.placeholder.startsWith('Topik / Judul Materi Sesi')) {
      topicInp.placeholder = `Topik / Judul Materi Sesi ${num} (Opsional)`;
    }
  });

  const sessionBadge = document.getElementById('moduleSessionBadge');
  if (sessionBadge) {
    if (items.length > 0) {
      sessionBadge.textContent = `${items.length} Sesi Terjadwal`;
      sessionBadge.style.display = 'inline-flex';
    } else {
      sessionBadge.style.display = 'none';
    }
  }
  bindAllTimePickers();
}

function toggleSessionTimeEdit(id) {
  const item = document.getElementById(`sessionItem_${id}`);
  if (!item) return;
  const dateInp = item.querySelector('.session-edit-date');
  if (dateInp) dateInp.focus();
}

function onSessionInlineChange(id) {
  const item = document.getElementById(`sessionItem_${id}`);
  if (!item) return;
  const dateInp = item.querySelector('.session-edit-date, .module-date');
  const startInp = item.querySelector('.session-edit-start, .module-start');
  const endInp = item.querySelector('.session-edit-end, .module-end');
  const durHidden = item.querySelector('.module-duration');
  const dayBadge = item.querySelector('.session-day-label');

  const dateVal = dateInp ? dateInp.value : '';
  const startVal = startInp ? startInp.value : '09:00';
  const endVal = endInp ? endInp.value : '15:00';

  if (dayBadge) {
    const dayName = dateVal ? getDayNameId(dateVal) : '';
    dayBadge.textContent = dayName ? `(${dayName})` : '';
  }

  const diff = calculateMinutesBetween(startVal, endVal);
  const durStr = diff > 0 ? formatMinutes(diff) : '-';
  if (durHidden) durHidden.value = durStr;

  const durPill = item.querySelector('.session-dur-pill');
  if (durPill) durPill.textContent = durStr;

  calculateScheduleAndDuration();
}

window.removeIntegratedSession = removeIntegratedSession;
window.renumberSessions = renumberSessions;
window.toggleSessionTimeEdit = toggleSessionTimeEdit;
window.onSessionInlineChange = onSessionInlineChange;

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
  const item = btn.closest('.session-compact-item');
  if (item) {
    removeIntegratedSession(btn);
    return;
  }
  const tr = btn.closest('tr');
  if (tr) {
    const tbody = tr.parentElement;
    tr.remove();
    renumber(tbody);
  }
}

function renumber(tbody) {
  if (tbody.id === 'participantBody') {
    const validRows = Array.from(tbody.querySelectorAll('tr')).filter(r => r.id !== 'participantEmptyRow');
    validRows.forEach((row, i) => {
      const firstCol = row.querySelector('td');
      if (firstCol) firstCol.textContent = i + 1;
    });
    participantCounter = validRows.length;
    updateParticipantCount();
    return;
  }
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const firstCol = row.querySelector('td');
    if (firstCol) firstCol.textContent = i + 1;
  });
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
// Helper: HTML Escaping
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// Navigation & Routing (TDS Multi-Page Portal)
// ==========================================
let currentPage = 'ajukan';

function goToPage(page) {
  if (!page) page = 'ajukan';

  // Normalize aliases
  if (page === 'dashboard' || page === 'home' || page === 'form') page = 'ajukan';
  if (page === 'calendar' || page === 'jadwal') page = 'kalender';
  if (page === 'studio' || page === 'ai') page = 'ai-studio';
  if (page === 'admin' || page === 'master' || page === 'data' || page === 'portal-approval' || page === 'approval' || page === 'approver') page = 'portal-approval';
  if (page === 'my-training' || page === 'mytraining') page = 'training-saya';
  if (page === 'vendors' || page === 'directory') page = 'vendor';
  if (page === 'skill-matrix' || page === 'matrix' || page === 'skillmatrix' || page === 'skills') page = 'skill-matrix';
  if (page === 'post-training' || page === 'trampoline' || page === 'post-test' || page === 'evidence' || page === 'posttraining') page = 'post-training';
  if (page === 'absensi' || page === 'absen' || page === 'presensi' || page === 'checkin' || page === 'live-absensi') page = 'absensi';

  // Gate for portal-approval (requires PIN unlock)
  if (page === 'portal-approval') {
    const isUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';
    if (!isUnlocked) {
      requestAdminAccess();
      return;
    }
  }

  currentPage = page;

  // 1. Hide all .tds-page
  document.querySelectorAll('.tds-page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // 2. Display requested page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.style.display = 'block';
    targetPage.classList.add('active');
  }

  // 3. Update sidebar active item
  document.querySelectorAll('.tds-nav-item').forEach(item => {
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 4. Sticky Bottom Bar: Only displayed on 'ajukan' page
  const stickyBar = document.getElementById('stickyBottomBar');
  if (stickyBar) {
    stickyBar.style.display = (page === 'ajukan') ? '' : 'none';
  }

  // 5. URL Hash sync
  if (page === 'absensi' && (window.location.hash.includes('?') || window.location.search.includes('id='))) {
    // Preserve query parameters for mobile attendance check-in (e.g. ?id=...#absen or #absen?id=...)
  } else {
    const targetHash = `#${page}`;
    if (window.location.hash !== targetHash) {
      history.replaceState(null, null, targetHash);
    }
  }

  // 6. Ensure freshest data from localStorage
  loadCalendarEntries();

  // 7. Page-specific render triggers
  if (page === 'dashboard') {
    renderDashboardLandingPage();
  } else if (page === 'skill-matrix') {
    renderSkillMatrix();
  } else if (page === 'ai-studio') {
    initAiStudioPage();
  } else if (page === 'absensi') {
    const attParams = getAttendanceUrlParams();
    if (attParams.id) {
      setupMobileAttendanceView(attParams.id, attParams.sesi);
    } else {
      initAttendanceHub();
    }
  } else if (page === 'kalender') {
    renderCalendar();
  } else if (page === 'training-saya') {
    const searchInput = document.getElementById('myTrainingSearchInput');
    if (searchInput && searchInput.value.trim()) {
      searchMyTrainings();
    } else {
      resetMyTrainingSearch();
    }
  } else if (page === 'vendor') {
    renderVendorDirectoryPage();
  } else if (page === 'post-training') {
    populateTrampolineTrainingDropdowns();
    const navGroup = document.getElementById('navGroupPostTraining');
    if (navGroup) navGroup.classList.add('is-open');
  } else if (page === 'portal-approval') {
    const masterView = document.getElementById('masterView');
    if (masterView) masterView.style.display = '';
    switchAdminTab(adminCurrentTab || 'dashboard');
    loadMasterData();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Backward compatibility helper
function switchPublicView(view) {
  if (view === 'calendar') goToPage('kalender');
  else goToPage('ajukan');
}

const DEFAULT_HOSTING_URL = 'https://request-training-development.vercel.app';

function getAttendanceBaseUrl() {
  const origin = window.location.origin || '';
  const protocol = window.location.protocol || '';
  const hostname = window.location.hostname || '';

  // Jika dibuka dari file lokal (file:///) atau localhost / IP privat tanpa domain publik
  if (protocol === 'file:' || origin === 'null' || !origin || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
    return DEFAULT_HOSTING_URL;
  }
  // Jika sudah online di Vercel atau domain publik apapun
  return `${origin}${window.location.pathname.replace(/\/+$/, '')}`;
}

function getAttendanceUrlParams() {
  // 1. Ambil dari window.location.search (?id=...&sesi=...)
  const searchParams = new URLSearchParams(window.location.search || '');
  let id = searchParams.get('id');
  let sesi = searchParams.get('sesi') || searchParams.get('modul');

  // 2. Ambil dari window.location.hash (#absen?id=... atau #checkin?id=...)
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const hashParams = new URLSearchParams(hash.substring(qIndex + 1));
    if (!id) id = hashParams.get('id');
    if (!sesi) sesi = hashParams.get('sesi') || hashParams.get('modul');
  }

  return {
    id: (id || '').trim(),
    sesi: (sesi || 'Sesi 1').trim()
  };
}

function handleHashNavigation() {
  // Prioritas Utama: Jika URL membawa parameter ID pelatihan dari scan QR presensi
  const attParams = getAttendanceUrlParams();
  if (attParams.id) {
    goToPage('absensi');
    setupMobileAttendanceView(attParams.id, attParams.sesi);
    return;
  }

  const rawHash = (window.location.hash || '').replace('#', '').toLowerCase();
  if (rawHash === 'approval-page' || rawHash === 'approver-portal') {
    requestApprovalAccess();
  } else if (!rawHash || rawHash === 'dashboard' || rawHash === 'home' || rawHash === 'ajukan' || rawHash === 'form') {
    goToPage('ajukan');
  } else if (rawHash === 'skill-matrix' || rawHash === 'matrix' || rawHash === 'skillmatrix' || rawHash === 'skills') {
    goToPage('skill-matrix');
  } else if (rawHash === 'ai-studio' || rawHash === 'studio' || rawHash === 'ai') {
    goToPage('ai-studio');
  } else if (rawHash === 'kalender' || rawHash === 'calendar' || rawHash === 'jadwal') {
    goToPage('kalender');
  } else if (rawHash === 'training-saya' || rawHash === 'my-training' || rawHash === 'mytraining') {
    goToPage('training-saya');
  } else if (rawHash === 'vendor' || rawHash === 'vendors' || rawHash === 'directory') {
    goToPage('vendor');
  } else if (rawHash === 'post-training' || rawHash === 'trampoline' || rawHash === 'evidence' || rawHash === 'posttest') {
    goToPage('post-training');
  } else if (rawHash.startsWith('absen') || rawHash.startsWith('absensi') || rawHash.startsWith('checkin') || rawHash.startsWith('presensi')) {
    goToPage('absensi');
  } else if (rawHash === 'portal-approval' || rawHash === 'approval' || rawHash === 'approver' || rawHash === 'admin' || rawHash === 'master' || rawHash === 'data') {
    goToPage('portal-approval');
  } else {
    goToPage('ajukan');
  }
}

// ==========================================
// POST TRAINING TRAMPOLINE LOGIC
// ==========================================
function switchTrampolineTab(tabName) {
  if (!tabName) tabName = 'evidence';
  const panelEvidence = document.getElementById('trampolinePanelEvidence');
  const panelPostTest = document.getElementById('trampolinePanelPostTest');
  const panelSharing = document.getElementById('trampolinePanelSharing');
  const btnEvidence = document.getElementById('tabBtnEvidence');
  const btnPostTest = document.getElementById('tabBtnPostTest');
  const btnSharing = document.getElementById('tabBtnSharing');

  if (panelEvidence) panelEvidence.style.display = (tabName === 'evidence') ? 'block' : 'none';
  if (panelPostTest) panelPostTest.style.display = (tabName === 'posttest') ? 'block' : 'none';
  if (panelSharing) panelSharing.style.display = (tabName === 'sharing') ? 'block' : 'none';

  if (btnEvidence) btnEvidence.classList.toggle('active', tabName === 'evidence');
  if (btnPostTest) btnPostTest.classList.toggle('active', tabName === 'posttest');
  if (btnSharing) btnSharing.classList.toggle('active', tabName === 'sharing');

  // Sync sidebar sub-item active state
  document.querySelectorAll('.tds-nav-sub-item').forEach(item => {
    const sub = item.getAttribute('data-sub');
    item.classList.toggle('active', sub === tabName);
  });

  const headerSub = document.getElementById('trampolinePageSubtitle');
  if (headerSub) {
    if (tabName === 'evidence') {
      headerSub.textContent = 'Pusat tindak lanjut pasca-pelatihan: unggah bukti foto kegiatan & modul materi ke Google Drive.';
    } else if (tabName === 'posttest') {
      headerSub.textContent = 'Pusat tindak lanjut pasca-pelatihan: evaluasi pemahaman peserta melalui lembar Google Form resmi.';
    } else if (tabName === 'sharing') {
      headerSub.textContent = 'Pusat tindak lanjut pasca-pelatihan: pelaporan realisasi sesi knowledge sharing kepada rekan tim.';
    }
  }

  const navGroup = document.getElementById('navGroupPostTraining');
  if (navGroup) {
    navGroup.classList.add('is-open');
  }
}
window.switchTrampolineTab = switchTrampolineTab;

function goToPostTrainingSub(subTab, event) {
  if (event) {
    event.stopPropagation();
  }
  goToPage('post-training');
  switchTrampolineTab(subTab);
}
window.goToPostTrainingSub = goToPostTrainingSub;

function handleNavParentClick(page, groupId, event) {
  if (event) {
    event.preventDefault();
  }
  const group = document.getElementById(groupId);
  if (currentPage === page) {
    if (group) group.classList.toggle('is-open');
  } else {
    goToPage(page);
    if (group) group.classList.add('is-open');
    const activeSub = group ? group.querySelector('.tds-nav-sub-item.active') : null;
    const subName = activeSub ? activeSub.getAttribute('data-sub') : 'evidence';
    switchTrampolineTab(subName);
  }
}
window.handleNavParentClick = handleNavParentClick;

function toggleNavGroup(groupId, event) {
  if (event) {
    event.stopPropagation();
  }
  const group = document.getElementById(groupId);
  if (group) {
    group.classList.toggle('is-open');
  }
}
window.toggleNavGroup = toggleNavGroup;

function populateTrampolineTrainingDropdowns() {
  const selEvidence = document.getElementById('evidenceTrainingSelect');
  const selPostTest = document.getElementById('postTestTrainingSelect');
  const selSharing = document.getElementById('sharingTrainingSelect');
  if (!selEvidence && !selPostTest && !selSharing) return;

  let list = [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) {
    list = [];
  }

  // Collect unique trainings
  const trainingMap = new Map();
  list.forEach(item => {
    const meta = item.meta || {};
    const name = (meta['Nama training'] || item.namaTraining || '').trim();
    if (name) {
      trainingMap.set(name, {
        nama: name,
        id: meta['ID training'] || item.id || '',
        divisi: meta['Departemen / divisi'] || item.divisi || '',
        kategori: meta['Kategori training'] || meta['Kategori'] || 'Soft skill'
      });
    }
  });

  // Gunakan training dari submission riwayat nyata (tanpa data sampel dummy)
  const sampleTrainings = [];
  sampleTrainings.forEach(sample => {
    if (!trainingMap.has(sample.nama)) {
      trainingMap.set(sample.nama, sample);
    }
  });

  window._trampolineTrainingsData = trainingMap;

  const curEvidenceVal = selEvidence ? selEvidence.value : '';
  const curPostTestVal = selPostTest ? selPostTest.value : '';
  const curSharingVal = selSharing ? selSharing.value : '';

  let optionsHtml = '<option value="">-- Silahkan Pilih Training --</option>';
  trainingMap.forEach((val, key) => {
    optionsHtml += `<option value="${escapeHtml(key)}">${escapeHtml(key)}${val.divisi ? ' (' + escapeHtml(val.divisi) + ')' : ''}</option>`;
  });

  if (selEvidence) {
    selEvidence.innerHTML = optionsHtml;
    if (curEvidenceVal && trainingMap.has(curEvidenceVal)) {
      selEvidence.value = curEvidenceVal;
    }
  }
  if (selPostTest) {
    selPostTest.innerHTML = optionsHtml;
    if (curPostTestVal && trainingMap.has(curPostTestVal)) {
      selPostTest.value = curPostTestVal;
    }
  }
  if (selSharing) {
    selSharing.innerHTML = optionsHtml;
    if (curSharingVal && trainingMap.has(curSharingVal)) {
      selSharing.value = curSharingVal;
    }
  }
}
window.populateTrampolineTrainingDropdowns = populateTrampolineTrainingDropdowns;

function handleSharingTrainingChange(trainingName) {
  if (!window._trampolineTrainingsData) return;
  const data = window._trampolineTrainingsData.get(trainingName);
  if (data) {
    const divisiSel = document.getElementById('sharingDivisi');
    if (divisiSel && data.divisi) {
      divisiSel.value = data.divisi;
    }
  }
}
window.handleSharingTrainingChange = handleSharingTrainingChange;

function toggleKnowledgeSharingDetails(checked) {
  const details = document.getElementById('knowledgeSharingDetails');
  if (details) {
    details.style.display = checked ? 'flex' : 'none';
  }
}
window.toggleKnowledgeSharingDetails = toggleKnowledgeSharingDetails;

function handleEvidenceTrainingChange(trainingName) {
  if (!window._trampolineTrainingsData) return;
  const data = window._trampolineTrainingsData.get(trainingName);
  const statsBox = document.getElementById('evidenceAttendanceStats');
  const statsText = document.getElementById('evidenceAttendanceText');

  if (data) {
    if (data.divisi) {
      const divisiSel = document.getElementById('evidenceDivisi');
      if (divisiSel) divisiSel.value = data.divisi;
    }
    if (data.kategori) {
      selectEvidenceCategory(data.kategori);
    }

    // Hitung tingkat kehadiran aktual dari presensi terdaftar
    if (statsBox && statsText) {
      const trnId = String(data.id || '').trim();
      const logs = (typeof getStoredAttendanceLogs === 'function') ? getStoredAttendanceLogs() : [];
      const trnLogs = logs.filter(l => String(l.trainingId).trim() === trnId);
      const uniquePresentEmails = new Set(trnLogs.map(l => String(l.participantEmail).toLowerCase().trim()));

      loadCalendarEntries();
      const submissions = (typeof cachedEntries !== 'undefined' && Array.isArray(cachedEntries)) ? cachedEntries : [];
      const foundSub = submissions.find(s => {
        const sId = (s.meta && s.meta['ID training']) || s.id || '';
        return sId.trim() === trnId;
      });

      const totalParticipants = (foundSub && foundSub.participants && foundSub.participants.length) || uniquePresentEmails.size || 0;
      const presentCount = uniquePresentEmails.size;
      const pct = totalParticipants > 0 ? Math.round((presentCount / totalParticipants) * 100) : 0;

      if (totalParticipants > 0 || presentCount > 0) {
        statsBox.style.display = 'flex';
        statsText.innerHTML = `<strong>Tingkat Kehadiran:</strong> ${presentCount} / ${totalParticipants} Peserta Hadir (${pct}%)`;
      } else {
        statsBox.style.display = 'none';
      }
    }
  } else if (statsBox) {
    statsBox.style.display = 'none';
  }
}
window.handleEvidenceTrainingChange = handleEvidenceTrainingChange;

function handlePostTestTrainingChange(trainingName) {
  if (!window._trampolineTrainingsData) return;
  const data = window._trampolineTrainingsData.get(trainingName);
  if (data) {
    if (data.divisi) {
      const divisiSel = document.getElementById('postTestDivisi');
      if (divisiSel) divisiSel.value = data.divisi;
    }
  }
}
window.handlePostTestTrainingChange = handlePostTestTrainingChange;

// Google Form Post-Test Integration
const GOOGLE_FORM_POST_TEST_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdLNo9kzy22HEKq3xSCBHmZO2ksfCE2K7U_Y3EA2hCzQtRYmw/viewform";

function copyPostTestFormLink() {
  const url = GOOGLE_FORM_POST_TEST_URL;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Tautan Google Form Post-Test berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      fallbackCopyText(url, 'Tautan Google Form Post-Test berhasil disalin ke clipboard!');
    });
  } else {
    fallbackCopyText(url, 'Tautan Google Form Post-Test berhasil disalin ke clipboard!');
  }
}

function togglePostTestPreview() {
  const container = document.getElementById('ptPreviewContainer');
  const btn = document.getElementById('btnTogglePtPreview');
  const btnText = document.getElementById('ptPreviewBtnText');
  const iframe = document.getElementById('ptGoogleFormIframe');

  if (!container) return;

  const isOpen = container.classList.contains('open');
  if (isOpen) {
    container.classList.remove('open');
    if (btnText) btnText.textContent = 'Tampilkan Form di Sini';
  } else {
    container.classList.add('open');
    if (btnText) btnText.textContent = 'Sembunyikan Form';
    if (iframe && (!iframe.src || iframe.src === 'about:blank' || iframe.getAttribute('src') === 'about:blank')) {
      iframe.src = `${GOOGLE_FORM_POST_TEST_URL}?embedded=true`;
    }
  }
}

window.copyPostTestFormLink = copyPostTestFormLink;
window.togglePostTestPreview = togglePostTestPreview;

function selectEvidenceCategory(cat) {
  const hidden = document.getElementById('evidenceKategori');
  const chipSoft = document.getElementById('chipCatSoft');
  const chipHard = document.getElementById('chipCatHard');
  if (hidden) hidden.value = cat;

  if (cat === 'Hard skill') {
    chipHard?.classList.add('selected');
    chipSoft?.classList.remove('selected');
  } else {
    chipSoft?.classList.add('selected');
    chipHard?.classList.remove('selected');
  }
}
window.selectEvidenceCategory = selectEvidenceCategory;

// File Upload Handling
let selectedEvidenceFiles = []; // Array of { file, name, size, type, base64 }

function handleEvidenceFileSelect(e) {
  const files = Array.from(e.target.files || []);
  processEvidenceFiles(files);
  e.target.value = '';
}
window.handleEvidenceFileSelect = handleEvidenceFileSelect;

function handleEvidenceDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('evidenceDropzone')?.classList.add('dragover');
}
window.handleEvidenceDragOver = handleEvidenceDragOver;

function handleEvidenceDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('evidenceDropzone')?.classList.remove('dragover');
}
window.handleEvidenceDragLeave = handleEvidenceDragLeave;

function handleEvidenceDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('evidenceDropzone')?.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files || []);
  processEvidenceFiles(files);
}
window.handleEvidenceDrop = handleEvidenceDrop;

function processEvidenceFiles(newFiles) {
  if (!newFiles || newFiles.length === 0) return;

  const maxFiles = 5;
  const maxBytes = 5 * 1024 * 1024; // 5 MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];

    if (selectedEvidenceFiles.length >= maxFiles) {
      showToast(`Maksimal hanya dapat memilih ${maxFiles} foto evidence.`, 'warning');
      break;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const isAllowed = allowedTypes.includes(file.type) || ['jpg', 'jpeg', 'png'].includes(ext);
    if (!isAllowed) {
      showToast(`File "${file.name}" ditolak. Hanya format JPG dan PNG yang diperbolehkan.`, 'error');
      continue;
    }

    if (file.size > maxBytes) {
      showToast(`File "${file.name}" melebihi batas ukuran 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Silahkan pilih file yang lebih kecil.`, 'error');
      continue;
    }

    const isDuplicate = selectedEvidenceFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
      continue;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        // Optimasi dimensi maksimal (1600px HD) agar foto tajam, cepat diunggah, & hemat kuota
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const optimizedDataUrl = canvas.toDataURL(mime, 0.85);
        const pureBase64 = optimizedDataUrl.substring(optimizedDataUrl.indexOf('base64,') + 7);

        selectedEvidenceFiles.push({
          file: file,
          name: file.name,
          size: Math.round((optimizedDataUrl.length * 3) / 4),
          type: mime,
          previewUrl: optimizedDataUrl,
          base64: pureBase64
        });
        renderEvidencePreview();
      };
      img.onerror = () => {
        const pureBase64 = dataUrl.indexOf('base64,') !== -1 ? dataUrl.substring(dataUrl.indexOf('base64,') + 7) : dataUrl;
        selectedEvidenceFiles.push({
          file: file,
          name: file.name,
          size: file.size,
          type: file.type || (ext === 'png' ? 'image/png' : 'image/jpeg'),
          previewUrl: dataUrl,
          base64: pureBase64
        });
        renderEvidencePreview();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }
}

function renderEvidencePreview() {
  const section = document.getElementById('evidencePreviewSection');
  const countEl = document.getElementById('evidencePreviewCount');
  const grid = document.getElementById('evidencePreviewGrid');
  if (!section || !grid) return;

  if (selectedEvidenceFiles.length === 0) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  if (countEl) countEl.textContent = `${selectedEvidenceFiles.length} dari 5 Foto Terpilih`;

  grid.innerHTML = selectedEvidenceFiles.map((item, index) => {
    const sizeKb = (item.size / 1024).toFixed(0);
    const sizeStr = item.size > 1024 * 1024 ? (item.size / (1024 * 1024)).toFixed(1) + ' MB' : `${sizeKb} KB`;
    const previewSrc = item.previewUrl || (item.base64 ? `data:${item.type || 'image/jpeg'};base64,${item.base64}` : '');
    return `
      <div class="evidence-preview-item">
        <img src="${previewSrc}" alt="${escapeHtml(item.name)}" class="evidence-preview-thumb">
        <div class="evidence-preview-info">
          <span class="evidence-preview-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="evidence-preview-size">${sizeStr}</span>
        </div>
        <button type="button" class="evidence-preview-remove" onclick="removeEvidenceFile(${index})" title="Hapus foto ini">&times;</button>
      </div>
    `;
  }).join('');
}

function removeEvidenceFile(index) {
  selectedEvidenceFiles.splice(index, 1);
  renderEvidencePreview();
}
window.removeEvidenceFile = removeEvidenceFile;

function clearAllEvidenceFiles() {
  selectedEvidenceFiles = [];
  renderEvidencePreview();
}
window.clearAllEvidenceFiles = clearAllEvidenceFiles;

// ==========================================
// MATERIAL / MODUL UPLOAD HANDLING
// ==========================================
let selectedMaterialFiles = []; // Array of { file, name, size, type, ext, base64 }

function handleMaterialFileSelect(e) {
  const files = Array.from(e.target.files || []);
  processMaterialFiles(files);
  e.target.value = '';
}
window.handleMaterialFileSelect = handleMaterialFileSelect;

function handleMaterialDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('materialDropzone')?.classList.add('dragover');
}
window.handleMaterialDragOver = handleMaterialDragOver;

function handleMaterialDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('materialDropzone')?.classList.remove('dragover');
}
window.handleMaterialDragLeave = handleMaterialDragLeave;

function handleMaterialDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('materialDropzone')?.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files || []);
  processMaterialFiles(files);
}
window.handleMaterialDrop = handleMaterialDrop;

function processMaterialFiles(newFiles) {
  if (!newFiles || newFiles.length === 0) return;

  const maxFiles = 5;
  const maxBytes = 25 * 1024 * 1024; // 25 MB
  const allowedExts = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar'];

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];

    if (selectedMaterialFiles.length >= maxFiles) {
      showToast(`Maksimal hanya dapat memilih ${maxFiles} file modul & materi pelatihan.`, 'warning');
      break;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      showToast(`File "${file.name}" ditolak. Hanya format PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, ZIP, RAR yang diperbolehkan.`, 'error');
      continue;
    }

    if (file.size > maxBytes) {
      showToast(`File "${file.name}" melebihi batas ukuran 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Silahkan pilih file yang lebih kecil.`, 'error');
      continue;
    }

    const isDuplicate = selectedMaterialFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
      continue;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const pureBase64 = dataUrl.indexOf('base64,') !== -1 ? dataUrl.substring(dataUrl.indexOf('base64,') + 7) : dataUrl;
      selectedMaterialFiles.push({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        ext: ext,
        base64: pureBase64
      });
      renderMaterialPreview();
    };
    reader.onerror = () => {
      showToast(`Gagal membaca file "${file.name}".`, 'error');
    };
    reader.readAsDataURL(file);
  }
}

function renderMaterialPreview() {
  const section = document.getElementById('materialPreviewSection');
  const countEl = document.getElementById('materialPreviewCount');
  const list = document.getElementById('materialPreviewList');
  if (!section || !list) return;

  if (selectedMaterialFiles.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  if (countEl) countEl.textContent = `${selectedMaterialFiles.length} dari 5 File Terpilih`;

  list.innerHTML = selectedMaterialFiles.map((item, index) => {
    const sizeKb = (item.size / 1024).toFixed(0);
    const sizeStr = item.size > 1024 * 1024 ? (item.size / (1024 * 1024)).toFixed(1) + ' MB' : `${sizeKb} KB`;
    let badgeClass = 'badge-file';
    const ext = (item.ext || 'doc').toLowerCase();
    if (ext === 'pdf') badgeClass = 'badge-pdf';
    else if (ext.startsWith('ppt')) badgeClass = 'badge-ppt';
    else if (ext.startsWith('doc')) badgeClass = 'badge-doc';
    else if (ext.startsWith('xls')) badgeClass = 'badge-xls';
    else if (ext === 'zip' || ext === 'rar') badgeClass = 'badge-zip';

    return `
      <div class="material-preview-item">
        <div class="material-file-badge ${badgeClass}">${escapeHtml(ext.toUpperCase())}</div>
        <div class="material-preview-meta">
          <span class="material-preview-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="material-preview-sub">${sizeStr}</span>
        </div>
        <button type="button" class="material-preview-remove" onclick="removeMaterialFile(${index})" title="Hapus berkas ini">&times;</button>
      </div>
    `;
  }).join('');
}

function removeMaterialFile(index) {
  selectedMaterialFiles.splice(index, 1);
  renderMaterialPreview();
}
window.removeMaterialFile = removeMaterialFile;

function clearAllMaterialFiles() {
  selectedMaterialFiles = [];
  renderMaterialPreview();
}
window.clearAllMaterialFiles = clearAllMaterialFiles;

// ==========================================
// PROPOSAL MODULE / SILABUS UPLOAD (STEP 1)
// ==========================================
let selectedProposalFiles = []; // Array of { file, name, size, type, ext, base64 }

function handleProposalFileSelect(e) {
  const files = Array.from(e.target.files || []);
  processProposalFiles(files);
  e.target.value = '';
}
window.handleProposalFileSelect = handleProposalFileSelect;

function handleProposalDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('proposalDropzone')?.classList.add('dragover');
}
window.handleProposalDragOver = handleProposalDragOver;

function handleProposalDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('proposalDropzone')?.classList.remove('dragover');
}
window.handleProposalDragLeave = handleProposalDragLeave;

function handleProposalDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('proposalDropzone')?.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files || []);
  processProposalFiles(files);
}
window.handleProposalDrop = handleProposalDrop;

function processProposalFiles(newFiles) {
  if (!newFiles || newFiles.length === 0) return;

  const maxFiles = 5;
  const maxBytes = 25 * 1024 * 1024; // 25 MB
  const allowedExts = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar'];

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];

    if (selectedProposalFiles.length >= maxFiles) {
      showToast(`Maksimal hanya dapat melampirkan ${maxFiles} file modul & silabus pelatihan.`, 'warning');
      break;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      showToast(`File "${file.name}" ditolak. Hanya format PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, ZIP, RAR yang diperbolehkan.`, 'error');
      continue;
    }

    if (file.size > maxBytes) {
      showToast(`File "${file.name}" melebihi batas ukuran 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`, 'error');
      continue;
    }

    const isDuplicate = selectedProposalFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
      continue;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const pureBase64 = dataUrl.indexOf('base64,') !== -1 ? dataUrl.substring(dataUrl.indexOf('base64,') + 7) : dataUrl;
      selectedProposalFiles.push({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        ext: ext,
        base64: pureBase64
      });
      renderProposalPreview();
    };
    reader.onerror = () => {
      showToast(`Gagal membaca file "${file.name}".`, 'error');
    };
    reader.readAsDataURL(file);
  }
}

function renderProposalPreview() {
  const section = document.getElementById('proposalPreviewSection');
  const countEl = document.getElementById('proposalPreviewCount');
  const list = document.getElementById('proposalPreviewList');
  if (!section || !list) return;

  if (selectedProposalFiles.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  if (countEl) countEl.textContent = `${selectedProposalFiles.length} dari 5 File Terpilih`;

  list.innerHTML = selectedProposalFiles.map((item, index) => {
    const sizeKb = (item.size / 1024).toFixed(0);
    const sizeStr = item.size > 1024 * 1024 ? (item.size / (1024 * 1024)).toFixed(1) + ' MB' : `${sizeKb} KB`;
    let badgeClass = 'badge-file';
    const ext = (item.ext || 'doc').toLowerCase();
    if (ext === 'pdf') badgeClass = 'badge-pdf';
    else if (ext.startsWith('ppt')) badgeClass = 'badge-ppt';
    else if (ext.startsWith('doc')) badgeClass = 'badge-doc';
    else if (ext.startsWith('xls')) badgeClass = 'badge-xls';
    else if (ext === 'zip' || ext === 'rar') badgeClass = 'badge-zip';

    return `
      <div class="material-preview-item">
        <div class="material-file-badge ${badgeClass}">${escapeHtml(ext.toUpperCase())}</div>
        <div class="material-preview-meta">
          <span class="material-preview-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="material-preview-sub">${sizeStr}</span>
        </div>
        <button type="button" class="material-preview-remove" onclick="removeProposalFile(${index})" title="Hapus berkas ini">&times;</button>
      </div>
    `;
  }).join('');
}

function removeProposalFile(index) {
  selectedProposalFiles.splice(index, 1);
  renderProposalPreview();
}
window.removeProposalFile = removeProposalFile;

function clearAllProposalFiles() {
  selectedProposalFiles = [];
  renderProposalPreview();
}
window.clearAllProposalFiles = clearAllProposalFiles;

async function submitEvidence(e) {
  e.preventDefault();
  const trainingSelect = document.getElementById('evidenceTrainingSelect');
  const namaInput = document.getElementById('evidenceNamaPeserta');
  const divisiSelect = document.getElementById('evidenceDivisi');
  const kategoriHidden = document.getElementById('evidenceKategori');
  const statusBanner = document.getElementById('evidenceStatusBanner');
  const btn = document.getElementById('btnSubmitEvidence');
  const btnText = document.getElementById('btnSubmitEvidenceText');

  if (!trainingSelect?.value) {
    showToast('Silahkan pilih training terlebih dahulu.', 'warning');
    trainingSelect?.focus();
    return;
  }
  if (!namaInput?.value.trim()) {
    showToast('Silahkan masukkan nama peserta / pengunggah.', 'warning');
    namaInput?.focus();
    return;
  }
  if (!divisiSelect?.value) {
    showToast('Silahkan pilih divisi / departemen.', 'warning');
    divisiSelect?.focus();
    return;
  }
  if (selectedEvidenceFiles.length === 0 && selectedMaterialFiles.length === 0) {
    showToast('Silahkan pilih minimal 1 foto dokumentasi kegiatan atau modul/materi pelatihan.', 'warning');
    return;
  }

  const uploadParts = [];
  if (selectedEvidenceFiles.length > 0) uploadParts.push(`${selectedEvidenceFiles.length} Foto`);
  if (selectedMaterialFiles.length > 0) uploadParts.push(`${selectedMaterialFiles.length} Modul/Materi`);
  const uploadDesc = uploadParts.join(' & ');
  const totalCount = selectedEvidenceFiles.length + selectedMaterialFiles.length;

  // Set Loading State
  if (btn) btn.disabled = true;
  if (btnText) btnText.innerHTML = `Sedang Mengunggah ${uploadDesc} ke Drive...`;
  if (statusBanner) {
    statusBanner.className = 'trampoline-banner';
    statusBanner.style.background = 'rgba(75, 150, 255, 0.08)';
    statusBanner.style.color = 'var(--ink)';
    statusBanner.style.border = '1px solid rgba(75, 150, 255, 0.3)';
    statusBanner.style.display = 'flex';
    statusBanner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      <div>Silahkan tunggu, sistem sedang membuat folder Google Drive dan menyimpan ${totalCount} berkas (${uploadDesc})...</div>
    `;
  }

  const payload = {
    action: "submitPostTrainingEvidence",
    namaTraining: trainingSelect.value,
    namaPeserta: namaInput.value.trim(),
    divisi: divisiSelect.value,
    kategori: kategoriHidden?.value || 'Soft skill',
    tanggal: new Date().toISOString().split('T')[0],
    files: selectedEvidenceFiles.map(f => {
      let b64 = f.base64 || '';
      if (b64.indexOf('base64,') !== -1) {
        b64 = b64.substring(b64.indexOf('base64,') + 7);
      }
      return {
        name: f.name,
        type: f.type,
        base64: b64.replace(/[\r\n\s]/g, '')
      };
    }),
    materials: selectedMaterialFiles.map(f => {
      let b64 = f.base64 || '';
      if (b64.indexOf('base64,') !== -1) {
        b64 = b64.substring(b64.indexOf('base64,') + 7);
      }
      return {
        name: f.name,
        type: f.type,
        base64: b64.replace(/[\r\n\s]/g, '')
      };
    })
  };

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data && data.success) {
      const uploadedSummary = [];
      if (selectedEvidenceFiles.length > 0) uploadedSummary.push(`${selectedEvidenceFiles.length} foto dokumentasi`);
      if (selectedMaterialFiles.length > 0) uploadedSummary.push(`${selectedMaterialFiles.length} modul/materi`);
      const uploadedSummaryText = uploadedSummary.join(' dan ');

      showToast('Berkas training berhasil diunggah ke Google Drive & dicatat ke Sheets!', 'success');
      if (statusBanner) {
        statusBanner.className = 'trampoline-banner success';
        statusBanner.style.display = 'flex';
        statusBanner.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <div>
            <strong>Berhasil Diunggah!</strong> Sebanyak ${totalCount} berkas (${uploadedSummaryText}) telah tersimpan rapi di Google Drive dan dicatat ke sheet "Post Training".
            ${data.folderUrl ? `<br><a href="${data.folderUrl}" target="_blank" rel="noopener">Buka Folder Sesi Pelatihan di Google Drive &rarr;</a>` : ''}
          </div>
        `;
      }

      // Simpan riwayat evidence ke localStorage agar tersinkron instan dengan Portal Approval
      try {
        const storedEvidenceRaw = localStorage.getItem('tds_post_training_evidence_list');
        let storedEvidence = storedEvidenceRaw ? JSON.parse(storedEvidenceRaw) : [];
        if (!Array.isArray(storedEvidence)) storedEvidence = [];

        // Siapkan thumbnail foto untuk galeri collection
        const photoPreviews = selectedEvidenceFiles.slice(0, 5).map(f => ({
          name: f.name,
          type: f.type,
          dataUrl: f.base64 ? `data:${f.type || 'image/jpeg'};base64,${f.base64}` : ''
        }));
        const materialList = selectedMaterialFiles.map(f => ({
          name: f.name,
          size: f.size,
          ext: f.ext,
          type: f.type
        }));

        storedEvidence.unshift({
          id: 'EVD-' + Date.now(),
          waktuSubmit: new Date().toLocaleString('id-ID'),
          tipeAktivitas: 'Unggah Bukti & Materi',
          namaTraining: trainingSelect.value,
          namaPeserta: namaInput.value.trim(),
          divisi: divisiSelect.value,
          kategori: kategoriHidden?.value || 'Soft skill',
          jumlahFile: totalCount,
          folderUrl: data.folderUrl || '',
          detailFile: (data.files || []).map((f, i) => `${i + 1}. ${f.name} (${f.url})`).join('\n') || '',
          fileUrls: (data.files || []).map(f => f.url).filter(Boolean),
          photos: photoPreviews,
          materials: materialList,
          skorPostTest: '-',
          catatan: '-',
          status: 'Selesai & Berdokumentasi'
        });

        if (storedEvidence.length > 50) storedEvidence = storedEvidence.slice(0, 50);
        localStorage.setItem('tds_post_training_evidence_list', JSON.stringify(storedEvidence));
      } catch (eStore) {
        console.warn('Gagal menyimpan cache lokal evidence:', eStore);
      }

      clearAllEvidenceFiles();
      clearAllMaterialFiles();
      namaInput.value = '';
    } else {
      throw new Error(data?.message || 'Gagal menyimpan berkas ke Google Drive.');
    }
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
    if (statusBanner) {
      statusBanner.className = 'trampoline-banner error';
      statusBanner.style.display = 'flex';
      statusBanner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <div><strong>Gagal Mengunggah:</strong> ${escapeHtml(err.message)}. Silahkan periksa koneksi internet Anda atau coba beberapa saat lagi.</div>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerHTML = 'Unggah &amp; Simpan ke Drive';
  }
}
window.submitEvidence = submitEvidence;

async function submitPostTest(e) {
  e.preventDefault();
  const trainingSelect = document.getElementById('postTestTrainingSelect');
  const namaInput = document.getElementById('postTestNamaPeserta');
  const divisiSelect = document.getElementById('postTestDivisi');
  const catatanInput = document.getElementById('postTestCatatan');
  const statusBanner = document.getElementById('postTestStatusBanner');
  const btn = document.getElementById('btnSubmitPostTest');
  const btnText = document.getElementById('btnSubmitPostTestText');

  if (!trainingSelect?.value) {
    showToast('Silahkan pilih training terlebih dahulu.', 'warning');
    trainingSelect?.focus();
    return;
  }
  if (!namaInput?.value.trim()) {
    showToast('Silahkan masukkan nama peserta.', 'warning');
    namaInput?.focus();
    return;
  }
  if (!divisiSelect?.value) {
    showToast('Silahkan pilih divisi / departemen.', 'warning');
    divisiSelect?.focus();
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.innerHTML = 'Sedang Menyimpan ke Sheets...';
  if (statusBanner) {
    statusBanner.className = 'trampoline-banner';
    statusBanner.style.background = 'rgba(75, 150, 255, 0.08)';
    statusBanner.style.color = 'var(--ink)';
    statusBanner.style.border = '1px solid rgba(75, 150, 255, 0.3)';
    statusBanner.style.display = 'flex';
    statusBanner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      <div>Silahkan tunggu, data evaluasi post-test sedang dicatat ke spreadsheet...</div>
    `;
  }

  const payload = {
    action: "submitPostTest",
    namaTraining: trainingSelect.value,
    namaPeserta: namaInput.value.trim(),
    divisi: divisiSelect.value,
    skor: "-",
    jawaban: catatanInput?.value.trim() || '-',
    tanggal: new Date().toISOString().split('T')[0]
  };

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data && data.success) {
      showToast('Konfirmasi post-test berhasil dicatat ke Google Sheets!', 'success');
      if (statusBanner) {
        statusBanner.className = 'trampoline-banner success';
        statusBanner.style.display = 'flex';
        statusBanner.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <div><strong>Tersimpan!</strong> Konfirmasi evaluasi post-test atas nama <strong>${escapeHtml(namaInput.value.trim())}</strong> telah berhasil dicatat ke sheet "Post Training".</div>
        `;
      }

      // Perbarui catatan post-test pada riwayat evidence lokal jika nama training cocok
      try {
        const storedEvidenceRaw = localStorage.getItem('tds_post_training_evidence_list');
        let storedEvidence = storedEvidenceRaw ? JSON.parse(storedEvidenceRaw) : [];
        if (Array.isArray(storedEvidence)) {
          let matched = false;
          storedEvidence.forEach(item => {
            if (item.namaTraining === trainingSelect.value) {
              item.skorPostTest = '-';
              if (catatanInput?.value.trim()) item.catatan = catatanInput.value.trim();
              matched = true;
            }
          });
          if (!matched) {
            storedEvidence.unshift({
              id: 'EVD-' + Date.now(),
              waktuSubmit: new Date().toLocaleString('id-ID'),
              tipeAktivitas: 'Post Test',
              namaTraining: trainingSelect.value,
              namaPeserta: namaInput.value.trim(),
              divisi: divisiSelect.value,
              kategori: 'Soft skill',
              jumlahFile: 0,
              folderUrl: '',
              detailFile: '-',
              fileUrls: [],
              photos: [],
              skorPostTest: '-',
              catatan: catatanInput?.value.trim() || '-',
              status: 'Selesai & Berdokumentasi'
            });
          }
          localStorage.setItem('tds_post_training_evidence_list', JSON.stringify(storedEvidence));
        }
      } catch (eStore) {
        console.warn('Gagal update cache lokal post-test:', eStore);
      }

      namaInput.value = '';
      if (catatanInput) catatanInput.value = '';
    } else {
      throw new Error(data?.message || 'Gagal mencatat hasil post-test ke Google Sheets.');
    }
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
    if (statusBanner) {
      statusBanner.className = 'trampoline-banner error';
      statusBanner.style.display = 'flex';
      statusBanner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <div><strong>Gagal Menyimpan:</strong> ${escapeHtml(err.message)}. Silahkan periksa koneksi internet Anda atau coba beberapa saat lagi.</div>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerHTML = 'Simpan Hasil Post-Test';
  }
}
window.submitPostTest = submitPostTest;

async function submitKnowledgeSharing(e) {
  e.preventDefault();
  const trainingSelect = document.getElementById('sharingTrainingSelect');
  const speakerInput = document.getElementById('sharingNamaSpeaker');
  const divisiSelect = document.getElementById('sharingDivisi');
  const tglInput = document.getElementById('sharingTanggalSesi');
  const pesertaInput = document.getElementById('sharingJumlahPeserta');
  const linkInput = document.getElementById('sharingLinkRecording');
  const topikInput = document.getElementById('sharingTopikRingkas');
  const statusBanner = document.getElementById('sharingStatusBanner');
  const btn = document.getElementById('btnSubmitSharing');
  const btnText = document.getElementById('btnSubmitSharingText');

  if (!trainingSelect?.value) {
    showToast('Silahkan pilih training terlebih dahulu.', 'warning');
    trainingSelect?.focus();
    return;
  }
  if (!speakerInput?.value.trim()) {
    showToast('Silahkan masukkan nama pembicara / alumni training.', 'warning');
    speakerInput?.focus();
    return;
  }
  if (!divisiSelect?.value) {
    showToast('Silahkan pilih divisi audiens.', 'warning');
    divisiSelect?.focus();
    return;
  }
  if (!tglInput?.value) {
    showToast('Silahkan tentukan tanggal sesi sharing dilaksanakan.', 'warning');
    tglInput?.focus();
    return;
  }

  // Set Loading State
  if (btn) btn.disabled = true;
  if (btnText) btnText.innerHTML = 'Sedang Mencatat Sesi Sharing...';
  if (statusBanner) {
    statusBanner.className = 'trampoline-banner';
    statusBanner.style.background = 'rgba(75, 150, 255, 0.08)';
    statusBanner.style.color = 'var(--ink)';
    statusBanner.style.border = '1px solid rgba(75, 150, 255, 0.3)';
    statusBanner.style.display = 'flex';
    statusBanner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      <div>Silahkan tunggu, sistem sedang menyimpan pelaporan knowledge sharing ke spreadsheet...</div>
    `;
  }

  const payload = {
    action: "submitKnowledgeSharing",
    namaTraining: trainingSelect.value,
    namaSpeaker: speakerInput.value.trim(),
    divisi: divisiSelect.value,
    tanggalSesi: tglInput.value,
    jumlahPeserta: Number(pesertaInput?.value) || 1,
    linkRecording: (linkInput?.value || '').trim(),
    topikMateri: (topikInput?.value || '').trim()
  };

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data && data.success) {
      showToast('Laporan knowledge sharing berhasil disimpan ke spreadsheet!', 'success');
      if (statusBanner) {
        statusBanner.className = 'trampoline-banner success';
        statusBanner.style.display = 'flex';
        statusBanner.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <div>
            <strong>Berhasil Dicatat!</strong> Sesi knowledge sharing "${escapeHtml(trainingSelect.value)}" oleh ${escapeHtml(speakerInput.value.trim())} telah berhasil didokumentasikan ke sheet "Post Training".
          </div>
        `;
      }

      // Update riwayat lokal
      try {
        const storedEvidenceRaw = localStorage.getItem('tds_post_training_evidence_list');
        let storedEvidence = storedEvidenceRaw ? JSON.parse(storedEvidenceRaw) : [];
        if (!Array.isArray(storedEvidence)) storedEvidence = [];

        storedEvidence.unshift({
          id: 'KS-' + Date.now(),
          waktuSubmit: new Date().toLocaleString('id-ID'),
          tipeAktivitas: 'Knowledge Sharing',
          namaTraining: trainingSelect.value,
          namaPeserta: speakerInput.value.trim(),
          divisi: divisiSelect.value,
          kategori: 'Internal Transfer',
          jumlahFile: 0,
          folderUrl: payload.linkRecording || '-',
          detailFile: `Sesi Sharing: ${payload.tanggalSesi}, Hadir: ${payload.jumlahPeserta} org. Topik: ${payload.topikMateri}`,
          fileUrls: payload.linkRecording ? [payload.linkRecording] : [],
          photos: [],
          materials: [],
          skorPostTest: '-',
          catatan: payload.topikMateri || '-',
          status: 'Terdokumentasi'
        });

        if (storedEvidence.length > 50) storedEvidence = storedEvidence.slice(0, 50);
        localStorage.setItem('tds_post_training_evidence_list', JSON.stringify(storedEvidence));
      } catch (eStore) {
        console.warn('Gagal menyimpan cache lokal sharing:', eStore);
      }

      // Reset form
      speakerInput.value = '';
      if (pesertaInput) pesertaInput.value = '';
      if (linkInput) linkInput.value = '';
      if (topikInput) topikInput.value = '';
    } else {
      throw new Error(data?.message || 'Gagal menyimpan laporan knowledge sharing.');
    }
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
    if (statusBanner) {
      statusBanner.className = 'trampoline-banner error';
      statusBanner.style.display = 'flex';
      statusBanner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <div><strong>Gagal Menyimpan:</strong> ${escapeHtml(err.message)}. Silahkan periksa koneksi internet Anda atau coba beberapa saat lagi.</div>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerHTML = 'Simpan Laporan Sharing';
  }
}
window.submitKnowledgeSharing = submitKnowledgeSharing;

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
      errEl.textContent = 'PIN Approval salah. Silahkan coba lagi.';
      errEl.style.display = 'block';
    }
    showToast('PIN Approval salah. Silahkan coba lagi (Default: ubahpin123).', 'error');
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
    goToPage('portal-approval');
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
    showToast('Akses Portal Approval berhasil dibuka.', 'success');
    goToPage('portal-approval');
  } else if (pinInput) {
    pinInput.classList.add('error');
    showToast('PIN Admin salah. Silahkan coba lagi (Default: ubahpin123).', 'error');
    setTimeout(() => pinInput.classList.remove('error'), 1500);
  }
}

function cancelAdminPin() {
  closeModal('modalAdminPin');
  if (currentPage === 'portal-approval') {
    goToPage('ajukan');
  } else {
    goToPage(currentPage);
  }
}

function lockAdminAccess() {
  sessionStorage.removeItem('admin_unlocked');
  goToPage('ajukan');
  showToast('Sesi Portal Approval telah dikunci.', 'info');
}

function switchView(view) {
  if (view === 'form') {
    goToPage('ajukan');
  } else {
    goToPage('portal-approval');
  }
}

// ==========================================
// Dashboard Landing Page Logic (#page-dashboard)
// ==========================================
function renderDashboardLandingPage() {
  const entries = cachedEntries || [];
  const currentYear = new Date().getFullYear();

  // 1. KPI Total Training (Tahun Berjalan)
  const thisYearEntries = entries.filter(e => {
    if (e.submittedAt && new Date(e.submittedAt).getFullYear() === currentYear) return true;
    if (e.meta && e.meta['Tanggal pengajuan'] && e.meta['Tanggal pengajuan'].startsWith(String(currentYear))) return true;
    if (e.modules && e.modules.some(m => m.tanggal && m.tanggal.startsWith(String(currentYear)))) return true;
    if (e.meta && e.meta['Tanggal & jam pelaksanaan'] && e.meta['Tanggal & jam pelaksanaan'].includes(String(currentYear))) return true;
    return false;
  });

  const kpiTotalEl = document.getElementById('dashKpiTotal');
  if (kpiTotalEl) kpiTotalEl.textContent = thisYearEntries.length;
  const kpiTotalSubEl = document.getElementById('dashKpiTotalSub');
  if (kpiTotalSubEl) kpiTotalSubEl.textContent = `Tahun ${currentYear} (${entries.length} total)`;

  // 2. Status Breakdown
  let pendingCount = 0, approvedCount = 0, rejectedCount = 0;
  entries.forEach(e => {
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

  const kpiPendingEl = document.getElementById('dashKpiPending');
  if (kpiPendingEl) {
    kpiPendingEl.innerHTML = `${pendingCount} <small style="font-size:13px;font-weight:500;color:var(--ink-soft);">Pending</small>`;
  }
  const kpiStatusSubEl = document.getElementById('dashKpiStatusSub');
  if (kpiStatusSubEl) {
    kpiStatusSubEl.innerHTML = `
      <span class="mini-pill approved" style="padding:2px 7px;font-size:11px;"><span class="dot"></span>${approvedCount} Approved</span>
      <span class="mini-pill rejected" style="padding:2px 7px;font-size:11px;"><span class="dot"></span>${rejectedCount} Rejected</span>
    `;
  }

  // 3. Total Budget Diajukan
  let totalDiajukan = 0;
  entries.forEach(e => {
    const m = e.meta || {};
    totalDiajukan += rupiahToNumber(m['Budget diajukan'] || m['Estimasi biaya'] || '0');
  });

  const kpiBudgetEl = document.getElementById('dashKpiBudget');
  if (kpiBudgetEl) {
    kpiBudgetEl.textContent = 'Rp ' + new Intl.NumberFormat('id-ID').format(totalDiajukan);
  }

  // 4. Jenis Program
  let internalCount = 0, eksternalCount = 0, mandiriCount = 0;
  entries.forEach(e => {
    const j = ((e.meta && e.meta['Jenis training']) || '').toLowerCase();
    if (j.includes('eksternal')) eksternalCount++;
    else if (j.includes('mandiri')) mandiriCount++;
    else internalCount++;
  });

  const kpiJenisEl = document.getElementById('dashKpiJenis');
  if (kpiJenisEl) kpiJenisEl.textContent = `${entries.length} Program`;
  const kpiJenisSubEl = document.getElementById('dashKpiJenisSub');
  if (kpiJenisSubEl) {
    kpiJenisSubEl.textContent = `${internalCount} Internal • ${eksternalCount} Eksternal • ${mandiriCount} Mandiri`;
  }

  // 5. Training Terdekat (3-4 sesi mendatang yang belum lewat)
  const upcomingListEl = document.getElementById('dashUpcomingList');
  if (upcomingListEl) {
    const todayStr = new Date().toISOString().split('T')[0];
    const allSessions = getAllTrainingSessions(entries);
    const upcoming = allSessions
      .filter(s => s.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);

    if (upcoming.length === 0) {
      upcomingListEl.innerHTML = `
        <div class="dash-empty-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);margin-bottom:8px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <div style="font-weight:600;font-size:13.5px;color:var(--ink);margin-bottom:3px;">Belum Ada Agenda Mendatang</div>
          <div style="font-size:12px;color:var(--ink-soft);">Seluruh sesi training aktif yang dijadwalkan akan muncul otomatis di sini.</div>
        </div>
      `;
    } else {
      upcomingListEl.innerHTML = '';
      upcoming.forEach(s => {
        const item = document.createElement('div');
        item.className = 'dash-session-item';
        item.innerHTML = `
          <div class="dash-session-head">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="upcoming-date-badge">${formatDateIndo(s.date)}</span>
              <span class="dash-session-id">${escapeHtml(s.id)}</span>
            </div>
            <span class="mini-pill ${s.statusClass}"><span class="dot"></span>${escapeHtml(s.status)}</span>
          </div>
          <div class="dash-session-modul">${escapeHtml(s.modulName)}</div>
          <div class="dash-session-meta">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              ${escapeHtml(s.time || '-')}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${escapeHtml(s.lokasi || '-')}
            </span>
          </div>
          <div class="dash-session-foot">
            <button type="button" class="btn-cal-detail">
              <span>Lihat Detail</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        `;
        item.addEventListener('click', () => showDetail(s.entry, s.entryIndex));
        const btn = item.querySelector('.btn-cal-detail');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetail(s.entry, s.entryIndex);
          });
        }
        upcomingListEl.appendChild(item);
      });
    }
  }

  // 6. Pengajuan Training Terkini (5 Terbaru)
  const recentTableBody = document.getElementById('dashRecentTableBody');
  if (recentTableBody) {
    if (!entries || entries.length === 0) {
      recentTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:28px 16px;color:var(--ink-soft);font-size:12.5px;">
            Belum ada data pengajuan training. Klik <strong>Ajukan Training Baru</strong> untuk memulai pengajuan.
          </td>
        </tr>
      `;
    } else {
      const recentList = entries
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .slice(-5)
        .reverse();

      recentTableBody.innerHTML = '';
      recentList.forEach(({ entry, originalIndex }) => {
        const m = entry.meta || {};
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--line-soft)';
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.12s ease';

        const tglPengajuan = m['Tanggal pengajuan'] || (entry.submittedAt ? entry.submittedAt.split('T')[0] : '-');
        const formattedDate = tglPengajuan !== '-' ? formatDateIndo(tglPengajuan) : '-';
        const namaTraining = m['Nama training'] || 'Pelatihan Karyawan';
        const leader = m['Leader pengaju'] || '-';
        const dept = m['Departemen / divisi'] || '-';
        const metode = m['Metode training'] || 'Onsite';
        const modulCount = (entry.modules && entry.modules.length) ? entry.modules.length : 1;
        const statusClass = entry.statusClass || 'pending';
        const statusText = entry.status || 'Pending';

        tr.innerHTML = `
          <td style="padding:10px 14px;font-size:12px;vertical-align:middle;white-space:nowrap;">
            <strong style="color:var(--ink);">${escapeHtml(m['ID training'] || 'TRN-...')}</strong>
            <div style="font-size:11px;color:var(--ink-faint);">${escapeHtml(formattedDate)}</div>
          </td>
          <td style="padding:10px 14px;font-size:12.5px;font-weight:600;color:var(--ink);vertical-align:middle;">
            ${escapeHtml(namaTraining)}
          </td>
          <td style="padding:10px 14px;font-size:12px;color:var(--ink-soft);vertical-align:middle;white-space:nowrap;">
            <div style="font-weight:500;color:var(--ink);">${escapeHtml(leader)}</div>
            <div style="font-size:11px;color:var(--ink-faint);">${escapeHtml(dept)}</div>
          </td>
          <td style="padding:10px 14px;font-size:12px;color:var(--ink-soft);vertical-align:middle;white-space:nowrap;">
            <span>${escapeHtml(metode)}</span> &bull; <span>${modulCount} Sesi</span>
          </td>
          <td style="padding:10px 14px;vertical-align:middle;white-space:nowrap;">
            <span class="mini-pill ${statusClass}" style="padding:3px 8px;font-size:11px;">
              <span class="dot"></span>${escapeHtml(statusText)}
            </span>
          </td>
          <td style="padding:10px 14px;text-align:center;vertical-align:middle;white-space:nowrap;">
            <button type="button" class="btn-table-action" onclick="event.stopPropagation(); showDetail(cachedEntries[${originalIndex}], ${originalIndex});">
              Detail
            </button>
          </td>
        `;

        tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = 'rgba(75, 150, 255, 0.04)'; });
        tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = 'transparent'; });
        tr.addEventListener('click', () => { showDetail(entry, originalIndex); });

        recentTableBody.appendChild(tr);
      });
    }
  }
}

// ==========================================
// Training Saya & Kanban Board Logic (#page-training-saya)
// ==========================================
function resetMyTrainingSearch() {
  const searchInput = document.getElementById('myTrainingSearchInput');
  if (searchInput) searchInput.value = '';
  const promptEl = document.getElementById('myTrainingsPrompt');
  const kanbanEl = document.getElementById('myTrainingsKanban');
  if (promptEl) promptEl.style.display = 'block';
  if (kanbanEl) {
    kanbanEl.style.display = 'none';
    kanbanEl.innerHTML = '';
  }
}

function searchMyTrainings() {
  const searchInput = document.getElementById('myTrainingSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();
  const promptEl = document.getElementById('myTrainingsPrompt');
  const kanbanEl = document.getElementById('myTrainingsKanban');

  if (!query) {
    resetMyTrainingSearch();
    return;
  }

  loadCalendarEntries();
  const entries = cachedEntries || [];
  const indexedEntries = entries.map((entry, originalIndex) => ({ entry, originalIndex }));

  const filtered = indexedEntries.filter(item => {
    const m = item.entry.meta || {};
    const leader = (m['Leader pengaju'] || m['Nama pengaju'] || '').toLowerCase();
    const email = (m['Email pengaju'] || '').toLowerCase();
    return leader.includes(query) || email.includes(query);
  });

  if (promptEl) promptEl.style.display = 'none';
  if (kanbanEl) {
    kanbanEl.style.display = 'block';
    if (filtered.length === 0) {
      kanbanEl.innerHTML = `
        <div class="helper-note" style="padding:36px 20px;text-align:center;background:var(--panel);border-radius:var(--radius);border:1px dashed var(--line);max-width:540px;margin:20px auto;">
          <div style="font-weight:600;font-size:14px;color:var(--ink);margin-bottom:4px;">Tidak Ditemukan</div>
          <div style="font-size:13px;color:var(--ink-soft);">Tidak ada pengajuan training dengan nama pengaju "<strong>${escapeHtml(searchInput.value.trim())}</strong>".</div>
        </div>
      `;
    } else {
      renderKanbanBoard(filtered, 'myTrainingsKanban');
    }
  }
}

function renderKanbanBoard(filteredItems, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cols = {
    pending: { title: 'Menunggu Approval', class: 'pending', items: [] },
    approved: { title: 'Disetujui', class: 'approved', items: [] },
    rejected: { title: 'Ditolak / Revisi', class: 'rejected', items: [] }
  };

  filteredItems.forEach(item => {
    const e = item.entry;
    const s = (e.status || '').toLowerCase();
    const sc = (e.statusClass || '').toLowerCase();
    if (sc === 'approved' || s.includes('disetujui') || s.includes('approved')) {
      cols.approved.items.push(item);
    } else if (sc === 'rejected' || s.includes('ditolak') || s.includes('rejected')) {
      cols.rejected.items.push(item);
    } else {
      cols.pending.items.push(item);
    }
  });

  let html = `<div class="kanban-board">`;

  ['pending', 'approved', 'rejected'].forEach(key => {
    const col = cols[key];
    html += `
      <div class="kanban-col ${col.class}">
        <div class="kanban-col-head">
          <span class="kanban-col-title">${col.title}</span>
          <span class="kanban-col-badge">${col.items.length}</span>
        </div>
        <div class="kanban-cards">
    `;

    if (col.items.length === 0) {
      html += `<div class="kanban-empty">Tidak ada pengajuan</div>`;
    } else {
      col.items.forEach(item => {
        const m = item.entry.meta || {};
        const pCount = (item.entry.participants || []).filter(p => p.nama).length;
        const submitDate = item.entry.submittedAt
          ? new Date(item.entry.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '-';
        html += `
          <div class="kanban-card" onclick="showDetail(cachedEntries[${item.originalIndex}], ${item.originalIndex})">
            <div class="kanban-card-head">
              <span class="kanban-card-id">${m['ID training'] || 'TRN'}</span>
              <span style="font-size:11px;color:var(--ink-faint);">${submitDate}</span>
            </div>
            <div class="kanban-card-title">${escapeHtml(m['Nama training'] || '-')}</div>
            <div class="kanban-card-meta">
              <div><strong>Pengaju:</strong> ${escapeHtml(m['Nama pengaju'] || m['Leader pengaju'] || '-')} (${escapeHtml(m['Departemen / divisi'] || '-')})</div>
              <div><strong>Jadwal:</strong> ${escapeHtml(m['Tanggal & jam pelaksanaan'] || '-')}</div>
              <div><strong>Peserta:</strong> ${pCount} orang &bull; <strong>Budget:</strong> ${escapeHtml(m['Budget diajukan'] || m['Estimasi biaya'] || 'Rp 0')}</div>
            </div>
            <div class="kanban-card-footer">
              <span class="mini-pill ${item.entry.statusClass || 'draft'}"><span class="dot"></span>${item.entry.status || 'Diajukan'}</span>
              <button type="button" class="btn-cal-detail" onclick="event.stopPropagation(); showDetail(cachedEntries[${item.originalIndex}], ${item.originalIndex})">
                <span>Detail</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ==========================================
// Vendor Directory Logic (#page-vendor)
// ==========================================
function renderVendorDirectoryPage() {
  const container = document.getElementById('vendorDirectoryContainer');
  if (!container) return;

  loadCalendarEntries();
  const entries = cachedEntries || [];

  const vendorMap = new Map();
  entries.forEach((entry, entryIndex) => {
    const vendors = entry.vendors || [];
    vendors.forEach(v => {
      const name = (v.nama || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!vendorMap.has(key)) {
        vendorMap.set(key, {
          nama: name,
          kontak: (v.kontak || '').trim() || '-',
          catatan: (v.catatan || '').trim() || '-',
          count: 0,
          trainings: []
        });
      }
      const item = vendorMap.get(key);
      item.count++;
      if ((v.kontak || '').trim()) item.kontak = v.kontak.trim();
      if ((v.catatan || '').trim()) item.catatan = v.catatan.trim();
      const trnTitle = (entry.meta && entry.meta['Nama training']) || entry.meta?.['ID training'] || 'Training';
      item.trainings.push({
        id: entry.meta?.['ID training'] || '',
        title: trnTitle,
        entryIndex
      });
    });
  });

  const vendorList = Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);

  if (vendorList.length === 0) {
    container.innerHTML = `
      <div class="helper-note" style="padding:48px 24px;text-align:center;background:var(--panel);border-radius:var(--radius);border:1px dashed var(--line);max-width:540px;margin:32px auto;">
        <div class="card-icon-wrap" style="width:48px;height:48px;border-radius:14px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:var(--accent-tint);color:var(--accent);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path><path d="M9 8h1"></path><path d="M9 12h1"></path><path d="M9 16h1"></path><path d="M14 8h1"></path><path d="M14 12h1"></path><path d="M14 16h1"></path></svg>
        </div>
        <div style="font-weight:700;color:var(--ink);font-size:16px;margin-bottom:6px;">Belum ada data vendor</div>
        <div style="font-size:13.5px;color:var(--ink-soft);line-height:1.6;">Vendor akan otomatis muncul di sini setelah training eksternal diajukan.</div>
      </div>
    `;
    return;
  }

  let html = `<div class="vendor-grid">`;
  vendorList.forEach(v => {
    html += `
      <div class="vendor-card">
        <div>
          <div class="vendor-card-head">
            <h4 class="vendor-card-title">${escapeHtml(v.nama)}</h4>
            <span class="vendor-card-badge">${v.count}x Dipakai</span>
          </div>
          <div class="vendor-meta-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span><strong>Kontak / PIC:</strong> ${escapeHtml(v.kontak)}</span>
          </div>
          <div class="vendor-notes">
            <strong>Catatan Terakhir:</strong> ${escapeHtml(v.catatan)}
          </div>
        </div>
        <div style="font-size:11.5px;color:var(--ink-soft);border-top:1px dashed var(--line-soft);padding-top:8px;">
          <strong>Pelatihan terkait:</strong> ${v.trainings.slice(0, 2).map(t => escapeHtml(t.id || t.title)).join(', ')}${v.trainings.length > 2 ? ` (+${v.trainings.length - 2} lainnya)` : ''}
        </div>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
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
  if (m['Metode training'] === 'Online') {
    const platform = m['Platform online'] || 'Google Meet';
    const link = m['Link meeting online'] ? ` (${m['Link meeting online']})` : (platform === 'Google Meet' ? ' (Otomatis Google Meet)' : ' (Link Menyusul / TBA)');
    venueDisplay = `Online [${platform}${link}]`;
  } else if (m['Metode training'] === 'Hybrid') {
    const platform = m['Platform online'] || 'Online';
    const link = m['Link meeting online'] ? ` (${m['Link meeting online']})` : (platform === 'Google Meet' ? ' (Otomatis Google Meet)' : '');
    venueDisplay = `${venueDisplay} & Online [${platform}${link}]`;
  }
  setRev('revVenue', venueDisplay);
  setRev('revTrainer', m['Trainer']);

  const countPeserta = (data.participants || []).filter(p => p.nama).length;
  const countEmail = (data.participants || []).filter(p => p.email).length;
  setRev('revDurationParticipants', `${m['Total durasi belajar'] || '-'} • ${countPeserta} Peserta (${countEmail} Email terdaftar)`);
  const evaluasiDisplay = m['PIC evaluasi'] ? `${m['PIC evaluasi']} (${m['Waktu evaluasi'] || 'Setelah training'})` : (m['Waktu evaluasi'] || '-');
  setRev('revEvaluasi', evaluasiDisplay);
  setRev('revBudget', m['Budget diajukan'] || m['Estimasi biaya'] || 'Rp 0');

  const goalsText = m['Training goals'] || m['Training plan purpose'] || '';
  const goalsWrap = document.getElementById('revGoalsWrapper');
  const goalsEl = document.getElementById('revGoals');
  if (goalsWrap && goalsEl) {
    if (goalsText) {
      goalsEl.textContent = goalsText;
      goalsWrap.style.display = 'block';
    } else {
      goalsWrap.style.display = 'none';
    }
  }

  const matWrap = document.getElementById('revMaterialsWrapper');
  const matEl = document.getElementById('revMaterials');
  if (matWrap && matEl) {
    const fileCount = (selectedProposalFiles || []).length;
    const driveLink = (m['Link silabus materi'] || document.getElementById('linkSilabusDrive')?.value || '').trim();
    const matSummary = [];
    if (fileCount > 0) {
      matSummary.push(`<strong>${fileCount} Berkas Terlampir:</strong> ${selectedProposalFiles.map(f => escapeHtml(f.name)).join(', ')}`);
    }
    if (driveLink) {
      matSummary.push(`<strong>Tautan Cloud:</strong> <a href="${escapeHtml(driveLink)}" target="_blank" style="color:var(--accent);text-decoration:underline;word-break:break-all;">${escapeHtml(driveLink)}</a>`);
    }
    if (matSummary.length > 0) {
      matEl.innerHTML = matSummary.join('<br>');
      matWrap.style.display = 'block';
    } else {
      matWrap.style.display = 'none';
    }
  }
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

  // Fallback Training plan purpose from Training goals if only goals was filled
  if (!meta['Training plan purpose'] && meta['Training goals']) {
    meta['Training plan purpose'] = meta['Training goals'];
  }

  // Ensure schedule, duration, and participant counts are fresh
  meta['Tanggal & jam pelaksanaan'] = document.getElementById('jadwal')?.value || meta['Tanggal & jam pelaksanaan'] || '';
  meta['Tanggal pelaksanaan (raw)'] = document.getElementById('tglPelaksanaan')?.value || meta['Tanggal pelaksanaan (raw)'] || '';
  meta['Jam mulai (raw)'] = document.getElementById('jamMulai')?.value || meta['Jam mulai (raw)'] || '';
  meta['Jam selesai (raw)'] = document.getElementById('jamSelesai')?.value || meta['Jam selesai (raw)'] || '';
  meta['Total durasi belajar'] = document.getElementById('totalDuration')?.value || meta['Total durasi belajar'] || '';
  meta['Jumlah partisipan (rencana)'] = document.getElementById('plannedParticipants')?.value || meta['Jumlah partisipan (rencana)'] || '';
  meta['Lokasi / venue'] = document.getElementById('lokasi')?.value || meta['Lokasi / venue'] || '';

  // Penanganan metode Online & Link Meeting
  if (meta['Metode training'] === 'Online') {
    const platform = meta['Platform online'] || 'Google Meet';
    meta['Lokasi / venue'] = platform;
    if (!meta['Link meeting online']) {
      meta['Link meeting online'] = platform === 'Google Meet' ? 'Auto-generate Google Meet' : 'Menyusul dari Vendor (TBA)';
    }
  } else if (meta['Metode training'] === 'Hybrid') {
    if (!meta['Link meeting online'] && meta['Platform online'] === 'Google Meet') {
      meta['Link meeting online'] = 'Auto-generate Google Meet';
    }
  }

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

  meta['Waktu evaluasi'] = meta['Waktu evaluasi'] || meta['Interval follow-up'] || 'Setelah training';
  meta['Interval follow-up'] = meta['Waktu evaluasi'];

  meta['PIC evaluasi'] = meta['PIC evaluasi'] || meta['PIC monitoring'] || meta['Nama pengaju'] || meta['Leader pengaju'] || '';
  meta['PIC monitoring'] = meta['PIC evaluasi'];

  const wajibSharing = document.getElementById('wajibKnowledgeSharing');
  meta['Komitmen knowledge sharing'] = wajibSharing && wajibSharing.checked ? 'Ya' : 'Tidak';
  meta['Target audiens sharing'] = (document.getElementById('targetAudiensSharing')?.value || '').trim() || '-';
  meta['Estimasi tanggal sharing'] = document.getElementById('tglRencanaSharing')?.value || '-';

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
    if (tr.id === 'participantEmptyRow') return;
    const inputName = tr.querySelector('.participant-name') || tr.querySelectorAll('input')[0];
    const inputEmail = tr.querySelector('.participant-email') || tr.querySelectorAll('input')[1];
    const selectDept = tr.querySelector('.participant-dept') || tr.querySelector('select');
    const nama = inputName ? inputName.value.trim() : '';
    const email = inputEmail ? inputEmail.value.trim().toLowerCase() : '';
    const dept = selectDept ? selectDept.value.trim() : '';
    if (nama || email) {
      participants.push({
        nama: nama,
        email: email,
        departemen: dept
      });
    }
  });

  const modules = [];
  const topTrainer = (document.getElementById('trainer')?.value || '').trim();
  const topLokasi = (document.getElementById('lokasi')?.value || '').trim();

  document.querySelectorAll('#moduleBody .session-compact-item, #moduleBody tr').forEach((tr, idx) => {
    const tgl = tr.querySelector('.module-date')?.value || '';
    const jamMulai = tr.querySelector('.module-start')?.value || '';
    const jamSelesai = tr.querySelector('.module-end')?.value || '';
    let modul = tr.querySelector('.module-title')?.value.trim() || '';
    if (!modul) {
      modul = `Sesi ${idx + 1}`;
    }
    const durasi = tr.querySelector('.module-duration')?.value || '';
    const pic = tr.querySelector('.module-pic')?.value.trim() || topTrainer;
    const metode = tr.querySelector('.module-method')?.value || (document.getElementById('metode')?.value || 'Workshop');
    const lokasi = tr.querySelector('.module-location')?.value.trim() || topLokasi;
    const deskripsi = tr.querySelector('.module-desc')?.value.trim() || '';

    modules.push({
      tanggal: tgl,
      jamMulai: jamMulai,
      jamSelesai: jamSelesai,
      modul: modul,
      durasi: durasi,
      pic: pic,
      metode: metode,
      lokasi: lokasi,
      deskripsi: deskripsi
    });
  });

  if (modules.length === 0 && meta['Tanggal pelaksanaan (raw)']) {
    modules.push({
      tanggal: meta['Tanggal pelaksanaan (raw)'],
      jamMulai: meta['Jam mulai (raw)'] || '09:00',
      jamSelesai: meta['Jam selesai (raw)'] || '15:00',
      modul: meta['Nama training'] || 'Sesi 1',
      durasi: meta['Total durasi belajar'] || '6 Jam',
      pic: topTrainer,
      metode: meta['Metode training'] || 'Onsite',
      lokasi: topLokasi,
      deskripsi: ''
    });
  }

  const approvals = [];
  document.querySelectorAll('#approvalSteps .approval-step').forEach(step => {
    const inputs = step.querySelectorAll('input');
    approvals.push({
      role: inputs[0] ? inputs[0].value.trim() : '',
      nama: inputs[1] ? inputs[1].value.trim() : '',
      tanggal: inputs[2] ? inputs[2].value : ''
    });
  });

  // Capture link silabus materi
  meta['Link silabus materi'] = (document.getElementById('linkSilabusDrive')?.value || meta['Link silabus materi'] || '').trim();

  return {
    meta,
    vendors,
    participants,
    modules,
    approvals,
    materials: (selectedProposalFiles || []).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      ext: f.ext,
      base64: f.base64
    })),
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

  // 1. Validasi Step 1
  if (!idValue || !nameValue || !leader || !leaderEmail || !dept) {
    showToast('Lengkapi field wajib (ID Training, Nama Training, Nama Pengaju, Email Pengaju, Departemen)', 'error');
    goToStep(1);
    return;
  }
  if (!leaderEmail.includes('@') || !leaderEmail.includes('.')) {
    showToast('Format Email Pengaju tidak valid (contoh: nama@cpssoft.com)', 'error');
    goToStep(1);
    return;
  }

  // 2. Validasi Step 2
  const tglVal = (document.getElementById('tglPelaksanaan')?.value || '').trim();
  if (!tglVal) {
    showToast('Mohon tentukan Tanggal Pelaksanaan training terlebih dahulu.', 'error');
    goToStep(2);
    const trigger = document.getElementById('tglPelaksanaan')?.closest('.date-picker-wrap')?.querySelector('.date-picker-trigger');
    if (trigger) trigger.focus();
    return;
  }

  const metode = document.getElementById('metode')?.value || 'Onsite';
  if (metode === 'Onsite') {
    const lokasi = (document.getElementById('lokasi')?.value || '').trim();
    const customVal = (document.getElementById('customLokasiInput')?.value || '').trim();
    if (!lokasi || (lokasi === 'custom' && !customVal)) {
      showToast('Mohon pilih Ruangan Meeting atau ketik nama/alamat lokasi ruangan jika memilih Lainnya.', 'error');
      goToStep(2);
      (document.getElementById('roomDropdownTrigger') || document.getElementById('lokasiSelect'))?.focus();
      return;
    }
  }

  const participantRows = document.querySelectorAll('#participantBody tr');
  let hasInvalidEmail = false;
  participantRows.forEach(tr => {
    if (tr.id === 'participantEmptyRow') return;
    const name = (tr.querySelector('.participant-name') || tr.querySelectorAll('input')[0])?.value.trim();
    const emailInput = tr.querySelector('.participant-email') || tr.querySelectorAll('input')[1];
    const email = emailInput?.value.trim();
    if (name && email) {
      if (!email.includes('@') || !email.includes('.')) {
        hasInvalidEmail = true;
        if (emailInput) emailInput.classList.add('error');
      } else {
        if (emailInput) emailInput.classList.remove('error');
      }
    }
  });

  if (hasInvalidEmail) {
    showToast('Format email peserta tidak valid (contoh: nama@perusahaan.com).', 'error');
    goToStep(2);
    return;
  }

  pendingSubmitData = data;
  populateReviewSummary();
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
  if (tglPengajuan) setDatePickerValue('tglPengajuan', today);
  const tglPelaksanaan = document.getElementById('tglPelaksanaan');
  if (tglPelaksanaan) setDatePickerValue('tglPelaksanaan', '');
  const jamPelaksanaan = document.getElementById('jamPelaksanaan');
  if (jamPelaksanaan) jamPelaksanaan.value = '';
  // Reset Custom Room Dropdown & Lokasi
  const triggerIcon = document.getElementById('roomTriggerIcon');
  if (triggerIcon && typeof ROOM_ICONS !== 'undefined') triggerIcon.innerHTML = ROOM_ICONS['default'];
  const triggerLabel = document.getElementById('roomTriggerLabel');
  if (triggerLabel) {
    triggerLabel.textContent = 'Pilih Ruangan Meeting...';
    triggerLabel.classList.add('placeholder');
  }
  const triggerBadge = document.getElementById('roomTriggerBadge');
  if (triggerBadge) {
    triggerBadge.style.display = 'none';
    triggerBadge.textContent = '';
  }
  document.querySelectorAll('#roomDropdownMenu .room-dropdown-item').forEach(item => item.classList.remove('selected'));
  if (typeof closeRoomDropdown === 'function') closeRoomDropdown();

  const lokasiSelect = document.getElementById('lokasiSelect');
  if (lokasiSelect) lokasiSelect.value = '';
  const roomStatusNotice = document.getElementById('roomStatusNotice');
  if (roomStatusNotice) {
    roomStatusNotice.style.display = 'none';
    roomStatusNotice.innerHTML = '';
  }
  const lokasiChips = document.querySelectorAll('#lokasiChipGrid .chip-card');
  lokasiChips.forEach(c => c.classList.remove('selected'));
  const lokasi = document.getElementById('lokasi');
  if (lokasi) lokasi.value = '';
  const customLokasi = document.getElementById('customLokasiInput');
  if (customLokasi) {
    customLokasi.style.display = 'none';
    customLokasi.value = '';
  }
  if (typeof resetRoomBadges === 'function') {
    resetRoomBadges('Tersedia');
  }
  if (typeof roomAvailabilityCache !== 'undefined' && roomAvailabilityCache.clear) {
    roomAvailabilityCache.clear();
  }

  // 5. Reset Level Chips (Basic)
  const levelChips = document.querySelectorAll('#levelChipGrid .chip-card');
  levelChips.forEach((c, idx) => {
    if (idx === 0) c.classList.add('selected');
    else c.classList.remove('selected');
  });
  const levelKemahiran = document.getElementById('levelKemahiran');
  if (levelKemahiran) levelKemahiran.value = 'Basic';

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
  const lokasiSection = document.getElementById('lokasiSection');
  if (lokasiSection) lokasiSection.style.display = 'block';
  const onlineSection = document.getElementById('onlineConfigSection');
  if (onlineSection) onlineSection.style.display = 'none';
  const jamMulai = document.getElementById('jamMulai');
  if (jamMulai) jamMulai.value = '09:00';
  const jamSelesai = document.getElementById('jamSelesai');
  if (jamSelesai) jamSelesai.value = '15:00';

  // 7. Reset standard dropdown defaults
  const category = document.getElementById('category');
  if (category) category.value = 'Soft Skill';
  const waktuEvaluasi = document.getElementById('waktuEvaluasi');
  if (waktuEvaluasi) waktuEvaluasi.value = 'Setelah training';
  const onlinePlatform = document.getElementById('onlinePlatform');
  if (onlinePlatform) onlinePlatform.value = 'Google Meet';
  if (typeof handleOnlinePlatformChange === 'function') {
    handleOnlinePlatformChange('Google Meet');
  }

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
  const trnId = document.getElementById('trainingId');
  if (trnId) trnId.value = '';
  updateTrainingId();
  calculateScheduleAndDuration();

  // 12. Reset Stepper to Step 1
  currentStep = 1;
  updateStepperUI();
  pendingSubmitData = null;
  clearAllProposalFiles();

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
  cachedEntries = list;
}

function populateSuccessModal(data, sheetSaved, scriptUrl) {
  const box = document.getElementById('successSummaryBox');
  if (!box) return;

  const m = data.meta;
  let sheetStatusNote = '';
  if (scriptUrl) {
    sheetStatusNote = sheetSaved
      ? `<div style="color:var(--moss);font-weight:600;margin-top:6px;">&#10003; Berhasil tersinkron ke Google Spreadsheet &amp; Menunggu Persetujuan Approver</div>`
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

function loadCalendarEntries() {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    cachedEntries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    cachedEntries = [];
  }
}

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

// ==========================================
// FullCalendar Interactive Training Engine (js/app.js)
// ==========================================
let userCalendarInstance = null;
let rawUserCalendarEvents = [];
let userMiniCalDate = new Date();
let activeUserCalView = 'dayGridMonth';

const USER_ROOM_COLOR_MAP = {
  'Neptunus': '#2563EB',
  'Saturnus': '#7C3AED',
  'Mars': '#EA580C',
  'Merkurius': '#059669',
  'Lainnya': '#64748B'
};

const USER_STATUS_COLOR_MAP = {
  'Approved': '#16A34A',
  'Pending': '#EAB308',
  'Rejected': '#DC2626'
};

function getUserRoomNormKey(roomStr) {
  const r = String(roomStr || '').toLowerCase();
  if (r.includes('neptunus')) return 'Neptunus';
  if (r.includes('saturnus')) return 'Saturnus';
  if (r.includes('mars')) return 'Mars';
  if (r.includes('merkurius')) return 'Merkurius';
  return 'Lainnya';
}

function initUserFullCalendar() {
  const mountEl = document.getElementById('fullCalendarMount');
  if (!mountEl) return;

  if (typeof FullCalendar === 'undefined') {
    console.warn('FullCalendar library belum termuat.');
    return;
  }

  if (userCalendarInstance) {
    userCalendarInstance.updateSize();
    renderUserMiniCalendar();
    return;
  }

  userCalendarInstance = new FullCalendar.Calendar(mountEl, {
    locale: 'id',
    initialView: activeUserCalView,
    headerToolbar: false,
    height: 'auto',
    expandRows: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    allDaySlot: true,
    dayMaxEvents: false, // Tampilkan seluruh event sekaligus tanpa pembatasan +more
    navLinks: true,
    navLinkDayClick: function(date) {
      userCalendarInstance.gotoDate(date);
      switchCalView('timeGridDay');
    },
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    datesSet: function(info) {
      updateUserCalTitle(info);
      renderUserMiniCalendar();
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
      openTrainingEventDetailModal(info.event);
    }
  });

  userCalendarInstance.render();
  fetchCalendarEvents();
}
window.initUserFullCalendar = initUserFullCalendar;
window.renderCalendar = initUserFullCalendar;

function updateUserCalTitle(info) {
  const titleEl = document.getElementById('calActiveTitle');
  if (!titleEl) return;

  if (userCalendarInstance) {
    const curDate = userCalendarInstance.getDate();
    userMiniCalDate = new Date(curDate);

    const view = userCalendarInstance.view;
    if (view.type === 'dayGridMonth') {
      titleEl.textContent = `${INDO_MONTH_NAMES[curDate.getMonth()]} ${curDate.getFullYear()}`;
    } else if (view.type === 'timeGridWeek') {
      const start = view.currentStart;
      const end = new Date(view.currentEnd);
      end.setDate(end.getDate() - 1);
      titleEl.textContent = `${start.getDate()} ${INDO_MONTH_NAMES[start.getMonth()]} - ${end.getDate()} ${INDO_MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    } else if (view.type === 'timeGridDay') {
      titleEl.textContent = `${curDate.getDate()} ${INDO_MONTH_NAMES[curDate.getMonth()]} ${curDate.getFullYear()}`;
    } else {
      titleEl.textContent = view.title || `${INDO_MONTH_NAMES[curDate.getMonth()]} ${curDate.getFullYear()}`;
    }
  }
}

function goToCalToday() {
  if (userCalendarInstance) {
    userCalendarInstance.today();
    updateUserCalTitle();
    renderUserMiniCalendar();
  }
}
window.goToCalToday = goToCalToday;

function goToCalPrev() {
  if (userCalendarInstance) {
    userCalendarInstance.prev();
    updateUserCalTitle();
    renderUserMiniCalendar();
  }
}
window.goToCalPrev = goToCalPrev;

function goToCalNext() {
  if (userCalendarInstance) {
    userCalendarInstance.next();
    updateUserCalTitle();
    renderUserMiniCalendar();
  }
}
window.goToCalNext = goToCalNext;

function switchCalView(viewName) {
  activeUserCalView = viewName;
  if (userCalendarInstance) {
    userCalendarInstance.changeView(viewName);
    updateUserCalTitle();
  }

  const btnDay = document.getElementById('btnViewDay');
  const btnWeek = document.getElementById('btnViewWeek');
  const btnMonth = document.getElementById('btnViewMonth');

  if (btnDay) btnDay.classList.toggle('active', viewName === 'timeGridDay');
  if (btnWeek) btnWeek.classList.toggle('active', viewName === 'timeGridWeek');
  if (btnMonth) btnMonth.classList.toggle('active', viewName === 'dayGridMonth');
}
window.switchCalView = switchCalView;

function toggleCalSidebarFilter() {
  const sidebar = document.getElementById('calFilterSidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}
window.toggleCalSidebarFilter = toggleCalSidebarFilter;

async function fetchCalendarEvents(forceRefresh = false) {
  const loadingEl = document.getElementById('calLoadingState');
  const emptyEl = document.getElementById('calEmptyState');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';

  let fetched = null;

  try {
    const url = `${SCRIPT_URL}${SCRIPT_URL.includes('?') ? '&' : '?'}action=getCalendarEvents&_ts=${Date.now()}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json)) {
        fetched = json;
      } else if (json && json.status === 'success' && Array.isArray(json.data)) {
        fetched = json.data;
      } else if (json && Array.isArray(json.events)) {
        fetched = json.events;
      }
    }
  } catch (err) {
    console.warn('Gagal fetch event kalender via Apps Script, menggunakan fallback lokal:', err);
  }

  if (!fetched || fetched.length === 0) {
    fetched = buildUserCalendarEventsFromCached(cachedEntries);
  }

  rawUserCalendarEvents = fetched;

  populateUserDivisionFilters();
  filterAndRenderUserCalendar();

  if (loadingEl) loadingEl.style.display = 'none';
}
window.fetchCalendarEvents = fetchCalendarEvents;

function buildUserCalendarEventsFromCached(entries) {
  const events = [];
  if (!Array.isArray(entries)) return events;

  entries.forEach(entry => {
    const m = entry.meta || {};
    const modules = Array.isArray(entry.modules) ? entry.modules : [];

    let status = 'Pending';
    const rawStat = String(m['Status Dokumen'] || entry.status || '').toLowerCase();
    if (rawStat.includes('approv') || rawStat.includes('setuju')) status = 'Approved';
    else if (rawStat.includes('reject') || rawStat.includes('tolak')) status = 'Rejected';

    const id = m['ID training'] || entry.id || 'TRN-2026';
    const judul = m['Nama training'] || entry.namaTraining || 'Pelatihan';
    const pemohon = m['Leader pengaju'] || m['Nama pengaju'] || entry.pengaju || '-';
    const divisi = m['Departemen / divisi'] || entry.departemen || 'HR';
    const venue = m['Lokasi / venue'] || m['Platform online'] || entry.venue || 'Neptunus';
    const kategori = m['Kategori training'] || entry.kategori || 'Soft skill';

    if (modules.length > 0) {
      modules.forEach((mod, idx) => {
        const d = (mod.tanggal || '').trim();
        if (d) {
          const jamMulai = (mod.jamMulai || '09:00').trim();
          const jamSelesai = (mod.jamSelesai || '16:00').trim();
          events.push({
            id: `${id}-mod-${idx}`,
            submissionId: id,
            judul: mod.modul ? `${judul} - ${mod.modul}` : judul,
            tanggal: d,
            jamMulai: jamMulai,
            jamSelesai: jamSelesai,
            ruangan: mod.lokasi || venue,
            pemohon: pemohon,
            divisi: divisi,
            kategori: kategori,
            status: status,
            notes: mod.deskripsi || ''
          });
        }
      });
    }

    const match = String(m['Tanggal & jam pelaksanaan'] || m['Tanggal pelaksanaan'] || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match) {
      const d = match[1];
      if (!events.some(e => e.submissionId === id)) {
        events.push({
          id: id,
          submissionId: id,
          judul: judul,
          tanggal: d,
          jamMulai: '09:00',
          jamSelesai: '16:00',
          ruangan: venue,
          pemohon: pemohon,
          divisi: divisi,
          kategori: kategori,
          status: status,
          notes: m['Tujuan training'] || ''
        });
      }
    }
  });

  return events;
}

function populateUserDivisionFilters() {
  const container = document.getElementById('divisionFilterList');
  if (!container) return;

  const divs = new Set();
  rawUserCalendarEvents.forEach(e => {
    if (e.divisi && e.divisi.trim()) divs.add(e.divisi.trim());
  });

  ['HR', 'GA', 'FINANCE', 'MARKETING', 'WEB DEVELOPER', 'CUSTOMER EXPERIENCE', 'AI'].forEach(d => divs.add(d));

  const sortedDivs = Array.from(divs).sort();
  const colors = ['#2563EB', '#7C3AED', '#EA580C', '#059669', '#DB2777', '#4F46E5', '#0891B2', '#D97706'];

  container.innerHTML = sortedDivs.map((d, idx) => {
    const col = colors[idx % colors.length];
    return `
      <label class="cal-checkbox-item">
        <input type="checkbox" name="divisionFilter" value="${escapeHtml(d)}" checked onchange="onCalendarFilterChange()">
        <span class="cal-checkbox-indicator" style="background:${col};"></span>
        <span class="cal-checkbox-label">${escapeHtml(d)}</span>
      </label>
    `;
  }).join('');
}

function selectAllRooms(checkAll = true) {
  document.querySelectorAll('input[name="roomFilter"]').forEach(cb => {
    cb.checked = checkAll;
  });
  onCalendarFilterChange();
}
window.selectAllRooms = selectAllRooms;

function selectAllDivisions(checkAll = true) {
  document.querySelectorAll('input[name="divisionFilter"]').forEach(cb => {
    cb.checked = checkAll;
  });
  onCalendarFilterChange();
}
window.selectAllDivisions = selectAllDivisions;

function onCalendarFilterChange() {
  filterAndRenderUserCalendar();
}
window.onCalendarFilterChange = onCalendarFilterChange;

function filterAndRenderUserCalendar() {
  if (!userCalendarInstance) return;

  const selectedRooms = Array.from(document.querySelectorAll('input[name="roomFilter"]:checked')).map(cb => cb.value);
  const selectedDivisions = Array.from(document.querySelectorAll('input[name="divisionFilter"]:checked')).map(cb => cb.value);
  const selectedStatuses = Array.from(document.querySelectorAll('input[name="statusFilter"]:checked')).map(cb => cb.value);

  const filtered = rawUserCalendarEvents.filter(ev => {
    const roomKey = getUserRoomNormKey(ev.ruangan);
    const roomMatches = selectedRooms.includes(roomKey);

    const evDiv = (ev.divisi || '').trim();
    const divMatches = selectedDivisions.length === 0 || selectedDivisions.includes(evDiv);

    const evStatus = (ev.status || 'Pending').trim();
    let normStatus = 'Pending';
    if (evStatus.toLowerCase().includes('approv') || evStatus.toLowerCase().includes('setuju')) normStatus = 'Approved';
    else if (evStatus.toLowerCase().includes('reject') || evStatus.toLowerCase().includes('tolak')) normStatus = 'Rejected';
    const statusMatches = selectedStatuses.includes(normStatus);

    return roomMatches && divMatches && statusMatches;
  });

  const emptyEl = document.getElementById('calEmptyState');
  if (emptyEl) {
    emptyEl.style.display = filtered.length === 0 ? 'flex' : 'none';
  }

  const fcEvents = filtered.map(ev => {
    let normStatus = 'Pending';
    if ((ev.status || '').toLowerCase().includes('approv') || (ev.status || '').toLowerCase().includes('setuju')) normStatus = 'Approved';
    else if ((ev.status || '').toLowerCase().includes('reject') || (ev.status || '').toLowerCase().includes('tolak')) normStatus = 'Rejected';

    const color = USER_STATUS_COLOR_MAP[normStatus] || '#EAB308';
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

  userCalendarInstance.removeAllEvents();
  userCalendarInstance.addEventSource(fcEvents);
  renderUserMiniCalendar();
}

function renderUserMiniCalendar() {
  const titleEl = document.getElementById('miniCalTitle');
  const gridEl = document.getElementById('miniCalGrid');
  if (!titleEl || !gridEl) return;

  const y = userMiniCalDate.getFullYear();
  const m = userMiniCalDate.getMonth();
  titleEl.textContent = `${INDO_MONTH_NAMES[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay();
  const startDay = firstDay === 0 ? 7 : firstDay;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const curActiveDate = userCalendarInstance ? userCalendarInstance.getDate() : today;
  const activeDateStr = `${curActiveDate.getFullYear()}-${String(curActiveDate.getMonth() + 1).padStart(2, '0')}-${String(curActiveDate.getDate()).padStart(2, '0')}`;

  const eventDates = new Set();
  rawUserCalendarEvents.forEach(e => {
    if (e.tanggal) eventDates.add(e.tanggal.trim());
  });

  let cells = [];

  for (let i = startDay - 2; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push(`<div class="mini-cell other-month">${d}</div>`);
  }

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
      <div class="${cls}" onclick="onUserMiniCalDayClick('${dateStr}')" title="${dateStr}">
        ${d}
      </div>
    `);
  }

  const total = cells.length;
  const rem = (7 - (total % 7)) % 7;
  for (let n = 1; n <= rem; n++) {
    cells.push(`<div class="mini-cell other-month">${n}</div>`);
  }

  gridEl.innerHTML = cells.join('');
}

function prevMiniCalMonth() {
  userMiniCalDate.setMonth(userMiniCalDate.getMonth() - 1);
  renderUserMiniCalendar();
}
window.prevMiniCalMonth = prevMiniCalMonth;

function nextMiniCalMonth() {
  userMiniCalDate.setMonth(userMiniCalDate.getMonth() + 1);
  renderUserMiniCalendar();
}
window.nextMiniCalMonth = nextMiniCalMonth;

function onUserMiniCalDayClick(dateStr) {
  if (userCalendarInstance) {
    userCalendarInstance.gotoDate(dateStr);
    updateUserCalTitle();
    renderUserMiniCalendar();
  }
}
window.onUserMiniCalDayClick = onUserMiniCalDayClick;

function openTrainingEventDetailModal(fcEvent) {
  const modal = document.getElementById('modalTrainingEventDetail');
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

  const badgeEl = document.getElementById('calDetailStatusBadge');
  if (badgeEl) {
    badgeEl.className = `mini-pill ${statusBadgeClass}`;
    badgeEl.textContent = statusLabel;
  }

  const idEl = document.getElementById('calDetailId');
  if (idEl) idEl.textContent = props.submissionId || props.id || '-';

  const judulEl = document.getElementById('calDetailJudul');
  if (judulEl) judulEl.textContent = fcEvent.title || props.judul || '-';

  const katEl = document.getElementById('calDetailKategori');
  if (katEl) katEl.textContent = props.kategori || 'General Skill';

  const waktuEl = document.getElementById('calDetailWaktu');
  if (waktuEl) {
    const tgl = formatDateIndo(props.tanggal || fcEvent.startStr);
    const jam = props.jamMulai ? `${props.jamMulai} - ${props.jamSelesai || ''} WIB` : 'All Day';
    waktuEl.textContent = `${tgl}, ${jam}`;
  }

  const roomNameEl = document.getElementById('calDetailRoomName');
  const roomDotEl = document.getElementById('calDetailRoomDot');
  if (roomNameEl) roomNameEl.textContent = props.ruangan || 'Ruangan Belum Ditentukan';
  if (roomDotEl) {
    const roomKey = getUserRoomNormKey(props.ruangan);
    roomDotEl.style.background = USER_ROOM_COLOR_MAP[roomKey] || '#64748B';
  }

  const pemohonEl = document.getElementById('calDetailPemohon');
  if (pemohonEl) pemohonEl.textContent = props.pemohon || '-';

  const divisiEl = document.getElementById('calDetailDivisi');
  if (divisiEl) divisiEl.textContent = props.divisi || '-';

  const extraEl = document.getElementById('calDetailExtra');
  const extraWrap = document.getElementById('calDetailExtraWrap');
  if (extraEl) {
    const extraInfo = props.notes || 'Silahkan periksa detail pengajuan pada daftar training jika membutuhkan informasi lebih mendalam.';
    extraEl.textContent = extraInfo;
    if (extraWrap) extraWrap.style.display = 'block';
  }

  modal.classList.add('active');
}
window.openTrainingEventDetailModal = openTrainingEventDetailModal;

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
        <span>${s.time}</span>
        <span>${s.lokasi}</span>
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
  const modalContent = document.getElementById('modalDetailContent');
  const modalTitle = document.getElementById('modalDetailTitle');
  const modalSub = document.getElementById('modalDetailSub');

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

  const detailHtml = `
    <div class="detail-panel" style="margin-top:0;">
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
      <div style="font-weight:600;margin:14px 0 6px;">Tujuan &amp; Goals:</div>
      <div style="font-size:13px;line-height:1.6;margin-bottom:12px;">
        ${m['Training goals'] ? `<div><strong>Training Goals:</strong> ${m['Training goals']}</div>` : ''}
        ${m['Training plan purpose'] && m['Training plan purpose'] !== m['Training goals'] ? `<div><strong>Purpose:</strong> ${m['Training plan purpose']}</div>` : ''}
        ${!m['Training goals'] && !m['Training plan purpose'] ? `<div><strong>Training Goals:</strong> -</div>` : ''}
        ${m['Link silabus materi'] ? `<div><strong>Link Silabus / Materi:</strong> <a href="${m['Link silabus materi']}" target="_blank" style="color:var(--accent);text-decoration:underline;word-break:break-all;">${m['Link silabus materi']}</a></div>` : ''}
        ${m['Modul & Materi (File/Link)'] && m['Modul & Materi (File/Link)'] !== '-' && m['Modul & Materi (File/Link)'] !== m['Link silabus materi'] ? `<div><strong>Lampiran Modul:</strong> <div style="white-space:pre-line;color:var(--ink-soft);">${escapeHtml(m['Modul & Materi (File/Link)'])}</div></div>` : ''}
        ${entry.materials && entry.materials.length > 0 ? `<div style="margin-top:4px;"><strong>Berkas Modul Dilampirkan:</strong> ${entry.materials.map(mat => `<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:rgba(21,128,61,0.08);border:1px solid rgba(21,128,61,0.25);border-radius:6px;font-size:11.5px;color:#15803D;">${escapeHtml(mat.name)}</span>`).join('')}</div>` : ''}
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

  // Always populate modal and open it
  if (modalContent) {
    modalContent.innerHTML = detailHtml;
    if (modalTitle) modalTitle.textContent = `${m['ID training'] || 'Detail Training'}`;
    if (modalSub) modalSub.textContent = m['Nama training'] || 'Informasi lengkap program pelatihan';
    openModal('modalDetailSubmission');
  }

  // Also populate inline detail panel if visible in master view
  if (panel && document.getElementById('masterView')?.style.display !== 'none') {
    panel.innerHTML = detailHtml;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function deleteSubmission(index) {
  if (!confirm('Apakah Anda yakin ingin menghapus data submission ini dari riwayat lokal?')) return;
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      list.splice(index, 1);
      localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
      closeModal('modalDetailSubmission');
      showToast('Data submission berhasil dihapus.', 'info');
      loadCalendarEntries();
      renderCalendar();
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

  const headers = [
    'Waktu Submit',
    'ID Training',
    'Status Dokumen',
    'Jenis Training',
    'Nama Training',
    'Nama Pengaju',
    'Email Pengaju',
    'Departemen / Divisi',
    'Kategori Training',
    'Target Level Kemahiran',
    'Kategori Kebutuhan Training',
    'Tanggal Pengajuan',
    'Metode Training',
    'Jadwal Pelaksanaan',
    'Lokasi / Venue',
    'Platform & Link Meeting',
    'Trainer / Fasilitator',
    'Total Durasi Belajar',
    'Jumlah Partisipan (Rencana)',
    'Jumlah Peserta Terdaftar',
    'Training Goals',
    'Hasil yang Diharapkan',
    'Penerapan di Pekerjaan',
    'Indikator Keberhasilan',
    'Waktu Evaluasi',
    'PIC Evaluasi',
    'Daftar Peserta (Ringkasan)',
    'Modul & Sesi (Ringkasan)'
  ];

  const rows = entries.map(entry => {
    const m = entry.meta || {};
    const participants = entry.participants || [];
    const modules = entry.modules || [];

    const participantsSummary = participants
      .filter(p => p.nama)
      .map((p, idx) => `${idx + 1}. ${p.nama}${p.email ? ' <' + p.email + '>' : ''} (${p.departemen || '-'})`)
      .join(' | ');

    const modulesSummary = modules
      .filter(mod => mod.modul)
      .map((mod, idx) => `${idx + 1}. ${mod.modul} [${mod.durasi || '-'}]`)
      .join(' | ');

    let meetingInfo = '-';
    if (m['Platform online'] || m['Link meeting online']) {
      meetingInfo = [m['Platform online'], m['Link meeting online']].filter(Boolean).join(' - ');
    }

    const countPeserta = participants.filter(p => p.nama).length;

    return [
      `"${(entry.submittedAt || '').replace(/"/g, '""')}"`,
      `"${(m['ID training'] || entry.id || '').replace(/"/g, '""')}"`,
      `"${(entry.status || 'Diajukan').replace(/"/g, '""')}"`,
      `"${(m['Jenis training'] || 'Training Internal').replace(/"/g, '""')}"`,
      `"${(m['Nama training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Nama pengaju'] || m['Leader pengaju'] || '').replace(/"/g, '""')}"`,
      `"${(m['Email pengaju'] || '').replace(/"/g, '""')}"`,
      `"${(m['Departemen / divisi'] || '').replace(/"/g, '""')}"`,
      `"${(m['Kategori training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Target level kemahiran'] || 'General').replace(/"/g, '""')}"`,
      `"${(m['Kategori kebutuhan training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Tanggal pengajuan'] || '').replace(/"/g, '""')}"`,
      `"${(m['Metode training'] || '').replace(/"/g, '""')}"`,
      `"${(m['Tanggal & jam pelaksanaan'] || '').replace(/"/g, '""')}"`,
      `"${(m['Lokasi / venue'] || '').replace(/"/g, '""')}"`,
      `"${meetingInfo.replace(/"/g, '""')}"`,
      `"${(m['Trainer'] || '').replace(/"/g, '""')}"`,
      `"${(m['Total durasi belajar'] || '').replace(/"/g, '""')}"`,
      `"${(m['Jumlah partisipan (rencana)'] || '').replace(/"/g, '""')}"`,
      countPeserta,
      `"${(m['Training goals'] || m['Training plan purpose'] || '').replace(/"/g, '""')}"`,
      `"${(m['Hasil yang diharapkan'] || m['Expected outcomes'] || '').replace(/"/g, '""')}"`,
      `"${(m['Penerapan di pekerjaan'] || m['Aplikasi / implementasi'] || '').replace(/"/g, '""')}"`,
      `"${(m['Indikator keberhasilan'] || '').replace(/"/g, '""')}"`,
      `"${(m['Waktu evaluasi'] || '').replace(/"/g, '""')}"`,
      `"${(m['PIC evaluasi'] || '').replace(/"/g, '""')}"`,
      `"${participantsSummary.replace(/"/g, '""')}"`,
      `"${modulesSummary.replace(/"/g, '""')}"`
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
window.fetchRoomAvailability = fetchRoomAvailability;
window.toggleRoomDropdown = toggleRoomDropdown;
window.closeRoomDropdown = closeRoomDropdown;
window.selectCustomRoom = selectCustomRoom;
window.handleLokasiSelectChange = handleLokasiSelectChange;
window.switchPublicView = switchPublicView;
window.goToPage = goToPage;
window.searchMyTrainings = searchMyTrainings;
window.resetMyTrainingSearch = resetMyTrainingSearch;
window.renderKanbanBoard = renderKanbanBoard;
window.renderVendorDirectoryPage = renderVendorDirectoryPage;
window.renderDashboardLandingPage = renderDashboardLandingPage;
window.showDetail = showDetail;
window.loadCalendarEntries = loadCalendarEntries;
window.requestAdminAccess = requestAdminAccess;
window.checkAdminPin = checkAdminPin;
window.cancelAdminPin = cancelAdminPin;
window.lockAdminAccess = lockAdminAccess;

// ==========================================
// AI Training Course Architect Logic
// ==========================================
let currentAiPlan = null;

// Built-in Google Gemini API Key for Seamless Enterprise L&D AI
const DEFAULT_GEMINI_KEY = '';

function getActiveGeminiApiKey() {
  const custom = (localStorage.getItem('tds_gemini_api_key') || '').trim();
  return custom || DEFAULT_GEMINI_KEY;
}

function openAiAssistantModal() {
  openAiModal();
}

function openAiModal() {
  const currentTitle = (document.getElementById('trainingName')?.value || '').trim();
  const topicInput = document.getElementById('aiTopicInput');
  if (topicInput && currentTitle) {
    topicInput.value = currentTitle;
  }
  openModal('modalAiAssistant');
}

function setAiTopic(topic) {
  const input = document.getElementById('aiTopicInput');
  if (input) {
    input.value = topic;
    input.focus();
  }
}

function saveAiApiKey(val) {
  const clean = (val || '').trim();
  if (clean) {
    localStorage.setItem('tds_gemini_api_key', clean);
    showToast('Gemini API Key berhasil disimpan secara lokal.', 'success');
  } else {
    localStorage.removeItem('tds_gemini_api_key');
  }
}

async function executeAiGeneration() {
  const topicInput = document.getElementById('aiTopicInput');
  const topic = (topicInput?.value || '').trim();
  if (!topic) {
    showToast('Ketik topik atau nama training terlebih dahulu.', 'error');
    if (topicInput) topicInput.focus();
    return;
  }

  const level = document.getElementById('aiLevelSelect')?.value || 'Intermediate';
  const format = document.getElementById('aiFormatSelect')?.value || '1_day';
  const apiKey = getActiveGeminiApiKey();

  const loadingEl = document.getElementById('aiLoadingState');
  const previewEl = document.getElementById('aiPreviewContainer');
  const btnGenerate = document.getElementById('btnAiGenerate');
  const btnApply = document.getElementById('btnAiApply');
  const stepText = document.getElementById('aiLoadingStep');

  if (loadingEl) loadingEl.style.display = 'block';
  if (previewEl) previewEl.style.display = 'none';
  if (btnGenerate) btnGenerate.disabled = true;
  if (btnApply) btnApply.disabled = true;

  try {
    let plan = null;

    if (apiKey) {
      if (stepText) stepText.textContent = 'Menganalisis domain kompetensi & menyusun modul...';
      try {
        plan = await generateWithGeminiLive(topic, level, format, apiKey);
      } catch (err) {
        console.warn('Live AI call failed, falling back to built-in smart engine:', err);
      }
    }

    if (!plan) {
      if (stepText) stepText.textContent = 'Menganalisis domain kompetensi & menyusun silabus...';
      await new Promise(r => setTimeout(r, 80));
      plan = generateSmartPlanOffline(topic, level, format);
    }

    currentAiPlan = plan;
    renderAiPlanPreview(plan);

    if (btnApply) btnApply.disabled = false;
    showToast('Rancangan kurikulum pelatihan berhasil dibuat!', 'success');
  } catch (error) {
    console.error('Error during AI generation:', error);
    showToast('Terjadi kendala saat merancang materi. Silahkan coba lagi.', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (btnGenerate) btnGenerate.disabled = false;
  }
}

async function generateWithGeminiLive(topic, level, format, apiKey) {
  const prompt = `Anda adalah konsultan L&D (Learning & Development) korporat terkemuka.
Rancanglah rencana program pelatihan karyawan yang aplikatif dan profesional untuk:
Topik: "${topic}"
Target Level: ${level}
Format: ${format}

Output WAJIB berupa JSON murni tanpa markdown formatting, tanpa tanda kutip backtick, dengan struktur spesifik berikut:
{
  "namaTraining": "Nama Resmi Training",
  "kategoriUrgensi": "Kesenjangan Keterampilan",
  "goals": "Deskripsi tujuan SMART dan capaian yang jelas",
  "modules": [
    {
      "modul": "Sesi 1: Judul Sesi",
      "jamMulai": "09:00",
      "jamSelesai": "12:00",
      "durasi": "3 Jam",
      "metode": "Praktik / Workshop / Teori",
      "deskripsi": "Rincian materi yang dipelajari"
    }
  ],
  "hasilDiharapkan": "Kemampuan konkret yang dimiliki peserta",
  "penerapanPekerjaan": "Bagaimana kompetensi ini diterapkan di workflow tim sehari-hari",
  "indikatorKeberhasilan": "Target metrik keberhasilan kuantitatif & kualitatif"
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const cleanKey = apiKey.trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      })
    });

    if (!response.ok) {
      // Fallback to gemini-3.5-flash-lite
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(cleanKey)}`;
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        })
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini');
  
  const cleanJson = rawText.replace(/```json\s*|```/g, '').trim();
  return JSON.parse(cleanJson);
}

function generateSmartPlanOffline(topic, level, format) {
  const lower = topic.toLowerCase();
  let urgency = 'Kesenjangan Keterampilan';
  let goals = '';
  let expected = '';
  let application = '';
  let kpi = '';
  let sessions = [];

  // Determine session schedule & count by format
  let sessionSchedule = [
    { start: '09:00', end: '12:00', dur: '3 Jam' },
    { start: '13:00', end: '16:00', dur: '3 Jam' }
  ];

  if (format === 'half_day') {
    sessionSchedule = [
      { start: '09:00', end: '12:00', dur: '3 Jam' }
    ];
  } else if (format === '2_days') {
    sessionSchedule = [
      { start: '09:00', end: '12:00', dur: '3 Jam' },
      { start: '13:00', end: '16:00', dur: '3 Jam' },
      { start: '09:00', end: '12:00', dur: '3 Jam' },
      { start: '13:00', end: '16:00', dur: '3 Jam' }
    ];
  }

  // Domain Categorization logic
  if (lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('frontend') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('web') || lower.includes('golang') || lower.includes('backend') || lower.includes('python') || lower.includes('api') || lower.includes('code') || lower.includes('developer')) {
    urgency = 'Kesenjangan Keterampilan';
    goals = `Membekali peserta dengan keterampilan teknis mutakhir dalam arsitektur ${topic}, implementasi clean code, pola desain modular, dan integrasi API yang tangguh demi mempercepat siklus pengiriman perangkat lunak berkualitas tinggi.`;
    expected = `Peserta mampu merancang, memprogram, menguji (unit testing), dan menerapkan fitur baru secara mandiri tanpa dependensi tinggi terhadap tim senior.`;
    application = `Diterapkan langsung dalam penulisan modul sprint berjalan, refactoring kode legacy, dan standar code review tim engineering.`;
    kpi = `Penurunan tingkat bug/defect pada code review sebesar 25%, peningkatan code coverage minimal 80%, dan zero-downtime saat deployment fitur baru.`;

    const titles = [
      `Fondasi Arsitektur, Core Concepts & Pola Desain Modern`,
      `Hands-on Workshop: Implementasi Fitur & Best Practices`,
      `State Management, Asynchronous Flow & Integrasi Layanan Eksternal`,
      `Performance Profiling, Automated Testing & Standar Production Readiness`
    ];
    const methods = ['Teori & Analisis Kasus', 'Praktik & Live Coding', 'Praktik & Workshop', 'Simulasi Deployment'];
    const descs = [
      `Membedah paradigma utama, struktur direktori terstandar, dan prinsip maintainable software architecture.`,
      `Membangun modul inti secara bertahap dengan bimbingan langsung, studi kasus bug umum, dan penyelesaian masalah real.`,
      `Optimasi penanganan data kompleks, caching, optimasi rendering, dan secure API authentication.`,
      `Pengukuran performa benchmarking, penulisan automated test suite, dan checklist pra-produksi.`
    ];

    sessionSchedule.forEach((sched, idx) => {
      sessions.push({
        modul: `Sesi ${idx + 1}: ${titles[idx] || `Sesi Lanjutan ${idx + 1}`}`,
        jamMulai: sched.start,
        jamSelesai: sched.end,
        durasi: sched.dur,
        metode: methods[idx] || 'Praktik & Workshop',
        deskripsi: descs[idx] || `Pendalaman materi praktis terkait implementasi ${topic}.`
      });
    });

  } else if (lower.includes('lead') || lower.includes('manager') || lower.includes('coach') || lower.includes('supervis') || lower.includes('manajemen') || lower.includes('people')) {
    urgency = 'Pengembangan Kepemimpinan';
    goals = `Meningkatkan kapasitas kepemimpinan peserta dalam mengarahkan tim, membangun budaya kerja akuntabel, memfasilitasi coaching berkala, dan menyelaraskan eksekusi harian dengan sasaran strategis perusahaan.`;
    expected = `Pemimpin mampu mendelegasikan tanggung jawab secara efektif, memberikan constructive feedback tanpa friksi, dan memimpin rapat tim yang berorientasi hasil.`;
    application = `Diterapkan dalam daily standup, sesi 1-on-1 bulanan bersama bawahan langsung, dan penyusunan OKR/KPI tim.`;
    kpi = `Peningkatan skor employee engagement tim minimal 15%, penurunan turnover anggota tim, dan pencapaian target kerja kuartalan 100%.`;

    const titles = [
      `Mindset Pemimpin Adaptif: Komunikasi Berpengaruh & Trust Building`,
      `GROW Coaching Framework & Seni Memberikan Feedback Konstruktif`,
      `Delegasi Efektif, Manajemen Prioritas & Akuntabilitas Tim`,
      `Resolusi Konflik Internal & Pengambilan Keputusan Berbasis Solusi`
    ];
    const methods = ['Studi Kasus & Diskusi', 'Roleplay & Simulasi Coaching', 'Workshop Manajemen Tim', 'Simulasi Kasus Riil'];
    const descs = [
      `Mengenali gaya kepemimpinan diri, memetakan dinamika anggota tim, dan membangun psychological safety.`,
      `Praktek simulasi wawancara coaching 1-on-1 dengan framework terstruktur untuk membimbing tim berkinerja rendah.`,
      `Teknik pendelegasian wewenang berbasis level kompetensi bawahan dan sistem pemantauan tanpa micromanagement.`,
      `Strategi de-eskalasi friksi antar-anggota tim dan metode decision matrix saat situasi darurat.`
    ];

    sessionSchedule.forEach((sched, idx) => {
      sessions.push({
        modul: `Sesi ${idx + 1}: ${titles[idx] || `Sesi Kepemimpinan ${idx + 1}`}`,
        jamMulai: sched.start,
        jamSelesai: sched.end,
        durasi: sched.dur,
        metode: methods[idx] || 'Workshop & Roleplay',
        deskripsi: descs[idx] || `Pendalaman kemampuan manajerial terapan.`
      });
    });

  } else if (lower.includes('data') || lower.includes('excel') || lower.includes('power bi') || lower.includes('tableau') || lower.includes('analytics') || lower.includes('analis') || lower.includes('sql')) {
    urgency = 'Kesenjangan Keterampilan';
    goals = `Membekali peserta dengan keterampilan mengolah, membersihkan, menganalisis data mentah, serta memvisualisasikannya ke dalam dashboard interaktif untuk mendukung data-driven decision making yang akurat.`;
    expected = `Peserta mampu mengotomasi laporan rutin, mendeteksi tren anomali bisnis dari dataset, dan menyajikan insight bisnis ke manajemen secara visual.`;
    application = `Diterapkan dalam pembuatan laporan performa mingguan divisi dan monitoring real-time metrik operasional.`;
    kpi = `Efisiensi waktu pembuatan report hingga 50%, eliminasi kesalahan formula manual (zero error rate), dan adopsi dashboard mandiri oleh divisi terkait.`;

    const titles = [
      `Data Wrangling: Pembersihan, Transformasi & Formula Analitik Lanjutan`,
      `Data Modeling, Relasi Tabel & Otomasi Perhitungan Metrik Bisnis`,
      `Perancangan Visualisasi: Dashboard Eksekutif Interaktif & Storytelling with Data`,
      `Audit Validasi Data & Strategi Presentasi Insight ke Stakeholder`
    ];
    const methods = ['Teori & Latihan Praktis', 'Praktik Hands-on', 'Workshop Visualisasi', 'Presentasi & Review'];
    const descs = [
      `Menggunakan fungsi lookup modern, dynamic array, dan teknik membersihkan data yang tidak terstruktur.`,
      `Membangun star-schema relasi data dan pembuatan ukuran performa bisnis (measures & calculated columns).`,
      `Mendesain layout dashboard yang clean, intuitif, dan menerapkan filter lintas kategori secara interaktif.`,
      `Memastikan konsistensi data sebelum dipublikasikan dan teknik menyampaikan temuan kritis secara ringkas.`
    ];

    sessionSchedule.forEach((sched, idx) => {
      sessions.push({
        modul: `Sesi ${idx + 1}: ${titles[idx] || `Sesi Analisis Data ${idx + 1}`}`,
        jamMulai: sched.start,
        jamSelesai: sched.end,
        durasi: sched.dur,
        metode: methods[idx] || 'Praktik Hands-on',
        deskripsi: descs[idx] || `Praktek pengolahan dan visualisasi data.`
      });
    });

  } else if (lower.includes('sales') || lower.includes('customer') || lower.includes('service') || lower.includes('komunikasi') || lower.includes('public speaking') || lower.includes('presentasi') || lower.includes('negosiasi') || lower.includes('marketing')) {
    urgency = 'Kesenjangan Keterampilan';
    goals = `Meningkatkan kemampuan komunikasi persuasif, pelayanan pelanggan yang empati, dan penguasaan teknik negosiasi profesional untuk memperkuat loyalitas klien serta konversi peluang bisnis.`;
    expected = `Peserta mampu menangani keberatan klien secara tenang, mempresentasikan value proposition dengan meyakinkan, dan menyelesaikan komplain dengan solusi win-win.`;
    application = `Diterapkan dalam interaksi harian bersama klien, presentasi proposal ke prospek, dan penanganan tiket eskalasi pelanggan.`;
    kpi = `Skor kepuasan pelanggan (CSAT / NPS) meningkat minimal 20%, tingkat konversi penawaran naik 15%, dan waktu resolusi keluhan berkurang 30%.`;

    const titles = [
      `Psikologi Pelanggan, Active Listening & Prinsip Komunikasi Asertif`,
      `Teknik Persuasi, Presentasi Berdaya Pikat & Penanganan Keberatan (Objection Handling)`,
      `Strategi Negosiasi Win-Win & Closing Penawaran bernilai Tinggi`,
      `Studi Kasus Eskalasi Layanan, Manajemen Ekspektasi & Service Recovery`
    ];
    const methods = ['Workshop & Studi Kasus', 'Roleplay Interaktif', 'Simulasi Negosiasi', 'Analisis Kasus Kritis'];
    const descs = [
      `Memahami tipe kepribadian lawan bicara, membaca bahasa tubuh, dan merumuskan respons yang solutif.`,
      `Struktur presentasi problem-solution dan teknik merespons penolakan harga atau keraguan calon klien.`,
      `Menjaga margin keuntungan saat negosiasi serta mengunci kesepakatan secara formal dan saling menguntungkan.`,
      `Langkah sistematis membalikkan pelanggan yang kecewa menjadi advokat merek yang setia.`
    ];

    sessionSchedule.forEach((sched, idx) => {
      sessions.push({
        modul: `Sesi ${idx + 1}: ${titles[idx] || `Sesi Komunikasi ${idx + 1}`}`,
        jamMulai: sched.start,
        jamSelesai: sched.end,
        durasi: sched.dur,
        metode: methods[idx] || 'Roleplay & Praktik',
        deskripsi: descs[idx] || `Simulasi interaksi dan komunikasi persuasif.`
      });
    });

  } else {
    // General Domain Fallback
    urgency = 'Kesenjangan Keterampilan';
    goals = `Meningkatkan pemahaman konseptual dan kapabilitas operasional peserta mengenai ${topic}, mengadopsi standar praktik terbaik (best practices), serta meminimalisir kesalahan kerja guna mendongkrak produktivitas tim.`;
    expected = `Peserta menguasai metodologi terstandar dalam ${topic} dan mampu mengeksekusi tanggung jawab pekerjaan terkait secara konsisten dan efisien.`;
    application = `Diterapkan pada proses kerja harian divisi dan standarisasi Standar Operasional Prosedur (SOP) tim.`;
    kpi = `Peningkatan nilai evaluasi kompetensi pasca-pelatihan minimal 85% dan peningkatan efisiensi pengerjaan tugas tim sebesar 20%.`;

    const titles = [
      `Konsep Kunci, Fundamental Teori & Standar Mutu ${topic}`,
      `Workshop Praktik: Studi Kasus, Penerapan Alur Kerja & Simulasi Nyata`,
      `Optimasi Eksekusi, Mitigasi Risiko & Troubleshooting Masalah Umum`,
      `Evaluasi Hasil Kerja, Standarisasi SOP & Rencana Tindak Lanjut Mandiri`
    ];
    const methods = ['Teori & Diskusi Kasus', 'Praktik & Workshop Terpandu', 'Simulasi & Diskusi Solusi', 'Review & Action Plan'];
    const descs = [
      `Membedah prinsip dasar, terminologi esensial, dan fondasi kepatuhan prosedur terkait ${topic}.`,
      `Praktik terstruktur langkah-demi-langkah menyelesaikan skenario kerja aktual yang biasa dihadapi di lapangan.`,
      `Menganalisis potensi bottleneck, mitigasi kesalahan fatal, dan teknik pemecahan masalah secara terorganisir.`,
      `Menyusun lembar kerja tindak lanjut mandiri (action item) untuk memastikan kesinambungan pasca-pelatihan.`
    ];

    sessionSchedule.forEach((sched, idx) => {
      sessions.push({
        modul: `Sesi ${idx + 1}: ${titles[idx] || `Sesi Pembelajaran ${idx + 1}`}`,
        jamMulai: sched.start,
        jamSelesai: sched.end,
        durasi: sched.dur,
        metode: methods[idx] || 'Praktik & Workshop',
        deskripsi: descs[idx] || `Praktek dan pendalaman materi ${topic}.`
      });
    });
  }

  return {
    namaTraining: topic,
    kategoriUrgensi: urgency,
    level: level,
    goals: goals,
    modules: sessions,
    hasilDiharapkan: expected,
    penerapanPekerjaan: application,
    indikatorKeberhasilan: kpi
  };
}

function renderAiPlanPreview(plan) {
  const previewEl = document.getElementById('aiPreviewContainer');
  if (!previewEl) return;

  const goalsEl = document.getElementById('previewAiGoals');
  if (goalsEl) goalsEl.textContent = plan.goals || '-';

  const countEl = document.getElementById('previewAiModuleCount');
  if (countEl) countEl.textContent = (plan.modules || []).length;

  const listEl = document.getElementById('previewAiModulesList');
  if (listEl) {
    listEl.innerHTML = (plan.modules || []).map(m => `
      <div class="ai-module-pill">
        <div class="ai-module-pill-head">
          <span>${m.modul}</span>
          <span style="font-size:11px;color:var(--moss);">${m.jamMulai} - ${m.jamSelesai} (${m.durasi}) • ${m.metode || 'Praktik'}</span>
        </div>
        <div class="ai-module-pill-desc">${m.deskripsi || '-'}</div>
      </div>
    `).join('');
  }

  const expEl = document.getElementById('previewAiExpected');
  if (expEl) expEl.textContent = plan.hasilDiharapkan || '-';

  const appEl = document.getElementById('previewAiApply');
  if (appEl) appEl.textContent = plan.penerapanPekerjaan || '-';

  const kpiEl = document.getElementById('previewAiKpi');
  if (kpiEl) kpiEl.textContent = plan.indikatorKeberhasilan || '-';

  previewEl.style.display = 'block';
  previewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function applyAiPlanToForm() {
  if (!currentAiPlan) {
    showToast('Belum ada rancangan training yang digenerate.', 'error');
    return;
  }

  // 1. Step 1 Fields
  const nameEl = document.getElementById('trainingName');
  if (nameEl && currentAiPlan.namaTraining) {
    nameEl.value = currentAiPlan.namaTraining;
  }

  const goalsEl = document.getElementById('goals');
  if (goalsEl && currentAiPlan.goals) {
    goalsEl.value = currentAiPlan.goals;
  }

  const urgencyEl = document.getElementById('urgencyCategory');
  if (urgencyEl && currentAiPlan.kategoriUrgensi) {
    urgencyEl.value = currentAiPlan.kategoriUrgensi;
  }

  // Level Kemahiran Chip
  if (currentAiPlan.level) {
    const levelChip = Array.from(document.querySelectorAll('#levelChipGrid .chip-card, .chip-card')).find(c => {
      return (c.textContent || '').trim().toLowerCase().includes(currentAiPlan.level.toLowerCase());
    });
    if (levelChip && typeof selectChip === 'function') {
      selectChip('level', currentAiPlan.level, levelChip);
    } else {
      const levelHidden = document.getElementById('levelKemahiran');
      if (levelHidden) levelHidden.value = currentAiPlan.level;
    }
  }

  // 2. Step 2 Modules Table
  if (Array.isArray(currentAiPlan.modules) && currentAiPlan.modules.length > 0) {
    const tbody = document.getElementById('moduleBody');
    if (tbody) tbody.innerHTML = '';
    moduleCounter = 0;

    const today = document.getElementById('tglPelaksanaan')?.value || new Date().toISOString().split('T')[0];
    const trainer = (document.getElementById('trainer')?.value || '').trim();
    const lokasi = (document.getElementById('lokasi')?.value || '').trim();

    currentAiPlan.modules.forEach(m => {
      addModule(today, m.jamMulai, m.jamSelesai, m.modul, trainer, m.metode || 'Praktik', lokasi, m.deskripsi || '');
    });

    calculateScheduleAndDuration();
  }

  // 3. Step 2 Evaluation Fields
  const expectedEl = document.getElementById('hasilDiharapkan');
  if (expectedEl && currentAiPlan.hasilDiharapkan) {
    expectedEl.value = currentAiPlan.hasilDiharapkan;
  }

  const applyEl = document.getElementById('penerapanPekerjaan');
  if (applyEl && currentAiPlan.penerapanPekerjaan) {
    applyEl.value = currentAiPlan.penerapanPekerjaan;
  }

  const kpiEl = document.getElementById('indikatorKeberhasilan');
  if (kpiEl && currentAiPlan.indikatorKeberhasilan) {
    kpiEl.value = currentAiPlan.indikatorKeberhasilan;
  }

  // Update training ID
  if (typeof updateTrainingId === 'function') updateTrainingId();

  closeModal('modalAiAssistant');
  showToast('Rancangan kurikulum pelatihan berhasil diterapkan ke formulir!', 'success');
}

/// ===================================================
// ADVANCED AI LEARNING & DEVELOPMENT STUDIO ENGINE
// ===================================================
let currentStudioMode = 'curriculum';
let currentStudioDocTab = 'overview';
let studioGeneratedData = null;

function initAiStudioPage() {
  // Enterprise AI Studio ready with Google Gemini 3.5 Flash
}

function toggleStudioApiKey() {
  const drawer = document.getElementById('studioApiKeyDrawer');
  if (drawer) {
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
  }
}

function switchStudioMode(mode) {
  currentStudioMode = mode;

  // 1. Update Mode Tabs
  document.querySelectorAll('.ai-mode-tab').forEach(t => t.classList.remove('active'));
  const activeTabBtn = document.getElementById(`modeTab${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  // 2. Switch Input Panes
  const panes = ['Curriculum', 'Tna', 'Roi', 'Assessment'];
  panes.forEach(p => {
    const el = document.getElementById(`paneMode${p}`);
    if (el) el.style.display = (p.toLowerCase() === mode.toLowerCase()) ? 'block' : 'none';
  });

  // 3. Update Title & Badges & Button Text
  const titleEl = document.getElementById('studioPanelTitle');
  const badgeEl = document.getElementById('studioActiveModeBadge');
  const btnText = document.getElementById('btnStudioRunText');

  if (mode === 'curriculum') {
    if (titleEl) titleEl.textContent = 'Parameter Kurikulum';
    if (badgeEl) badgeEl.textContent = 'Mode 1: Curriculum Architect';
    if (btnText) btnText.textContent = 'Analisis & Rancang Kurikulum';
  } else if (mode === 'tna') {
    if (titleEl) titleEl.textContent = 'Diagnosa Kebutuhan & Masalah';
    if (badgeEl) badgeEl.textContent = 'Mode 2: TNA Diagnostic';
    if (btnText) btnText.textContent = 'Diagnosa Masalah Tim & Kebutuhan';
  } else if (mode === 'roi') {
    if (titleEl) titleEl.textContent = 'Estimasi Dampak Bisnis';
    if (badgeEl) badgeEl.textContent = 'Mode 3: Business ROI & Kirkpatrick';
    if (btnText) btnText.textContent = 'Hitung Proyeksi Dampak & ROI';
  } else if (mode === 'assessment') {
    if (titleEl) titleEl.textContent = 'Konfigurasi Instrumen Ujian';
    if (badgeEl) badgeEl.textContent = 'Mode 4: Assessment & Quiz Builder';
    if (btnText) btnText.textContent = 'Buat Soal Pre/Post Test & Rubrik';
  }
}

function setStudioTopicAndRun(topic) {
  const input = document.getElementById('curriculumTopic');
  if (input) {
    input.value = topic;
    input.focus();
  }
}

function setTnaCase(caseText, deptHint) {
  const textarea = document.getElementById('tnaIssue');
  if (textarea) {
    textarea.value = caseText;
    textarea.focus();
  }
  if (deptHint) {
    const deptSel = document.getElementById('tnaDept');
    if (deptSel) deptSel.value = deptHint;
  }
}

function switchStudioDocTab(tabName) {
  currentStudioDocTab = tabName;

  document.querySelectorAll('.ai-doc-subtab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`subtabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');

  const docPanes = ['Overview', 'Ksa', 'Evaluation', 'Quiz'];
  docPanes.forEach(dp => {
    const el = document.getElementById(`paneDoc${dp}`);
    if (el) el.style.display = (dp.toLowerCase() === tabName.toLowerCase()) ? 'block' : 'none';
  });
}

async function runStudioEngine() {
  let mainTopic = '';
  let targetLevel = 'Intermediate';
  let format = '1_day';
  let targetAudience = 'Karyawan & Team Lead';
  let userIssue = '';

  if (currentStudioMode === 'curriculum') {
    mainTopic = (document.getElementById('curriculumTopic')?.value || '').trim();
    targetLevel = document.getElementById('curriculumLevel')?.value || 'Intermediate';
    format = document.getElementById('curriculumFormat')?.value || '1_day';
    targetAudience = (document.getElementById('curriculumTarget')?.value || '').trim() || 'Tim Lintas Divisi';
    if (!mainTopic) {
      showToast('Mohon masukkan Topik / Keahlian Pelatihan terlebih dahulu.', 'error');
      document.getElementById('curriculumTopic')?.focus();
      return;
    }
  } else if (currentStudioMode === 'tna') {
    userIssue = (document.getElementById('tnaIssue')?.value || '').trim();
    const dept = (document.getElementById('tnaDept')?.value || '').trim() || 'Operasional';
    if (!userIssue) {
      showToast('Mohon deskripsikan Masalah / Kesenjangan Performa Tim terlebih dahulu.', 'error');
      document.getElementById('tnaIssue')?.focus();
      return;
    }
    mainTopic = `Peningkatan Performa & Penyelesaian Kesenjangan: ${dept}`;
    targetAudience = `Tim ${dept}`;
  } else if (currentStudioMode === 'roi') {
    mainTopic = (document.getElementById('roiTopic')?.value || '').trim();
    if (!mainTopic) {
      showToast('Mohon masukkan Topik Program Pelatihan terlebih dahulu.', 'error');
      document.getElementById('roiTopic')?.focus();
      return;
    }
  } else if (currentStudioMode === 'assessment') {
    mainTopic = (document.getElementById('quizTopic')?.value || '').trim();
    if (!mainTopic) {
      showToast('Mohon masukkan Topik / Silabus Materi Ujian terlebih dahulu.', 'error');
      document.getElementById('quizTopic')?.focus();
      return;
    }
  }

  // UI State: Loading
  const emptyEl = document.getElementById('studioCanvasEmpty');
  const loadingEl = document.getElementById('studioCanvasLoading');
  const resultEl = document.getElementById('studioCanvasResult');
  const subtabsEl = document.getElementById('studioDocSubtabs');
  const actionsEl = document.getElementById('studioDocActions');
  const statusBadge = document.getElementById('studioDocStatusBadge');
  const runBtn = document.getElementById('btnStudioRun');

  if (emptyEl) emptyEl.style.display = 'none';
  if (resultEl) resultEl.style.display = 'none';
  if (subtabsEl) subtabsEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'block';
  if (runBtn) runBtn.disabled = true;

  if (statusBadge) {
    statusBadge.innerHTML = `<span class="mini-pill" style="background:#EEF2FF;color:#4F46E5;border:1px solid #C7D2FE;"><span class="dot" style="background:#4F46E5;"></span>Menganalisis L&amp;D...</span>`;
  }

  try {
    const apiKey = getActiveGeminiApiKey();
    let data = null;

    if (apiKey) {
      try {
        data = await generateStudioWithGeminiLive(mainTopic, targetLevel, format, targetAudience, userIssue, currentStudioMode, apiKey);
      } catch (err) {
        console.warn('Gemini live call in Studio failed, falling back to comprehensive offline blueprint:', err);
        data = buildComprehensiveLdBlueprint(mainTopic, targetLevel, format, targetAudience, userIssue, currentStudioMode);
      }
    } else {
      await new Promise(r => setTimeout(r, 120));
      data = buildComprehensiveLdBlueprint(mainTopic, targetLevel, format, targetAudience, userIssue, currentStudioMode);
    }

    studioGeneratedData = data;
    currentAiPlan = data.formPlan || data; // Sync so direct apply to form works

    renderStudioExecutiveBlueprint(data);

    if (loadingEl) loadingEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'block';
    if (subtabsEl) subtabsEl.style.display = 'flex';
    if (actionsEl) actionsEl.style.display = 'flex';

    if (statusBadge) {
      statusBadge.innerHTML = `<span class="mini-pill approved" style="font-size:11.5px;padding:3px 10px;"><span class="dot"></span>Analisis Selesai</span>`;
    }

    switchStudioDocTab('overview');
    showToast('Cetak biru L&D berhasil dianalisis dan disusun!', 'success');
  } catch (err) {
    console.error('Error running AI Studio engine:', err);
    showToast('Gagal memproses analisis. Silahkan coba kembali.', 'error');
    if (emptyEl) emptyEl.style.display = 'flex';
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (runBtn) runBtn.disabled = false;
  }
}

async function generateStudioWithGeminiLive(topic, level, format, audience, issue, mode, apiKey) {
  const prompt = `Anda adalah seorang Chief Learning Officer & Pakar Senior L&D Korporat.
Rancanglah cetak biru program L&D dan kurikulum pelatihan mendalam untuk konteks berikut:
Topik: "${topic}"
Target Level: ${level}
Format: ${format}
Target Audiens: "${audience}"
Masalah / Gejala Performa: "${issue || 'Kesenjangan keterampilan dan kebutuhan peningkatan efisiensi'}"
Fokus Mode Saat Ini: ${mode}

Keluarkan HANYA JSON murni (tanpa tanda kutip backtick markdown) dengan skema berikut:
{
  "title": "${topic}",
  "level": "${level}",
  "format": "${format}",
  "audience": "${audience}",
  "summary": "Sasaran strategis & SMART goals yang tajam dan terukur",
  "tna": {
    "rootCause": "Analisis akar masalah 5-Whys mengapa kendala ini terjadi",
    "intervention": "Kombinasi intervensi (Pelatihan teknis, perbaikan SOP, atau tooling)",
    "roadmap": [
      { "tahap": "Tahap 1: Penguasaan Dasar", "durasi": "Minggu 1-2", "deskripsi": "Uraian tahap 1" },
      { "tahap": "Tahap 2: Simulasi Praktik", "durasi": "Minggu 3-4", "deskripsi": "Uraian tahap 2" },
      { "tahap": "Tahap 3: Pendampingan Kerja", "durasi": "Bulan ke-2", "deskripsi": "Uraian tahap 3" }
    ]
  },
  "modules": [
    {
      "modul": "Sesi 1: Judul Modul",
      "jamMulai": "09:00",
      "jamSelesai": "12:00",
      "durasi": "3 Jam",
      "metode": "Praktik / Workshop / Studi Kasus",
      "deskripsi": "Uraian materi mendalam dan aktivitas hands-on"
    }
  ],
  "ksa": {
    "knowledge": ["Point pengetahuan 1", "Point pengetahuan 2", "Point pengetahuan 3"],
    "skills": ["Point keterampilan 1", "Point keterampilan 2", "Point keterampilan 3"],
    "attitude": ["Point sikap kerja 1", "Point sikap kerja 2", "Point sikap kerja 3"]
  },
  "evaluation": {
    "level1": { "title": "Level 1: Reaksi & Kepuasan", "metric": "Survei CSAT", "target": "Target skor minimal 4.6/5.0" },
    "level2": { "title": "Level 2: Pembelajaran", "metric": "Pre-Test vs Post-Test", "target": "Peningkatan nilai rata-rata >= 35%" },
    "level3": { "title": "Level 3: Perilaku Kerja 30-Hari", "metric": "Observasi Supervisor Langsung", "target": "Penerapan SOP >= 85%" },
    "level4": { "title": "Level 4: Hasil Bisnis 90-Hari", "metric": "Metrik Performa Operasional", "target": "Efisiensi jam kerja & reduksi defect" },
    "roiProjection": {
      "participants": 10,
      "hoursSavedPerWeek": "4 Jam / Tim",
      "annualHoursSaved": "200 Jam / Tahun",
      "estimatedPayback": "2 Bulan"
    }
  },
  "quiz": [
    {
      "q": "1. Pertanyaan skenario kasus riil...",
      "options": ["A. Opsi A", "B. Opsi B", "C. Opsi C", "D. Opsi D"],
      "answer": "B",
      "explanation": "Alasan mengapa B benar..."
    }
  ]
}`;

  const cleanKey = apiKey.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 16000);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      })
    });

    if (!response.ok) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(cleanKey)}`;
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        })
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const resData = await response.json();
  const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini');

  const cleanJson = rawText.replace(/```json\s*|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  parsed.formPlan = {
    namaTraining: parsed.title || topic,
    kategoriUrgensi: 'Kesenjangan Keterampilan',
    level: parsed.level || level,
    goals: parsed.summary || '',
    modules: parsed.modules || [],
    hasilDiharapkan: parsed.evaluation?.level4?.target || parsed.summary,
    penerapanPekerjaan: parsed.evaluation?.level3?.target || 'Penerapan langsung di workflow tim.',
    indikatorKeberhasilan: parsed.evaluation?.level2?.target || 'Peningkatan skor evaluasi >= 85%.'
  };

  return parsed;
}

// Deep Intelligence Blueprint Builder (Multi-Dimensional L&D Engine)
function buildComprehensiveLdBlueprint(topic, level, format, audience, issue, mode) {
  const basePlan = generateSmartPlanOffline(topic, level, format);
  const lower = topic.toLowerCase();
  const issueLower = (issue || '').toLowerCase();

  // 1. TNA Diagnostic Logic
  let rootCauseAnalysis = '';
  let interventionCategory = 'Pelatihan Keterampilan + Standardisasi SOP';
  let tnaRoadmap = [];

  if (mode === 'tna' || issue) {
    rootCauseAnalysis = `Berdasarkan analisis 5-Whys terhadap kendala (${issue || topic}), kesenjangan performa berakar pada kurangnya standardisasi alur kerja, belum adanya framework komunikasi asertif/teknis, serta minimnya latihan skenario krisis bertekanan tinggi di lingkungan kerja aktual.`;
    interventionCategory = 'Kombinasi Pelatihan Teknis (70%) + Pendampingan SOP & Tooling (30%)';
    tnaRoadmap = [
      { tahap: 'Tahap 1: Penguasaan Fondasi & Mindset', durasi: 'Minggu 1-2', deskripsi: 'Penyelarasan standar kompetensi dasar, eliminasi bad habits, dan bedah SOP terintegrasi.' },
      { tahap: 'Tahap 2: Simulasi Kasus Kritis (Pressure Lab)', durasi: 'Minggu 3-4', deskripsi: 'Workshop studi kasus nyata berulang dengan bimbingan langsung fasilitator senior.' },
      { tahap: 'Tahap 3: Pendampingan & Monitoring 30-Hari', durasi: 'Bulan ke-2', deskripsi: 'Evaluasi mingguan oleh Team Lead menggunakan lembar audit observasi perilaku.' }
    ];
  }

  // 2. KSA Matrix (Knowledge, Skills, Attitude)
  let ksa = {
    knowledge: [
      `Prinsip arsitektur, standar industri terbaik (best practices), dan terminologi kunci terkait ${topic}.`,
      `Metodologi pencegahan kesalahan umum (common pitfalls) dan mitigasi risiko operasional.`,
      `Alur eskalasi masalah dan batas wewenang pengambilan keputusan mandiri.`
    ],
    skills: [
      `Kemampuan mengeksekusi modul kerja ${topic} secara cepat dan akurat sesuai SOP perusahaan.`,
      `Teknik analisis akar masalah (root cause debugging/troubleshooting) saat terjadi insiden.`,
      `Keterampilan menyusun dokumentasi kerja terstandar yang mudah didelegasikan ke rekan tim.`
    ],
    attitude: [
      `Akuntabilitas tinggi terhadap zero-defect dan rasa kepemilikan (ownership) terhadap hasil kerja.`,
      `Keterbukaan menerima feedback konstruktif saat evaluasi sprint atau audit berkala.`,
      `Proaktif berkomunikasi lintas fungsi tanpa menunggu terjadinya hambatan operasional.`
    ]
  };

  // 3. Domain Specific KSA Tuning
  if (lower.includes('react') || lower.includes('code') || lower.includes('golang') || lower.includes('devops') || lower.includes('tech') || lower.includes('data')) {
    ksa.knowledge = [
      `Paradigma arsitektur perangkat lunak modular, clean architecture, dan pola desain maintainable.`,
      `Standar security, sanitasi input API, automated CI/CD pipeline, dan observability.`,
      `Teknik profiling bottleneck memori, query database, dan prinsip scalable system design.`
    ];
    ksa.skills = [
      `Menulis kode modular dengan unit testing coverage minimal 80% dan zero critical lint warnings.`,
      `Melakukan peer code review asertif dan refactoring legacy code tanpa menyebabkan regresi.`,
      `Mengoperasikan tools debugging modern dan otomatisasi deployment zero-downtime.`
    ];
    ksa.attitude = [
      `Disiplin tinggi terhadap craftmanship kode bersih (clean code) dan standar git flow tim.`,
      `Ego-free code mindset: memisahkan identitas diri dari kritik terhadap baris kode.`,
      `Kepedulian terhadap maintainability kode yang akan dirawat oleh rekan kerja di masa depan.`
    ];
  } else if (lower.includes('lead') || lower.includes('coach') || lower.includes('manager')) {
    ksa.knowledge = [
      `Prinsip Situational Leadership, GROW Coaching Model, dan pemetaan tingkat kematangan bawahan.`,
      `Prinsip psychological safety di tempat kerja dan teknik de-eskalasi friksi internal.`,
      `Strategi perumusan cascading OKR/KPI yang realistis namun menantang.`
    ];
    ksa.skills = [
      `Memfasilitasi sesi 1-on-1 mingguan yang menghasilkan komitmen action plan konkret dari bawahan.`,
      `Mendelegasikan tanggung jawab kritis dengan matriks wewenang tanpa micromanagement.`,
      `Memberikan SBI (Situation-Behavior-Impact) constructive feedback secara tenang dan solutif.`
    ];
    ksa.attitude = [
      `Empati aktif dan kesediaan mendengarkan sebelum menarik kesimpulan atas masalah tim.`,
      `Keteladanan dalam akuntabilitas (lead by example) dan integritas waktu komitmen.`,
      `Fokus pada pertumbuhan potensi anggota tim, bukan sekadar memburu hasil jangka pendek.`
    ];
  }

  // 4. Kirkpatrick 4-Level Evaluation & Financial ROI
  const pCount = parseInt(document.getElementById('roiParticipants')?.value || '10', 10) || 10;
  const hoursSavedPerWeek = Math.max(3, Math.round(pCount * 0.4));
  const annualHours = hoursSavedPerWeek * 50;

  const evaluation = {
    level1: {
      title: 'Level 1: Reaksi & Kepuasan Peserta',
      metric: 'Survei CSAT Evaluasi Pelatihan',
      target: 'Skor kepuasan minimal 4.6 dari 5.0 terhadap relevansi materi, studi kasus, dan fasilitator.'
    },
    level2: {
      title: 'Level 2: Pembelajaran & Retensi Materi',
      metric: 'Perbandingan Pre-Test vs Post-Test',
      target: 'Kenaikan nilai rata-rata peserta minimal +35% dengan tingkat kelulusan komprehensif 100%.'
    },
    level3: {
      title: 'Level 3: Perilaku Kerja Aktual (30-60 Hari)',
      metric: 'Audit Observasi Perilaku oleh Direct Supervisor',
      target: 'Checklist kepatuhan SOP dan aplikasi framework kerja baru tercapai minimal 85% pada evaluasi 30 hari.'
    },
    level4: {
      title: 'Level 4: Dampak Bisnis Nyata (90 Hari)',
      metric: 'Efisiensi Operasional & Penurunan Defect Rate',
      target: `Efisiensi waktu kerja ~${hoursSavedPerWeek} jam/minggu, penurunan tingkat kesalahan kerja 25%, dan eliminasi rework.`
    },
    roiProjection: {
      participants: pCount,
      hoursSavedPerWeek: `${hoursSavedPerWeek} Jam / Tim`,
      annualHoursSaved: `${annualHours} Jam / Tahun`,
      estimatedPayback: '1.5 &ndash; 2.5 Bulan'
    }
  };

  // 5. Scenario-Based Pre/Post Assessment Quiz (5 Questions)
  const quiz = [
    {
      q: `1. Saat menghadapi situasi di mana ${topic} mengalami hambatan atau anomali di tengah operasional, langkah pertama yang paling sesuai dengan best practice adalah:`,
      options: [
        'A. Langsung mencari jalan pintas sementara tanpa mencatat penyebab akar masalah.',
        'B. Melakukan isolasi dampak masalah, meninjau log/data faktual, dan mendokumentasikan anomali sebelum intervensi.',
        'C. Mengabaikan selama belum ada keluhan dari atasan atau pihak eksternal.',
        'D. Menyerahkan seluruh perbaikan kepada divisi lain tanpa investigasi awal.'
      ],
      answer: 'B',
      explanation: 'Isolasi dampak dan verifikasi data faktual merupakan prinsip dasar pemecahan masalah agar perbaikan bersifat permanen dan tidak memicu efek samping lain.'
    },
    {
      q: `2. Dalam menerapkan metodologi ${topic}, apa indikator paling objektif bahwa suatu modul kerja telah memenuhi standar kualitas (Definition of Done)?`,
      options: [
        'A. Pekerjaan selesai tepat sebelum jam pulang kantor.',
        'B. Telah melalui checklist verifikasi mandiri, bebas error kritis, dan terverifikasi oleh rekan kerja/atasan.',
        'C. Selesai lebih cepat dari rekan kerja lain tanpa perlu dokumentasi pendukung.',
        'D. Diterima oleh pengguna tanpa adanya pertanyaan sama sekali.'
      ],
      answer: 'B',
      explanation: 'Definition of Done mensyaratkan verifikasi objektif, nihil error kritis, dan adanya validasi silang (cross-check).'
    },
    {
      q: `3. Mengapa pemahaman atas konsep kunci dalam ${topic} harus diimbangi dengan studi kasus langsung (hands-on)?`,
      options: [
        'A. Karena teori saja tidak memperlihatkan kompleksitas batasan kondisi di lapangan nyata.',
        'B. Hanya untuk menghabiskan durasi pelatihan yang telah dijadwalkan.',
        'C. Agar fasilitator tidak perlu berbicara terlalu banyak selama pelatihan.',
        'D. Teori sebenarnya sudah cukup tanpa perlu simulasi praktik.'
      ],
      answer: 'A',
      explanation: 'Simulasi kasus nyata mengasah intuisi pengambilan keputusan dan refleks operasional peserta saat menghadapi tekanan aktual.'
    },
    {
      q: `4. Pada evaluasi Level 3 Kirkpatrick untuk program ${topic}, pihak yang paling bertanggung jawab memantau penerapan perilaku kerja baru adalah:`,
      options: [
        'A. Tim HR Generalist pusat.',
        'B. Direct Supervisor / Atasan Langsung dari peserta pelatihan.',
        'C. Vendor penyedia training eksternal.',
        'D. Sesama peserta training yang duduk berdampingan.'
      ],
      answer: 'B',
      explanation: 'Direct Supervisor berinteraksi setiap hari dengan peserta dan memegang wewenang penilaian kinerja langsung (on-the-job application).'
    },
    {
      q: `5. Jika pasca pelatihan ditemukan peserta belum menerapkan materi ${topic} secara konsisten, langkah perbaikan yang direkomendasikan adalah:`,
      options: [
        'A. Langsung memberikan surat peringatan formal tanpa diskusi.',
        'B. Mengadakan sesi coaching 1-on-1 untuk mengidentifikasi apakah hambatan berupa pemahaman materi, beban kerja, atau ketiadaan tools pendukung.',
        'C. Meminta peserta mengulang seluruh modul dari awal secara mandiri di luar jam kerja.',
        'D. Membiarkan saja karena performa karyawan akan membaik dengan sendirinya.'
      ],
      answer: 'B',
      explanation: 'Coaching 1-on-1 mengurai akar kendala penerapan (apakah masalah kompetensi, kejelasan ekspektasi, atau kendala sistem lingkungan kerja).'
    }
  ];

  return {
    title: topic,
    level: level,
    format: format,
    audience: audience,
    issue: issue,
    mode: mode,
    summary: basePlan.goals,
    modules: basePlan.modules,
    tna: {
      rootCause: rootCauseAnalysis,
      intervention: interventionCategory,
      roadmap: tnaRoadmap
    },
    ksa: ksa,
    evaluation: evaluation,
    quiz: quiz,
    formPlan: basePlan
  };
}

function renderStudioExecutiveBlueprint(data) {
  const paneOverview = document.getElementById('paneDocOverview');
  const paneKsa = document.getElementById('paneDocKsa');
  const paneEval = document.getElementById('paneDocEvaluation');
  const paneQuiz = document.getElementById('paneDocQuiz');

  if (!paneOverview) return;

  // 1. PANE 1: OVERVIEW & SESSIONS
  let tnaBlockHtml = '';
  if (data.tna && data.tna.rootCause) {
    const roadmapItemsHtml = (data.tna.roadmap || []).map(r => `
      <div style="background:#FFFFFF;border:1px solid var(--line-soft);border-radius:6px;padding:10px 12px;margin-top:6px;">
        <div style="display:flex;justify-content:space-between;font-weight:600;font-size:12.5px;color:var(--ink);">
          <span>${r.tahap}</span>
          <span class="mini-pill in_review" style="font-size:11px;padding:2px 7px;">${r.durasi}</span>
        </div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:3px;">${r.deskripsi}</div>
      </div>
    `).join('');

    tnaBlockHtml = `
      <div class="ai-doc-card" style="border-left:4px solid var(--accent);background:rgba(79,70,229,0.03);">
        <div class="ai-doc-card-title">
          <span style="display:flex;align-items:center;gap:6px;color:var(--accent);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Hasil Diagnosa TNA &amp; Analisis Akar Masalah (Root Cause)
          </span>
          <span class="mini-pill in_review" style="font-size:11px;">Rekomendasi Intervensi</span>
        </div>
        <p style="font-size:13px;color:var(--ink);line-height:1.6;margin:0 0 10px 0;">${escapeHtml(data.tna.rootCause)}</p>
        <div style="font-size:12.5px;margin-bottom:10px;"><strong>Tipe Intervensi Direkomendasikan:</strong> <span style="color:var(--moss);font-weight:600;">${escapeHtml(data.tna.intervention)}</span></div>
        <div style="font-weight:600;font-size:12.5px;color:var(--ink);margin-bottom:6px;">Roadmap Intervensi 3-Tahap:</div>
        <div>${roadmapItemsHtml}</div>
      </div>
    `;
  }

  const sessionsHtml = (data.modules || []).map((m, idx) => `
    <div class="ai-doc-card" style="margin-bottom:12px;">
      <div class="ai-doc-card-title">
        <span>${escapeHtml(m.modul)}</span>
        <span class="mini-pill approved" style="font-size:11px;padding:3px 9px;">${m.jamMulai} &ndash; ${m.jamSelesai} (${m.durasi}) &bull; ${escapeHtml(m.metode || 'Workshop Hands-on')}</span>
      </div>
      <div style="font-size:12.5px;color:var(--ink-soft);line-height:1.55;margin-bottom:6px;">
        ${escapeHtml(m.deskripsi)}
      </div>
      <div style="display:flex;gap:12px;font-size:11.5px;color:var(--ink-faint);flex-wrap:wrap;border-top:1px dashed var(--line-soft);padding-top:6px;margin-top:6px;">
        <span><strong>Output:</strong> Aplikasi Praktik &amp; Pemahaman Mandiri</span>
        <span><strong>Fasilitator:</strong> Subject Matter Expert (SME) Terakreditasi</span>
      </div>
    </div>
  `).join('');

  paneOverview.innerHTML = `
    <div class="ai-doc-hero">
      <h2>${escapeHtml(data.title)}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span class="mini-pill submitted" style="font-size:11.5px;padding:3px 10px;">Level: ${escapeHtml(data.level)}</span>
        <span class="mini-pill in_review" style="font-size:11.5px;padding:3px 10px;">${(data.modules || []).length} Sesi Terstruktur</span>
        <span class="mini-pill approved" style="font-size:11.5px;padding:3px 10px;">Target: ${escapeHtml(data.audience)}</span>
      </div>
    </div>

    ${tnaBlockHtml}

    <div class="ai-doc-card">
      <div class="ai-doc-card-title">
        <span>Sasaran Pembelajaran &amp; Hasil Strategis (SMART Goals)</span>
      </div>
      <p style="font-size:13px;color:var(--ink);line-height:1.65;margin:0;">${escapeHtml(data.summary)}</p>
    </div>

    <div style="margin-top:20px;">
      <h4 style="margin:0 0 12px 0;font-size:14px;color:var(--ink);font-weight:700;">Rundown &amp; Silabus Pembelajaran Per Sesi</h4>
      <div>${sessionsHtml}</div>
    </div>
  `;

  // 2. PANE 2: KSA MATRIKS
  const knowledgeList = (data.ksa.knowledge || []).map(k => `<li>${escapeHtml(k)}</li>`).join('');
  const skillsList = (data.ksa.skills || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
  const attitudeList = (data.ksa.attitude || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');

  paneKsa.innerHTML = `
    <div class="ai-doc-hero">
      <h2>Matriks Kompetensi: KSA Framework</h2>
      <p style="margin:0;font-size:13px;color:var(--ink-soft);">Pemetaan terintegrasi atas Pengetahuan (Knowledge), Keterampilan (Skills), dan Sikap Kerja (Attitude) yang wajib dikuasai peserta pasca-pelatihan.</p>
    </div>

    <div class="ai-ksa-grid">
      <div class="ai-ksa-card">
        <div class="ai-ksa-title" style="color:var(--accent);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          1. Knowledge (Pengetahuan)
        </div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:var(--ink-soft);line-height:1.6;">${knowledgeList}</ul>
      </div>

      <div class="ai-ksa-card">
        <div class="ai-ksa-title" style="color:var(--moss);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          2. Skills (Keterampilan)
        </div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:var(--ink-soft);line-height:1.6;">${skillsList}</ul>
      </div>

      <div class="ai-ksa-card">
        <div class="ai-ksa-title" style="color:var(--clay);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          3. Attitude (Sikap Kerja)
        </div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:var(--ink-soft);line-height:1.6;">${attitudeList}</ul>
      </div>
    </div>

    <div class="ai-doc-card" style="margin-top:20px;">
      <div class="ai-doc-card-title">
        <span>Tingkat Penguasaan Berdasarkan Bloom's Taxonomy</span>
      </div>
      <div style="font-size:13px;color:var(--ink-soft);line-height:1.6;">
        Program ini dirancang untuk membawa peserta dari level pemahaman <strong>Understand</strong> menuju <strong>Apply</strong> (mampu mempraktikkan langsung secara mandiri) dan <strong>Analyze</strong> (mampu mengurai anomali dan mengambil keputusan perbaikan di lapangan kerja).
      </div>
    </div>
  `;

  // 3. PANE 3: KIRKPATRICK & BUSINESS ROI
  const ev = data.evaluation;
  paneEval.innerHTML = `
    <div class="ai-doc-hero">
      <h2>Model Evaluasi 4-Level Kirkpatrick &amp; Proyeksi ROI</h2>
      <p style="margin:0;font-size:13px;color:var(--ink-soft);">Kerangka pengukuran dampak pelatihan dari respon di kelas hingga dampak finansial pada performa kuartalan.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin-bottom:20px;">
      <div class="ai-doc-card" style="margin:0;">
        <div class="ai-doc-card-title"><span style="color:var(--accent);">${ev.level1.title}</span></div>
        <div style="font-size:12px;color:var(--ink-faint);margin-bottom:4px;"><strong>Instrumen:</strong> ${ev.level1.metric}</div>
        <div style="font-size:12.5px;color:var(--ink);">${ev.level1.target}</div>
      </div>

      <div class="ai-doc-card" style="margin:0;">
        <div class="ai-doc-card-title"><span style="color:var(--moss);">${ev.level2.title}</span></div>
        <div style="font-size:12px;color:var(--ink-faint);margin-bottom:4px;"><strong>Instrumen:</strong> ${ev.level2.metric}</div>
        <div style="font-size:12.5px;color:var(--ink);">${ev.level2.target}</div>
      </div>

      <div class="ai-doc-card" style="margin:0;">
        <div class="ai-doc-card-title"><span style="color:var(--clay);">${ev.level3.title}</span></div>
        <div style="font-size:12px;color:var(--ink-faint);margin-bottom:4px;"><strong>Instrumen:</strong> ${ev.level3.metric}</div>
        <div style="font-size:12.5px;color:var(--ink);">${ev.level3.target}</div>
      </div>

      <div class="ai-doc-card" style="margin:0;">
        <div class="ai-doc-card-title"><span style="color:#B45309;">${ev.level4.title}</span></div>
        <div style="font-size:12px;color:var(--ink-faint);margin-bottom:4px;"><strong>Instrumen:</strong> ${ev.level4.metric}</div>
        <div style="font-size:12.5px;color:var(--ink);">${ev.level4.target}</div>
      </div>
    </div>

    <div class="ai-doc-card" style="background:var(--panel);">
      <div class="ai-doc-card-title"><span>Simulasi Dampak &amp; Pengembalian Investasi (ROI)</span></div>
      <div class="dashboard-kpi-grid" style="margin-top:10px;">
        <div class="kpi-card" style="background:#FFFFFF;">
          <div class="kpi-card-title">Jam Kerja Dihemat</div>
          <div class="kpi-card-val" style="font-size:20px;color:var(--moss);">${ev.roiProjection.hoursSavedPerWeek}</div>
          <div class="kpi-card-sub">Per minggu untuk ${ev.roiProjection.participants} peserta</div>
        </div>
        <div class="kpi-card" style="background:#FFFFFF;">
          <div class="kpi-card-title">Akumulasi Tahunan</div>
          <div class="kpi-card-val" style="font-size:20px;color:var(--accent);">${ev.roiProjection.annualHoursSaved}</div>
          <div class="kpi-card-sub">Produktivitas tambahan</div>
        </div>
        <div class="kpi-card" style="background:#FFFFFF;">
          <div class="kpi-card-title">Estimasi Payback</div>
          <div class="kpi-card-val" style="font-size:20px;color:#B45309;">${ev.roiProjection.estimatedPayback}</div>
          <div class="kpi-card-sub">Balik modal biaya training</div>
        </div>
      </div>
    </div>
  `;

  // 4. PANE 4: ASSESSMENT & QUIZ BUILDER
  const quizItemsHtml = (data.quiz || []).map((q, idx) => `
    <div class="ai-quiz-item">
      <div class="ai-quiz-q">${escapeHtml(q.q)}</div>
      <div style="margin-bottom:8px;">
        ${q.options.map(opt => `<div class="ai-quiz-opt ${opt.startsWith(q.answer) ? 'correct' : ''}">${escapeHtml(opt)}</div>`).join('')}
      </div>
      <div style="background:#FFFFFF;border:1px solid var(--line-soft);border-radius:6px;padding:8px 10px;font-size:12px;">
        <strong>Kunci Jawaban (${q.answer}):</strong> ${escapeHtml(q.explanation)}
      </div>
    </div>
  `).join('');

  paneQuiz.innerHTML = `
    <div class="ai-doc-hero">
      <h2>Instrumen Ujian &amp; Evaluasi Pemahaman (5 Soal)</h2>
      <p style="margin:0;font-size:13px;color:var(--ink-soft);">Dapat digunakan sebagai soal Pre-Test (sebelum kelas) dan Post-Test (setelah kelas) untuk mengukur tingkat serapan materi secara akurat.</p>
    </div>

    <div>${quizItemsHtml}</div>

    <div class="ai-doc-card" style="margin-top:16px;">
      <div class="ai-doc-card-title"><span>Rubrik Kelulusan Standar</span></div>
      <div style="font-size:12.5px;color:var(--ink-soft);line-height:1.6;">
        Peserta dinyatakan <strong>Lulus Kompetensi (Certified)</strong> apabila memperoleh skor minimal <strong>80% (minimal 4 dari 5 soal benar)</strong> pada sesi evaluasi akhir pasca pelatihan.
      </div>
    </div>
  `;
}

function copyActiveDocContent() {
  if (!studioGeneratedData) {
    showToast('Belum ada dokumen yang dihasilkan.', 'error');
    return;
  }

  const d = studioGeneratedData;
  let text = `========================================================\n`;
  text += `CETAK BIRU L&D EKSEKUTIF: ${d.title.toUpperCase()}\n`;
  text += `Target: ${d.audience} | Level: ${d.level} | Format: ${d.format}\n`;
  text += `========================================================\n\n`;

  text += `[SASARAN STRATEGIS & SMART GOALS]\n${d.summary}\n\n`;

  if (d.tna && d.tna.rootCause) {
    text += `[DIAGNOSA AKAR MASALAH (TNA)]\n${d.tna.rootCause}\n`;
    text += `Tipe Intervensi: ${d.tna.intervention}\n\n`;
  }

  text += `[RUNDOWN SILABUS MODUL]\n`;
  (d.modules || []).forEach((m, idx) => {
    text += `${idx + 1}. ${m.modul} (${m.jamMulai} - ${m.jamSelesai}, ${m.durasi}) [${m.metode}]\n`;
    text += `   Deskripsi: ${m.deskripsi}\n`;
  });

  text += `\n[MATRIKS KOMPETENSI KSA]\n`;
  text += `- KNOWLEDGE:\n  • ` + (d.ksa.knowledge || []).join('\n  • ') + `\n`;
  text += `- SKILLS:\n  • ` + (d.ksa.skills || []).join('\n  • ') + `\n`;
  text += `- ATTITUDE:\n  • ` + (d.ksa.attitude || []).join('\n  • ') + `\n\n`;

  text += `[EVALUASI 4 LEVEL KIRKPATRICK]\n`;
  text += `L1 (Reaksi): ${d.evaluation.level1.target}\n`;
  text += `L2 (Belajar): ${d.evaluation.level2.target}\n`;
  text += `L3 (Perilaku): ${d.evaluation.level3.target}\n`;
  text += `L4 (Hasil Bisnis): ${d.evaluation.level4.target}\n`;
  text += `Estimasi Hemat Jam Kerja: ${d.evaluation.roiProjection.hoursSavedPerWeek}\n\n`;

  text += `[SOAL EVALUASI PEMAHAMAN PRE/POST TEST]\n`;
  (d.quiz || []).forEach(q => {
    text += `${q.q}\n${q.options.join('\n')}\nKunci: ${q.answer} - ${q.explanation}\n\n`;
  });

  text += `(Dihasilkan oleh Training & Development System - AI Studio)\n`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Seluruh dokumen blueprint berhasil disalin!', 'success');
    }).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg || 'Berhasil disalin ke clipboard!', 'success');
  } catch (e) {
    showToast('Gagal menyalin teks secara otomatis.', 'error');
  }
  document.body.removeChild(ta);
}

function applyStudioPlanAndGoToForm() {
  if (!studioGeneratedData) {
    showToast('Belum ada kurikulum yang dirancang.', 'error');
    return;
  }
  currentAiPlan = studioGeneratedData.formPlan;
  goToPage('ajukan');
  applyAiPlanToForm();
  showToast('Cetak biru kurikulum berhasil ditransfer ke formulir pengajuan!', 'success');
}

// Window Exposures for AI Assistant & Studio
window.openAiAssistantModal = openAiAssistantModal;
window.setAiTopic = setAiTopic;
window.saveAiApiKey = saveAiApiKey;
window.executeAiGeneration = executeAiGeneration;
window.applyAiPlanToForm = applyAiPlanToForm;
window.initAiStudioPage = initAiStudioPage;
window.toggleStudioApiKey = toggleStudioApiKey;
window.switchStudioMode = switchStudioMode;
window.setStudioTopicAndRun = setStudioTopicAndRun;
window.setTnaCase = setTnaCase;
window.switchStudioDocTab = switchStudioDocTab;
window.runStudioEngine = runStudioEngine;
window.copyActiveDocContent = copyActiveDocContent;
window.applyStudioPlanAndGoToForm = applyStudioPlanAndGoToForm;

// Outside click listener untuk custom room dropdown
document.addEventListener('click', function(e) {
  const container = document.getElementById('roomDropdownContainer');
  if (container && !container.contains(e.target)) {
    if (typeof closeRoomDropdown === 'function') closeRoomDropdown();
  }
});

// ===================================================
// SKILL MATRIX & GAP ANALYSIS ENGINE (3-TIER HIERARCHY)
// Tier 1: Dropdown Divisi -> Tier 2: List Karyawan -> Tier 3: Individual Skill Matrix (e.g. Fernanda Rusli)
// ===================================================
const STORAGE_KEY_SKILL_EMPLOYEES = 'tds_skill_employees';
const STORAGE_KEY_SKILL_COMPETENCIES = 'tds_skill_competencies';
const STORAGE_KEY_SKILL_SCORES = 'tds_skill_scores';

let activeSkillDept = ''; // Currently selected division
let activeSkillEmpId = ''; // Currently selected employee for individual matrix
let skillEmpSearchQuery = '';
let activeSkillScoreEmpId = null;
let activeSkillScoreCompId = null;

// Scale definitions (Skala Penilaian: 1 - 4)
const SKILL_SCALE_DESC = {
  1: 'Pemahaman Dasar',
  2: 'Cukup Kompeten',
  3: 'Kompeten',
  4: 'Ahli'
};

const SKILL_SCORE_COLORS = {
  1: { bg: '#FEE2E2', color: '#B91C1C' },
  2: { bg: '#FEF3C7', color: '#B45309' },
  3: { bg: '#D1FAE5', color: '#047857' },
  4: { bg: '#DBEAFE', color: '#1D4ED8' }
};

function getGapDetails(gap) {
  if (gap === null || gap === undefined || isNaN(gap)) return null;

  if (gap <= -3) {
    return {
      gapLabel: `GAP ${gap}`,
      keterangan: 'Memerlukan pengembangan menyeluruh / intensif',
      color: '#FF708C',
      bgColor: '#FF708C',
      textColor: '#FFFFFF',
      badgeClass: 'gap-m3',
      dotColor: '#FF708C'
    };
  }
  if (gap === -2) {
    return {
      gapLabel: 'GAP -2',
      keterangan: 'Memerlukan pengembangan',
      color: '#FFB37A',
      bgColor: '#FFB37A',
      textColor: '#4A1D00',
      badgeClass: 'gap-m2',
      dotColor: '#FFB37A'
    };
  }
  if (gap === -1) {
    return {
      gapLabel: 'GAP -1',
      keterangan: 'Memerlukan peningkatan kompetensi',
      color: '#E5A500', // High contrast yellow/gold for text status
      bgColor: '#FFD76A',
      textColor: '#5C3D00',
      badgeClass: 'gap-m1',
      dotColor: '#FFD76A'
    };
  }
  if (gap === 0) {
    return {
      gapLabel: 'GAP 0',
      keterangan: 'Sesuai kompetensi ideal (Standar)',
      color: '#4CC9A0',
      bgColor: '#4CC9A0',
      textColor: '#FFFFFF',
      badgeClass: 'gap-0',
      dotColor: '#4CC9A0'
    };
  }
  // gap > 0
  return {
    gapLabel: `GAP +${gap}`,
    keterangan: 'Melampaui kompetensi ideal',
    color: '#4B96FF',
    bgColor: '#4B96FF',
    textColor: '#FFFFFF',
    badgeClass: 'gap-p',
    dotColor: '#4B96FF'
  };
}

function getInitials(name) {
  if (!name) return 'EMP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const DEFAULT_HR_TEAM_MEMBERS = [
  { id: 'emp_hr_danti', nama: 'DANTI MAGHFIRAH MAULANI', divisi: 'HR', jabatan: 'RECRUITMENT SENIOR' },
  { id: 'emp_hr_fauzan', nama: 'MUHAMMAD FAUZAN', divisi: 'HR', jabatan: 'HR OPERATION SENIOR' },
  { id: 'emp_hr_maria', nama: 'MARIA REGINA ANDARINI TYASWATI', divisi: 'HR', jabatan: 'RECRUITMENT OFFICER' },
  { id: 'emp_hr_shalsa', nama: 'SHALSA BILLA RIZKYA FARHANSI', divisi: 'HR', jabatan: 'RECRUITMENT OFFICER' },
  { id: 'emp_hr_talent', nama: 'TALENT CHRISTABEL RAISSA LIANDA', divisi: 'HR', jabatan: 'TRAINING & PEOPLE DEVELOPMENT SENIOR*' },
  { id: 'emp_hr_aida', nama: 'AIDA FITRIA', divisi: 'HR', jabatan: 'HR OPERATION OFFICER' },
  { id: 'emp_hr_davin', nama: 'DAVIN JENDRI MONARI PURBA', divisi: 'HR', jabatan: 'HR OPERATION ADMIN' },
  { id: 'emp_hr_lathifatul', nama: 'LATHIFATUL AFIFAH', divisi: 'HR', jabatan: 'RECRUITMENT OFFICER' },
  { id: 'emp_hr_rizky', nama: 'RIZKY SIHALOHO', divisi: 'HR', jabatan: 'RECRUITMENT OFFICER' },
  { id: 'emp_hr_gading', nama: 'GADING AZARINE PARAMESTHI', divisi: 'HR', jabatan: 'HR OPERATION ADMIN' }
];

function getInitialSkillData() {
  const employees = [
    // HR - Fernanda Rusli front and center
    { id: 'emp_fernanda', nama: 'FERNANDA RUSLI', divisi: 'HR', jabatan: 'TRAINING & PEOPLE DEVELOPMENT JUNIOR' },
    ...DEFAULT_HR_TEAM_MEMBERS,

    // WEB DEVELOPER
    { id: 'emp_web_1', nama: 'Rizky Pratama', divisi: 'WEB DEVELOPER', jabatan: 'Senior Frontend Developer' },
    { id: 'emp_web_2', nama: 'Kevin Sanjaya', divisi: 'WEB DEVELOPER', jabatan: 'Backend REST API Engineer' },
    { id: 'emp_web_3', nama: 'Nadia Putri', divisi: 'WEB DEVELOPER', jabatan: 'Fullstack Software Engineer' },

    // QA
    { id: 'emp_qa_1', nama: 'Dimas Anggara', divisi: 'QA', jabatan: 'QA Automation Engineer' },
    { id: 'emp_qa_2', nama: 'Rina Melati', divisi: 'QA', jabatan: 'QA Performance & Manual Specialist' },

    // FINANCE
    { id: 'emp_fin_1', nama: 'Hendra Wijaya', divisi: 'FINANCE', jabatan: 'Financial Planning & Analysis' },
    { id: 'emp_fin_2', nama: 'Maya Indah', divisi: 'FINANCE', jabatan: 'Tax & Compliance Officer' },

    // MARKETING
    { id: 'emp_mkt_1', nama: 'Denny Setiawan', divisi: 'MARKETING', jabatan: 'Digital Performance Marketing' },
    { id: 'emp_mkt_2', nama: 'Clarissa Aurelia', divisi: 'MARKETING', jabatan: 'Brand Strategy & Content' },

    // SALES OPS
    { id: 'emp_sales_1', nama: 'Fajar Ramadhan', divisi: 'SALES OPS', jabatan: 'Sales Operations Lead' },
    { id: 'emp_sales_2', nama: 'Tiara Lestari', divisi: 'SALES OPS', jabatan: 'CRM Pipeline Specialist' },

    // IT INFRASTRUCTURE
    { id: 'emp_it_1', nama: 'Bayu Nugroho', divisi: 'IT INFRASTRUCTURE', jabatan: 'Cloud & DevOps Engineer' },
    { id: 'emp_it_2', nama: 'Eko Prasetyo', divisi: 'IT INFRASTRUCTURE', jabatan: 'Network & System Administrator' },

    // AI
    { id: 'emp_ai_1', nama: 'Andre Kurniawan', divisi: 'AI', jabatan: 'AI & Machine Learning Engineer' },
    { id: 'emp_ai_2', nama: 'Felicia Anggraini', divisi: 'AI', jabatan: 'Prompt & LLM Developer' }
  ];

  const competencies = [
    // Spesifik FERNANDA RUSLI (5 Kompetensi T&D - Seluruh Kompetensi Ideal digenapkan ke angka 3)
    { id: 'comp_fr_1', empId: 'emp_fernanda', nama: 'Training & Development Planning', standar: 3, divisi: 'HR' },
    { id: 'comp_fr_2', empId: 'emp_fernanda', nama: 'Training Need Analysis (TNA)', standar: 3, divisi: 'HR' },
    { id: 'comp_fr_3', empId: 'emp_fernanda', nama: 'Program Coordination & Execution', standar: 3, divisi: 'HR' },
    { id: 'comp_fr_4', empId: 'emp_fernanda', nama: 'Monitoring & Evaluation Development Program', standar: 3, divisi: 'HR' },
    { id: 'comp_fr_5', empId: 'emp_fernanda', nama: 'Stakeholder Coordination & Communication', standar: 3, divisi: 'HR' },

    // Kompetensi Default Divisi HR (untuk rekan HR lainnya)
    { id: 'comp_hr_1', divisi: 'HR', nama: 'Recruitment & Talent Sourcing', standar: 3 },
    { id: 'comp_hr_2', divisi: 'HR', nama: 'Industrial Relations & Labor Law', standar: 3 },
    { id: 'comp_hr_3', divisi: 'HR', nama: 'Performance Management System', standar: 3 },
    { id: 'comp_hr_4', divisi: 'HR', nama: 'HR Analytics & People Dashboard', standar: 3 },

    // WEB DEVELOPER
    { id: 'comp_web_1', divisi: 'WEB DEVELOPER', nama: 'Frontend (HTML/CSS/Modern JS)', standar: 3 },
    { id: 'comp_web_2', divisi: 'WEB DEVELOPER', nama: 'Backend REST API & Database', standar: 3 },
    { id: 'comp_web_3', divisi: 'WEB DEVELOPER', nama: 'Git Version Control & CI/CD', standar: 4 },
    { id: 'comp_web_4', divisi: 'WEB DEVELOPER', nama: 'Software Architecture & Clean Code', standar: 3 },
    { id: 'comp_web_5', divisi: 'WEB DEVELOPER', nama: 'System Security & Optimization', standar: 3 },

    // QA
    { id: 'comp_qa_1', divisi: 'QA', nama: 'Test Case Design & Scenarios', standar: 4 },
    { id: 'comp_qa_2', divisi: 'QA', nama: 'Automated Testing (Playwright/Cypress)', standar: 3 },
    { id: 'comp_qa_3', divisi: 'QA', nama: 'API & Performance Testing', standar: 3 },
    { id: 'comp_qa_4', divisi: 'QA', nama: 'Bug Tracking & Root Cause Analysis', standar: 4 },

    // FINANCE
    { id: 'comp_fin_1', divisi: 'FINANCE', nama: 'Financial Statement Analysis', standar: 4 },
    { id: 'comp_fin_2', divisi: 'FINANCE', nama: 'Budgeting & Cashflow Forecasting', standar: 3 },
    { id: 'comp_fin_3', divisi: 'FINANCE', nama: 'Tax Compliance & Reporting', standar: 3 },

    // MARKETING
    { id: 'comp_mkt_1', divisi: 'MARKETING', nama: 'Digital Campaign & Meta Ads', standar: 3 },
    { id: 'comp_mkt_2', divisi: 'MARKETING', nama: 'SEO & Content Marketing', standar: 3 },
    { id: 'comp_mkt_3', divisi: 'MARKETING', nama: 'Brand Strategy & Positioning', standar: 4 },

    // SALES OPS
    { id: 'comp_sales_1', divisi: 'SALES OPS', nama: 'CRM Pipeline Management', standar: 3 },
    { id: 'comp_sales_2', divisi: 'SALES OPS', nama: 'Sales Forecasting & Quota Planning', standar: 4 },
    { id: 'comp_sales_3', divisi: 'SALES OPS', nama: 'Deal Negotiation & Closing', standar: 3 },

    // IT INFRASTRUCTURE
    { id: 'comp_it_1', divisi: 'IT INFRASTRUCTURE', nama: 'Cloud Computing (AWS/GCP/Azure)', standar: 3 },
    { id: 'comp_it_2', divisi: 'IT INFRASTRUCTURE', nama: 'Network Security & Firewall', standar: 4 },
    { id: 'comp_it_3', divisi: 'IT INFRASTRUCTURE', nama: 'Linux Server Administration', standar: 3 },

    // AI
    { id: 'comp_ai_1', divisi: 'AI', nama: 'Machine Learning & Deep Learning', standar: 4 },
    { id: 'comp_ai_2', divisi: 'AI', nama: 'Prompt Engineering & LLM APIs', standar: 3 },
    { id: 'comp_ai_3', divisi: 'AI', nama: 'Python & Data Pipelines', standar: 3 }
  ];

  const scores = {
    // Skor FERNANDA RUSLI (5 Kompetensi: Kompetensi Ideal = 3 untuk seluruh parameter)
    'emp_fernanda_comp_fr_1': 4, // Ideal 3 -> GAP +1 (Melampaui kompetensi ideal) [Biru]
    'emp_fernanda_comp_fr_2': 2, // Ideal 3 -> GAP -1 (Memerlukan peningkatan) [Kuning]
    'emp_fernanda_comp_fr_3': 3, // Ideal 3 -> GAP 0 (Sesuai kompetensi ideal) [Hijau]
    'emp_fernanda_comp_fr_4': 2, // Ideal 3 -> GAP -1 (Memerlukan peningkatan) [Kuning]
    'emp_fernanda_comp_fr_5': 3, // Ideal 3 -> GAP 0 (Sesuai kompetensi ideal) [Hijau]

    // Rekan HR Team
    'emp_hr_danti_comp_hr_1': 4,
    'emp_hr_danti_comp_hr_2': 3,
    'emp_hr_danti_comp_hr_3': 3,
    'emp_hr_danti_comp_hr_4': 3,

    'emp_hr_fauzan_comp_hr_1': 3,
    'emp_hr_fauzan_comp_hr_2': 4,
    'emp_hr_fauzan_comp_hr_3': 3,
    'emp_hr_fauzan_comp_hr_4': 4,

    'emp_hr_maria_comp_hr_1': 3,
    'emp_hr_maria_comp_hr_2': 3,
    'emp_hr_maria_comp_hr_3': 3,
    'emp_hr_maria_comp_hr_4': 2,

    'emp_hr_shalsa_comp_hr_1': 3,
    'emp_hr_shalsa_comp_hr_2': 2,
    'emp_hr_shalsa_comp_hr_3': 3,
    'emp_hr_shalsa_comp_hr_4': 3,

    'emp_hr_talent_comp_hr_1': 3,
    'emp_hr_talent_comp_hr_2': 3,
    'emp_hr_talent_comp_hr_3': 4,
    'emp_hr_talent_comp_hr_4': 4,

    'emp_hr_aida_comp_hr_1': 3,
    'emp_hr_aida_comp_hr_2': 3,
    'emp_hr_aida_comp_hr_3': 3,
    'emp_hr_aida_comp_hr_4': 3,

    'emp_hr_davin_comp_hr_1': 3,
    'emp_hr_davin_comp_hr_2': 3,
    'emp_hr_davin_comp_hr_3': 2,
    'emp_hr_davin_comp_hr_4': 2,

    'emp_hr_lathifatul_comp_hr_1': 3,
    'emp_hr_lathifatul_comp_hr_2': 2,
    'emp_hr_lathifatul_comp_hr_3': 3,
    'emp_hr_lathifatul_comp_hr_4': 2,

    'emp_hr_rizky_comp_hr_1': 4,
    'emp_hr_rizky_comp_hr_2': 3,
    'emp_hr_rizky_comp_hr_3': 3,
    'emp_hr_rizky_comp_hr_4': 3,

    'emp_hr_gading_comp_hr_1': 3,
    'emp_hr_gading_comp_hr_2': 3,
    'emp_hr_gading_comp_hr_3': 3,
    'emp_hr_gading_comp_hr_4': 2,

    // Web Developer
    'emp_web_1_comp_web_1': 4,
    'emp_web_1_comp_web_2': 3,
    'emp_web_1_comp_web_3': 4,
    'emp_web_1_comp_web_4': 3,
    'emp_web_1_comp_web_5': 3,
    'emp_web_2_comp_web_1': 3,
    'emp_web_2_comp_web_2': 4,
    'emp_web_2_comp_web_3': 3,
    'emp_web_2_comp_web_4': 2,
    'emp_web_2_comp_web_5': 3,
    'emp_web_3_comp_web_1': 4,
    'emp_web_3_comp_web_2': 4,
    'emp_web_3_comp_web_3': 4,
    'emp_web_3_comp_web_4': 3,
    'emp_web_3_comp_web_5': 4,

    // QA
    'emp_qa_1_comp_qa_1': 4,
    'emp_qa_1_comp_qa_2': 3,
    'emp_qa_1_comp_qa_3': 3,
    'emp_qa_1_comp_qa_4': 4,
    'emp_qa_2_comp_qa_1': 3,
    'emp_qa_2_comp_qa_2': 2,
    'emp_qa_2_comp_qa_3': 3,
    'emp_qa_2_comp_qa_4': 3
  };

  return { employees, competencies, scores };
}

function getSkillEmployees() {
  const raw = localStorage.getItem(STORAGE_KEY_SKILL_EMPLOYEES);
  if (raw) {
    try {
      let parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Clean up old sample dummy employees
        const initialCount = parsed.length;
        parsed = parsed.filter(e => !['emp_budi', 'emp_siti', 'emp_ahmad'].includes(e.id));
        let modified = (parsed.length !== initialCount);

        // Ensure Fernanda Rusli exists and has updated title
        const frIdx = parsed.findIndex(e => e.id === 'emp_fernanda' || e.nama.toUpperCase().includes('FERNANDA RUSLI'));
        if (frIdx === -1) {
          parsed.unshift({ id: 'emp_fernanda', nama: 'FERNANDA RUSLI', divisi: 'HR', jabatan: 'TRAINING & PEOPLE DEVELOPMENT JUNIOR' });
          modified = true;
        } else {
          if (parsed[frIdx].jabatan !== 'TRAINING & PEOPLE DEVELOPMENT JUNIOR') {
            parsed[frIdx].jabatan = 'TRAINING & PEOPLE DEVELOPMENT JUNIOR';
            parsed[frIdx].divisi = 'HR';
            modified = true;
          }
        }

        // Ensure all 10 HR team members exist in the exact order requested
        DEFAULT_HR_TEAM_MEMBERS.forEach(member => {
          const idx = parsed.findIndex(e => e.id === member.id || e.nama.toUpperCase() === member.nama.toUpperCase());
          if (idx === -1) {
            // Insert right after last HR member
            const lastHrIdx = parsed.map(e => e.divisi).lastIndexOf('HR');
            if (lastHrIdx !== -1) {
              parsed.splice(lastHrIdx + 1, 0, member);
            } else {
              parsed.push(member);
            }
            modified = true;
          } else {
            if (parsed[idx].jabatan !== member.jabatan || parsed[idx].nama !== member.nama) {
              parsed[idx].jabatan = member.jabatan;
              parsed[idx].nama = member.nama;
              parsed[idx].divisi = 'HR';
              modified = true;
            }
          }
        });

        if (modified) {
          saveSkillEmployees(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing skill employees:', e);
    }
  }

  const { employees } = getInitialSkillData();
  saveSkillEmployees(employees);
  return employees;
}

function saveSkillEmployees(arr) {
  localStorage.setItem(STORAGE_KEY_SKILL_EMPLOYEES, JSON.stringify(arr || []));
}

function getSkillCompetencies() {
  const raw = localStorage.getItem(STORAGE_KEY_SKILL_COMPETENCIES);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Fernanda's competencies exist
        const hasFrComps = parsed.some(c => c.empId === 'emp_fernanda');
        if (!hasFrComps) {
          const { competencies: defaultComps } = getInitialSkillData();
          const frComps = defaultComps.filter(c => c.empId === 'emp_fernanda');
          const merged = [...frComps, ...parsed];
          saveSkillCompetencies(merged);
          return merged;
        }
        // One-time sync: ensure all standards for Fernanda's competencies are rounded to 3
        let compModified = false;
        parsed.forEach(c => {
          if (c.empId === 'emp_fernanda' && c.standar !== 3) {
            c.standar = 3;
            compModified = true;
          }
        });
        if (compModified) {
          saveSkillCompetencies(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing skill competencies:', e);
    }
  }

  const { competencies } = getInitialSkillData();
  saveSkillCompetencies(competencies);
  return competencies;
}

function saveSkillCompetencies(arr) {
  localStorage.setItem(STORAGE_KEY_SKILL_COMPETENCIES, JSON.stringify(arr || []));
}

function getSkillScores() {
  const raw = localStorage.getItem(STORAGE_KEY_SKILL_SCORES);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const { scores: defaultScores } = getInitialSkillData();
        let modified = false;
        Object.keys(defaultScores).forEach(k => {
          if (parsed[k] === undefined) {
            parsed[k] = defaultScores[k];
            modified = true;
          }
        });
        // Sync Fernanda scores to match standard 3
        if (parsed['emp_fernanda_comp_fr_2'] === 4) {
          parsed['emp_fernanda_comp_fr_2'] = 2;
          parsed['emp_fernanda_comp_fr_3'] = 3;
          parsed['emp_fernanda_comp_fr_5'] = 3;
          modified = true;
        }
        if (modified) {
          saveSkillScores(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing skill scores:', e);
    }
  }

  const { scores } = getInitialSkillData();
  saveSkillScores(scores);
  return scores;
}

function saveSkillScores(obj) {
  localStorage.setItem(STORAGE_KEY_SKILL_SCORES, JSON.stringify(obj || {}));
}

function getCompetenciesForEmployee(empId, dept) {
  const allComps = getSkillCompetencies();
  // 1. Employee-specific competencies
  const empComps = allComps.filter(c => c.empId === empId);
  if (empComps.length > 0) return empComps;

  // 2. Division fallback template competencies
  return allComps.filter(c => (c.divisi || 'HR') === dept && !c.empId);
}

function calcEmployeeStats(empId, dept) {
  const comps = getCompetenciesForEmployee(empId, dept);
  const scores = getSkillScores();
  let scoredCount = 0;
  let scoreSum = 0;
  let gapSum = 0;
  const negativeGaps = [];

  comps.forEach(comp => {
    const key = `${empId}_${comp.id}`;
    const score = scores[key];
    if (score !== null && score !== undefined && !isNaN(score)) {
      const numScore = parseInt(score, 10);
      const std = parseInt(comp.standar, 10) || 3;
      const gap = numScore - std;
      scoreSum += numScore;
      gapSum += gap;
      scoredCount++;
      if (gap < 0) {
        negativeGaps.push({ comp, gap, score: numScore, standar: std });
      }
    }
  });

  const totalComps = comps.length;
  const avgScore = scoredCount > 0 ? (scoreSum / scoredCount).toFixed(1) : '-';
  const avgGapNum = scoredCount > 0 ? (gapSum / scoredCount) : null;
  const avgGap = avgGapNum !== null ? ((avgGapNum > 0 ? '+' : '') + avgGapNum.toFixed(1)) : '-';

  return { totalComps, scoredCount, avgScore, avgGap, avgGapNum, negativeGaps, comps };
}

function handleSkillDeptChange(dept) {
  activeSkillDept = (dept || '').trim();
  activeSkillEmpId = ''; // Reset active employee when switching departments
  skillEmpSearchQuery = '';

  const topSelect = document.getElementById('skillMatrixDeptSelect');
  if (topSelect) topSelect.value = activeSkillDept;
  const emptySelect = document.getElementById('skillMatrixEmptyDeptSelect');
  if (emptySelect) emptySelect.value = activeSkillDept;
  const searchInput = document.getElementById('skillEmpSearchInput');
  if (searchInput) searchInput.value = '';

  renderSkillMatrix();
  if (activeSkillDept) {
    showToast(`Menampilkan daftar karyawan Divisi: ${activeSkillDept}`, 'info');
  }
}

function selectSkillDeptDirectly(dept) {
  handleSkillDeptChange(dept);
}

function openEmployeeSkillMatrix(empId) {
  activeSkillEmpId = empId;
  renderSkillMatrix();

  const allEmployees = getSkillEmployees();
  const emp = allEmployees.find(e => e.id === empId);
  if (emp) {
    showToast(`Membuka Skill Matrix: ${emp.nama}`, 'info');
  }
}

function backToSkillEmployeeList() {
  activeSkillEmpId = '';
  renderSkillMatrix();
  const searchInput = document.getElementById('skillEmpSearchInput');
  if (searchInput) searchInput.value = skillEmpSearchQuery || '';
}

function changeSkillDept() {
  activeSkillDept = '';
  activeSkillEmpId = '';
  skillEmpSearchQuery = '';
  const emptySelect = document.getElementById('skillMatrixEmptyDeptSelect');
  if (emptySelect) emptySelect.value = '';
  const searchInput = document.getElementById('skillEmpSearchInput');
  if (searchInput) searchInput.value = '';
  renderSkillMatrix();
}

function filterSkillEmployeesList(val) {
  skillEmpSearchQuery = val;
  renderSkillEmployeeList();
}

function addNewSkillEmployeeFromList() {
  if (!activeSkillDept) {
    showToast('Pilih divisi terlebih dahulu.', 'error');
    return;
  }

  const nameInput = document.getElementById('newSkillEmpNameInput');
  const roleInput = document.getElementById('newSkillEmpRoleInput');
  const name = (nameInput?.value || '').trim();
  const role = (roleInput?.value || '').trim();

  if (!name) {
    showToast(`Ketik nama karyawan ${activeSkillDept} terlebih dahulu.`, 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  const employees = getSkillEmployees();
  const newId = 'emp_' + Date.now();
  employees.push({
    id: newId,
    nama: name,
    divisi: activeSkillDept,
    jabatan: role || `Staff ${activeSkillDept}`
  });

  saveSkillEmployees(employees);
  if (nameInput) nameInput.value = '';
  if (roleInput) roleInput.value = '';
  showToast(`Karyawan "${name}" berhasil ditambahkan ke Divisi ${activeSkillDept}.`, 'success');
  renderSkillMatrix();
}

function deleteSkillEmployee(empId) {
  const employees = getSkillEmployees();
  const emp = employees.find(e => e.id === empId);
  const empName = emp ? emp.nama : 'karyawan ini';

  if (!confirm(`Hapus ${empName} dari data Skill Matrix? Nilai penilaian karyawan ini juga akan dihapus.`)) {
    return;
  }

  const updatedEmployees = employees.filter(e => e.id !== empId);
  saveSkillEmployees(updatedEmployees);

  // Clean up associated scores
  const scores = getSkillScores();
  Object.keys(scores).forEach(k => {
    if (k.startsWith(`${empId}_`)) {
      delete scores[k];
    }
  });
  saveSkillScores(scores);

  if (activeSkillEmpId === empId) {
    activeSkillEmpId = '';
  }

  renderSkillMatrix();
  showToast(`Karyawan "${empName}" berhasil dihapus.`, 'info');
}

function setIndividualSkillScore(empId, compId, score) {
  const key = `${empId}_${compId}`;
  const scores = getSkillScores();
  const current = scores[key];

  if (current === score) {
    delete scores[key];
    showToast('Skor dihapus (Belum Dinilai).', 'info');
  } else {
    scores[key] = parseInt(score, 10);
    showToast(`Nilai tersimpan: Level ${score} (${SKILL_SCALE_DESC[score] || ''})`, 'success');
  }

  saveSkillScores(scores);
  renderIndividualEmployeeMatrix();
}

function updateIndividualCompStandar(compId, val) {
  let std = parseInt(val, 10);
  if (isNaN(std)) std = 3;
  if (std < 1) std = 1;
  if (std > 4) std = 4;

  const competencies = getSkillCompetencies();
  const comp = competencies.find(c => c.id === compId);
  if (comp) {
    comp.standar = std;
    saveSkillCompetencies(competencies);
    renderIndividualEmployeeMatrix();
  }
}

function deleteIndividualCompetency(compId) {
  const competencies = getSkillCompetencies();
  const comp = competencies.find(c => c.id === compId);
  const name = comp ? comp.nama : 'parameter ini';

  if (!confirm(`Hapus parameter kompetensi "${name}"? Seluruh nilai pada parameter ini akan dihapus.`)) {
    return;
  }

  const updated = competencies.filter(c => c.id !== compId);
  saveSkillCompetencies(updated);

  const scores = getSkillScores();
  Object.keys(scores).forEach(k => {
    if (k.endsWith(`_${compId}`)) delete scores[k];
  });
  saveSkillScores(scores);

  showToast(`Parameter "${name}" berhasil dihapus.`, 'info');
  renderIndividualEmployeeMatrix();
}

function openAddSkillCompetencyModal() {
  if (!activeSkillDept) {
    showToast('Pilih divisi terlebih dahulu.', 'error');
    return;
  }

  const allEmployees = getSkillEmployees();
  const emp = allEmployees.find(e => e.id === activeSkillEmpId);

  const subEl = document.getElementById('modalAddSkillCompSubtitle');
  if (subEl) {
    if (emp) {
      subEl.innerHTML = `Menambahkan kompetensi untuk: <strong>${escapeHtml(emp.nama)}</strong> (${escapeHtml(activeSkillDept)})`;
    } else {
      subEl.textContent = `Divisi: ${activeSkillDept}`;
    }
  }

  const nameInput = document.getElementById('modalNewCompName');
  const stdSelect = document.getElementById('modalNewCompStandard');
  if (nameInput) nameInput.value = '';
  if (stdSelect) stdSelect.value = '3';

  openModal('modalAddSkillCompetency');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function submitModalNewCompetency() {
  if (!activeSkillDept) {
    showToast('Pilih divisi terlebih dahulu.', 'error');
    return;
  }

  const nameInput = document.getElementById('modalNewCompName');
  const stdSelect = document.getElementById('modalNewCompStandard');
  const name = (nameInput?.value || '').trim();
  if (!name) {
    showToast('Ketik nama kompetensi terlebih dahulu.', 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  const std = parseInt(stdSelect?.value, 10) || 3;
  const competencies = getSkillCompetencies();

  competencies.push({
    id: 'comp_' + Date.now(),
    empId: activeSkillEmpId || undefined,
    nama: name,
    standar: std,
    divisi: activeSkillDept
  });

  saveSkillCompetencies(competencies);
  closeModal('modalAddSkillCompetency');
  renderSkillMatrix();
  showToast(`Kompetensi "${name}" (Standar ${std}) berhasil ditambahkan.`, 'success');
}

function proposeTrainingForActiveEmp() {
  const allEmployees = getSkillEmployees();
  const emp = allEmployees.find(e => e.id === activeSkillEmpId);
  const stats = emp ? calcEmployeeStats(emp.id, activeSkillDept) : null;

  goToPage('ajukan');

  // Pre-fill department
  const deptEl = document.getElementById('deptName');
  if (deptEl && activeSkillDept) {
    deptEl.value = activeSkillDept;
    if (typeof handleDeptChange === 'function') handleDeptChange(deptEl);
    if (typeof updateTrainingId === 'function') updateTrainingId();
  }

  // Pre-fill proposed training name if there is a negative GAP competency
  if (stats && stats.negativeGaps.length > 0) {
    const primaryNeed = stats.negativeGaps[0].comp.nama;
    const trainingNameEl = document.getElementById('trainingName');
    if (trainingNameEl) {
      trainingNameEl.value = `Pelatihan ${primaryNeed}`;
      if (typeof updateTrainingId === 'function') updateTrainingId();
    }
  }

  // Pre-fill participant
  if (emp && typeof addParticipant === 'function') {
    const tbody = document.getElementById('participantTableBody');
    if (tbody) {
      const inputs = tbody.querySelectorAll('input.participant-name');
      let found = false;
      inputs.forEach(inp => {
        if (inp.value.trim().toLowerCase() === emp.nama.toLowerCase()) found = true;
      });
      if (!found) {
        addParticipant(emp.nama, '', emp.divisi || activeSkillDept);
      }
    }
  }

  showToast(`Membuka form pengajuan training untuk ${emp ? emp.nama : 'karyawan'}.`, 'success');
}

function resetSkillMatrixSampleData() {
  const dept = activeSkillDept || 'Semua Divisi';
  if (!confirm(`Muat ulang seluruh contoh data matriks kompetensi (${dept})? Penilaian kustom saat ini akan dikembalikan ke data default.`)) {
    return;
  }
  const { employees, competencies, scores } = getInitialSkillData();
  saveSkillEmployees(employees);
  saveSkillCompetencies(competencies);
  saveSkillScores(scores);
  activeSkillEmpId = '';
  renderSkillMatrix();
  showToast(`Contoh data Matriks Kompetensi (${dept}) berhasil dimuat ulang.`, 'success');
}

function renderSkillMatrix() {
  const promptEl = document.getElementById('skillMatrixEmptyPrompt');
  const listViewEl = document.getElementById('skillMatrixEmployeeListView');
  const indivViewEl = document.getElementById('skillMatrixIndividualView');
  const badgeEl = document.getElementById('skillMatrixActiveDeptBadge');
  const badgeTextEl = document.getElementById('skillMatrixActiveDeptText');
  const actionsEl = document.getElementById('skillMatrixActiveActions');
  const topSelect = document.getElementById('skillMatrixDeptSelect');
  const emptySelect = document.getElementById('skillMatrixEmptyDeptSelect');

  // Synchronize select inputs
  if (topSelect && topSelect.value !== activeSkillDept) {
    topSelect.value = activeSkillDept;
  }
  if (emptySelect && emptySelect.value !== activeSkillDept) {
    emptySelect.value = activeSkillDept;
  }

  // Update all .active-dept-label in DOM
  document.querySelectorAll('.active-dept-label').forEach(el => {
    el.textContent = activeSkillDept || 'Departemen';
  });

  // ============================================
  // STAGE 1: No department chosen yet
  // ============================================
  if (!activeSkillDept) {
    if (promptEl) promptEl.style.display = 'block';
    if (listViewEl) listViewEl.style.display = 'none';
    if (indivViewEl) indivViewEl.style.display = 'none';
    if (badgeEl) badgeEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    return;
  }

  // Header active state
  if (promptEl) promptEl.style.display = 'none';
  if (badgeEl) badgeEl.style.display = 'inline-flex';
  if (badgeTextEl) badgeTextEl.textContent = activeSkillDept;
  if (actionsEl) actionsEl.style.display = 'inline-flex';

  // ============================================
  // STAGE 2: Department selected, but no employee clicked yet -> SHOW EMPLOYEE LIST
  // ============================================
  if (!activeSkillEmpId) {
    if (listViewEl) listViewEl.style.display = 'block';
    if (indivViewEl) indivViewEl.style.display = 'none';
    renderSkillEmployeeList();
    return;
  }

  // ============================================
  // STAGE 3: Individual Employee clicked -> SHOW INDIVIDUAL SKILL MATRIX
  // ============================================
  if (listViewEl) listViewEl.style.display = 'none';
  if (indivViewEl) indivViewEl.style.display = 'block';
  renderIndividualEmployeeMatrix();
}

function renderSkillEmployeeList() {
  const allEmployees = getSkillEmployees();
  const deptEmployees = allEmployees.filter(e => (e.divisi || 'HR') === activeSkillDept);

  // 1. Division KPI Cards
  const totalEmp = deptEmployees.length;
  let scoredEmployeesCount = 0;
  let divGapSum = 0;
  let divScoredCompsTotal = 0;

  deptEmployees.forEach(emp => {
    const stats = calcEmployeeStats(emp.id, activeSkillDept);
    if (stats.scoredCount > 0) {
      scoredEmployeesCount++;
      if (stats.avgGapNum !== null) {
        divGapSum += stats.avgGapNum;
        divScoredCompsTotal++;
      }
    }
  });

  const kpiTotalEl = document.getElementById('kpiDivTotalEmployees');
  if (kpiTotalEl) kpiTotalEl.textContent = totalEmp;

  const kpiScoredEl = document.getElementById('kpiDivScoredEmployees');
  if (kpiScoredEl) kpiScoredEl.textContent = `${scoredEmployeesCount} dari ${totalEmp}`;

  const kpiDivGapEl = document.getElementById('kpiDivAvgGap');
  const kpiDivGapSubEl = document.getElementById('kpiDivAvgGapSub');
  if (kpiDivGapEl) {
    if (divScoredCompsTotal > 0) {
      const avg = divGapSum / divScoredCompsTotal;
      const formatted = (avg > 0 ? '+' : '') + avg.toFixed(1);
      kpiDivGapEl.textContent = formatted;
      const gapDetails = getGapDetails(Math.round(avg));
      kpiDivGapEl.style.color = gapDetails?.color || 'var(--ink)';
      if (kpiDivGapSubEl) kpiDivGapSubEl.textContent = `${gapDetails?.keterangan || 'Rata-rata kumulatif'}`;
    } else {
      kpiDivGapEl.textContent = '-';
      kpiDivGapEl.style.color = 'var(--ink)';
      if (kpiDivGapSubEl) kpiDivGapSubEl.textContent = 'Belum ada penilaian skor';
    }
  }

  // 2. Render Cards Grid
  const gridContainer = document.getElementById('skillEmployeesGridContainer');
  if (!gridContainer) return;

  const q = (skillEmpSearchQuery || '').toLowerCase().trim();
  const filtered = deptEmployees.filter(emp => {
    if (!q) return true;
    return emp.nama.toLowerCase().includes(q) || (emp.jabatan || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--ink-soft); background: #fff; border: 1px dashed var(--line); border-radius: 12px;">
        <div style="font-weight: 700; font-size: 15px; color: var(--ink); margin-bottom: 6px;">Tidak ada karyawan ditemukan di Divisi ${escapeHtml(activeSkillDept)}</div>
        <div style="font-size: 13px;">${q ? 'Coba ubah kata kunci pencarian.' : 'Gunakan form "+ Tambah Karyawan" di atas untuk menambahkan personel divisi ini.'}</div>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(emp => {
    const stats = calcEmployeeStats(emp.id, activeSkillDept);
    const initials = getInitials(emp.nama);
    const gapDetails = stats.avgGapNum !== null ? getGapDetails(Math.round(stats.avgGapNum)) : null;

    html += `
      <div class="skill-emp-card" onclick="openEmployeeSkillMatrix('${emp.id}')">
        <div class="skill-emp-card-top">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div class="skill-emp-avatar">${initials}</div>
            <div class="skill-emp-details">
              <div class="skill-emp-card-name" title="${escapeHtml(emp.nama)}">${escapeHtml(emp.nama)}</div>
              <div class="skill-emp-card-role" title="${escapeHtml(emp.jabatan || activeSkillDept)}">${escapeHtml(emp.jabatan || activeSkillDept)}</div>
            </div>
          </div>
          <button type="button" class="row-remove" onclick="event.stopPropagation(); deleteSkillEmployee('${emp.id}')" title="Hapus Karyawan">&times;</button>
        </div>
        <div class="skill-emp-card-meta">
          <span class="mini-pill" style="font-size:11px;">${stats.totalComps} Parameter</span>
          ${stats.scoredCount > 0 ? `
            <span class="gap-badge ${gapDetails ? gapDetails.badgeClass : ''}" style="background:${gapDetails ? gapDetails.bgColor : '#4CC9A0'};color:${gapDetails ? gapDetails.textColor : '#fff'};border:none;margin-top:0;font-size:11px;">
              GAP ${stats.avgGap}
            </span>
          ` : `
            <span class="mini-pill" style="font-size:11px;">Belum Dinilai</span>
          `}
          <span style="margin-left:auto;font-size:12px;color:var(--moss);font-weight:700;display:flex;align-items:center;gap:3px;">
            Buka Skill Matrix &rarr;
          </span>
        </div>
      </div>
    `;
  });

  gridContainer.innerHTML = html;
}

function renderIndividualEmployeeMatrix() {
  const allEmployees = getSkillEmployees();
  const emp = allEmployees.find(e => e.id === activeSkillEmpId);
  if (!emp) {
    activeSkillEmpId = '';
    renderSkillMatrix();
    return;
  }

  // Synchronize Employee Switcher Dropdown
  const switcher = document.getElementById('indivEmployeeSwitcher');
  if (switcher) {
    const deptEmployees = allEmployees.filter(e => (e.divisi || 'HR') === activeSkillDept);
    let optHtml = '';
    deptEmployees.forEach(e => {
      optHtml += `<option value="${e.id}" ${e.id === activeSkillEmpId ? 'selected' : ''}>${escapeHtml(e.nama)}</option>`;
    });
    switcher.innerHTML = optHtml;
  }

  // Update Header Profile
  const nameEl = document.getElementById('indivEmpName');
  if (nameEl) nameEl.textContent = emp.nama;

  const roleEl = document.getElementById('indivEmpRoleText');
  if (roleEl) roleEl.textContent = emp.jabatan || `Staff ${activeSkillDept}`;

  const deptBadge = document.getElementById('indivEmpDeptBadge');
  if (deptBadge) deptBadge.textContent = `Divisi ${activeSkillDept}`;

  const avatarEl = document.getElementById('indivEmpAvatar');
  if (avatarEl) avatarEl.textContent = getInitials(emp.nama);

  // Calculate Employee Metrics
  const stats = calcEmployeeStats(emp.id, activeSkillDept);

  const mComps = document.getElementById('indivMetricComps');
  if (mComps) mComps.textContent = stats.totalComps;

  const mScore = document.getElementById('indivMetricAvgScore');
  if (mScore) mScore.textContent = stats.avgScore;

  const mGap = document.getElementById('indivMetricAvgGap');
  if (mGap) {
    mGap.textContent = stats.avgGap;
    const gapDetails = stats.avgGapNum !== null ? getGapDetails(Math.round(stats.avgGapNum)) : null;
    mGap.style.color = gapDetails?.color || 'var(--ink)';
  }

  const mStatus = document.getElementById('indivMetricStatus');
  if (mStatus) {
    if (stats.scoredCount === 0) {
      mStatus.textContent = 'Belum Dinilai';
      mStatus.style.color = 'var(--ink-soft)';
    } else {
      const gapDetails = getGapDetails(Math.round(stats.avgGapNum));
      mStatus.textContent = gapDetails?.keterangan || 'Sesuai Standar';
      mStatus.style.color = gapDetails?.color || 'var(--moss)';
    }
  }

  // Smart GAP Recommendation Box
  const recBox = document.getElementById('indivGapRecommendationBox');
  const recText = document.getElementById('indivGapRecommendationText');
  if (recBox && recText) {
    if (stats.negativeGaps.length > 0) {
      recBox.style.display = 'block';
      const compNames = stats.negativeGaps.map(item => `<strong>${escapeHtml(item.comp.nama)} (GAP ${item.gap})</strong>`).join(', ');
      recText.innerHTML = `Berdasarkan analisis GAP, <strong>${escapeHtml(emp.nama)}</strong> direkomendasikan mengikuti program pelatihan untuk: ${compNames}.`;
    } else {
      recBox.style.display = 'none';
    }
  }

  // Render Table Rows
  const tableBody = document.getElementById('indivSkillTableBody');
  if (tableBody) {
    if (stats.comps.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:36px 20px;color:var(--ink-soft);">
            <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:6px;">Belum Ada Parameter Kompetensi untuk ${escapeHtml(emp.nama)}</div>
            <div style="font-size:13px;margin-bottom:14px;">Tambahkan parameter kompetensi pertama untuk memulai penilaian.</div>
            <button type="button" class="btn-primary" onclick="openAddSkillCompetencyModal()" style="font-size:12.5px;padding:7px 14px;margin:0 auto;display:inline-flex;align-items:center;gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Tambah Kompetensi Pertama</span>
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const scores = getSkillScores();
    let bodyHtml = '';

    stats.comps.forEach((comp, idx) => {
      const key = `${emp.id}_${comp.id}`;
      const score = scores[key];
      const hasScore = (score !== null && score !== undefined && !isNaN(score));
      const numScore = hasScore ? parseInt(score, 10) : null;
      const std = parseInt(comp.standar, 10) || 3;
      const gap = hasScore ? (numScore - std) : null;
      const gapDetails = hasScore ? getGapDetails(gap) : null;

      bodyHtml += `
        <tr>
          <td style="text-align:center;font-weight:600;color:var(--ink-soft);">${idx + 1}</td>
          <td style="text-align:left;">
            <div style="font-weight:700;font-size:13.5px;color:var(--ink);">${escapeHtml(comp.nama)}</div>
          </td>
          <td style="text-align:center;">
            <div class="skill-comp-standar-box" style="margin:0 auto;background:transparent;border:none;padding:0;">
              <input type="number" min="1" max="4" value="${std}" class="skill-comp-standar-input" onchange="updateIndividualCompStandar('${comp.id}', this.value)" oninput="updateIndividualCompStandar('${comp.id}', this.value)" title="Kompetensi Ideal (1 - 4)" style="width:38px;height:28px;text-align:center;font-weight:800;font-size:13.5px;border:1.5px solid #CBD5E1;border-radius:6px;background:#F8FAFC;color:var(--ink);">
            </div>
          </td>
          <td style="text-align:center;">
            <div class="skill-score-pills">
              <button type="button" class="skill-score-pill-btn ${numScore === 1 ? 'active-1' : ''}" onclick="setIndividualSkillScore('${emp.id}', '${comp.id}', 1)" title="Level 1: Pemahaman Dasar">1</button>
              <button type="button" class="skill-score-pill-btn ${numScore === 2 ? 'active-2' : ''}" onclick="setIndividualSkillScore('${emp.id}', '${comp.id}', 2)" title="Level 2: Cukup Kompeten">2</button>
              <button type="button" class="skill-score-pill-btn ${numScore === 3 ? 'active-3' : ''}" onclick="setIndividualSkillScore('${emp.id}', '${comp.id}', 3)" title="Level 3: Kompeten">3</button>
              <button type="button" class="skill-score-pill-btn ${numScore === 4 ? 'active-4' : ''}" onclick="setIndividualSkillScore('${emp.id}', '${comp.id}', 4)" title="Level 4: Ahli">4</button>
            </div>
          </td>
          <td style="text-align:center;">
            ${hasScore ? `
              <span class="gap-badge ${gapDetails.badgeClass}" style="background:${gapDetails.bgColor};color:${gapDetails.textColor};border:none;">
                ${gapDetails.gapLabel}
              </span>
            ` : `
              <span style="font-size:12px;color:var(--ink-faint);">-</span>
            `}
          </td>
          <td style="text-align:left;">
            ${hasScore ? `
              <div style="font-size:12px;font-weight:600;color:${gapDetails?.color};display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${gapDetails?.color};"></span>
                <span>${gapDetails?.keterangan}</span>
              </div>
            ` : `
              <span style="font-size:11.5px;color:var(--ink-faint);font-style:italic;">Belum dinilai (klik angka 1-4 di samping)</span>
            `}
          </td>
          <td style="text-align:center;">
            <button type="button" class="row-remove" onclick="deleteIndividualCompetency('${comp.id}')" title="Hapus Parameter">&times;</button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = bodyHtml;
  }
}

// ==========================================
// AI Training Needs Analysis (TNA) from Skill Matrix
// ==========================================
let currentAiSkillSummaryPlan = null;
let currentAiSkillSummaryMarkdown = '';

function getCompetencyTrainingBlueprint(compName, roleName, gap, currentScore, targetStd) {
  const cName = (compName || '').trim();
  const cLower = cName.toLowerCase();
  const isUrgent = gap <= -2;
  const urgency = isUrgent ? 'Kritis / Mendesak' : 'Kesenjangan Keterampilan';

  if (cLower.includes('training need analysis') || cLower.includes('tna')) {
    return {
      title: 'Mastering Training Needs Analysis (TNA) & Competency Mapping',
      level: 'Intermediate',
      urgency: urgency,
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Mampu mengidentifikasi kesenjangan kompetensi karyawan secara sistematis, menganalisis data performa kerja, dan merumuskan prioritas intervensi pelatihan yang tepat sasaran bagi unit kerja.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Metodologi & Framework TNA Modern', metode: 'Teori & Diskusi Kasus', deskripsi: 'Pembedahan 3 level analisis TNA (Organisasi, Tugas/Pekerjaan, Individu) dan audit kompetensi berbasis data.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Instrumen Pengumpulan Data Kebutuhan Pelatihan', metode: 'Praktik & Workshop', deskripsi: 'Desain kuesioner survei, panduan wawancara user leader, dan triangulasi data penilaian performa kerja.' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Matriks Prioritas Pelatihan & Desain SMART Goals', metode: 'Simulasi Terbimbing', deskripsi: 'Mengubah temuan GAP kompetensi menjadi peta prioritas intervensi dan formulasi sasaran belajar terukur.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Penyusunan Dokumen TNA & Presentasi ke Stakeholder', metode: 'Presentasi & Review', deskripsi: 'Penyusunan executive report TNA, justifikasi program pelatihan, dan konsultasi kebutuhan dengan pimpinan divisi.' }
      ],
      hasilDiharapkan: `Peserta mampu mandiri melakukan audit kebutuhan training divisi, menyusun instrumen survei TNA, dan menaikkan skor kompetensi dari ${currentScore} menuju level standar ${targetStd} (Kompeten).`,
      penerapanPekerjaan: `Diterapkan langsung dalam penyusunan annual training plan dan asesmen performa tim divisi ${activeSkillDept || 'HR'}.`,
      indikatorKeberhasilan: `- Kenaikan skor kompetensi TNA mencapai minimal level ${targetStd} pada review 3 bulan\n- Laporan TNA divisi tersusun 100% tepat waktu\n- Skor post-test pemahaman TNA ≥ 85%`
    };
  }

  if (cLower.includes('monitoring') || cLower.includes('evaluation') || cLower.includes('m&e') || cLower.includes('evaluasi')) {
    return {
      title: 'Kirkpatrick Model: Monitoring, Evaluation & Impact Measurement for Corporate Training',
      level: 'Intermediate',
      urgency: urgency,
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Menguasai teknik evaluasi pelatihan komprehensif 4-Level Kirkpatrick (Reaction, Learning, Behavior, Result) guna menjamin akuntabilitas dan efektivitas investasi program training.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Arsitektur Evaluasi Kirkpatrick & Metrik Kunci', metode: 'Teori & Analisis Kasus', deskripsi: 'Memahami prinsip pengukuran efektivitas pelatihan dari level kepuasan hingga dampak operasional & bisnis.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Desain Instrumen Evaluasi Level 1 & Level 2', metode: 'Praktik Desain', deskripsi: 'Merancang form feedback reaksi (Level 1) dan pre-test/post-test terstandarisasi (Level 2).' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Monitoring Implementasi di Tempat Kerja (Level 3)', metode: 'Workshop', deskripsi: 'Membangun action plan 30-60-90 hari, lembar observasi supervisor, dan tindak lanjut pasca-pelatihan.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Analisis Dampak Bisnis (Level 4) & Reporting Dashboard', metode: 'Simulasi Terbimbing', deskripsi: 'Penyusunan dashboard evaluasi, kalkulasi peningkatan performa kerja, dan pelaporan eksekutif.' }
      ],
      hasilDiharapkan: `Mampu merancang instrumen evaluasi otomatis, memantau transfer materi ke workflow nyata, dan menutup kesenjangan evaluasi ke level ${targetStd}.`,
      penerapanPekerjaan: `Diterapkan pada seluruh program pelatihan yang diselenggarakan divisi.`,
      indikatorKeberhasilan: `- Seluruh training terdokumentasi evaluasinya hingga Level 3 dalam 60 hari\n- Skor evaluasi kepuasan training terukur konsisten ≥ 4.5/5.0\n- GAP kompetensi evaluasi tertutup menjadi 0`
    };
  }

  if (cLower.includes('planning') || cLower.includes('rencana') || cLower.includes('perencanaan')) {
    return {
      title: 'Strategic L&D Planning & Corporate Curriculum Architecture',
      level: 'Intermediate',
      urgency: urgency,
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Mampu merancang rencana strategis pelatihan tahunan, arsitektur kurikulum modular, serta alokasi anggaran training yang efektif dan efisien.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Alignment Sasaran Bisnis & Rencana L&D', metode: 'Teori Strategis', deskripsi: 'Menghubungkan target bisnis perusahaan dengan roadmap pengembangan talenta divisi.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Perancangan Silabus Modular & Blended Learning', metode: 'Workshop Desain', deskripsi: 'Merancang alur belajar terstruktur memadukan sesi kelas, praktik langsung, dan e-learning.' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Budgeting & Manajemen Efisiensi Biaya Training', metode: 'Praktik Spreadsheet', deskripsi: 'Kalkulasi komponen biaya trainer, konsumsi, venue, materi, dan return-on-investment.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Kalender Kerja Pelatihan & Risk Mitigation', metode: 'Simulasi & Review', deskripsi: 'Penyusunan jadwal tahunan komprehensif, mitigasi jadwal bentrok, dan approval workflow.' }
      ],
      hasilDiharapkan: `Peserta memiliki kemampuan menyusun proposal program training terstruktur lengkap dengan modul dan time-schedule yang presisi.`,
      penerapanPekerjaan: `Diterapkan dalam perumusan annual training calendar dan kurikulum internal.`,
      indikatorKeberhasilan: `- Tersusunnya kalender pelatihan tahunan tepat waktu\n- Efisiensi realisasi anggaran training mencapai 95-100%\n- Skor kompetensi perencanaan meningkat ke level standar (${targetStd})`
    };
  }

  if (cLower.includes('coordination') || cLower.includes('execution') || cLower.includes('eksekusi') || cLower.includes('koordinasi')) {
    return {
      title: 'End-to-End Corporate Training Execution & Logistics Mastery',
      level: 'Basic',
      urgency: urgency,
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Meningkatkan kecakapan teknis dan operasional dalam mengelola koordinasi acara pelatihan (onsite, virtual, maupun hybrid) dengan zero defect.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Checklist Pra-Training: Administrasi, Perlengkapan & Venue', metode: 'Praktik Terbimbing', deskripsi: 'Standard operating procedure sebelum hari-H: surat undangan, daftar hadir, booking room, dan tes koneksi.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Moderasi, Facilitation Support & Ice Breaking Interaktif', metode: 'Simulasi Roleplay', deskripsi: 'Teknik memandu pembukaan acara, memperkenalkan instruktur, dan mencairkan suasana audiens.' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Real-time Attendance, Time-keeping & Troubleshooting Teknis', metode: 'Praktik Operasional', deskripsi: 'Manajemen kendala audio-visual mendadak, pergantian sesi tepat waktu, dan hospitality peserta.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Pasca-Training: Distribusi Materi, Sertifikasi & Dokumentasi', metode: 'Review Administrasi', deskripsi: 'Penerbitan e-certificate, pengumpulan formulir evaluasi, dan penyusunan berita acara kegiatan.' }
      ],
      hasilDiharapkan: `Peserta mandiri mengeksekusi pelatihan dari persiapan hingga penutupan tanpa kendala operasional.`,
      penerapanPekerjaan: `Diterapkan dalam operasional harian seluruh sesi training divisi.`,
      indikatorKeberhasilan: `- Skor kepuasan logistik & fasilitas peserta ≥ 4.6/5.0\n- Zero keterlambatan jadwal sesi pelatihan\n- Administrasi sertifikat dan presensi selesai H+1`
    };
  }

  if (cLower.includes('stakeholder') || cLower.includes('communication') || cLower.includes('komunikasi')) {
    return {
      title: 'Executive Stakeholder Communication & Strategic Business Partnering',
      level: 'Intermediate',
      urgency: urgency,
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Mengembangkan keterampilan komunikasi persuasif, konsultasi dengan user leader departemen, dan presentasi program People Development yang berbobot.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Memahami Ekspektasi Leader & Komunikasi Asertif', metode: 'Teori & Diskusi Kasus', deskripsi: 'Menganalisis persona pimpinan, bahasa komunikasi korporat, dan membangun kredibilitas HR.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Teknik Konsultasi & Menyampaikan Hasil Asesmen', metode: 'Simulasi Wawancara', deskripsi: 'Menyampaikan kesenjangan kompetensi tim secara solutif tanpa menyinggung, dan active listening.' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Storytelling Data & Presentasi Proposal ke Top Management', metode: 'Workshop Presentasi', deskripsi: 'Menyusun slide deck ringkas, visualisasi grafik data kebutuhan, dan estimasi dampak bisnis.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Resolusi Hambatan Koordinasi & Sinergi Lintas Divisi', metode: 'Roleplay Negosiasi', deskripsi: 'Mengatasi penolakan jadwal dari departemen operasional dan menyelaraskan komitmen bersama.' }
      ],
      hasilDiharapkan: `Mampu berkoordinasi secara percaya diri dengan pimpinan divisi lain dalam mengadvokasi program pengembangan karyawan.`,
      penerapanPekerjaan: `Diterapkan saat presentasi program training ke kepala unit kerja dan koordinasi lintas divisi.`,
      indikatorKeberhasilan: `- Rasio approval proposal training oleh user meningkat ≥ 85%\n- Indeks kepuasan stakeholder terhadap HR ≥ 4.5/5.0\n- Skor kompetensi komunikasi naik ke level standar (${targetStd})`
    };
  }

  // Fallback Dynamic Generator
  return {
    title: `Akselerasi Kompetensi: ${cName} untuk ${roleName || 'Karyawan'}`,
    level: 'Intermediate',
    urgency: urgency,
    durationText: '1 Hari Workshop Intensif (6 Jam)',
    goals: `Meningkatkan penguasaan kompetensi '${cName}' dari skor saat ini (${currentScore}) menjadi level standar (${targetStd}) melalui kurikulum terstruktur dan studi kasus operasional nyata.`,
    modules: [
      { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: `Sesi 1: Konsep Fundamental & Prinsip Kunci ${cName}`, metode: 'Teori Aplikatif', deskripsi: `Memahami fondasi teori, regulasi, dan standar kualitas kerja terkait ${cName}.` },
      { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: `Sesi 2: Best Practice, Framework Kerja & Standar Operasional`, metode: 'Studi Kasus', deskripsi: `Bedah kasus operasional, alur kerja standar industri, dan identifikasi potensi kegagalan.` },
      { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: `Sesi 3: Simulasi Hands-on & Penyelesaian Masalah Operasional`, metode: 'Praktik Terbimbing', deskripsi: `Latihan mandiri memecahkan skenario kerja nyata dan implementasi tools pendukung.` },
      { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: `Sesi 4: Action Plan Mandiri, Review Kinerja & Evaluasi Hasil`, metode: 'Review & Ujian', deskripsi: `Penyusunan target kerja 30 hari pasca-pelatihan dan post-test penguasaan kompetensi.` }
    ],
    hasilDiharapkan: `Peserta mampu menjalankan tugas operasional terkait ${cName} secara mandiri sesuai SOP perusahaan.`,
    penerapanPekerjaan: `Diterapkan langsung dalam workflow pekerjaan harian di divisi ${activeSkillDept || 'terkait'}.`,
    indikatorKeberhasilan: `- Nilai post-test kelulusan ≥ 80/100\n- Kenaikan skor kompetensi dari ${currentScore} menjadi ${targetStd} dalam review 90 hari\n- Minim kesalahan kerja operasional pada tugas terkait`
  };
}

function renderAiBlueprintCard(blueprint) {
  let modulesHtml = '';
  if (Array.isArray(blueprint.modules)) {
    blueprint.modules.forEach(m => {
      modulesHtml += `
        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <strong style="font-size:12.5px;color:var(--ink);">${escapeHtml(m.modul)}</strong>
            <span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:var(--sand-soft);color:var(--moss);">
              ${escapeHtml(m.jamMulai)} - ${escapeHtml(m.jamSelesai)} &bull; ${escapeHtml(m.metode || 'Praktik')}
            </span>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);line-height:1.4;">${escapeHtml(m.deskripsi || '')}</div>
        </div>
      `;
    });
  }

  return `
    <div style="border:1px solid #4B96FF;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(75,150,255,0.08);">
      <div style="background:linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);color:#fff;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#BFDBFE;margin-bottom:4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <span>Rekomendasi Program Pelatihan Solutif</span>
        </div>
        <h4 style="margin:0;font-size:16px;font-weight:700;color:#fff;line-height:1.35;">${escapeHtml(blueprint.title)}</h4>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.2);color:#fff;">Level: ${escapeHtml(blueprint.level)}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.2);color:#fff;">Format: ${escapeHtml(blueprint.durationText)}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#FDE047;color:#713F12;font-weight:700;">Urgensi: ${escapeHtml(blueprint.urgency)}</span>
        </div>
      </div>

      <div style="padding:14px 16px;background:#FAF9F5;">
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Tujuan Pelatihan (SMART Goals):</div>
          <div style="font-size:12.5px;color:var(--ink);line-height:1.5;">${escapeHtml(blueprint.goals)}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Rancangan Silabus Modul:</div>
          ${modulesHtml}
        </div>

        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:8px;padding:10px 12px;">
          <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Target Capaian & Indikator Keberhasilan (KPI):</div>
          <div style="font-size:12px;color:var(--ink-soft);white-space:pre-line;line-height:1.45;">${escapeHtml(blueprint.indikatorKeberhasilan)}</div>
        </div>
      </div>
    </div>
  `;
}

function generateAiSkillSummaryForActiveEmp() {
  const allEmployees = getSkillEmployees();
  const emp = allEmployees.find(e => e.id === activeSkillEmpId);
  if (!emp) {
    showToast('Silahkan pilih salah satu karyawan terlebih dahulu.', 'error');
    return;
  }

  const dept = activeSkillDept || emp.divisi || 'Divisi HR';
  const stats = calcEmployeeStats(emp.id, dept);

  const modalEl = document.getElementById('modalAiSkillSummary');
  const subEl = document.getElementById('modalAiSkillSummarySubtitle');
  const bodyEl = document.getElementById('modalAiSkillSummaryBody');
  if (!modalEl || !bodyEl) return;

  if (subEl) {
    subEl.innerHTML = `Executive TNA Diagnostic &bull; <strong>${escapeHtml(emp.nama)}</strong> (${escapeHtml(emp.jabatan || dept)})`;
  }

  // Case 1: No scored competencies
  if (stats.scoredCount === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;">
        <div style="width:54px;height:54px;border-radius:50%;background:#FEF3C7;color:#D97706;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h4 style="font-size:16px;color:var(--ink);margin:0 0 8px 0;">Belum Ada Skor Penilaian</h4>
        <p style="font-size:13px;color:var(--ink-soft);max-width:440px;margin:0 auto 16px auto;line-height:1.5;">
          Parameter kompetensi untuk <strong>${escapeHtml(emp.nama)}</strong> belum dinilai. Silahkan klik angka skor (1-4) pada tabel matriks terlebih dahulu agar AI dapat menghitung nilai GAP dan merumuskan rekomendasi training yang akurat.
        </p>
        <button type="button" class="btn-secondary" onclick="closeModal('modalAiSkillSummary')" style="font-size:12.5px;padding:7px 16px;">
          Kembali ke Tabel Matriks
        </button>
      </div>
    `;
    currentAiSkillSummaryPlan = null;
    currentAiSkillSummaryMarkdown = '';
    openModal('modalAiSkillSummary');
    return;
  }

  // Sort negative gaps: largest deficit first (e.g. -3, then -2, then -1)
  const sortedGaps = [...stats.negativeGaps].sort((a, b) => a.gap - b.gap);
  const initials = getInitials(emp.nama);

  // Case 2: No negative gaps (All competent)
  if (sortedGaps.length === 0) {
    const blueprint = {
      title: `Strategic Leadership & Cross-Functional Mentorship Program`,
      level: 'Advanced',
      urgency: 'Pengembangan Karir / Rutin',
      durationText: '1 Hari Workshop Intensif (6 Jam)',
      goals: `Memperdalam kapasitas kepemimpinan strategis, kemampuan coaching antar-anggota tim, serta mempersiapkan karyawan untuk memegang peran sentral dalam inisiatif People Development skala korporat.`,
      modules: [
        { jamMulai: '09:00', jamSelesai: '10:30', durasi: '1.5 Jam', modul: 'Sesi 1: Strategic Thinking & Executive Leadership in HR', metode: 'Studi Kasus Eksekutif', deskripsi: 'Memperluas sudut pandang dari level operasional menuju kontribusi strategis pada arah bisnis organisasi.' },
        { jamMulai: '10:45', jamSelesai: '12:15', durasi: '1.5 Jam', modul: 'Sesi 2: Corporate Coaching & Knowledge Transfer Skills', metode: 'Simulasi Coaching', deskripsi: 'Metodologi transfer keahlian kepada junior/rekan kerja dan membangun budaya belajar berkelanjutan.' },
        { jamMulai: '13:15', jamSelesai: '14:45', durasi: '1.5 Jam', modul: 'Sesi 3: Agile Project Management & Cross-Functional Innovation', metode: 'Workshop Kolaborasi', deskripsi: 'Memimpin proyek inovasi lintas divisi dengan prinsip agile dan eksekusi terukur.' },
        { jamMulai: '15:00', jamSelesai: '16:30', durasi: '1.5 Jam', modul: 'Sesi 4: Executive Presentation & High-Stakes Stakeholder Alignment', metode: 'Presentasi Proyek', deskripsi: 'Keterampilan meyakinkan jajaran direksi dalam menginisiasi program transformasi SDM.' }
      ],
      hasilDiharapkan: `Karyawan siap menjadi mentor internal, memimpin proyek divisional, dan menjadi talent benchmark bagi anggota tim lainnya.`,
      penerapanPekerjaan: `Diterapkan dalam memimpin proyek L&D strategis dan mentoring talenta muda di divisi ${dept}.`,
      indikatorKeberhasilan: `- Nilai post-training evaluation ≥ 90%\n- Berhasil menginisiasi minimal 1 proyek perbaikan proses kerja divisi dalam 6 bulan`
    };

    currentAiSkillSummaryPlan = {
      namaTraining: blueprint.title,
      level: blueprint.level,
      goals: blueprint.goals,
      kategoriUrgensi: blueprint.urgency,
      hasilDiharapkan: blueprint.hasilDiharapkan,
      penerapanPekerjaan: blueprint.penerapanPekerjaan,
      indikatorKeberhasilan: blueprint.indikatorKeberhasilan,
      modules: blueprint.modules,
      targetEmployee: {
        nama: emp.nama,
        email: emp.email || '',
        divisi: emp.divisi || dept
      }
    };

    currentAiSkillSummaryMarkdown = `# AI TRAINING NEEDS ANALYSIS (TNA) SUMMARY\n` +
      `**Karyawan**: ${emp.nama}\n` +
      `**Jabatan**: ${emp.jabatan || 'Team Member'}\n` +
      `**Divisi**: ${dept}\n` +
      `**Status**: Seluruh kompetensi memenuhi/melampaui standar (Rata-rata GAP: ${stats.avgGap})\n\n` +
      `### Rekomendasi Program Pengayaan Tingkat Mahir (Advanced Enrichment):\n` +
      `**Program**: ${blueprint.title}\n` +
      `**Target Level**: ${blueprint.level} | **Format**: ${blueprint.durationText}\n` +
      `**Tujuan**: ${blueprint.goals}\n\n` +
      `### Rencana Modul:\n` +
      blueprint.modules.map(m => `- ${m.modul} (${m.jamMulai} - ${m.jamSelesai}): ${m.deskripsi}`).join('\n') + `\n\n` +
      `### Indikator Keberhasilan:\n${blueprint.indikatorKeberhasilan}`;

    bodyEl.innerHTML = `
      <!-- Employee Profile Bar -->
      <div style="display:flex;align-items:center;gap:14px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:50%;background:#16A34A;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
          ${initials}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h4 style="margin:0;font-size:15px;color:#14532D;font-weight:700;">${escapeHtml(emp.nama)}</h4>
            <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:#DCFCE7;color:#15803D;font-weight:700;">${escapeHtml(emp.jabatan || dept)}</span>
          </div>
          <div style="font-size:12px;color:#166534;margin-top:3px;">
            ${stats.scoredCount}/${stats.totalComps} Parameter Dinilai &bull; Rata-rata Skor: <strong>${stats.avgScore}</strong> / 4.0 &bull; Rata-rata GAP: <strong style="color:#15803D;">${stats.avgGap} (Kompeten Penuh)</strong>
          </div>
        </div>
      </div>

      <!-- Optimal Callout -->
      <div style="background:#FAF9F5;border:1px solid var(--line-soft);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:var(--ink-soft);line-height:1.5;">
        <strong style="color:var(--ink);">AI Performance Diagnostic:</strong> Luar biasa! Seluruh parameter kompetensi kerja ${escapeHtml(emp.nama)} telah memenuhi standar operasional. Tidak ditemukan kesenjangan kompetensi defisit. AI merekomendasikan program akselerasi kapabilitas tingkat mahir (Advanced Leadership & Mentoring).
      </div>

      <!-- Recommendation Card -->
      ${renderAiBlueprintCard(blueprint)}
    `;

    openModal('modalAiSkillSummary');
    return;
  }

  // Case 3: Negative gaps exist (Needs targeted training)
  const primaryGap = sortedGaps[0];
  const blueprint = getCompetencyTrainingBlueprint(primaryGap.comp.nama, emp.jabatan, primaryGap.gap, primaryGap.score, primaryGap.standar);

  currentAiSkillSummaryPlan = {
    namaTraining: blueprint.title,
    level: blueprint.level,
    goals: blueprint.goals,
    kategoriUrgensi: blueprint.urgency,
    hasilDiharapkan: blueprint.hasilDiharapkan,
    penerapanPekerjaan: blueprint.penerapanPekerjaan,
    indikatorKeberhasilan: blueprint.indikatorKeberhasilan,
    modules: blueprint.modules,
    targetEmployee: {
      nama: emp.nama,
      email: emp.email || '',
      divisi: emp.divisi || dept
    }
  };

  currentAiSkillSummaryMarkdown = `# AI TRAINING NEEDS ANALYSIS (TNA) SUMMARY\n` +
    `**Karyawan**: ${emp.nama}\n` +
    `**Jabatan**: ${emp.jabatan || 'Team Member'}\n` +
    `**Divisi**: ${dept}\n` +
    `**Rata-rata GAP**: ${stats.avgGap}\n\n` +
    `### Temuan Kesenjangan Kompetensi (Skill GAP):\n` +
    sortedGaps.map(g => `- ${g.comp.nama}: Aktual ${g.score} / Ideal ${g.standar} (GAP ${g.gap > 0 ? '+' : ''}${g.gap}) ${g.gap <= -2 ? '[KRITIS]' : '[PERLU PENINGKATAN]'}`).join('\n') + `\n\n` +
    `### Rekomendasi Program Pelatihan Utama AI:\n` +
    `**Program**: ${blueprint.title}\n` +
    `**Tingkat Urgensi**: ${blueprint.urgency} | **Target Level**: ${blueprint.level}\n` +
    `**Format Rekomendasi**: ${blueprint.durationText}\n` +
    `**Tujuan Pelatihan (SMART)**: ${blueprint.goals}\n\n` +
    `### Rencana Modul Pelatihan Terstruktur:\n` +
    blueprint.modules.map(m => `- ${m.modul} (${m.jamMulai} - ${m.jamSelesai} WIB, ${m.metode}):\n  ${m.deskripsi}`).join('\n') + `\n\n` +
    `### Hasil & Penerapan di Pekerjaan:\n${blueprint.hasilDiharapkan}\n${blueprint.penerapanPekerjaan}\n\n` +
    `### Indikator Keberhasilan (KPI):\n${blueprint.indikatorKeberhasilan}`;

  // Build HTML table for GAP details
  let gapRowsHtml = '';
  sortedGaps.forEach((g, idx) => {
    const isTop = idx === 0;
    const isCrit = g.gap <= -2;
    const badgeBg = isCrit ? '#FEE2E2' : '#FEF3C7';
    const badgeColor = isCrit ? '#B91C1C' : '#B45309';
    const priorityText = isTop ? (isCrit ? 'Prioritas 1 (Kritis)' : 'Prioritas Utama') : 'Perlu Penguatan';

    gapRowsHtml += `
      <tr style="border-bottom:1px solid var(--line-soft);font-size:12px;">
        <td style="padding:8px 10px;font-weight:600;color:var(--ink);">
          ${escapeHtml(g.comp.nama)}
        </td>
        <td style="padding:8px 10px;text-align:center;color:var(--ink-soft);">
          <strong>${g.score}</strong> / ${g.standar}
        </td>
        <td style="padding:8px 10px;text-align:center;">
          <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:${badgeBg};color:${badgeColor};">
            GAP ${g.gap}
          </span>
        </td>
        <td style="padding:8px 10px;text-align:left;">
          <span style="font-size:11px;font-weight:600;color:${isCrit ? '#B91C1C' : '#92400E'};">${priorityText}</span>
        </td>
      </tr>
    `;
  });

  bodyEl.innerHTML = `
    <!-- Employee Profile Bar -->
    <div style="display:flex;align-items:center;gap:14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
      <div style="width:44px;height:44px;border-radius:50%;background:#D97706;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
        ${initials}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h4 style="margin:0;font-size:15px;color:#78350F;font-weight:700;">${escapeHtml(emp.nama)}</h4>
          <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:#FEF3C7;color:#92400E;font-weight:700;">${escapeHtml(emp.jabatan || dept)}</span>
        </div>
        <div style="font-size:12px;color:#92400E;margin-top:3px;">
          ${stats.scoredCount}/${stats.totalComps} Parameter Dinilai &bull; Rata-rata Skor: <strong>${stats.avgScore}</strong> / 4.0 &bull; Rata-rata GAP: <strong style="color:#B91C1C;">${stats.avgGap}</strong>
        </div>
      </div>
    </div>

    <!-- Diagnostic Summary Box -->
    <div style="background:#FAF9F5;border:1px solid var(--line-soft);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span style="font-size:12.5px;font-weight:700;color:var(--ink);">Diagnosis Kesenjangan Kompetensi (Skill GAP):</span>
      </div>
      <p style="margin:0 0 10px 0;font-size:12px;color:var(--ink-soft);line-height:1.45;">
        Ditemukan <strong>${sortedGaps.length} parameter kompetensi</strong> yang berada di bawah standar kerja perusahaan. Kesenjangan paling signifikan ada pada <strong>"${escapeHtml(primaryGap.comp.nama)}"</strong> (Defisit GAP ${primaryGap.gap}).
      </p>
      <div class="tbl-wrap" style="border:1px solid var(--line-soft);border-radius:8px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;margin:0;">
          <thead>
            <tr style="background:var(--sand-soft);font-size:11px;color:var(--ink-soft);text-transform:uppercase;border-bottom:1px solid var(--line-soft);">
              <th style="padding:7px 10px;text-align:left;">Kompetensi</th>
              <th style="padding:7px 10px;text-align:center;">Aktual / Ideal</th>
              <th style="padding:7px 10px;text-align:center;">GAP</th>
              <th style="padding:7px 10px;text-align:left;">Prioritas Intervensi</th>
            </tr>
          </thead>
          <tbody>
            ${gapRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recommendation Card -->
    ${renderAiBlueprintCard(blueprint)}
  `;

  openModal('modalAiSkillSummary');
}

function generateAiSkillSummaryForDivision() {
  const dept = activeSkillDept || 'Divisi HR';
  const allEmployees = getSkillEmployees();
  const deptEmployees = allEmployees.filter(e => !dept || (e.divisi && e.divisi.toLowerCase() === dept.toLowerCase()));

  if (deptEmployees.length === 0) {
    showToast(`Tidak ada karyawan terdaftar pada divisi ${dept}.`, 'error');
    return;
  }

  const modalEl = document.getElementById('modalAiSkillSummary');
  const subEl = document.getElementById('modalAiSkillSummarySubtitle');
  const bodyEl = document.getElementById('modalAiSkillSummaryBody');
  if (!modalEl || !bodyEl) return;

  if (subEl) {
    subEl.innerHTML = `Divisional TNA Diagnostic &bull; <strong>${escapeHtml(dept)}</strong> (${deptEmployees.length} Karyawan)`;
  }

  let totalScoredEmp = 0;
  let compGaps = {}; // { compName: { count: 0, sumDeficit: 0, employees: [], standar: 3 } }

  deptEmployees.forEach(emp => {
    const stats = calcEmployeeStats(emp.id, dept);
    if (stats.scoredCount > 0) totalScoredEmp++;

    stats.negativeGaps.forEach(g => {
      const cName = g.comp.nama;
      if (!compGaps[cName]) {
        compGaps[cName] = { count: 0, sumDeficit: 0, employees: [], standar: g.standar };
      }
      compGaps[cName].count++;
      compGaps[cName].sumDeficit += Math.abs(g.gap);
      compGaps[cName].employees.push({
        id: emp.id,
        nama: emp.nama,
        email: emp.email || '',
        jabatan: emp.jabatan || '',
        score: g.score,
        gap: g.gap
      });
    });
  });

  // Rank competencies by frequency of gap and total deficit
  const rankedComps = Object.keys(compGaps).map(cName => ({
    name: cName,
    ...compGaps[cName]
  })).sort((a, b) => (b.count * 10 + b.sumDeficit) - (a.count * 10 + a.sumDeficit));

  // If no employees evaluated yet
  if (totalScoredEmp === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;">
        <div style="width:54px;height:54px;border-radius:50%;background:#FEF3C7;color:#D97706;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h4 style="font-size:16px;color:var(--ink);margin:0 0 8px 0;">Belum Ada Skor Penilaian pada ${escapeHtml(dept)}</h4>
        <p style="font-size:13px;color:var(--ink-soft);max-width:440px;margin:0 auto 16px auto;line-height:1.5;">
          Belum ada karyawan yang dinilai pada divisi ini. Silahkan buka masing-masing profil karyawan dan tentukan skor kompetensinya terlebih dahulu.
        </p>
        <button type="button" class="btn-secondary" onclick="closeModal('modalAiSkillSummary')" style="font-size:12.5px;padding:7px 16px;">
          Kembali ke Daftar Karyawan
        </button>
      </div>
    `;
    currentAiSkillSummaryPlan = null;
    currentAiSkillSummaryMarkdown = '';
    openModal('modalAiSkillSummary');
    return;
  }

  // If no negative gaps in entire division
  if (rankedComps.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;">
        <div style="width:54px;height:54px;border-radius:50%;background:#DCFCE7;color:#16A34A;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h4 style="font-size:16px;color:#14532D;margin:0 0 8px 0;">Seluruh Anggota Tim ${escapeHtml(dept)} Memenuhi Standar</h4>
        <p style="font-size:13px;color:#166534;max-width:460px;margin:0 auto 16px auto;line-height:1.5;">
          Dari total <strong>${totalScoredEmp} karyawan</strong> yang telah dinilai, tidak ditemukan adanya GAP negatif. Seluruh kompetensi berada pada atau melampaui level standar perusahaan.
        </p>
        <button type="button" class="btn-secondary" onclick="closeModal('modalAiSkillSummary')" style="font-size:12.5px;padding:7px 16px;">
          Tutup
        </button>
      </div>
    `;
    currentAiSkillSummaryPlan = null;
    currentAiSkillSummaryMarkdown = '';
    openModal('modalAiSkillSummary');
    return;
  }

  // We have bottleneck competencies!
  const topBottleneck = rankedComps[0];
  const blueprint = getCompetencyTrainingBlueprint(topBottleneck.name, 'Tim ' + dept, -2, 2, topBottleneck.standar || 3);

  // Customize title for division cohort
  blueprint.title = `Corporate Workshop: ${topBottleneck.name} Mastery for ${dept}`;
  blueprint.goals = `Program upskilling kolektif yang dirancang untuk mengatasi kesenjangan kompetensi '${topBottleneck.name}' pada ${topBottleneck.count} anggota tim ${dept}, menyelaraskan pemahaman metodologi, dan meningkatkan kapabilitas tim sesuai standar divisi.`;

  currentAiSkillSummaryPlan = {
    namaTraining: blueprint.title,
    level: blueprint.level,
    goals: blueprint.goals,
    kategoriUrgensi: blueprint.urgency,
    hasilDiharapkan: blueprint.hasilDiharapkan,
    penerapanPekerjaan: `Diterapkan secara terkoordinasi antar seluruh anggota tim pada divisi ${dept}.`,
    indikatorKeberhasilan: `- Penutupan gap kompetensi ${topBottleneck.name} 100% pada seluruh peserta\n- Nilai post-test tim rata-rata ≥ 85%\n- Peningkatan kecepatan dan akurasi eksekusi tugas divisi`,
    modules: blueprint.modules,
    targetEmployees: topBottleneck.employees.map(e => ({
      nama: e.nama,
      email: e.email || '',
      divisi: dept
    }))
  };

  currentAiSkillSummaryMarkdown = `# EXECUTIVE TNA SUMMARY — ${dept.toUpperCase()}\n` +
    `**Divisi**: ${dept}\n` +
    `**Total Karyawan Terdaftar**: ${deptEmployees.length}\n` +
    `**Karyawan Sudah Dinilai**: ${totalScoredEmp}\n` +
    `**Area Bottleneck Utama**: ${topBottleneck.name} (${topBottleneck.count} Karyawan Mengalami GAP Defisit)\n\n` +
    `### Peta Kesenjangan Kompetensi Divisi:\n` +
    rankedComps.map((c, i) => `${i + 1}. ${c.name}: ${c.count} Karyawan (Total Defisit GAP: -${c.sumDeficit})`).join('\n') + `\n\n` +
    `### Karyawan yang Membutuhkan Pelatihan '${topBottleneck.name}':\n` +
    topBottleneck.employees.map(e => `- ${e.nama} (${e.jabatan || 'Team Member'}) - Skor ${e.score} (GAP ${e.gap})`).join('\n') + `\n\n` +
    `### Rekomendasi Program Pelatihan Kolektif:\n` +
    `**Program**: ${blueprint.title}\n` +
    `**Format**: 1 Hari Workshop Kolektif (6 Jam)\n` +
    `**Tujuan**: ${blueprint.goals}\n\n` +
    `### Rencana Modul:\n` +
    blueprint.modules.map(m => `- ${m.modul}: ${m.deskripsi}`).join('\n') + `\n\n` +
    `### Indikator Keberhasilan:\n${currentAiSkillSummaryPlan.indikatorKeberhasilan}`;

  // Build ranking rows
  let bottleneckRowsHtml = '';
  rankedComps.forEach((c, idx) => {
    const isTop = idx === 0;
    bottleneckRowsHtml += `
      <tr style="border-bottom:1px solid var(--line-soft);font-size:12px;background:${isTop ? '#FEF2F2' : '#fff'};">
        <td style="padding:8px 10px;font-weight:600;color:var(--ink);">
          ${escapeHtml(c.name)}
        </td>
        <td style="padding:8px 10px;text-align:center;">
          <span style="font-weight:700;color:${isTop ? '#B91C1C' : '#B45309'};">${c.count} Karyawan</span>
        </td>
        <td style="padding:8px 10px;text-align:center;">
          <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:#FEE2E2;color:#B91C1C;">
            -${c.sumDeficit}
          </span>
        </td>
        <td style="padding:8px 10px;text-align:left;">
          <span style="font-size:11px;font-weight:600;color:${isTop ? '#B91C1C' : '#64748B'};">
            ${isTop ? 'Prioritas Pelatihan Divisi #1' : 'Peningkatan Bertahap'}
          </span>
        </td>
      </tr>
    `;
  });

  // Build participant chips
  let participantChipsHtml = topBottleneck.employees.map(e => `
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 10px;border-radius:14px;background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF;font-weight:600;">
      <span>${escapeHtml(e.nama)}</span>
      <span style="font-size:10px;padding:1px 5px;border-radius:8px;background:#DBEAFE;color:#1D4ED8;">GAP ${e.gap}</span>
    </span>
  `).join(' ');

  bodyEl.innerHTML = `
    <!-- Division KPI Stats Ribbon -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px;">
      <div style="background:#FAF9F5;border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px;text-align:center;">
        <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;">Karyawan Dinilai</div>
        <div style="font-size:18px;font-weight:800;color:var(--ink);">${totalScoredEmp} / ${deptEmployees.length}</div>
      </div>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px 12px;text-align:center;">
        <div style="font-size:11px;color:#991B1B;text-transform:uppercase;">Bottleneck Utama</div>
        <div style="font-size:14px;font-weight:800;color:#B91C1C;margin-top:2px;">${escapeHtml(topBottleneck.name)}</div>
      </div>
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 12px;text-align:center;">
        <div style="font-size:11px;color:#1E40AF;text-transform:uppercase;">Target Peserta</div>
        <div style="font-size:18px;font-weight:800;color:#1D4ED8;">${topBottleneck.count} Orang</div>
      </div>
    </div>

    <!-- Bottleneck Heatmap Table -->
    <div style="background:#FAF9F5;border:1px solid var(--line-soft);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:6px;">
        Peta Prioritas Kebutuhan Pelatihan ${escapeHtml(dept)}:
      </div>
      <div class="tbl-wrap" style="border:1px solid var(--line-soft);border-radius:8px;background:#fff;margin-bottom:10px;">
        <table style="width:100%;border-collapse:collapse;margin:0;">
          <thead>
            <tr style="background:var(--sand-soft);font-size:11px;color:var(--ink-soft);text-transform:uppercase;border-bottom:1px solid var(--line-soft);">
              <th style="padding:7px 10px;text-align:left;">Kompetensi</th>
              <th style="padding:7px 10px;text-align:center;">Jumlah Karyawan GAP</th>
              <th style="padding:7px 10px;text-align:center;">Total Defisit</th>
              <th style="padding:7px 10px;text-align:left;">Status Prioritas</th>
            </tr>
          </thead>
          <tbody>
            ${bottleneckRowsHtml}
          </tbody>
        </table>
      </div>

      <div style="font-size:12px;color:var(--ink-soft);margin-bottom:6px;">
        <strong>Karyawan yang Direkomendasikan Mengikuti Cohort Ini (${topBottleneck.count} Orang):</strong>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${participantChipsHtml}
      </div>
    </div>

    <!-- Recommendation Card -->
    ${renderAiBlueprintCard(blueprint)}
  `;

  openModal('modalAiSkillSummary');
}

function applyAiSkillSummaryToForm() {
  if (!currentAiSkillSummaryPlan) {
    showToast('Belum ada rekomendasi pelatihan AI yang dibuat.', 'error');
    return;
  }

  // 1. Close modal
  closeModal('modalAiSkillSummary');

  // 2. Switch to form wizard
  goToPage('ajukan');

  // 3. Set department
  const deptEl = document.getElementById('deptName');
  const targetDept = activeSkillDept || (currentAiSkillSummaryPlan.targetEmployee?.divisi) || 'Divisi HR';
  if (deptEl && targetDept) {
    deptEl.value = targetDept;
    if (typeof handleDeptChange === 'function') handleDeptChange(deptEl);
  }

  // 4. Set currentAiPlan and apply standard AI plan fields
  currentAiPlan = currentAiSkillSummaryPlan;
  if (typeof applyAiPlanToForm === 'function') {
    applyAiPlanToForm();
  }

  // 5. Populate Participant(s) in Step 2 table
  const tbody = document.getElementById('participantTableBody');
  if (tbody && typeof addParticipant === 'function') {
    if (Array.isArray(currentAiSkillSummaryPlan.targetEmployees) && currentAiSkillSummaryPlan.targetEmployees.length > 0) {
      currentAiSkillSummaryPlan.targetEmployees.forEach(emp => {
        const inputs = tbody.querySelectorAll('input.participant-name');
        let exists = false;
        inputs.forEach(inp => {
          if (inp.value.trim().toLowerCase() === emp.nama.toLowerCase()) exists = true;
        });
        if (!exists) {
          addParticipant(emp.nama, emp.email || '', emp.divisi || targetDept);
        }
      });
    } else if (currentAiSkillSummaryPlan.targetEmployee) {
      const emp = currentAiSkillSummaryPlan.targetEmployee;
      const inputs = tbody.querySelectorAll('input.participant-name');
      let exists = false;
      inputs.forEach(inp => {
        if (inp.value.trim().toLowerCase() === emp.nama.toLowerCase()) exists = true;
      });
      if (!exists) {
        addParticipant(emp.nama, emp.email || '', emp.divisi || targetDept);
      }
    }
  }

  showToast('Rekomendasi training AI & peserta berhasil diterapkan ke formulir!', 'success');
}

function openActiveAiSkillInStudio() {
  if (!currentAiSkillSummaryPlan) {
    showToast('Belum ada rancangan AI yang dipilih.', 'error');
    return;
  }

  closeModal('modalAiSkillSummary');
  goToPage('ai-studio');

  // Switch to TNA mode
  if (typeof switchStudioMode === 'function') {
    switchStudioMode('tna');
  }

  // Pre-fill TNA Department & Issue
  const deptInput = document.getElementById('tnaDept');
  if (deptInput) {
    deptInput.value = activeSkillDept || 'Divisi HR';
  }

  const issueInput = document.getElementById('tnaIssue');
  if (issueInput) {
    const empInfo = currentAiSkillSummaryPlan.targetEmployee 
      ? `Karyawan: ${currentAiSkillSummaryPlan.targetEmployee.nama} (${currentAiSkillSummaryPlan.targetEmployee.divisi})`
      : `Divisi: ${activeSkillDept || 'Divisi HR'}`;
    issueInput.value = `${empInfo}. Ditemukan kesenjangan performa pada kompetensi utama. Program yang diusulkan: "${currentAiSkillSummaryPlan.namaTraining}". Tujuan: ${currentAiSkillSummaryPlan.goals}`;
    issueInput.focus();
  }

  showToast('Beralih ke AI Studio untuk eksplorasi kurikulum mendalam.', 'info');
}

function copyAiSkillSummary() {
  if (!currentAiSkillSummaryMarkdown) {
    showToast('Tidak ada konten summary untuk disalin.', 'error');
    return;
  }

  const textToCopy = currentAiSkillSummaryMarkdown;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Summary rekomendasi training AI berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      fallbackCopySummaryText(textToCopy);
    });
  } else {
    fallbackCopySummaryText(textToCopy);
  }
}

function fallbackCopySummaryText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Summary berhasil disalin ke clipboard!', 'success');
  } catch (err) {
    showToast('Gagal menyalin summary otomatis.', 'error');
  }
  document.body.removeChild(ta);
}

// Window Exposures for Skill Matrix
window.handleSkillDeptChange = handleSkillDeptChange;
window.selectSkillDeptDirectly = selectSkillDeptDirectly;
window.openEmployeeSkillMatrix = openEmployeeSkillMatrix;
window.backToSkillEmployeeList = backToSkillEmployeeList;
window.changeSkillDept = changeSkillDept;
window.filterSkillEmployeesList = filterSkillEmployeesList;
window.addNewSkillEmployeeFromList = addNewSkillEmployeeFromList;
window.deleteSkillEmployee = deleteSkillEmployee;
window.setIndividualSkillScore = setIndividualSkillScore;
window.updateIndividualCompStandar = updateIndividualCompStandar;
window.deleteIndividualCompetency = deleteIndividualCompetency;
window.openAddSkillCompetencyModal = openAddSkillCompetencyModal;
window.submitModalNewCompetency = submitModalNewCompetency;
window.proposeTrainingForActiveEmp = proposeTrainingForActiveEmp;
window.renderSkillMatrix = renderSkillMatrix;
window.resetSkillMatrixSampleData = resetSkillMatrixSampleData;

// Window Exposures for AI Skill Matrix TNA
window.generateAiSkillSummaryForActiveEmp = generateAiSkillSummaryForActiveEmp;
window.generateAiSkillSummaryForDivision = generateAiSkillSummaryForDivision;
window.applyAiSkillSummaryToForm = applyAiSkillSummaryToForm;
window.openActiveAiSkillInStudio = openActiveAiSkillInStudio;
window.copyAiSkillSummary = copyAiSkillSummary;

// ==============================================================================
// 13. LIVE QR ATTENDANCE HUB & MOBILE CHECK-IN ENGINE
// ==============================================================================

const ATTENDANCE_STORAGE_KEY = 'training_attendance_master_logs';

// Standalone Pure Vanilla QR Generator (Zero-Dependency SVG Generator)
const QRCodeEngine = (function() {
  const MODE_8BIT_BYTE = 4;
  const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

  const QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };

  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num, shift) {
    if (num.length === undefined) throw new Error(num.length + "/" + shift);
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (let i = 0; i < shift; i++) this.num[this.num.length - shift + i] = 0;
  }

  QRPolynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      const num = new Array(this.getLength() + e.getLength() - 1);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  const QRRSBlock = {
    RS_BLOCK_TABLE: [
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
    ],
    getRSBlocks: function(typeNumber, errorCorrectLevel) {
      const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
      if (rsBlock === undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber);
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) list.push({ totalCount: totalCount, dataCount: dataCount });
      }
      return list;
    },
    getRsBlockTable: function(typeNumber, errorCorrectLevel) {
      switch (errorCorrectLevel) {
        case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default: return undefined;
      }
    }
  };

  const QRBitBuffer = function() {
    this.buffer = [];
    this.length = 0;
  };
  QRBitBuffer.prototype = {
    get: function(index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) === 1; },
    put: function(num, length) {
      for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    },
    putBit: function(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QR8bitByte(data) {
    this.mode = MODE_8BIT_BYTE;
    this.data = data;
    this.parsedData = [];
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      if (code < 0x80) {
        this.parsedData.push(code);
      } else if (code < 0x800) {
        this.parsedData.push(0xc0 | (code >> 6));
        this.parsedData.push(0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        this.parsedData.push(0xe0 | (code >> 12));
        this.parsedData.push(0x80 | ((code >> 6) & 0x3f));
        this.parsedData.push(0x80 | (code & 0x3f));
      } else {
        i++;
        const code2 = 0x10000 + (((code & 0x3ff) << 10) | (data.charCodeAt(i) & 0x3ff));
        this.parsedData.push(0xf0 | (code2 >> 18));
        this.parsedData.push(0x80 | ((code2 >> 12) & 0x3f));
        this.parsedData.push(0x80 | ((code2 >> 6) & 0x3f));
        this.parsedData.push(0x80 | (code2 & 0x3f));
      }
    }
  }

  QR8bitByte.prototype = {
    getLength: function() { return this.parsedData.length; },
    write: function(buffer) {
      for (let i = 0; i < this.parsedData.length; i++) buffer.put(this.parsedData[i], 8);
    }
  };

  const QRUtil = {
    PATTERN_POSITION_TABLE: [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54]
    ],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
    getBCHTypeInfo: function(data) {
      let d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },
    getBCHDigit: function(data) {
      let digit = 0;
      while (data !== 0) { digit++; data >>>= 1; }
      return digit;
    },
    getPatternPosition: function(typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },
    getMask: function(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
        case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
        case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getErrorCorrectPolynomial: function(errorCorrectLength) {
      let a = new QRPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },
    getLengthInBits: function(mode, type) {
      if (1 <= type && type < 10) return 8;
      return 16;
    },
    getLostPoint: function(qrCode) {
      const moduleCount = qrCode.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    }
  };

  function QRCodeModel(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  QRCodeModel.prototype = {
    addData: function(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      if (this.typeNumber < 1) {
        let typeNumber = 1;
        for (typeNumber = 1; typeNumber < 10; typeNumber++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
          let totalBytes = 0;
          for (let i = 0; i < this.dataList.length; i++) totalBytes += this.dataList[i].getLength();
          if (totalBytes + 3 <= totalDataCount) break;
        }
        this.typeNumber = Math.min(10, typeNumber);
      }
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      this.mapData(this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList), maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
              (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    getBestMaskPattern: function() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    setupTimingPattern: function() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) continue;
        this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) continue;
        this.modules[6][c] = (c % 2 === 0);
      }
    },
    setupPositionAdjustPattern: function() {
      const pos = QRUtil.getPatternPosition(this.typeNumber);
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      const data = (this.errorCorrectLevel << 3) | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = !test;
    },
    mapData: function(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              const mask = QRUtil.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    },
    createData: function(typeNumber, errorCorrectLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      const buffer = new QRBitBuffer();
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.length % 8 !== 0) buffer.putBit(false);
      while (true) {
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0xec, 8);
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0x11, 8);
      }
      return this.createBytes(buffer, rsBlocks);
    },
    createBytes: function(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
      }
      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) data[index++] = dcdata[r][i];
        }
      }
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) data[index++] = ecdata[r][i];
        }
      }
      return data;
    }
  };

  return {
    generateSVG: function(text, size = 260, darkColor = "#1F2421", lightColor = "#FFFFFF") {
      const qr = new QRCodeModel(0, QRErrorCorrectLevel.M);
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      const margin = 3;
      const fullCount = count + (margin * 2);
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullCount} ${fullCount}" width="${size}" height="${size}" shape-rendering="crispEdges">`;
      svg += `<rect width="100%" height="100%" fill="${lightColor}"/>`;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            svg += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${darkColor}"/>`;
          }
        }
      }
      svg += `</svg>`;
      return svg;
    }
  };
})();

// State Variables for Attendance
let activeAttendanceTraining = null;
let activeAttendanceModule = 'Sesi 1';
let activeAttendanceParticipants = [];
let activeAttendanceLogs = [];

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStoredAttendanceLogs() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredAttendanceLogs(logs) {
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {}
}

/**
 * Inisialisasi Halaman Live Absensi & Pemilihan Sesi Aktif
 */
function initAttendanceHub(preselectedTrainingId = '') {
  // Cek apakah mode mobile check-in aktif dari URL
  const attParams = getAttendanceUrlParams();
  if (attParams.id) {
    setupMobileAttendanceView(attParams.id, attParams.sesi);
    return;
  }

  // Tampilkan Trainer Hub View
  const trainerView = document.getElementById('attendanceTrainerView');
  const mobileView = document.getElementById('attendanceMobileView');
  if (trainerView) trainerView.style.display = 'block';
  if (mobileView) mobileView.style.display = 'none';

  loadCalendarEntries();
  const submissions = (typeof cachedEntries !== 'undefined' && Array.isArray(cachedEntries)) ? cachedEntries : [];
  const selTraining = document.getElementById('attTrainingSelect');
  if (!selTraining) return;

  selTraining.innerHTML = '';
  if (submissions.length === 0) {
    selTraining.innerHTML = '<option value="">-- Belum ada riwayat training tersimpan --</option>';
    handleAttendanceTrainingChange('');
    return;
  }

  const todayIso = getTodayIsoDate();
  const todayCompact = todayIso.replace(/-/g, '');
  let foundToday = false;

  // Placeholder Default (Tidak langsung auto-select agar tidak mengecohkan jika ada jadwal bersamaan)
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Silakan Pilih Pelatihan yang Anda Selenggarakan --';
  selTraining.appendChild(defaultOpt);

  // Urutkan: training hari ini di paling atas
  const sorted = [...submissions].sort((a, b) => {
    const aMeta = a.meta || {};
    const bMeta = b.meta || {};
    const aId = String(aMeta['ID training'] || a.id || '');
    const bId = String(bMeta['ID training'] || b.id || '');
    const aIsToday = aId.includes(todayCompact) || JSON.stringify(a).includes(todayIso);
    const bIsToday = bId.includes(todayCompact) || JSON.stringify(b).includes(todayIso);
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return 0;
  });

  sorted.forEach(sub => {
    const meta = sub.meta || {};
    const id = (meta['ID training'] || sub.id || '').trim();
    const title = (meta['Nama training'] || sub.namaTraining || 'Training Tanpa Judul').trim();
    const leader = (meta['Leader pengaju'] || sub.leader || '').trim();
    const trainer = (meta['Trainer'] || sub.trainer || '').trim();
    const dept = (meta['Departemen / divisi'] || sub.divisi || '').trim();
    const isToday = id.includes(todayCompact) || JSON.stringify(sub).includes(todayIso);
    if (isToday) foundToday = true;

    const opt = document.createElement('option');
    opt.value = id;

    let label = '';
    if (isToday) label += '🔥 [HARI INI] ';
    label += title;
    if (leader) label += ` — Pengaju: ${leader}`;
    if (dept) label += ` (${dept})`;
    if (trainer) label += ` | Trainer: ${trainer}`;

    opt.textContent = label;
    selTraining.appendChild(opt);
  });

  const dateHint = document.getElementById('attTrainingDateHint');
  if (dateHint) {
    dateHint.innerHTML = foundToday 
      ? `💡 <strong>Terdapat agenda pelatihan hari ini.</strong> Silakan pilih pelatihan yang sesuai dengan agenda Anda.`
      : `Pilih pelatihan sesuai agenda yang Anda selenggarakan untuk mengaktifkan QR Code dan presensi.`;
  }

  // Jika dibuka dengan preselected ID (misal dari shortcut kalender)
  if (preselectedTrainingId) {
    selTraining.value = preselectedTrainingId;
    handleAttendanceTrainingChange(preselectedTrainingId);
  } else {
    selTraining.value = '';
    handleAttendanceTrainingChange('');
  }
}

/**
 * Handle perubahan pilihan training pada hub trainer
 */
function handleAttendanceTrainingChange(trainingId) {
  if (!trainingId) {
    activeAttendanceTraining = null;
    activeAttendanceParticipants = [];
    activeAttendanceModule = 'Sesi 1';

    const elTitle = document.getElementById('attDisplayTrainingTitle');
    const elTrainer = document.getElementById('attDisplayTrainer');
    const elRoom = document.getElementById('attDisplayRoom');
    const elModule = document.getElementById('attDisplayModule');
    if (elTitle) elTitle.textContent = 'Belum Ada Pelatihan Dipilih';
    if (elTrainer) elTrainer.innerHTML = `<span>Trainer: -</span>`;
    if (elRoom) elRoom.textContent = '-';
    if (elModule) elModule.textContent = '-';

    const selModule = document.getElementById('attModuleSelect');
    if (selModule) selModule.innerHTML = '<option value="">-- Sesi Modul --</option>';

    const directInput = document.getElementById('attDirectUrlInput');
    if (directInput) directInput.value = '';

    const canvasWrap = document.getElementById('attQrCanvasWrap');
    if (canvasWrap) {
      canvasWrap.innerHTML = `
        <div style="text-align:center;padding:28px 16px;color:var(--ink-soft);">
          <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-tint);border:1px solid rgba(75,150,255,0.25);display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px;color:var(--accent-dark);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </div>
          <p style="margin:0 0 4px;font-size:13.5px;font-weight:600;color:var(--ink);">Pilih Pelatihan yang Anda Selenggarakan</p>
          <span style="font-size:12px;">Pilih agenda pelatihan pada dropdown di atas untuk mengaktifkan QR Code presensi dan memuat daftar peserta.</span>
        </div>`;
    }

    const container = document.getElementById('attParticipantList');
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:36px 16px;color:var(--ink-soft);font-size:13px;">Silakan pilih pelatihan di atas untuk memuat daftar peserta.</div>`;
    }

    const elPresent = document.getElementById('attCountPresent');
    const elTotal = document.getElementById('attCountTotal');
    const elPercent = document.getElementById('attPercent');
    const elFill = document.getElementById('attProgressFill');
    if (elPresent) elPresent.textContent = '0';
    if (elTotal) elTotal.textContent = '0';
    if (elPercent) elPercent.textContent = '0%';
    if (elFill) elFill.style.width = '0%';
    return;
  }

  loadCalendarEntries();
  const submissions = (typeof cachedEntries !== 'undefined' && Array.isArray(cachedEntries)) ? cachedEntries : [];
  const found = submissions.find(s => {
    const id = (s.meta && s.meta['ID training']) || s.id || '';
    return id.trim() === String(trainingId).trim();
  });

  if (!found) return;
  activeAttendanceTraining = found;

  const meta = found.meta || {};
  const title = (meta['Nama training'] || found.namaTraining || '-').trim();
  const trainer = (meta['Trainer'] || found.trainer || '-').trim();
  const room = (meta['Lokasi / venue'] || meta['Platform online'] || found.lokasi || '-').trim();

  // Update Metadata Text
  const elTitle = document.getElementById('attDisplayTrainingTitle');
  const elTrainer = document.getElementById('attDisplayTrainer');
  const elRoom = document.getElementById('attDisplayRoom');
  if (elTitle) elTitle.textContent = title;
  if (elTrainer) elTrainer.innerHTML = `<span>Trainer: ${trainer}</span>`;
  if (elRoom) elRoom.textContent = room;

  // Extract Modules
  const selModule = document.getElementById('attModuleSelect');
  if (selModule) {
    selModule.innerHTML = '';
    const rawModules = found.modules || [];
    if (rawModules.length > 0) {
      rawModules.forEach((m, idx) => {
        const modName = (m.modul || `Sesi ${idx + 1}`).trim();
        const opt = document.createElement('option');
        opt.value = modName;
        opt.textContent = `${modName} (${m.tanggal || ''} ${m.jamMulai || ''})`;
        selModule.appendChild(opt);
      });
      activeAttendanceModule = rawModules[0].modul || 'Sesi 1';
      selModule.value = activeAttendanceModule;
    } else {
      const opt = document.createElement('option');
      opt.value = 'Sesi 1';
      opt.textContent = 'Sesi 1 (Utama)';
      selModule.appendChild(opt);
      activeAttendanceModule = 'Sesi 1';
    }
  }

  // Extract Registered Participants
  activeAttendanceParticipants = [];
  const rawParts = found.participants || [];
  rawParts.forEach(p => {
    activeAttendanceParticipants.push({
      nama: (p.nama || p.namaPeserta || '').trim(),
      email: (p.email || p.emailPeserta || '').trim(),
      departemen: (p.departemen || p.divisi || '-').trim()
    });
  });

  // Render QR & Board
  renderAttendanceSessionQR();
  syncAttendanceHubLogs();
}

/**
 * Handle perubahan modul sesi
 */
function handleAttendanceModuleChange(moduleId) {
  activeAttendanceModule = moduleId || 'Sesi 1';
  const elMod = document.getElementById('attDisplayModule');
  if (elMod) elMod.textContent = activeAttendanceModule;

  renderAttendanceSessionQR();
  renderAttendanceParticipantBoard();
}

/**
 * Generate QR Code Sesi dan tautan langsung
 */
function renderAttendanceSessionQR() {
  if (!activeAttendanceTraining) return;
  const meta = activeAttendanceTraining.meta || {};
  const trnId = (meta['ID training'] || activeAttendanceTraining.id || '').trim();
  const modId = activeAttendanceModule || 'Sesi 1';

  // Construct Direct Mobile Check-In URL publik yang kompatibel 100% di semua smartphone
  const baseUrl = getAttendanceBaseUrl();
  const cleanUrl = `${baseUrl.replace(/\/+$/, '')}/?id=${encodeURIComponent(trnId)}&sesi=${encodeURIComponent(modId)}#absen`;

  const directInput = document.getElementById('attDirectUrlInput');
  if (directInput) directInput.value = cleanUrl;

  const openBtn = document.getElementById('attDirectUrlOpenBtn');
  if (openBtn) openBtn.href = cleanUrl;

  const canvasWrap = document.getElementById('attQrCanvasWrap');
  if (canvasWrap) {
    try {
      const svg = QRCodeEngine.generateSVG(cleanUrl, 260);
      canvasWrap.innerHTML = svg;
    } catch (err) {
      canvasWrap.innerHTML = `<span style="color:var(--danger);font-size:12px;">Gagal merender QR: ${err.message}</span>`;
    }
  }
}

/**
 * Render Papan Kehadiran Peserta (Live Checklist)
 */
function renderAttendanceParticipantBoard(searchQuery = '') {
  const container = document.getElementById('attParticipantList');
  if (!container) return;

  const logs = getStoredAttendanceLogs();
  const trnId = (activeAttendanceTraining && ((activeAttendanceTraining.meta && activeAttendanceTraining.meta['ID training']) || activeAttendanceTraining.id || '')).trim();
  const modId = activeAttendanceModule || 'Sesi 1';

  // Filter logs for this training and session
  const sessionLogs = logs.filter(l => {
    return String(l.trainingId).trim() === trnId && String(l.moduleId).trim() === modId;
  });

  const presentEmailMap = new Map();
  sessionLogs.forEach(l => {
    presentEmailMap.set(String(l.participantEmail).toLowerCase().trim(), l);
  });

  // Gabungkan peserta terdaftar + peserta walk-in yang hadir
  const combinedList = [...activeAttendanceParticipants];
  sessionLogs.forEach(l => {
    const exists = combinedList.some(p => p.email.toLowerCase().trim() === l.participantEmail.toLowerCase().trim());
    if (!exists) {
      combinedList.push({
        nama: l.participantName,
        email: l.participantEmail,
        departemen: l.department || '-',
        isWalkIn: true
      });
    }
  });

  const q = searchQuery.toLowerCase().trim();
  const filtered = combinedList.filter(p => {
    if (!q) return true;
    return p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.departemen.toLowerCase().includes(q);
  });

  let presentCount = 0;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-soft);font-size:12.5px;">Tidak ada peserta yang cocok dengan pencarian.</div>`;
  } else {
    filtered.forEach(p => {
      const emailKey = p.email.toLowerCase().trim();
      const log = presentEmailMap.get(emailKey);
      const isPresent = !!log;
      if (isPresent) presentCount++;

      const item = document.createElement('div');
      item.className = `att-participant-item ${isPresent ? 'present' : ''}`;

      let badgeHtml = '';
      if (isPresent) {
        const timeStr = log.timestamp ? log.timestamp.split(' ')[1] : '';
        badgeHtml = `<span class="att-badge-present">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Hadir ${timeStr ? '(' + timeStr + ')' : ''}
        </span>`;
      } else {
        badgeHtml = `
          <button type="button" class="btn-secondary" onclick="manualCheckInParticipant('${p.email}')" title="Centang Hadir Manual" style="font-size:11.5px;padding:4px 8px;gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Hadirkan</span>
          </button>
        `;
      }

      item.innerHTML = `
        <div class="att-item-meta">
          <span class="att-item-name">${p.nama} ${p.isWalkIn ? '<span style="font-size:10.5px;padding:1px 6px;border-radius:10px;background:rgba(183,134,40,0.15);color:var(--accent-gold);margin-left:4px;">Walk-in</span>' : ''}</span>
          <span class="att-item-sub">${p.departemen} &bull; ${p.email}</span>
        </div>
        <div class="att-item-actions">
          ${badgeHtml}
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Update Counters & Progress Bar
  const totalCount = combinedList.length;
  const percent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const elPresent = document.getElementById('attCountPresent');
  const elTotal = document.getElementById('attCountTotal');
  const elPercent = document.getElementById('attPercent');
  const elFill = document.getElementById('attProgressFill');

  if (elPresent) elPresent.textContent = presentCount;
  if (elTotal) elTotal.textContent = totalCount;
  if (elPercent) elPercent.textContent = `${percent}%`;
  if (elFill) elFill.style.width = `${percent}%`;
}

function filterAttendanceList(query) {
  renderAttendanceParticipantBoard(query);
}

/**
 * Centang Hadir Manual oleh Trainer
 */
async function manualCheckInParticipant(email) {
  if (!activeAttendanceTraining) return;
  const found = activeAttendanceParticipants.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
  if (!found) return;

  const meta = activeAttendanceTraining.meta || {};
  const trnId = (meta['ID training'] || activeAttendanceTraining.id || '').trim();
  const title = (meta['Nama training'] || activeAttendanceTraining.namaTraining || '').trim();
  const modId = activeAttendanceModule || 'Sesi 1';
  const now = new Date();
  const timestamp = `${getTodayIsoDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} WIB`;

  const newLog = {
    timestamp: timestamp,
    trainingId: trnId,
    trainingTitle: title,
    moduleId: modId,
    sessionDate: getTodayIsoDate(),
    participantName: found.nama,
    participantEmail: found.email,
    department: found.departemen,
    method: 'Manual by Trainer',
    status: 'Hadir',
    note: 'Centang Manual Trainer'
  };

  // Simpan ke local logs
  const logs = getStoredAttendanceLogs();
  logs.push(newLog);
  saveStoredAttendanceLogs(logs);
  renderAttendanceParticipantBoard();
  showToast(`Presensi ${found.nama} berhasil dicatat!`, 'success');

  // Kirim background sync ke Google Apps Script
  try {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'recordAttendance', ...newLog })
    }).catch(() => {});
  } catch (err) {}
}

/**
 * Modal Walk-in Participant Handlers
 */
function openWalkInModal() {
  const modal = document.getElementById('modalWalkIn');
  if (modal) modal.style.display = 'flex';
}

function closeWalkInModal() {
  const modal = document.getElementById('modalWalkIn');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('formWalkIn');
  if (form) form.reset();
}

async function submitWalkInParticipant(event) {
  event.preventDefault();
  if (!activeAttendanceTraining) return;

  const nama = (document.getElementById('walkInNama')?.value || '').trim();
  const email = (document.getElementById('walkInEmail')?.value || '').trim().toLowerCase();
  const divisi = (document.getElementById('walkInDivisi')?.value || '').trim();

  if (!nama || !email) {
    showToast('Nama dan email wajib diisi.', 'warning');
    return;
  }

  const meta = activeAttendanceTraining.meta || {};
  const trnId = (meta['ID training'] || activeAttendanceTraining.id || '').trim();
  const title = (meta['Nama training'] || activeAttendanceTraining.namaTraining || '').trim();
  const modId = activeAttendanceModule || 'Sesi 1';
  const now = new Date();
  const timestamp = `${getTodayIsoDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} WIB`;

  const newLog = {
    timestamp: timestamp,
    trainingId: trnId,
    trainingTitle: title,
    moduleId: modId,
    sessionDate: getTodayIsoDate(),
    participantName: nama,
    participantEmail: email,
    department: divisi || '-',
    method: 'QR Web (Walk-in)',
    status: 'Hadir',
    note: 'Peserta Walk-in'
  };

  const logs = getStoredAttendanceLogs();
  logs.push(newLog);
  saveStoredAttendanceLogs(logs);

  closeWalkInModal();
  renderAttendanceParticipantBoard();
  showToast(`Peserta walk-in ${nama} berhasil ditambahkan dan dicatat hadir!`, 'success');

  try {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'recordAttendance', isWalkIn: true, ...newLog })
    }).catch(() => {});
  } catch (err) {}
}

/**
 * Salin Tautan Check-In
 */
function copyAttendanceLink() {
  const input = document.getElementById('attDirectUrlInput');
  if (!input || !input.value) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Tautan presensi berhasil disalin!', 'success');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Tautan presensi berhasil disalin!', 'success');
    });
  } else {
    input.select();
    document.execCommand('copy');
    showToast('Tautan presensi berhasil disalin!', 'success');
  }
}

/**
 * Toggle Projector Fullscreen Mode
 */
function toggleProjectorMode() {
  if (!activeAttendanceTraining) {
    showToast('Silakan pilih pelatihan yang Anda selenggarakan terlebih dahulu sebelum membuka Mode Layar Proyektor.', 'warning');
    return;
  }
  const isProj = document.body.classList.toggle('projector-mode');
  const btn = document.getElementById('btnToggleProjector');
  if (isProj) {
    if (btn) btn.innerHTML = `<span>Tutup Layar Penuh (ESC)</span>`;
    showToast('Mode Layar Proyektor Aktif. Tekan ESC untuk keluar.', 'info');
  } else {
    if (btn) btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg><span>Layar Proyektor</span>`;
  }
}

// Event listener untuk tombol ESC keluar dari Projector Mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('projector-mode')) {
    toggleProjectorMode();
  }
});

/**
 * Sinkronisasi Data Kehadiran dari Google Apps Script
 */
async function syncAttendanceHubLogs() {
  renderAttendanceParticipantBoard();
  if (!activeAttendanceTraining) return;

  const meta = activeAttendanceTraining.meta || {};
  const trnId = (meta['ID training'] || activeAttendanceTraining.id || '').trim();
  if (!trnId) return;

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getAttendanceLogs&trainingId=${encodeURIComponent(trnId)}&_ts=${Date.now()}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const serverLogs = await resp.json();
      if (Array.isArray(serverLogs) && serverLogs.length > 0) {
        const localLogs = getStoredAttendanceLogs();
        // Merge without duplicate (trainingId + moduleId + participantEmail)
        const merged = [...localLogs];
        serverLogs.forEach(sLog => {
          const exists = merged.some(m => {
            return String(m.trainingId).trim() === String(sLog.trainingId).trim() &&
                   String(m.moduleId).trim() === String(sLog.moduleId).trim() &&
                   String(m.participantEmail).toLowerCase().trim() === String(sLog.participantEmail).toLowerCase().trim();
          });
          if (!exists) merged.push(sLog);
        });
        saveStoredAttendanceLogs(merged);
        renderAttendanceParticipantBoard();
      }
    }
  } catch (err) {
    // Offline fallback: rely on local logs
  }
}

function refreshAttendanceHubData() {
  syncAttendanceHubLogs();
  showToast('Memperbarui data kehadiran...', 'info');
}

// ==========================================
// MOBILE PARTICIPANT CHECK-IN CONTROLLER
// ==========================================

let mobileActiveTraining = null;
let mobileActiveModule = 'Sesi 1';
let mobileParticipantsList = [];

async function setupMobileAttendanceView(trainingId, moduleId) {
  const trainerView = document.getElementById('attendanceTrainerView');
  const mobileView = document.getElementById('attendanceMobileView');
  if (trainerView) trainerView.style.display = 'none';
  if (mobileView) mobileView.style.display = 'block';

  const targetTrnId = String(trainingId || '').trim();
  mobileActiveModule = String(moduleId || 'Sesi 1').trim();

  const elTitle = document.getElementById('mobDisplayTitle');
  const elModule = document.getElementById('mobDisplayModule');
  const elTrainer = document.getElementById('mobDisplayTrainer');
  const elDate = document.getElementById('mobDisplayDate');
  const selParticipant = document.getElementById('mobParticipantSelect');
  const formInputs = document.getElementById('mobFormInputs');
  const successCard = document.getElementById('mobSuccessCard');

  if (elTitle) elTitle.textContent = `Memuat Info Pelatihan (${targetTrnId})...`;
  if (elModule) elModule.textContent = mobileActiveModule;
  if (elTrainer) elTrainer.textContent = 'Memuat trainer...';
  if (elDate) elDate.textContent = 'Memuat jadwal...';

  if (selParticipant) {
    selParticipant.disabled = true;
    selParticipant.innerHTML = '<option value="">⏳ Mengambil daftar peserta dari server...</option>';
  }

  // 1. Cek apakah perangkat ini sudah absen pada modul ini
  const doneKey = `att_done_${targetTrnId}_${mobileActiveModule}`;
  const savedDone = localStorage.getItem(doneKey);
  if (savedDone) {
    try {
      const info = JSON.parse(savedDone);
      if (successCard) successCard.style.display = 'block';
      if (formInputs) formInputs.style.display = 'none';
      const det = document.getElementById('mobSuccessDetail');
      const ts = document.getElementById('mobSuccessTimestamp');
      if (det) det.textContent = `Terima kasih, ${info.name || 'Anda'} telah resmi tercatat hadir pada ${mobileActiveModule}.`;
      if (ts) ts.textContent = `Waktu: ${info.timestamp || '-'}`;
    } catch (e) {}
  } else {
    if (successCard) successCard.style.display = 'none';
    if (formInputs) formInputs.style.display = 'block';
  }

  // 2. Ambil data training (dari local cache jika ada, atau fetch dari Google Apps Script jika di HP peserta)
  let found = null;
  loadCalendarEntries();
  const submissions = (typeof cachedEntries !== 'undefined' && Array.isArray(cachedEntries)) ? cachedEntries : [];
  found = submissions.find(s => {
    const id = (s.meta && s.meta['ID training']) || s.id || '';
    return id.trim().toUpperCase() === targetTrnId.toUpperCase();
  });

  // Jika tidak ditemukan di penyimpanan lokal laptop (kasus umum smartphone peserta), fetch dari Google Apps Script
  if (!found || !found.participants || found.participants.length === 0) {
    try {
      const gasUrl = `${GOOGLE_SCRIPT_URL}?action=getTrainingDetails&id=${encodeURIComponent(targetTrnId)}`;
      const res = await fetch(gasUrl);
      const json = await res.json();
      if (json && json.status === 'success' && json.training) {
        found = json.training;
      }
    } catch (err) {
      console.warn('Gagal memuat detail pelatihan dari Apps Script:', err);
    }
  }

  mobileActiveTraining = found || {
    id: targetTrnId,
    namaTraining: `Pelatihan ${targetTrnId}`,
    trainer: 'Fasilitator Pelatihan',
    jadwal: getTodayIsoDate(),
    participants: []
  };

  const meta = mobileActiveTraining.meta || {};
  const title = (mobileActiveTraining.namaTraining || meta['Nama training'] || targetTrnId).trim();
  const trainer = (mobileActiveTraining.trainer || meta['Trainer'] || '-').trim();
  const schedule = (mobileActiveTraining.jadwal || meta['Tanggal & jam pelaksanaan'] || getTodayIsoDate()).trim();

  if (elTitle) elTitle.textContent = title;
  if (elModule) elModule.textContent = mobileActiveModule;
  if (elTrainer) elTrainer.textContent = trainer;
  if (elDate) elDate.textContent = schedule;

  // 3. Render daftar nama peserta terdaftar
  mobileParticipantsList = [];
  const rawParts = mobileActiveTraining.participants || [];
  if (selParticipant) {
    selParticipant.disabled = false;
    selParticipant.innerHTML = '';

    const optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.textContent = '-- Silakan Pilih Nama Anda --';
    selParticipant.appendChild(optDefault);

    rawParts.forEach(p => {
      const nama = (p.nama || p.namaPeserta || '').trim();
      const email = (p.email || p.emailPeserta || '').trim();
      const dept = (p.departemen || p.divisi || '-').trim();
      if (nama) {
        mobileParticipantsList.push({ nama, email, departemen: dept });
        const opt = document.createElement('option');
        opt.value = nama;
        opt.textContent = `${nama} (${dept})`;
        selParticipant.appendChild(opt);
      }
    });

    // Opsi tambahan Walk-in / Peserta Baru
    const optWalkIn = document.createElement('option');
    optWalkIn.value = '__walkin__';
    optWalkIn.textContent = '➕ Nama saya belum ada di daftar (Peserta Baru / Walk-in)';
    selParticipant.appendChild(optWalkIn);
  }

  // Reset tampilan form walk-in
  handleMobParticipantChange('');
}

function handleMobParticipantChange(selectedName) {
  const walkInWrap = document.getElementById('mobWalkInFields');
  const customNameInp = document.getElementById('mobCustomName');
  const customDeptInp = document.getElementById('mobCustomDept');
  const readonlyWrap = document.getElementById('mobDivisiReadonlyWrap');
  const divField = document.getElementById('mobDivisiReadonly');
  const emailField = document.getElementById('mobEmailVerify');
  const hintEl = document.getElementById('mobEmailHint');

  if (selectedName === '__walkin__') {
    if (walkInWrap) walkInWrap.style.display = 'block';
    if (customNameInp) { customNameInp.required = true; customNameInp.focus(); }
    if (customDeptInp) { customDeptInp.required = true; }
    if (readonlyWrap) readonlyWrap.style.display = 'none';
    if (emailField) {
      emailField.value = '';
      emailField.placeholder = 'email.kantor@perusahaan.com';
    }
    if (hintEl) hintEl.textContent = 'Masukkan email kantor Anda untuk pencatatan presensi walk-in.';
  } else {
    if (walkInWrap) walkInWrap.style.display = 'none';
    if (customNameInp) { customNameInp.required = false; customNameInp.value = ''; }
    if (customDeptInp) { customDeptInp.required = false; customDeptInp.value = ''; }
    if (readonlyWrap) readonlyWrap.style.display = 'block';

    const found = mobileParticipantsList.find(p => p.nama === selectedName);
    if (found) {
      if (divField) divField.value = found.departemen;
      if (emailField) {
        emailField.placeholder = found.email ? `Ketikkan email: ${found.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}` : 'nama.lengkap@perusahaan.com';
      }
      if (hintEl) hintEl.textContent = 'Verifikasi anti-joki: masukkan email kantor Anda yang terdaftar.';
    } else {
      if (divField) divField.value = '';
      if (emailField) emailField.placeholder = 'misal: nama.lengkap@perusahaan.com';
      if (hintEl) hintEl.textContent = 'Pilih nama Anda di atas untuk verifikasi.';
    }
  }
}

async function submitMobileAttendance(event) {
  event.preventDefault();
  if (!mobileActiveTraining) return;

  const selName = (document.getElementById('mobParticipantSelect')?.value || '').trim();
  const inputEmail = (document.getElementById('mobEmailVerify')?.value || '').trim().toLowerCase();

  if (!selName) {
    showToast('Silakan pilih nama Anda terlebih dahulu.', 'warning');
    return;
  }

  let finalName = '';
  let finalDept = '';
  let isWalkIn = false;

  if (selName === '__walkin__') {
    isWalkIn = true;
    finalName = (document.getElementById('mobCustomName')?.value || '').trim();
    finalDept = (document.getElementById('mobCustomDept')?.value || '').trim() || '-';
    if (!finalName) {
      showToast('Ketikkan nama lengkap Anda.', 'warning');
      document.getElementById('mobCustomName')?.focus();
      return;
    }
  } else {
    const found = mobileParticipantsList.find(p => p.nama === selName);
    if (!found) {
      showToast('Nama peserta tidak valid.', 'error');
      return;
    }
    finalName = found.nama;
    finalDept = found.departemen || '-';

    // Anti-Joki Verification: Compare email jika peserta terdaftar memiliki email
    const targetEmail = (found.email || '').toLowerCase().trim();
    if (targetEmail && inputEmail !== targetEmail) {
      showToast('Alamat email kantor tidak cocok dengan nama peserta yang dipilih!', 'error');
      document.getElementById('mobEmailVerify')?.focus();
      return;
    }
  }

  if (!inputEmail) {
    showToast('Alamat email kantor wajib diisi!', 'warning');
    document.getElementById('mobEmailVerify')?.focus();
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitMobAttendance');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="btn-spinner"></span> <span>Memproses Presensi...</span>`;
  }

  const meta = mobileActiveTraining.meta || {};
  const trnId = (meta['ID training'] || mobileActiveTraining.id || '').trim();
  const title = (mobileActiveTraining.namaTraining || meta['Nama training'] || trnId).trim();
  const now = new Date();
  const timestamp = `${getTodayIsoDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} WIB`;

  const payload = {
    action: 'recordAttendance',
    trainingId: trnId,
    trainingTitle: title,
    moduleId: mobileActiveModule || 'Sesi 1',
    sessionDate: getTodayIsoDate(),
    participantName: finalName,
    participantEmail: inputEmail,
    department: finalDept,
    method: isWalkIn ? 'QR Web (Walk-in)' : 'QR Web (Self)',
    status: 'Hadir',
    note: isWalkIn ? 'Presensi Mandiri QR (Walk-in)' : 'Presensi Mandiri QR'
  };

  // Simpan ke local log (jika perangkat dapat menyimpan)
  const logs = getStoredAttendanceLogs();
  logs.push(payload);
  saveStoredAttendanceLogs(logs);

  // Kunci form di localStorage perangkat peserta agar tidak absen berulang kali
  const doneKey = `att_done_${trnId}_${mobileActiveModule}`;
  try {
    localStorage.setItem(doneKey, JSON.stringify({
      timestamp: timestamp,
      name: finalName,
      email: inputEmail
    }));
  } catch (e) {}

  // Kirim POST ke Apps Script backend
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Sync ke Apps Script backend tertunda:', err);
  }

  // Update Tampilan Sukses
  const successCard = document.getElementById('mobSuccessCard');
  const formInputs = document.getElementById('mobFormInputs');
  if (successCard) successCard.style.display = 'block';
  if (formInputs) formInputs.style.display = 'none';
  const det = document.getElementById('mobSuccessDetail');
  const ts = document.getElementById('mobSuccessTimestamp');
  if (det) det.textContent = `Terima kasih, ${finalName} telah resmi tercatat hadir pada ${mobileActiveModule}.`;
  if (ts) ts.textContent = `Waktu: ${timestamp}`;

  showToast('Presensi Anda berhasil dicatat!', 'success');
}

function openAttendanceFromCalendar() {
  const trnId = (document.getElementById('calDetailId')?.textContent || '').trim();
  closeModal('modalTrainingEventDetail');
  goToPage('absensi');
  if (trnId) {
    setTimeout(() => {
      const selTraining = document.getElementById('attTrainingSelect');
      if (selTraining) {
        selTraining.value = trnId;
        handleAttendanceTrainingChange(trnId);
      }
    }, 150);
  }
}

// Window Exposures for Live QR Attendance Hub
window.initAttendanceHub = initAttendanceHub;
window.handleAttendanceTrainingChange = handleAttendanceTrainingChange;
window.handleAttendanceModuleChange = handleAttendanceModuleChange;
window.renderAttendanceSessionQR = renderAttendanceSessionQR;
window.renderAttendanceParticipantBoard = renderAttendanceParticipantBoard;
window.filterAttendanceList = filterAttendanceList;
window.manualCheckInParticipant = manualCheckInParticipant;
window.openWalkInModal = openWalkInModal;
window.closeWalkInModal = closeWalkInModal;
window.submitWalkInParticipant = submitWalkInParticipant;
window.copyAttendanceLink = copyAttendanceLink;
window.toggleProjectorMode = toggleProjectorMode;
window.refreshAttendanceHubData = refreshAttendanceHubData;
window.handleMobParticipantChange = handleMobParticipantChange;
window.submitMobileAttendance = submitMobileAttendance;
window.openAttendanceFromCalendar = openAttendanceFromCalendar;



