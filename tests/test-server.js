/**
 * tests/test-server.js - Comprehensive test suite for Antigravity server.js
 */

const assert = require('assert');
const path = require('path');
const http = require('http');

// Ensure MOCK_AGY is active for test stability
process.env.MOCK_AGY = 'true';

const {
  startServer,
  extractJsonFromOutput,
  buildGeneratePlanPrompt,
  buildStudioPrompt
} = require('../server.js');

async function runTests() {
  console.log('🧪 Starting Antigravity TDS Server Test Suite...\n');
  let testsPassed = 0;
  let testsTotal = 0;

  function test(name, fn) {
    testsTotal++;
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  ✅ [PASS] ${name}`);
        testsPassed++;
      })
      .catch((err) => {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(err);
        throw err;
      });
  }

  // Unit tests: JSON extraction
  await test('extractJsonFromOutput: parses direct JSON', () => {
    const raw = '{"hello":"world"}';
    const res = extractJsonFromOutput(raw);
    assert.deepStrictEqual(res, { hello: 'world' });
  });

  await test('extractJsonFromOutput: extracts markdown fenced json block', () => {
    const raw = '```json\n{"status":"success","code":200}\n```';
    const res = extractJsonFromOutput(raw);
    assert.deepStrictEqual(res, { status: 'success', code: 200 });
  });

  await test('extractJsonFromOutput: extracts json embedded within conversational text', () => {
    const raw = 'Here is the generated output:\n```\n{"plan":"Golang Mastery"}\n```\nHope that helps!';
    const res = extractJsonFromOutput(raw);
    assert.deepStrictEqual(res, { plan: 'Golang Mastery' });
  });

  await test('extractJsonFromOutput: extracts json via outermost braces fallback', () => {
    const raw = 'Leading chatter {"key":"value","items":[1,2,3]} trailing chatter';
    const res = extractJsonFromOutput(raw);
    assert.deepStrictEqual(res, { key: 'value', items: [1, 2, 3] });
  });

  // Start ephemeral server
  console.log('\n🚀 Starting test HTTP server on ephemeral port...');
  const { server, port } = await startServer(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`   Running at ${baseUrl}\n`);

  try {
    // 1. GET /health
    await test('GET /health returns 200 with status: "ok" and agyAvailable', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
      assert.strictEqual(typeof data.agyAvailable, 'boolean');
      assert.strictEqual(data.agyAvailable, true);
      assert.ok(data.timestamp);
    });

    // 2. GET /index.html
    await test('GET /index.html returns 200 with text/html Content-Type', async () => {
      const res = await fetch(`${baseUrl}/index.html`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      const text = await res.text();
      assert.ok(text.length > 500);
      assert.ok(text.includes('<!DOCTYPE html>') || text.includes('<html'));
    });

    // 3. GET / (root path defaults to index.html)
    await test('GET / root path returns 200 index.html', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
    });

    // 3b. GET /approval redirects to /approval/ (directory trailing slash redirect)
    await test('GET /approval redirects to /approval/ with 301', async () => {
      const res = await fetch(`${baseUrl}/approval`, { redirect: 'manual' });
      assert.strictEqual(res.status, 301);
      assert.strictEqual(res.headers.get('location'), '/approval/');
    });

    // 3c. GET /approval/ serves approval/index.html
    await test('GET /approval/ returns 200 approval index.html', async () => {
      const res = await fetch(`${baseUrl}/approval/`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      const text = await res.text();
      assert.ok(text.includes('Portal Approval Training'));
    });

    // 3d. GET /approval.js fallback alias serves approval/approval.js
    await test('GET /approval.js serves approval.js via fallback alias', async () => {
      const res = await fetch(`${baseUrl}/approval.js`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/javascript/);
      const text = await res.text();
      assert.ok(text.includes('DEFAULT_ADMIN_PIN'));
    });

    // Helper for raw HTTP requests bypassing client-side URL normalization
    function rawGet(reqPath) {
      return new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: reqPath }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on('error', reject);
      });
    }

    // 4. GET 404 for nonexistent file
    await test('GET nonexistent path returns 404', async () => {
      const res = await fetch(`${baseUrl}/nonexistent-test-file-999.xyz`);
      assert.strictEqual(res.status, 404);
    });

    // 4a. Directory traversal security checks
    await test('GET /../package.json returns 403 Forbidden', async () => {
      const res = await rawGet('/../package.json');
      assert.strictEqual(res.status, 403);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.error, 'Forbidden');
    });

    await test('GET /%2e%2e returns 403 Forbidden', async () => {
      const res = await rawGet('/%2e%2e');
      assert.strictEqual(res.status, 403);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.error, 'Forbidden');
    });

    // 4b. Malformed URI check & resilience
    await test('GET /%c0%af returns 400 Bad Request and server stays alive', async () => {
      const res = await fetch(`${baseUrl}/%c0%af`);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Malformed URI/i);

      // Verify server is resilient and alive for subsequent requests
      const health = await fetch(`${baseUrl}/health`);
      assert.strictEqual(health.status, 200);
    });

    // 5. POST /api/ai/generate-plan with empty body -> 400
    await test('POST /api/ai/generate-plan with empty payload returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/ai/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Topic is required/i);
    });

    // 5b. POST /api/ai/studio with empty payload -> 400
    await test('POST /api/ai/studio with empty payload returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/ai/studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Topic is required/i);
    });

    // 6. POST /api/ai/generate-plan with valid payload -> 200 with plan
    await test('POST /api/ai/generate-plan with valid body returns 200 with structured plan', async () => {
      const res = await fetch(`${baseUrl}/api/ai/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Mastering Docker & Microservices',
          level: 'Advanced',
          format: 'Workshop Praktik'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.plan);
      assert.ok(data.plan.namaTraining);
      assert.ok(Array.isArray(data.plan.modules));
      assert.ok(data.plan.modules.length > 0);
      assert.ok(data.plan.goals);
      assert.ok(data.plan.indikatorKeberhasilan);
    });

    // 7. POST /api/ai/studio with valid body -> 200 with enterprise blueprint
    await test('POST /api/ai/studio returns 200 with enterprise blueprint', async () => {
      const res = await fetch(`${baseUrl}/api/ai/studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'High Reliability Engineering',
          level: 'Intermediate',
          format: 'Hybrid Bootcamp',
          audience: 'DevOps & SRE Team',
          issue: 'Incident resolution time MTTR is too long',
          mode: 'comprehensive'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data);
      assert.strictEqual(data.data.title, 'High Reliability Engineering');
      assert.ok(data.data.tna);
      assert.ok(data.data.tna.rootCause);
      assert.ok(Array.isArray(data.data.modules));
      assert.ok(data.data.evaluation);
    });

    // 8. CORS preflight OPTIONS request
    await test('OPTIONS request returns 204 with CORS headers', async () => {
      const res = await fetch(`${baseUrl}/api/ai/generate-plan`, {
        method: 'OPTIONS'
      });
      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
      assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    });

  } finally {
    console.log('\n🛑 Closing test server...');
    await new Promise((resolve) => server.close(resolve));
    console.log('   Server closed cleanly.');
  }

  console.log(`\n========================================`);
  console.log(`🎉 All ${testsPassed}/${testsTotal} tests passed successfully!`);
  console.log(`========================================\n`);
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
