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
  ctx.SpreadsheetApp = { getActiveSpreadsheet() { return ss; }, flush() {} };

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
