#!/usr/bin/env node
/**
 * Static HTML Assembler for Training & Development System (TDS)
 * Compiles modular components in src/ into root index.html and training_internal_plan.html.
 * Works without external npm dependencies (Zero-Dependency Node.js).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const TEMPLATE_FILE = path.join(SRC_DIR, 'index.template.html');
const TARGET_INDEX = path.join(ROOT_DIR, 'index.html');
const TARGET_MIRROR = path.join(ROOT_DIR, 'training_internal_plan.html');

function assembleTemplate(templatePath, srcBaseDir) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  const includeRegex = /<!--\s*@@include\(['"]([^'"]+)['"]\)\s*-->/g;

  let depth = 0;
  const maxDepth = 10; // Supports up to 10 levels of nested includes

  while (includeRegex.test(content)) {
    depth++;
    if (depth > maxDepth) {
      throw new Error('Too many recursive includes (possible circular include detected).');
    }

    content = content.replace(includeRegex, (match, includeRelPath) => {
      const normalizedPath = includeRelPath.split('/').join(path.sep);
      const includeFullPath = path.join(srcBaseDir, normalizedPath);

      if (!fs.existsSync(includeFullPath)) {
        throw new Error(`Included partial file not found: ${includeFullPath} (referenced in template)`);
      }

      return fs.readFileSync(includeFullPath, 'utf8');
    });
  }

  return content;
}

function build() {
  const startTime = Date.now();
  console.log('[TDS Build] Starting assembly from src/index.template.html...');

  try {
    const assembledHtml = assembleTemplate(TEMPLATE_FILE, SRC_DIR);

    // Write to index.html
    fs.writeFileSync(TARGET_INDEX, assembledHtml, 'utf8');
    // Write to mirror training_internal_plan.html
    fs.writeFileSync(TARGET_MIRROR, assembledHtml, 'utf8');

    const duration = Date.now() - startTime;
    const stats = fs.statSync(TARGET_INDEX);
    console.log(`[TDS Build] Success in ${duration}ms!`);
    console.log(`  -> index.html (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log(`  -> training_internal_plan.html (Mirrored)`);
  } catch (err) {
    console.error(`[TDS Build Error] ${err.message}`);
    process.exit(1);
  }
}

// Watch mode support
if (process.argv.includes('--watch')) {
  build();
  console.log('[TDS Build] Watching src/ for changes... Press Ctrl+C to exit.');
  let debounceTimeout = null;

  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      console.log(`[TDS Build] Detected change in ${filename}, rebuilding...`);
      build();
    }, 100);
  });
} else {
  build();
}
