'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadGas, postJson } = require('../helpers/gas-harness');
const { samplePayload } = require('./smoke.test.js');

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
