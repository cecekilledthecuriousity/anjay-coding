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
