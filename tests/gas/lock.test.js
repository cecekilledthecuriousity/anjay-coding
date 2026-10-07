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

test('approval melepas lock sebelum kirim email & booking kalender', () => {
  const { ctx, lockState } = loadGas();
  postJson(ctx, samplePayload());
  const heldDuring = [];
  const held = () => lockState.acquired - lockState.released;
  ctx.bookMeetingRoom = () => { heldDuring.push(held()); return { booked: false }; };
  ctx.createCalendarEvent = () => { heldDuring.push(held()); return 'EVT-1'; };
  ctx.sendRegistrationEmails = () => { heldDuring.push(held()); return 'Terkirim (1/1)'; };
  ctx.sendApprovalDecisionEmail = () => { heldDuring.push(held()); return 'Terkirim'; };
  const res = postJson(ctx, { action: 'update_approval', id: 'TRN-20261006-WEB-HS', status: 'Disetujui', approverName: 'Bos', notes: '-' });
  assert.strictEqual(res.success, true);
  assert.ok(heldDuring.length >= 3, 'efek samping dipanggil');
  assert.deepStrictEqual(heldDuring.filter(h => h !== 0), [], 'lock tidak boleh dipegang saat efek samping');
  assert.strictEqual(lockState.released, lockState.acquired);
});
