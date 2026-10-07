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
