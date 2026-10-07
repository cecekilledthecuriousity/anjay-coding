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
