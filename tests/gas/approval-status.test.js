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
