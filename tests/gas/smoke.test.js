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
