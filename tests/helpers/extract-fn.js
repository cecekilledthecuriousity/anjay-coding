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
