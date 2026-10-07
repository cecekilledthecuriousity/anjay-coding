# Security Hardening Fase 1 (Tanpa Ubah Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup celah keamanan prioritas Critical/High yang **bisa diperbaiki tanpa mengubah flow pengguna** (form pengajuan, portal approval, post-training) di backend Google Apps Script dan portal approval.

**Architecture:** Semua perbaikan berupa guard di dalam kode yang sudah ada: helper kecil baru (`esc`, `safeUrl`, `sanitizeCell`, `withScriptLock`, `normalizeApprovalStatus`, `validateUploadFile`, `jsArg`, `safeImageSrc`) ditambahkan di file yang sama lalu dipakai di titik rawan. Tidak ada endpoint, payload, nama aksi, atau tampilan yang berubah untuk pengguna normal. Test memakai `node:test` bawaan Node (tanpa dependency) dengan me-load `google-apps-script.js` ke `vm` beserta stub layanan Google.

**Tech Stack:** Google Apps Script (V8), vanilla JS, Node 24 `node:test` + `node:vm` (zero dependency).

**Spec:** Hasil audit sesi 2026-10-05 (security + backend + frontend). Ringkasan item yang ditangani ada di tabel "Cakupan" di bawah.

## Cakupan

| Audit item | Ditangani di | Catatan |
|---|---|---|
| `?action=resetSheet` via GET tanpa auth (Critical #4) | Task 2 | Menu Spreadsheet tetap bisa reset |
| Approval terima status apa saja, default `Disetujui` bila kosong (High #6, sebagian) | Task 3 | Hanya `Disetujui` / `Ditolak` (yang memang dikirim portal) |
| Tanpa LockService → approval/hapus race (Medium #13, sebagian) | Task 4 | Hanya approval & hapus. Submit **tidak** di-lock (lihat catatan Task 4) |
| Formula injection ke Sheets (Medium #12) | Task 5 | |
| HTML injection di 6 template email (High #9) | Task 6 | Subject & plain text tidak diubah |
| Upload Drive tanpa batas (High #11, sebagian) | Task 7 | Batas = batas yang sudah ada di frontend. 3 titik upload: foto evidence, materi post-training, **berkas modul proposal saat submit** (baru, commit `0e8c23c`) |
| XSS portal approval: `dataUrl` mentah, `onclick` attr-JS (High #8, Low #21) | Task 8 | |

**Sengaja TIDAK di fase ini** (mengubah flow → butuh keputusan user, dibuat plan Fase 2 terpisah):
- Autentikasi endpoint GAS (Critical #1) dan pembatasan data `doGet` (High #5).
- Gerbang login portal approval (Critical #3): sejak commit terbaru gerbang PIN sudah aktif lagi (`initAuth` → `showLoginGate`), **tapi** cek PIN masih di browser (`ubahpin123`, `sessionStorage`) sehingga bisa dilewati dan endpoint GAS tetap terbuka. Menggantinya dengan verifikasi server + menghapus PIN default (Critical #2) tetap Fase 2.
- ID training dobel: ID dibuat di browser (`js/app.js` ~baris 1360) hanya berdasarkan cache lokal, jadi dua user bisa mengirim ID sama. Lock di server tidak bisa mencegah ini; perbaikannya (server menentukan ID final) mengubah flow → Fase 2.
- Proxy API key Gemini (High #7), `no-cors` → CORS (Medium #17), hapus fallback `ANYONE_WITH_LINK` Drive (High #11 sisa), security headers/CSP Vercel (Medium #19), state-machine approval (blok ubah keputusan final).

## Global Constraints

- **Flow tidak boleh berubah:** nama aksi (`update_approval`, `delete_submission`, dll.), bentuk payload, bentuk response sukses, urutan kolom sheet, isi subject email, dan tampilan UI untuk input normal harus identik dengan sebelum perubahan.
- Zero dependency: tidak menambah package npm. Test hanya pakai `node:test`, `node:assert`, `node:vm`, `node:fs`, `node:path`.
- `google-apps-script.js` tetap satu file (deploy masih copy-paste). Helper baru diletakkan di section baru **"0. SECURITY HELPERS"** tepat setelah `];` penutup array `HEADERS` (sebelum `doPost`).
- **Nomor baris di plan ini hanya perkiraan** (dicek terhadap commit `0e8c23c`). Selalu cari lokasi edit dengan teks/anchor yang dikutip, bukan nomor baris.
- Gaya kode mengikuti file sekitar: komentar Bahasa Indonesia, `function` declaration, `const`/`let`, double quote di GAS, single quote di `approval.js`.
- Jangan refactor di luar baris yang disebut task.
- Cache-busting `?v=` dinaikkan ke `20261006_sec1` di akhir (Task 9) supaya browser memuat `approval.js` baru.

## Review Focus

1. **Nilai teks normal yang kebetulan diawali `-`, `+`, `=` atau `@`** (mis. `-` placeholder, `+62812...`, `-Rp 500.000`) — harus tetap tampil sama di Sheets dan tetap terbaca sama oleh portal lewat `doGet`. Test di Task 5 (`"-"`, angka, nomor telepon tidak disentuh) + verifikasi manual di Task 9.
2. **Nama training / peserta yang mengandung `&`, `<`, `'`** (mis. "R&D", "O'Brien") — email harus menampilkan teksnya utuh (bukan `&amp;amp;`), subject email tetap mentah. Test di Task 6 (`subject` mentah, tidak double-escape).
3. **Link meeting tanpa skema** (mis. `meet.google.com/abc-def`) — tetap muncul seperti sebelumnya, hanya skema berbahaya (`javascript:`, `data:`, `vbscript:`, `file:`) yang dibuang. Test di Task 6.
4. **Dua request bersamaan saat lock sibuk** — request kedua mendapat response error JSON yang jelas dan tidak menulis apa pun; lock selalu dilepas walau handler throw. Test di Task 4.
5. **Foto tanpa ekstensi tapi bertipe `image/jpeg`** — frontend menerimanya (cek MIME *atau* ekstensi), maka backend juga harus menerima. Test di Task 7.

---

### Task 1: Test harness GAS + frontend (zero dependency)

**Files:**
- Create: `tests/helpers/gas-harness.js`
- Create: `tests/helpers/extract-fn.js`
- Create: `tests/gas/smoke.test.js`
- Modify: `package.json` (tambah script `test`)

**Interfaces:**
- Produces:
  - `loadGas(overrides?: object) => { ctx, ss, sheet, postSheet, mail, lockState, run(code: string) }` — `ctx` = global vm berisi semua fungsi GAS; `sheet` = fake sheet "Training Submissions" berisi baris header `HEADERS`; `postSheet` = fake sheet "Post Training"; `mail` = array `{to, subject, body, options}` dari `GmailApp.sendEmail`/`MailApp.sendEmail`; `lockState` = `{ busy: boolean, acquired: number, released: number }`; `run(code)` mengevaluasi ekspresi di konteks (untuk membaca `const` top-level seperti `HEADERS`).
  - `makeSheet(name: string, rows: any[][]) => FakeSheet` — `FakeSheet` punya `_data`, `appended`, `deleted`, `setCalls`.
  - `postJson(ctx, payload: object) => object` — panggil `doPost` dan parse JSON response.
  - `getJson(ctx, params: object) => any` — panggil `doGet` dan parse JSON response.
  - `extractFunctions(file: string, names: string[]) => object` — ambil deklarasi `function name(...) {...}` dari file frontend dan jalankan di vm; return konteks berisi fungsi tsb.
  - `samplePayload(extraMeta?: object) => object` (diekspor dari `tests/gas/smoke.test.js`).

- [ ] **Step 1: Buat `tests/helpers/gas-harness.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAS_FILE = path.join(__dirname, '..', '..', 'google-apps-script.js');

// Objek "permisif": method yang tidak didefinisikan mengembalikan dirinya sendiri
// (untuk chaining seperti range.setFontWeight().setBackground()).
function permissive(target) {
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => proxy;
    }
  });
  return proxy;
}

function makeSheet(name, rows) {
  const data = (rows || []).map(r => r.slice());
  const sheet = {
    _data: data,
    appended: [],
    deleted: [],
    setCalls: [],
    getName() { return name; },
    getLastRow() { return data.length; },
    getLastColumn() { return data.reduce((m, r) => Math.max(m, r.length), 0); },
    getDataRange() { return makeRange(1, 1, data.length, sheet.getLastColumn()); },
    getRange(r, c, nr, nc) { return makeRange(r, c, nr || 1, nc || 1); },
    appendRow(row) { data.push(row.slice()); sheet.appended.push(row.slice()); return proxy; },
    deleteRow(i) { data.splice(i - 1, 1); sheet.deleted.push(i); return proxy; }
  };
  function ensureRow(idx) { while (data.length <= idx) data.push([]); }
  function makeRange(r, c, nr, nc) {
    const range = {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = data[r - 1 + i] || [];
          const o = [];
          for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(o);
        }
        return out;
      },
      getValue() { return range.getValues()[0][0]; },
      setValue(v) { ensureRow(r - 1); data[r - 1][c - 1] = v; sheet.setCalls.push({ r, c, v }); return rp; },
      setValues(vals) {
        vals.forEach((row, i) => row.forEach((v, j) => {
          ensureRow(r - 1 + i);
          data[r - 1 + i][c - 1 + j] = v;
          sheet.setCalls.push({ r: r + i, c: c + j, v });
        }));
        return rp;
      }
    };
    const rp = permissive(range);
    return rp;
  }
  const proxy = permissive(sheet);
  return proxy;
}

function makeSpreadsheet(sheets) {
  const map = {};
  sheets.forEach(s => { map[s.getName()] = s; });
  return permissive({
    getSheetByName(n) { return map[n] || null; },
    insertSheet(n) { map[n] = makeSheet(n, []); return map[n]; }
  });
}

function loadGas(overrides) {
  const src = fs.readFileSync(GAS_FILE, 'utf8');
  const mail = [];
  const lockState = { busy: false, acquired: 0, released: 0 };
  const ctx = {
    console,
    Logger: { log() {} },
    Utilities: {
      formatDate() { return '2026-10-06 10:00:00'; },
      base64Decode(s) { return Array.from(Buffer.from(s, 'base64')); },
      newBlob(bytes, mime, name) { return { bytes, mime, name }; }
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput(text) { return { text, setMimeType() { return this; }, getContent() { return text; } }; }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() { if (lockState.busy) throw new Error('Lock timeout'); lockState.acquired++; },
          tryLock() { if (lockState.busy) return false; lockState.acquired++; return true; },
          releaseLock() { lockState.released++; },
          hasLock() { return true; }
        };
      }
    },
    GmailApp: { sendEmail(to, subject, body, options) { mail.push({ to, subject, body, options: options || {} }); } },
    MailApp: {
      sendEmail(arg) { mail.push({ to: arg.to, subject: arg.subject, body: '', options: { htmlBody: arg.htmlBody } }); },
      getRemainingDailyQuota() { return 100; }
    },
    DriveApp: { Access: {}, Permission: {} },
    MimeType: { PDF: 'application/pdf', ZIP: 'application/zip' },
    Session: { getActiveUser() { return { getEmail() { return 'tester@example.com'; } }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'google-apps-script.js' });

  const run = code => vm.runInContext(code, ctx);
  const headers = run('HEADERS');
  const sheet = makeSheet('Training Submissions', [headers.slice()]);
  const postHeaders = run('POST_TRAINING_HEADERS');
  const postSheet = makeSheet('Post Training', [postHeaders.slice()]);
  const ss = makeSpreadsheet([sheet, postSheet]);
  ctx.SpreadsheetApp = { getActiveSpreadsheet() { return ss; } };

  // Default: tidak ada efek samping eksternal saat test
  ctx.getApproverListForSubmission = () => ['approver@example.com'];
  ctx.bookMeetingRoom = () => ({ booked: false });
  ctx.createCalendarEvent = () => 'EVT-TEST';

  Object.assign(ctx, overrides || {});
  return { ctx, ss, sheet, postSheet, mail, lockState, run };
}

function postJson(ctx, payload) {
  const out = ctx.doPost({ postData: { contents: JSON.stringify(payload) }, parameter: {} });
  return JSON.parse(out.getContent());
}

function getJson(ctx, params) {
  const out = ctx.doGet({ parameter: params || {} });
  return JSON.parse(out.getContent());
}

module.exports = { loadGas, makeSheet, postJson, getJson };
```

- [ ] **Step 2: Buat `tests/helpers/extract-fn.js`**

```js
'use strict';
const fs = require('fs');
const vm = require('vm');

// Mengambil deklarasi `function name(...) { ... }` dari file frontend
// (file frontend butuh DOM, jadi tidak bisa di-load utuh).
function extractFunctions(file, names) {
  const src = fs.readFileSync(file, 'utf8');
  const chunks = names.map(name => {
    const start = src.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`function ${name} tidak ditemukan di ${file}`);
    let i = src.indexOf('{', start);
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
  });
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(chunks.join('\n'), ctx);
  return ctx;
}

module.exports = { extractFunctions };
```

- [ ] **Step 3: Buat smoke test `tests/gas/smoke.test.js`** (mengunci perilaku submit yang sekarang)

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');

function samplePayload(extraMeta) {
  return {
    status: 'Diajukan',
    meta: Object.assign({
      'ID training': 'TRN-20261006-WEB-HS',
      'Nama training': 'Workshop Golang',
      'Nama pengaju': 'Budi',
      'Email pengaju': 'budi@example.com',
      'Departemen / divisi': 'WEB DEVELOPER',
      'Tanggal & jam pelaksanaan': '2026-10-20, 09:00 - 15:00 WIB'
    }, extraMeta || {}),
    participants: [{ nama: 'Ani', email: 'ani@example.com', departemen: 'WEB DEVELOPER' }],
    modules: []
  };
}

test('submit baru menambah satu baris sesuai header', () => {
  const { ctx, sheet, run } = loadGas();
  const res = postJson(ctx, samplePayload());
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.id, 'TRN-20261006-WEB-HS');
  assert.strictEqual(sheet.appended.length, 1);
  const headers = run('HEADERS');
  const row = sheet.appended[0];
  assert.strictEqual(row[headers.indexOf('Nama Training')], 'Workshop Golang');
  assert.strictEqual(row[headers.indexOf('Status Dokumen')], 'Diajukan');
});

module.exports = { samplePayload };
```

- [ ] **Step 4: Tambah script test di `package.json`**

Ubah blok `scripts` menjadi:

```json
  "scripts": {
    "build": "node scripts/build.js",
    "watch": "node scripts/build.js --watch",
    "test": "node --test tests/"
  }
```

- [ ] **Step 5: Jalankan test**

Run: `npm test`
Expected: PASS — `submit baru menambah satu baris sesuai header` (0 fail). Jika gagal karena stub kurang (mis. `X is not defined`), tambahkan stub minimal ke `ctx` di `loadGas` — **jangan** ubah `google-apps-script.js` di task ini.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/gas-harness.js tests/helpers/extract-fn.js tests/gas/smoke.test.js package.json
git commit -m "test: add zero-dependency harness for Apps Script backend"
```

---

### Task 2: Hapus aksi `resetSheet` dari `doGet`

**Files:**
- Modify: `google-apps-script.js` ~baris 2806-2815 (blok "Aksi 4: Reset / Reformat Sheet")
- Test: `tests/gas/doget.test.js`

**Interfaces:**
- Consumes: `loadGas`, `getJson` (Task 1)
- Produces: `doGet` mengembalikan `{ error: "Aksi tidak dikenal" }` untuk `resetSheet` / `resetSheetHeaders` / `reformatSheet`. Fungsi `resetSheet()`, `resetSheetHeaders()`, `resetSheetHeadersToPreview()` tetap ada (dipakai menu Spreadsheet di baris 705).

Frontend tidak pernah memanggil `?action=resetSheet` (sudah dicek: `grep resetSheet js/ approval/ src/` kosong), jadi flow aman.

- [ ] **Step 1: Tulis test gagal `tests/gas/doget.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, getJson } = require('../helpers/gas-harness');

for (const action of ['resetSheet', 'resetSheetHeaders', 'reformatSheet']) {
  test(`doGet ?action=${action} tidak lagi me-reset sheet`, () => {
    let resetCalled = false;
    const { ctx } = loadGas();
    ctx.resetSheetHeadersToPreview = () => { resetCalled = true; };
    const res = getJson(ctx, { action });
    assert.strictEqual(resetCalled, false);
    assert.deepStrictEqual(res, { error: 'Aksi tidak dikenal' });
  });
}

test('doGet tanpa action tetap mengembalikan array submission', () => {
  const { ctx } = loadGas();
  const res = getJson(ctx, {});
  assert.ok(Array.isArray(res));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/doget.test.js`
Expected: FAIL pada 3 test reset (`resetCalled` true).

- [ ] **Step 3: Ganti blok "Aksi 4" di `doGet`** (diawali komentar `// Aksi 4: Reset / Reformat Sheet`) dengan:

```js
    // Aksi reset/reformat sheet TIDAK lagi tersedia via URL publik (bisa dipanggil siapa saja).
    // Gunakan menu Spreadsheet "Format / Reset Sheet" atau jalankan resetSheet() dari editor Apps Script.
    if (action === 'resetSheet' || action === 'resetSheetHeaders' || action === 'reformatSheet') {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Aksi tidak dikenal" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
```

- [ ] **Step 4: Jalankan test**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add google-apps-script.js tests/gas/doget.test.js
git commit -m "fix(gas): remove destructive resetSheet action from public doGet"
```

---

### Task 3: Whitelist status approval

**Files:**
- Modify: `google-apps-script.js` — tambah section "0. SECURITY HELPERS" setelah `];` penutup `HEADERS`; ubah awal `handleUpdateApproval` (~baris 345-354)
- Test: `tests/gas/approval-status.test.js`

**Interfaces:**
- Consumes: `loadGas`, `postJson`, `samplePayload` (Task 1)
- Produces: `normalizeApprovalStatus(raw: any) => "Disetujui" | "Ditolak" | ""` (global GAS). Juga membuat section `// 0. SECURITY HELPERS` yang dipakai Task 4-7.

Portal hanya mengirim `'Disetujui'` atau `'Ditolak'` (`approval/approval.js:231,236`). Saat ini status kosong otomatis dianggap `"Disetujui"` (`const status = data.status || "Disetujui";`) dan teks apa pun yang mengandung "setuju" dianggap approve.

- [ ] **Step 1: Tulis test gagal `tests/gas/approval-status.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');
const { samplePayload } = require('./smoke.test.js');

test('normalizeApprovalStatus hanya menerima nilai yang dikenal', () => {
  const { ctx } = loadGas();
  assert.strictEqual(ctx.normalizeApprovalStatus('Disetujui'), 'Disetujui');
  assert.strictEqual(ctx.normalizeApprovalStatus(' approved '), 'Disetujui');
  assert.strictEqual(ctx.normalizeApprovalStatus('Ditolak'), 'Ditolak');
  assert.strictEqual(ctx.normalizeApprovalStatus('REJECTED'), 'Ditolak');
  assert.strictEqual(ctx.normalizeApprovalStatus(''), '');
  assert.strictEqual(ctx.normalizeApprovalStatus(undefined), '');
  assert.strictEqual(ctx.normalizeApprovalStatus('tidak disetujui'), '');
  assert.strictEqual(ctx.normalizeApprovalStatus('<b>Disetujui</b>'), '');
});

test('update_approval tanpa status ditolak, sheet tidak berubah', () => {
  const { ctx, sheet } = loadGas();
  postJson(ctx, samplePayload());
  const before = JSON.stringify(sheet._data);
  const res = postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', approverName: 'X' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(JSON.stringify(sheet._data), before);
});

test('update_approval Ditolak tetap berjalan seperti sebelumnya', () => {
  const { ctx, sheet, run } = loadGas();
  postJson(ctx, samplePayload());
  const res = postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', status: 'Ditolak', approverName: 'Bos', notes: 'Budget' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'Ditolak');
  const headers = run('HEADERS');
  assert.strictEqual(sheet._data[1][headers.indexOf('Status Dokumen')], 'Ditolak');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/approval-status.test.js`
Expected: FAIL (`ctx.normalizeApprovalStatus is not a function`).

- [ ] **Step 3: Tambah section helper tepat setelah `];` penutup array `HEADERS` (~baris 97)**

```js

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
```

- [ ] **Step 4: Ubah awal `handleUpdateApproval`** — ganti baris

```js
  const status = data.status || "Disetujui";
```

dengan

```js
  const status = normalizeApprovalStatus(data.status);
```

lalu tepat setelah blok `if (!trainingId) { ... }` tambahkan:

```js
  if (!status) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Status approval tidak valid. Gunakan 'Disetujui' atau 'Ditolak'." })
    ).setMimeType(ContentService.MimeType.JSON);
  }
```

- [ ] **Step 5: Jalankan test**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add google-apps-script.js tests/gas/approval-status.test.js
git commit -m "fix(gas): only accept known approval statuses"
```

---

### Task 4: LockService untuk approval dan hapus

**Files:**
- Modify: `google-apps-script.js` — section SECURITY HELPERS; dispatch `update_approval` dan `delete_submission` di awal `doPost`
- Test: `tests/gas/lock.test.js`

**Interfaces:**
- Consumes: section SECURITY HELPERS (Task 3)
- Produces:
  - `const LOCK_TIMEOUT_MS = 30000;`
  - `withScriptLock(fn: () => TextOutput) => TextOutput` — kalau lock tidak didapat dalam 30 detik, return JSON `{ status: "error", success: false, message: "Server sedang sibuk ..." }` tanpa menjalankan `fn`; lock selalu dilepas (`finally`).

Yang di-lock hanya aksi yang membaca lalu mengubah baris yang sudah ada (`update_approval`, `delete_submission`), karena di situ race nyata terjadi (hapus baris salah, approve dobel memicu email/kalender dobel).

**Submit baru sengaja TIDAK di-lock:**
- Sejak commit `0e8c23c`, submit meng-upload berkas modul proposal (hingga 25 MB per file) ke Drive sebelum `appendRow`. Kalau di-lock, satu submit besar akan menahan lock lebih dari 30 detik, dan submit lain gagal. Karena frontend memakai `no-cors`, kegagalan itu tidak terlihat oleh user → pengajuan hilang diam-diam (flow berubah).
- ID training dibuat di browser, jadi lock di server tidak mencegah ID dobel (masuk Fase 2).
- `appendRow` sendiri sudah atomik.

Upload evidence/post-test/sharing juga **tidak** di-lock (alasan sama: upload Drive lama, isinya hanya `appendRow`).

- [ ] **Step 1: Tulis test gagal `tests/gas/lock.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');
const { samplePayload } = require('./smoke.test.js');

test('submit baru tidak memakai lock (tetap tersimpan walau lock sibuk)', () => {
  const { ctx, sheet, lockState } = loadGas();
  lockState.busy = true;
  const res = postJson(ctx, samplePayload());
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(sheet.appended.length, 1);
  assert.strictEqual(lockState.acquired, 0);
});

test('approval memakai lock dan melepasnya', () => {
  const { ctx, lockState } = loadGas();
  postJson(ctx, samplePayload());
  postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', status: 'Ditolak', approverName: 'Bos', notes: '-' });
  assert.strictEqual(lockState.acquired, 1);
  assert.strictEqual(lockState.released, 1);
});

test('lock sibuk: approval ditolak dan status tidak berubah', () => {
  const { ctx, sheet, lockState, run } = loadGas();
  postJson(ctx, samplePayload());
  lockState.busy = true;
  const res = postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', status: 'Ditolak', approverName: 'Bos', notes: '-' });
  assert.strictEqual(res.success, false);
  assert.match(res.message, /sibuk/);
  const headers = run('HEADERS');
  assert.strictEqual(sheet._data[1][headers.indexOf('Status Dokumen')], 'Diajukan');
});

test('lock sibuk: hapus tidak menghapus baris', () => {
  const { ctx, sheet, lockState } = loadGas();
  postJson(ctx, samplePayload());
  lockState.busy = true;
  const res = postJson(ctx, { action: 'delete_submission', id: 'TRN-20261006-WEB-HS' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(sheet.deleted.length, 0);
});

test('lock dilepas walau handler throw', () => {
  const { ctx, lockState } = loadGas();
  ctx.handleDeleteSubmission = () => { throw new Error('boom'); };
  const res = postJson(ctx, { action: 'delete_submission', id: 'X' });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(lockState.released, lockState.acquired);
});

test('upload evidence tidak memakai lock', () => {
  const { ctx, lockState } = loadGas();
  ctx.handlePostTrainingEvidence = () => ctx.ContentService.createTextOutput('{"success":true}');
  postJson(ctx, { action: 'submitPostTrainingEvidence' });
  assert.strictEqual(lockState.acquired, 0);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/lock.test.js`
Expected: FAIL (approval/hapus belum memakai lock; test "submit tidak memakai lock" sudah PASS).

- [ ] **Step 3: Tambah helper di akhir section SECURITY HELPERS**

```js

const LOCK_TIMEOUT_MS = 30000;

/**
 * Menjalankan fn di dalam script lock agar request bersamaan (submit, approval, hapus)
 * tidak saling menimpa baris / menghasilkan ID ganda.
 */
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
  } catch (lockErr) {
    Logger.log("Gagal mendapatkan lock: " + lockErr.toString());
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        success: false,
        message: "Server sedang sibuk memproses permintaan lain. Silakan coba lagi beberapa saat."
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 4: Ubah dispatch di `doPost`**

Ganti:

```js
    if (data.action === "update_approval") {
      return handleUpdateApproval(sheet, data);
    }
```

dengan:

```js
    if (data.action === "update_approval") {
      return withScriptLock(() => handleUpdateApproval(sheet, data));
    }
```

Ganti:

```js
      return handleDeleteSubmission(sheet, data);
```

dengan:

```js
      return withScriptLock(() => handleDeleteSubmission(sheet, data));
```

- [ ] **Step 5: Jalankan test**

Run: `npm test`
Expected: PASS semua (termasuk smoke test Task 1 — membuktikan submit tidak berubah).

- [ ] **Step 6: Commit**

```bash
git add google-apps-script.js tests/gas/lock.test.js
git commit -m "fix(gas): serialize approval and delete with LockService"
```

---

### Task 5: Cegah formula injection ke Sheets

**Files:**
- Modify: `google-apps-script.js` — section SECURITY HELPERS; blok submit baru di `doPost` (`sheet.appendRow(rowData)`), `handleUpdateApproval` (`setValue(approverName)`, `setValue(notes)`), `handlePostTrainingEvidence` / `handlePostTestSubmission` / `handleKnowledgeSharingSubmission` (`postSheet.appendRow(newRow)`, 3 tempat)
- Test: `tests/gas/sanitize-cell.test.js`

**Interfaces:**
- Consumes: section SECURITY HELPERS (Task 3)
- Produces: `sanitizeCell(value: any) => any`, `sanitizeRow(row: any[]) => any[]`

Aturan: string yang diawali `=`, `+`, `-`, `@`, tab, atau CR **dan** panjangnya > 1 **dan** bukan angka murni → diberi prefix `'` (Sheets menyimpannya sebagai teks; apostrof tidak tampil dan tidak ikut terbaca `getValues()`). Non-string dan `"-"` tidak disentuh.

- [ ] **Step 1: Tulis test gagal `tests/gas/sanitize-cell.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');
const { samplePayload } = require('./smoke.test.js');

test('sanitizeCell menetralkan formula', () => {
  const { ctx } = loadGas();
  assert.strictEqual(ctx.sanitizeCell('=IMPORTXML("http://x","//a")'), '\'=IMPORTXML("http://x","//a")');
  assert.strictEqual(ctx.sanitizeCell('+HYPERLINK("x")'), '\'+HYPERLINK("x")');
  assert.strictEqual(ctx.sanitizeCell('@SUM(A1)'), '\'@SUM(A1)');
  assert.strictEqual(ctx.sanitizeCell('-2+3+cmd'), '\'-2+3+cmd');
  assert.strictEqual(ctx.sanitizeCell('\t=1'), '\'\t=1');
});

test('sanitizeCell tidak mengubah nilai normal', () => {
  const { ctx } = loadGas();
  for (const v of ['-', 'Workshop Golang', '1. Ani <ani@x.com>', '-5', '+62812345', '12.5', '{"a":1}', '']) {
    assert.strictEqual(ctx.sanitizeCell(v), v);
  }
  assert.strictEqual(ctx.sanitizeCell(3), 3);
  assert.strictEqual(ctx.sanitizeCell(null), null);
});

test('submit menyimpan nama training berformula sebagai teks', () => {
  const { ctx, sheet, run } = loadGas();
  postJson(ctx, samplePayload({ 'Nama training': '=HYPERLINK("http://evil","klik")' }));
  const headers = run('HEADERS');
  assert.strictEqual(sheet.appended[0][headers.indexOf('Nama Training')], '\'=HYPERLINK("http://evil","klik")');
});

test('catatan approver berformula disimpan sebagai teks', () => {
  const { ctx, sheet, run } = loadGas();
  postJson(ctx, samplePayload());
  postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', status: 'Ditolak', approverName: '@Bos', notes: '=1+1' });
  const headers = run('HEADERS');
  assert.strictEqual(sheet._data[1][headers.indexOf('Catatan Approver')], '\'=1+1');
  assert.strictEqual(sheet._data[1][headers.indexOf('Approver')], '\'@Bos');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/sanitize-cell.test.js`
Expected: FAIL (`ctx.sanitizeCell is not a function`).

- [ ] **Step 3: Tambah helper di section SECURITY HELPERS**

```js

/**
 * Mencegah formula injection: teks dari pengguna yang diawali = + - @ (atau tab/CR)
 * disimpan sebagai teks biasa dengan prefix apostrof. Angka & placeholder "-" tidak disentuh.
 */
function sanitizeCell(value) {
  if (typeof value !== "string") return value;
  if (value.length > 1 && /^[=+\-@\t\r]/.test(value) && !/^[-+]?\d+([.,]\d+)?$/.test(value)) {
    return "'" + value;
  }
  return value;
}

function sanitizeRow(row) {
  return row.map(sanitizeCell);
}
```

- [ ] **Step 4: Pakai di titik tulis**

Di blok submit baru `doPost`, ganti `sheet.appendRow(rowData);` dengan:

```js
    sheet.appendRow(sanitizeRow(rowData));
```

Di `handleUpdateApproval`, ganti:

```js
    sheet.getRange(targetRowNum, colApprover + 1).setValue(approverName);
```

dengan:

```js
    sheet.getRange(targetRowNum, colApprover + 1).setValue(sanitizeCell(approverName));
```

dan ganti:

```js
    sheet.getRange(targetRowNum, colApprovalNotes + 1).setValue(notes);
```

dengan:

```js
    sheet.getRange(targetRowNum, colApprovalNotes + 1).setValue(sanitizeCell(notes));
```

Di ketiga handler post-training, ganti setiap `postSheet.appendRow(newRow);` dengan:

```js
    postSheet.appendRow(sanitizeRow(newRow));
```

Cek: `grep -n "appendRow(newRow)\|appendRow(rowData)" google-apps-script.js` harus kosong.

- [ ] **Step 5: Jalankan test**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add google-apps-script.js tests/gas/sanitize-cell.test.js
git commit -m "fix(gas): neutralize spreadsheet formula injection on writes"
```

---

### Task 6: Escape HTML di 6 template email

**Files:**
- Modify: `google-apps-script.js` — section SECURITY HELPERS; `sendRegistrationEmails`, `sendApprovalDecisionEmail`, `sendApproverNotification`, `checkAndSendApprovalReminders` (template di sekitar baris 1569), `sendReminderEmails`, `sendTrainingCompletionEmail`
- Test: `tests/gas/email-escape.test.js`

**Interfaces:**
- Produces: `esc(value: any) => string`, `safeUrl(value: any) => string`

**Aturan edit (berlaku untuk semua fungsi di task ini):**
1. Hanya ubah interpolasi `${...}` **di dalam** template literal `htmlBody` dan variabel penyusun fragmen HTML (`lokasiOrLink`, `silabusLink`, `actionBtnHtml`). **Jangan** ubah `subject`, `plainText`, `Logger.log`, maupun string status yang di-return.
2. Nilai teks dari pengguna/sheet → `${esc(x)}`.
3. Nilai di dalam `href="..."` / `src="..."` → `${safeUrl(x)}`.
4. Jangan escape variabel yang isinya HTML buatan kode sendiri (`actionBtnHtml`, `silabusLink`, `lokasiOrLink` saat disisipkan ke `htmlBody`), warna/style internal (`statusBadgeBg`, `statusTextColor`, `statusBoxBorder`, `statusBoxBg`, ternary `'&#9989;'`), konstanta (`LOGO_IMAGE_URL`, `APPROVAL_PORTAL_URL`), dan angka (`sentCount`, `diffDays`, `jmlPeserta`).

**Daftar interpolasi yang harus dibungkus per fungsi** (hasil `grep -oE '\$\{[^}]+\}'` per rentang fungsi):

| Fungsi | `esc(...)` | `safeUrl(...)` di href |
|---|---|---|
| `sendRegistrationEmails` | `trainingName`, `trainingId`, `trainer`, `recipientName`, `recipientEmail`, `jadwal`, `metode`, `platform`, `link` (teks anchor) | `link`, `meta["Link silabus materi"]` (2x), `meta["Link meeting online"]` |
| `sendApprovalDecisionEmail` | `trainingId`, `trainingName`, `approver`, `tanggalApproval`, `status.toUpperCase()`, `recipientName`, `pengaju`, `venue`, `trainer`, `rowObj["Jenis Training"] \|\| "Training Internal"`, `recipientEmail`, `metode`, `jadwal`, `firstValid.nama`, `departemen`, `catatan` (termasuk di dalam ternary `catatan !== '-' ? catatan : ...` → `catatan !== '-' ? esc(catatan) : ...`) | — |
| `sendApproverNotification` | `idTrn`, `trainingName`, `pengaju`, `jadwal`, `venue`, `trainer`, `totalBiaya`, `pengajuEmail`, `metode`, `meta["Jenis training"] \|\| "Training Internal"`, `deptName`, `deptName \|\| "-"` | `directApprovalLink` |
| `checkAndSendApprovalReminders` | `trainingId`, `trainingName`, `pengaju`, `deptName`, `jenisTraining`, `jadwal` | `directApprovalLink` |
| `sendReminderEmails` | sama dengan `sendRegistrationEmails` | sama dengan `sendRegistrationEmails` |
| `sendTrainingCompletionEmail` | `participantName` | `targetUrl` |

- [ ] **Step 1: Tulis test gagal `tests/gas/email-escape.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('../helpers/gas-harness');

const XSS = '<img src=x onerror=alert(1)>';
const meta = {
  'ID training': 'TRN-1',
  'Nama training': 'R&D ' + XSS,
  'Nama pengaju': "O'Brien",
  'Email pengaju': 'lead@example.com',
  'Departemen / divisi': 'WEB',
  'Tanggal & jam pelaksanaan': '2026-10-20, 09:00 - 15:00 WIB',
  'Trainer': XSS,
  'Metode training': 'Online',
  'Platform online': 'Zoom',
  'Link meeting online': 'javascript:alert(1)',
  'Link silabus materi': 'meet.google.com/abc-def'
};
const participants = [{ nama: XSS, email: 'ani@example.com', departemen: 'WEB' }];

function assertSafe(mailItem) {
  const html = mailItem.options.htmlBody;
  assert.ok(html, 'htmlBody harus ada');
  assert.ok(!html.includes('<img src=x'), 'tag dari input tidak boleh lolos');
  assert.ok(!/href="\s*javascript:/i.test(html), 'href javascript: tidak boleh ada');
}

test('esc dan safeUrl', () => {
  const { ctx } = loadGas();
  assert.strictEqual(ctx.esc(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.strictEqual(ctx.esc(null), '');
  assert.strictEqual(ctx.safeUrl('https://meet.google.com/a?b=1&c=2'), 'https://meet.google.com/a?b=1&amp;c=2');
  assert.strictEqual(ctx.safeUrl('meet.google.com/abc'), 'meet.google.com/abc');
  assert.strictEqual(ctx.safeUrl('javascript:alert(1)'), '');
  assert.strictEqual(ctx.safeUrl(' JaVa\tScript:alert(1)'), '');
  assert.strictEqual(ctx.safeUrl('data:text/html,x'), '');
  assert.strictEqual(ctx.safeUrl('vbscript:x'), '');
});

test('sendRegistrationEmails: html aman, subject tetap mentah', () => {
  const { ctx, mail } = loadGas();
  ctx.sendRegistrationEmails(meta, participants, []);
  assert.strictEqual(mail.length, 1);
  assertSafe(mail[0]);
  assert.ok(mail[0].subject.includes('R&D <img'), 'subject tidak di-escape');
  assert.ok(mail[0].options.htmlBody.includes('R&amp;D &lt;img'), 'teks tampil utuh, tidak double-escape');
  assert.ok(mail[0].options.htmlBody.includes('meet.google.com/abc-def'), 'link tanpa skema tetap ada');
});

test('sendReminderEmails: html aman', () => {
  const { ctx, mail } = loadGas();
  ctx.sendReminderEmails(meta, participants, [], new Date('2026-10-19'));
  assert.ok(mail.length >= 1);
  mail.forEach(assertSafe);
});

test('sendApproverNotification: html aman', () => {
  const { ctx, mail } = loadGas();
  ctx.sendApproverNotification(meta, participants, [], 'TRN-1');
  assert.ok(mail.length >= 1);
  mail.forEach(assertSafe);
  assert.ok(mail[0].options.htmlBody.includes('O&#39;Brien'));
});

test('sendApprovalDecisionEmail: html aman termasuk catatan approver', () => {
  const { ctx, mail } = loadGas();
  const rowObj = {
    'ID Training': 'TRN-1',
    'Nama Training': XSS,
    'Nama Pengaju': XSS,
    'Email Pengaju': 'lead@example.com',
    'Departemen / Divisi': XSS,
    'Raw Data JSON': JSON.stringify({ meta, participants })
  };
  ctx.sendApprovalDecisionEmail(rowObj, 'Ditolak', XSS, XSS);
  assert.strictEqual(mail.length, 1);
  assertSafe(mail[0]);
});

test('sendTrainingCompletionEmail: html aman', () => {
  const { ctx, mail } = loadGas();
  ctx.sendTrainingCompletionEmail(XSS, 'ani@example.com', 'javascript:alert(1)');
  assert.strictEqual(mail.length, 1);
  assertSafe(mail[0]);
});
```

Catatan: jika `sendReminderEmails` atau fungsi lain memanggil helper yang menyentuh layanan Google yang belum di-stub, stub helper tsb **di test** (`ctx.namaFungsi = () => ...`), bukan mengubah kode produksi. `checkAndSendApprovalReminders` tidak di-unit-test (membaca seluruh sheet + tanggal); diverifikasi lewat review grep di Step 6 dan checklist manual Task 9.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/email-escape.test.js`
Expected: FAIL (`ctx.esc is not a function`).

- [ ] **Step 3: Tambah helper di section SECURITY HELPERS**

```js

/**
 * Escape teks sebelum disisipkan ke HTML email.
 */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * URL aman untuk atribut href/src: buang skema berbahaya, lalu escape.
 * URL tanpa skema (mis. "meet.google.com/xyz") tetap dipertahankan seperti sebelumnya.
 */
function safeUrl(value) {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  const probe = raw.replace(/[\u0000- ]/g, "").toLowerCase();
  if (/^(javascript|data|vbscript|file):/.test(probe)) return "";
  return esc(raw);
}
```

- [ ] **Step 4: Terapkan di `sendRegistrationEmails` dan `sendReminderEmails`** (keduanya punya blok persiapan yang sama)

Ganti pembentukan `lokasiOrLink`:

```js
  let lokasiOrLink = esc(meta["Lokasi / venue"] || "-");
  if (metode === "Online" || metode === "Hybrid") {
    const platform = meta["Platform online"] || "Online";
    const link = meta["Link meeting online"] || "";
    lokasiOrLink = link ? `${esc(platform)} (<a href="${safeUrl(link)}" target="_blank">${esc(link)}</a>)` : esc(platform);
  }
```

Ganti `silabusLink`:

```js
  const silabusLink = meta["Link silabus materi"]
    ? `<a href="${safeUrl(meta["Link silabus materi"])}" target="_blank" style="color:#00178F;font-weight:600;text-decoration:underline;">Buka Silabus / Materi Pelatihan &rarr;</a>`
    : "-";
```

Di `actionBtnHtml` (hanya `sendRegistrationEmails`): `href="${meta["Link meeting online"]}"` → `href="${safeUrl(meta["Link meeting online"])}"` dan `href="${meta["Link silabus materi"]}"` → `href="${safeUrl(meta["Link silabus materi"])}"`.

Di dalam `htmlBody`: bungkus `trainingName`, `trainingId`, `trainer`, `recipientName`, `recipientEmail`, `jadwal`, `metode` dengan `esc(...)`. Biarkan `${lokasiOrLink}`, `${silabusLink}`, `${actionBtnHtml}` apa adanya.

- [ ] **Step 5: Terapkan di `sendApprovalDecisionEmail`, `sendApproverNotification`, `checkAndSendApprovalReminders`, `sendTrainingCompletionEmail`** sesuai tabel di atas (hanya di dalam `htmlBody`).

Contoh untuk satu baris di `sendApproverNotification`:

```js
            <td style="padding:11px 16px;border-bottom:1px solid #EDF1FE;font-size:13.5px;color:#4A4F8F;">${esc(pengaju)} (${esc(deptName)})</td>
```

dan tombol: `href="${directApprovalLink}"` → `href="${safeUrl(directApprovalLink)}"`.

Di `sendTrainingCompletionEmail`: `${participantName}` → `${esc(participantName)}`, `href="${targetUrl}"` → `href="${safeUrl(targetUrl)}"`.

- [ ] **Step 6: Verifikasi tidak ada yang terlewat**

Run: ``grep -n 'htmlBody = `' google-apps-script.js``

Untuk setiap `htmlBody` yang ditemukan (6 template + fragmen `actionBtnHtml`), baca template-nya dan pastikan setiap `${...}` termasuk salah satu kategori: dibungkus `esc(`/`safeUrl(`, variabel HTML internal (`lokasiOrLink`, `silabusLink`, `actionBtnHtml`), warna/style internal, konstanta, atau angka.

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add google-apps-script.js tests/gas/email-escape.test.js
git commit -m "fix(gas): escape user data in HTML email templates"
```

---

### Task 7: Validasi file upload (evidence, materi post-training, modul proposal)

**Files:**
- Modify: `google-apps-script.js` — section SECURITY HELPERS; `handlePostTrainingEvidence` loop foto (~baris 3505-3540) dan loop materi (~baris 3551-3585); blok "4. Proses Berkas Modul & Silabus Proposal" di submit baru `doPost` (~baris 230-275, loop `data.materials.forEach`)
- Test: `tests/gas/upload.test.js`

**Interfaces:**
- Produces:
  - `const UPLOAD_LIMITS = { photo: {...}, material: {...} }`
  - `getFileExtension(fileName: string) => string` (lowercase, tanpa titik, `""` jika tidak ada)
  - `sanitizeUploadFileName(fileName: any, fallback: string) => string`
  - `validateUploadFile(kind: "photo"|"material", fileName: string, mimeType: string, byteLength: number) => string` — `""` jika valid, selain itu alasan penolakan.

Batas **sama persis** dengan validasi frontend (`js/app.js:3148-3162` foto: MIME `image/jpeg|image/png|image/jpg` **atau** ekstensi `jpg|jpeg|png`, maks 5 MB; `js/app.js:3316-3328` materi: ekstensi `pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar`, maks 25 MB). File yang ditolak di-skip dan di-log, sama seperti perlakuan file yang gagal di-decode sekarang. Pengaturan sharing Drive **tidak** diubah di fase ini.

- [ ] **Step 1: Tulis test gagal `tests/gas/upload.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');

function fakeFolderSetup(ctx) {
  const created = [];
  const folder = {
    setSharing() {},
    getUrl() { return 'https://drive/folder'; },
    createFile(blob) {
      created.push(blob);
      return { getId() { return 'F' + created.length; }, getUrl() { return 'https://drive/f' + created.length; }, setSharing() {} };
    }
  };
  ctx.getEvidenceRootFolder = () => folder;
  ctx.getOrCreateSubFolder = () => folder;
  return created;
}

const b64 = n => Buffer.alloc(n, 1).toString('base64');

test('validateUploadFile mengikuti aturan frontend', () => {
  const { ctx } = loadGas();
  const MB = 1024 * 1024;
  assert.strictEqual(ctx.validateUploadFile('photo', 'a.JPG', '', 10), '');
  assert.strictEqual(ctx.validateUploadFile('photo', 'kamera', 'image/jpeg', 10), '');
  assert.notStrictEqual(ctx.validateUploadFile('photo', 'a.html', 'text/html', 10), '');
  assert.notStrictEqual(ctx.validateUploadFile('photo', 'a.png', 'image/png', 5 * MB + 1), '');
  assert.strictEqual(ctx.validateUploadFile('material', 'modul.PPTX', '', 25 * MB), '');
  assert.notStrictEqual(ctx.validateUploadFile('material', 'run.exe', '', 10), '');
  assert.notStrictEqual(ctx.validateUploadFile('material', 'big.pdf', '', 25 * MB + 1), '');
});

test('sanitizeUploadFileName membuang karakter path dan membatasi panjang', () => {
  const { ctx } = loadGas();
  assert.strictEqual(ctx.sanitizeUploadFileName('../a/b:c.png', 'x.jpg'), '.._a_b_c.png');
  assert.strictEqual(ctx.sanitizeUploadFileName('', 'x.jpg'), 'x.jpg');
  assert.strictEqual(ctx.sanitizeUploadFileName('a'.repeat(300) + '.pdf', 'x').length, 150);
});

test('upload: file valid disimpan, file berbahaya di-skip', () => {
  const { ctx } = loadGas();
  const created = fakeFolderSetup(ctx);
  const res = postJson(ctx, {
    action: 'submitPostTrainingEvidence',
    namaPeserta: 'Ani', divisi: 'WEB', namaTraining: 'Golang', kategori: 'Hard Skill',
    files: [
      { name: 'foto1.jpg', type: 'image/jpeg', base64: b64(10) },
      { name: 'evil.html', type: 'text/html', base64: b64(10) }
    ],
    materials: [
      { name: 'modul.pdf', base64: b64(10) },
      { name: 'virus.exe', base64: b64(10) }
    ]
  });
  assert.strictEqual(res.success, true);
  assert.deepStrictEqual(created.map(b => b.name), ['foto1.jpg', 'modul.pdf']);
});

test('submit baru: berkas modul proposal valid disimpan, file berbahaya di-skip', () => {
  const { ctx, sheet, run } = loadGas();
  const created = fakeFolderSetup(ctx);
  const payload = samplePayload();
  payload.materials = [
    { name: 'silabus.pdf', type: 'application/pdf', base64: b64(10) },
    { name: 'payload.exe', type: 'application/octet-stream', base64: b64(10) },
    { name: 'besar.pdf', type: 'application/pdf', base64: b64(25 * 1024 * 1024 + 1) }
  ];
  const res = postJson(ctx, payload);
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(created.map(b => b.name), ['silabus.pdf']);
  const headers = run('HEADERS');
  assert.match(String(sheet.appended[0][headers.indexOf('Modul & Materi (File/Link)')]), /silabus\.pdf/);
});
```

Tambahkan juga di bagian atas file test:

```js
const { samplePayload } = require('./smoke.test.js');
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/gas/upload.test.js`
Expected: FAIL (`ctx.validateUploadFile is not a function`).

- [ ] **Step 3: Tambah helper di section SECURITY HELPERS**

```js

// Batas upload — HARUS sama dengan validasi frontend di js/app.js (handleEvidenceFileSelect & handleMaterialFileSelect)
const UPLOAD_LIMITS = {
  photo: {
    maxBytes: 5 * 1024 * 1024,
    extensions: ["jpg", "jpeg", "png"],
    mimeTypes: ["image/jpeg", "image/png", "image/jpg"]
  },
  material: {
    maxBytes: 25 * 1024 * 1024,
    extensions: ["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "zip", "rar"],
    mimeTypes: []
  }
};

function getFileExtension(fileName) {
  const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function sanitizeUploadFileName(fileName, fallback) {
  const clean = String(fileName || "").trim().replace(/[\/\\:*?"<>|\u0000-\u001f]/g, "_").substring(0, 150);
  return clean || fallback;
}

/**
 * Mengembalikan "" jika file valid, atau alasan penolakan.
 */
function validateUploadFile(kind, fileName, mimeType, byteLength) {
  const rule = UPLOAD_LIMITS[kind];
  if (!rule) return "Jenis upload tidak dikenal";
  const ext = getFileExtension(fileName);
  const mime = String(mimeType || "").toLowerCase();
  const typeOk = rule.extensions.indexOf(ext) !== -1 || rule.mimeTypes.indexOf(mime) !== -1;
  if (!typeOk) return "Format file tidak diizinkan";
  if (byteLength > rule.maxBytes) return "Ukuran file melebihi batas";
  return "";
}
```

- [ ] **Step 4: Pakai di loop foto `handlePostTrainingEvidence`**

Ganti tiga baris:

```js
          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = (f.name || `dokumentasi_${idx + 1}.jpg`).toString().trim();
          const mimeType = f.type || (fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
```

dengan:

```js
          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = sanitizeUploadFileName(f.name, `dokumentasi_${idx + 1}.jpg`);
          const rejectReason = validateUploadFile("photo", fileName, f.type, decodedBytes.length);
          if (rejectReason) {
            Logger.log("File bukti ditolak (" + fileName + "): " + rejectReason);
            return;
          }
          const allowedPhotoMime = UPLOAD_LIMITS.photo.mimeTypes.indexOf(String(f.type || "").toLowerCase()) !== -1;
          const mimeType = allowedPhotoMime ? f.type : (fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
```

- [ ] **Step 5: Pakai di loop materi**

Ganti:

```js
          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = (m.name || `materi_${idx + 1}.pdf`).toString().trim();
```

dengan:

```js
          const decodedBytes = Utilities.base64Decode(cleanBase64);
          const fileName = sanitizeUploadFileName(m.name, `materi_${idx + 1}.pdf`);
          const rejectReason = validateUploadFile("material", fileName, m.type, decodedBytes.length);
          if (rejectReason) {
            Logger.log("File materi ditolak (" + fileName + "): " + rejectReason);
            return;
          }
```

- [ ] **Step 5b: Pakai di loop berkas modul proposal (submit baru di `doPost`)**

Di dalam blok `// 4. Proses Berkas Modul & Silabus Proposal ke Google Drive jika ada`, ganti:

```js
            const decodedBytes = Utilities.base64Decode(cleanBase64);
            const fileName = (m.name || `modul_${idx + 1}.pdf`).toString().trim();
```

dengan:

```js
            const decodedBytes = Utilities.base64Decode(cleanBase64);
            const fileName = sanitizeUploadFileName(m.name, `modul_${idx + 1}.pdf`);
            const rejectReason = validateUploadFile("material", fileName, m.type, decodedBytes.length);
            if (rejectReason) {
              Logger.log("Berkas modul proposal ditolak (" + fileName + "): " + rejectReason);
              return;
            }
```

Batasnya sama dengan validasi frontend Step 1 (`js/app.js`, `selectedProposalFiles`: 25 MB, ekstensi `pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar`).

- [ ] **Step 6: Jalankan test**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add google-apps-script.js tests/gas/upload.test.js
git commit -m "fix(gas): validate evidence and material uploads server-side"
```

---

### Task 8: Tutup XSS di portal approval

**Files:**
- Modify: `approval/approval.js` — tambah helper setelah `escapeHtml` (~baris 2164-2176); ubah `onclick` (~baris 758, 931, 953, 956, 2547, 2555, 2561, 2624, 2676 — temukan dengan grep di Step 4) dan `<img src>` (~baris 2548-2550, 2556, 2677). Nomor baris bergeser +4 sejak commit `0e8c23c` (gerbang PIN di `initAuth`).
- Test: `tests/frontend/approval-helpers.test.js`

**Interfaces:**
- Consumes: `extractFunctions` (Task 1), `escapeHtml` yang sudah ada di `approval/approval.js`
- Produces (global di `approval.js`):
  - `jsArg(value: any) => string` — argumen string aman untuk handler `onclick="fn(...)"`; menghasilkan `&quot;...&quot;` yang di-decode browser menjadi string literal JS.
  - `safeImageSrc(value: any) => string` — hanya `data:image/(png|jpeg|jpg|gif|webp);base64,...`, `https:`, `blob:`; selain itu `""`; hasilnya sudah di-escape untuk atribut.

- [ ] **Step 1: Tulis test gagal `tests/frontend/approval-helpers.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const vm = require('vm');
const { extractFunctions } = require('../helpers/extract-fn');

const FILE = path.join(__dirname, '..', '..', 'approval', 'approval.js');

function load() {
  return extractFunctions(FILE, ['escapeHtml', 'jsArg', 'safeImageSrc']);
}

// Simulasi browser: decode entity atribut lalu evaluasi argumen sebagai JS
function decodeAttr(s) {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

test('jsArg menghasilkan string JS yang tidak bisa keluar dari argumen', () => {
  const ctx = load();
  for (const id of ['TRN-20261006-WEB-HS', "x');alert(1);//", 'a"b\\c', '</script>']) {
    const attr = ctx.jsArg(id);
    assert.ok(!attr.includes("'") && !attr.includes('"') && !attr.includes('<'), 'aman di atribut');
    const evaluated = vm.runInNewContext(decodeAttr(attr));
    assert.strictEqual(evaluated, id);
  }
  assert.strictEqual(vm.runInNewContext(decodeAttr(ctx.jsArg(undefined))), '');
});

test('safeImageSrc hanya meloloskan sumber gambar aman', () => {
  const ctx = load();
  assert.strictEqual(ctx.safeImageSrc('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.strictEqual(ctx.safeImageSrc('https://drive.google.com/x?a=1&b=2'), 'https://drive.google.com/x?a=1&amp;b=2');
  assert.strictEqual(ctx.safeImageSrc('blob:https://app/123'), 'blob:https://app/123');
  assert.strictEqual(ctx.safeImageSrc('" onerror="alert(1)'), '');
  assert.strictEqual(ctx.safeImageSrc('javascript:alert(1)'), '');
  assert.strictEqual(ctx.safeImageSrc('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.strictEqual(ctx.safeImageSrc(null), '');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test tests/frontend/approval-helpers.test.js`
Expected: FAIL (`function jsArg tidak ditemukan`).

- [ ] **Step 3: Tambah helper tepat setelah fungsi `escapeHtml` di `approval/approval.js`**

```js

// Argumen string aman untuk inline handler onclick="fn(...)".
// JSON.stringify membuat literal JS valid, escapeHtml membuatnya aman di dalam atribut.
function jsArg(value) {
  return escapeHtml(JSON.stringify(String(value === null || value === undefined ? '' : value)));
}

// Hanya izinkan sumber gambar yang aman (data URL gambar, https, blob).
function safeImageSrc(value) {
  const src = String(value || '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return escapeHtml(src);
  if (/^(https:|blob:)/i.test(src)) return escapeHtml(src);
  return '';
}
```

- [ ] **Step 4: Ganti pola `onclick` di `approval/approval.js`**

Untuk setiap baris hasil:

```bash
grep -n "onclick=\"[^\"]*'\${escapeHtml(" approval/approval.js
```

ganti `'${escapeHtml(X)}'` (termasuk tanda kutip tunggal di luarnya) menjadi `${jsArg(X)}`. Contoh:

```js
onclick="openReviewModal('${escapeHtml(item.id)}')"
```

menjadi

```js
onclick="openReviewModal(${jsArg(item.id)})"
```

baris 927:

```js
<tr onclick="handleRowClick(event, ${jsArg(item.id)})">
```

baris 2672 (lightbox, dua argumen; URL yang tidak aman dikirim sebagai string kosong):

```js
<div class="evidence-gallery-item" onclick="openEvidenceLightbox(${jsArg(safeImageSrc(p.dataUrl || p.url) ? (p.dataUrl || p.url) : '')}, ${jsArg(p.name || `Foto ${i + 1}`)})">
```

Atribut `title="Hapus Pengajuan ${escapeHtml(item.id)}"` (baris 952) dibiarkan — sudah aman (konteks teks atribut, bukan JS). Baris 1410 (`dateStr` buatan kode sendiri) dibiarkan.

Setelah selesai, perintah ini harus tidak mengeluarkan baris apa pun:

```bash
grep -n "onclick=\"[^\"]*'\${escapeHtml(" approval/approval.js
```

- [ ] **Step 5: Ganti `<img src>` evidence**

Baris ~2548-2550 dan ~2556: `src="${photos[N].dataUrl}"` → `src="${safeImageSrc(photos[N].dataUrl)}"` (N = 0, 1, 2, lalu 0). Atribut `onerror` fallback dibiarkan (tetap berfungsi bila src kosong).

Baris ~2677: `src="${escapeHtml(p.dataUrl || p.url)}"` → `src="${safeImageSrc(p.dataUrl || p.url)}"`.

Cek fungsi `openEvidenceLightbox` (cari `function openEvidenceLightbox`): jika ia menyisipkan URL/nama lewat `innerHTML` dalam template string, bungkus URL dengan `safeImageSrc(...)` dan nama dengan `escapeHtml(...)`; jika sudah memakai properti DOM (`img.src =`, `textContent =`), biarkan.

- [ ] **Step 6: Jalankan test**

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add approval/approval.js tests/frontend/approval-helpers.test.js
git commit -m "fix(approval): escape onclick arguments and restrict evidence image sources"
```

---

### Task 9: Cache-bust, build, verifikasi manual, deploy GAS

**Files:**
- Modify: `src/index.template.html:10,17`, `approval/index.html:10,1200` (string `?v=20261005_v3` → `?v=20261006_sec1`)
- Generated: `index.html`, `training_internal_plan.html` (lewat `npm run build`)

- [ ] **Step 1: Naikkan versi cache-bust**

```bash
sed -i 's/?v=20261005_v3/?v=20261006_sec1/g' src/index.template.html approval/index.html
grep -rn "?v=20261005_v3" src/index.template.html approval/index.html
```

Expected: `grep` tidak mengeluarkan apa pun.

- [ ] **Step 2: Build & test**

Run: `npm run build && npm test`
Expected: build sukses (`index.html` & mirror ter-update), semua test PASS. `cmp index.html training_internal_plan.html` tidak mengeluarkan apa pun.

- [ ] **Step 3: Deploy GAS ke salinan/DEV dulu (manual, oleh user)**

1. Buka salinan Spreadsheet (File > Make a copy) → Extensions > Apps Script → tempel isi `google-apps-script.js` → Save.
2. Deploy > New deployment > Web app (Execute as: Me, Who has access: sama seperti produksi).
3. Untuk uji lokal, ganti sementara `GOOGLE_SCRIPT_URL` di `js/app.js:8` dan `approval/approval.js:12` ke URL dev (**jangan di-commit**).

- [ ] **Step 4: Checklist verifikasi manual (flow tidak berubah)**

Jalankan `serve.bat`, lalu:

- [ ] Ajukan training normal (nama berisi `R&D`, peserta `O'Brien`) → baris muncul di sheet, kolom tampil normal, email approver diterima dengan teks utuh.
- [ ] Ajukan training dengan nama `=1+1` → sel di sheet menampilkan teks `=1+1` (bukan `2`); di portal approval nama tampil `=1+1`.
- [ ] Nilai `-` dan nomor `+62...` di sheet tetap tampil sama seperti sebelumnya; portal approval membaca nilai tanpa apostrof.
- [ ] Ajukan training dengan lampiran modul (1 PDF + 1 PPTX) di Step 1 → file muncul di Drive folder "📁 Proposal Modul Training/<ID>", kolom "Modul & Materi (File/Link)" berisi nama + link file.
- [ ] Portal approval: login PIN di gerbang masih berfungsi seperti sebelumnya (tidak disentuh fase ini).
- [ ] Portal approval: klik kartu, baris tabel, tombol Review, Hapus → semua membuka/menjalankan aksi seperti sebelumnya.
- [ ] Approve satu pengajuan → status `Disetujui`, kalender & email peserta terkirim satu kali.
- [ ] Tolak satu pengajuan dengan catatan → email keputusan berisi catatan utuh.
- [ ] Jalankan `checkAndSendApprovalReminders` dari editor pada data uji → email reminder SLA tampil normal.
- [ ] Post-training: upload 2 foto JPG + 1 PDF → semua tersimpan di Drive; galeri evidence portal approval menampilkan foto & lightbox berfungsi.
- [ ] Buka `<URL_GAS_DEV>?action=resetSheet` → response `{"error":"Aksi tidak dikenal"}`, sheet tidak berubah. Menu Spreadsheet "Format / Reset Sheet" masih berfungsi.

- [ ] **Step 5: Deploy produksi (manual, oleh user)**

Tempel `google-apps-script.js` ke project Apps Script produksi → Deploy > Manage deployments > Edit (pensil) > Version: New version > Deploy (URL tetap sama). Kembalikan `GOOGLE_SCRIPT_URL` bila sempat diubah.

- [ ] **Step 6: Commit**

```bash
git add src/index.template.html approval/index.html index.html training_internal_plan.html
git commit -m "chore: bump asset cache-bust for security hardening release"
```
