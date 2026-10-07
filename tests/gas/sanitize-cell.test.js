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
