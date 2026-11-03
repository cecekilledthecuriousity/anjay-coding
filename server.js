/**
 * server.js - Antigravity Server & AI Bridge for Form Training TDS
 * Pure Node.js Standard Library implementation (http, fs, path, child_process).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.resolve(__dirname);
const AGY_BIN = process.env.AGY_BIN || 'agy';
const AGY_TIMEOUT_MS = parseInt(process.env.AGY_TIMEOUT_MS || '60000', 10);
const AGY_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// MIME types lookup table
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * Check if Antigravity CLI (agy) is available.
 */
function checkAgyAvailable() {
  if (process.env.MOCK_AGY === 'true') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    execFile(AGY_BIN, ['--version'], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Clean & extract pure JSON object from raw LLM / CLI output.
 */
function extractJsonFromOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from AI engine');
  }

  const trimmed = rawText.trim();

  // 1. Direct JSON parse attempt
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // 2. Extract markdown code fences: ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = codeBlockRegex.exec(trimmed);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (_) {}
  }

  // 3. Fallback: locate outermost JSON object brackets { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (err) {
      throw new Error(`Failed to parse extracted JSON candidate: ${err.message}`);
    }
  }

  throw new Error('Could not parse valid JSON from AI response: ' + trimmed.slice(0, 160));
}

/**
 * Prompt builder for Training Plan generation.
 */
function buildGeneratePlanPrompt(topic, level, format) {
  return `Anda adalah konsultan L&D (Learning & Development) korporat terkemuka.
Rancanglah rencana program pelatihan karyawan yang aplikatif dan profesional untuk:
Topik: "${topic}"
Target Level: ${level || 'Intermediate'}
Format: ${format || 'Workshop Tatap Muka'}

Output WAJIB berupa JSON murni tanpa markdown formatting, tanpa tanda kutip backtick, dengan struktur spesifik berikut:
{
  "namaTraining": "Nama Resmi Training",
  "kategoriUrgensi": "Kesenjangan Keterampilan",
  "goals": "Deskripsi tujuan SMART dan capaian yang jelas",
  "modules": [
    {
      "modul": "Sesi 1: Judul Sesi",
      "jamMulai": "09:00",
      "jamSelesai": "12:00",
      "durasi": "3 Jam",
      "metode": "Praktik / Workshop / Teori",
      "deskripsi": "Rincian materi yang dipelajari"
    }
  ],
  "hasilDiharapkan": "Kemampuan konkret yang dimiliki peserta",
  "penerapanPekerjaan": "Bagaimana kompetensi ini diterapkan di workflow tim sehari-hari",
  "indikatorKeberhasilan": "Target metrik keberhasilan kuantitatif & kualitatif"
}`;
}

/**
 * Prompt builder for Enterprise Studio L&D Blueprint.
 */
function buildStudioPrompt(topic, level, format, audience, issue, mode) {
  return `Anda adalah seorang Chief Learning Officer & Pakar Senior L&D Korporat.
Rancanglah cetak biru program L&D dan kurikulum pelatihan mendalam untuk konteks berikut:
Topik: "${topic}"
Target Level: ${level || 'Intermediate'}
Format: ${format || 'Workshop'}
Target Audiens: "${audience || 'Karyawan & Tim Terkait'}"
Masalah / Gejala Performa: "${issue || 'Kesenjangan keterampilan dan kebutuhan peningkatan efisiensi'}"
Fokus Mode Saat Ini: ${mode || 'comprehensive'}

Keluarkan HANYA JSON murni (tanpa tanda kutip backtick markdown) dengan skema berikut:
{
  "title": "${topic}",
  "level": "${level || 'Intermediate'}",
  "format": "${format || 'Workshop'}",
  "audience": "${audience || 'Karyawan & Tim Terkait'}",
  "summary": "Sasaran strategis & SMART goals yang tajam dan terukur",
  "tna": {
    "rootCause": "Analisis akar masalah 5-Whys mengapa kendala ini terjadi",
    "intervention": "Kombinasi intervensi (Pelatihan teknis, perbaikan SOP, atau tooling)",
    "roadmap": [
      { "tahap": "Tahap 1: Penguasaan Dasar", "durasi": "Minggu 1-2", "deskripsi": "Uraian tahap 1" },
      { "tahap": "Tahap 2: Simulasi Praktik", "durasi": "Minggu 3-4", "deskripsi": "Uraian tahap 2" },
      { "tahap": "Tahap 3: Pendampingan Kerja", "durasi": "Bulan ke-2", "deskripsi": "Uraian tahap 3" }
    ]
  },
  "modules": [
    {
      "modul": "Sesi 1: Judul Modul",
      "jamMulai": "09:00",
      "jamSelesai": "12:00",
      "durasi": "3 Jam",
      "metode": "Praktik / Workshop / Studi Kasus",
      "deskripsi": "Uraian materi mendalam dan aktivitas hands-on"
    }
  ],
  "ksa": {
    "knowledge": ["Point pengetahuan 1", "Point pengetahuan 2", "Point pengetahuan 3"],
    "skills": ["Point keterampilan 1", "Point keterampilan 2", "Point keterampilan 3"],
    "attitude": ["Point sikap kerja 1", "Point sikap kerja 2", "Point sikap kerja 3"]
  },
  "evaluation": {
    "level1": { "title": "Level 1: Reaksi & Kepuasan", "metric": "Survei CSAT", "target": "Target skor minimal 4.6/5.0" },
    "level2": { "title": "Level 2: Pembelajaran", "metric": "Pre-Test vs Post-Test", "target": "Peningkatan nilai rata-rata >= 35%" },
    "level3": { "title": "Level 3: Perilaku Kerja 30-Hari", "metric": "Observasi Supervisor Langsung", "target": "Penerapan SOP >= 85%" },
    "level4": { "title": "Level 4: Hasil Bisnis 90-Hari", "metric": "Metrik Performa Operasional", "target": "Efisiensi jam kerja & reduksi defect" },
    "roiProjection": {
      "participants": 10,
      "hoursSavedPerWeek": "4 Jam / Tim",
      "annualHoursSaved": "200 Jam / Tahun",
      "estimatedPayback": "2 Bulan"
    }
  },
  "quiz": [
    {
      "q": "1. Pertanyaan skenario kasus riil...",
      "options": ["A. Opsi A", "B. Opsi B", "C. Opsi C", "D. Opsi D"],
      "answer": "B",
      "explanation": "Alasan mengapa B benar..."
    }
  ]
}`;
}

/**
 * Fallback Mock Plan for testing & offline mode.
 */
function getMockPlan(topic, level, format) {
  return {
    namaTraining: `Program Pelatihan: ${topic}`,
    kategoriUrgensi: "Kesenjangan Keterampilan",
    goals: `Peserta mampu memahami konsep fundamental dan menguasai penerapan ${topic} pada level ${level || 'Intermediate'}.`,
    modules: [
      {
        modul: "Sesi 1: Fondasi & Konsep Utama",
        jamMulai: "09:00",
        jamSelesai: "12:00",
        durasi: "3 Jam",
        metode: format || "Praktik & Workshop",
        deskripsi: `Konsep dasar dan arsitektur ${topic} di lingkungan kerja.`
      },
      {
        modul: "Sesi 2: Implementasi & Studi Kasus",
        jamMulai: "13:00",
        jamSelesai: "16:00",
        durasi: "3 Jam",
        metode: "Praktik Langsung",
        deskripsi: `Simulasi hands-on problem solving dan praktik implementasi ${topic}.`
      }
    ],
    hasilDiharapkan: `Kemampuan mengimplementasikan ${topic} secara mandiri dan efisien.`,
    penerapanPekerjaan: "Diterapkan langsung ke proyek operasional tim dan workflow harian.",
    indikatorKeberhasilan: "Penyelesaian tugas tepat waktu dan peningkatan skor evaluasi pasca-training >= 85%."
  };
}

/**
 * Fallback Mock Studio blueprint.
 */
function getMockStudio(topic, level, format, audience, issue, mode) {
  return {
    title: topic,
    level: level || "Intermediate",
    format: format || "Workshop",
    audience: audience || "Karyawan & Tim Terkait",
    summary: `Sasaran strategis & SMART goals pengembangan kompetensi ${topic} untuk mengatasi kendala ${issue || 'kinerja'}.`,
    tna: {
      rootCause: `Analisis menunjukkan kendala disebabkan kurangnya standarisasi dan pemahaman teknis dalam ${topic}.`,
      intervention: "Pelatihan teknis terstruktur dikombinasikan dengan pendampingan mentor dan checklist SOP baru.",
      roadmap: [
        { tahap: "Tahap 1: Fondasi & Keterampilan Dasar", durasi: "Minggu 1-2", deskripsi: "Asesmen pre-test dan pelatihan intensif." },
        { tahap: "Tahap 2: Simulasi Praktik & Studi Kasus", durasi: "Minggu 3-4", deskripsi: "Pengerjaan proyek riil di bawah supervisi." },
        { tahap: "Tahap 3: Evaluasi Perilaku Kerja (30 Hari)", durasi: "Bulan ke-2", deskripsi: "Review capaian KPI operasional tim." }
      ]
    },
    modules: [
      {
        modul: `Sesi 1: Konsep Inti ${topic}`,
        jamMulai: "09:00",
        jamSelesai: "12:00",
        durasi: "3 Jam",
        metode: "Workshop & Simulasi",
        deskripsi: "Pemberian materi komprehensif dan diskusi interaktif."
      }
    ],
    ksa: {
      knowledge: [`Prinsip kerja ${topic}`, "Best practices industri", "Standar keamanan dan kualitas"],
      skills: ["Troubleshooting masalah teknis", "Eksekusi alur kerja efisien", "Penyusunan dokumentasi"],
      attitude: ["Disiplin prosedur", "Proaktif menyelesaikan kendala", "Kolaborasi lintas tim"]
    },
    evaluation: {
      level1: { title: "Level 1: Reaksi & Kepuasan", metric: "Survei CSAT", target: "Target skor minimal 4.6/5.0" },
      level2: { title: "Level 2: Pembelajaran", metric: "Pre-Test vs Post-Test", target: "Peningkatan nilai rata-rata >= 35%" },
      level3: { title: "Level 3: Perilaku Kerja 30-Hari", metric: "Observasi Supervisor Langsung", target: "Penerapan SOP >= 85%" },
      level4: { title: "Level 4: Hasil Bisnis 90-Hari", metric: "Metrik Performa Operasional", target: "Efisiensi jam kerja & reduksi defect" },
      roiProjection: {
        participants: 10,
        hoursSavedPerWeek: "4 Jam / Tim",
        annualHoursSaved: "200 Jam / Tahun",
        estimatedPayback: "2 Bulan"
      }
    },
    quiz: [
      {
        q: `Apa langkah utama dalam menerapkan ${topic}?`,
        options: ["A. Analisis kebutuhan", "B. Langsung eksekusi tanpa perencanaan", "C. Menghindari evaluasi", "D. Mengabaikan SOP"],
        answer: "A",
        explanation: "Analisis kebutuhan memastikan intervensi tepat sasaran."
      }
    ]
  };
}

/**
 * Execute agy prompt with graceful fallback.
 */
function runAgyPrompt(prompt, mockFallbackFn) {
  if (process.env.MOCK_AGY === 'true' && typeof mockFallbackFn === 'function') {
    return Promise.resolve(mockFallbackFn());
  }

  return new Promise((resolve, reject) => {
    execFile(
      AGY_BIN,
      ['-p', prompt],
      { timeout: AGY_TIMEOUT_MS, maxBuffer: AGY_MAX_BUFFER },
      (error, stdout, stderr) => {
        if (error) {
          if (process.env.MOCK_AGY === 'true' && typeof mockFallbackFn === 'function') {
            return resolve(mockFallbackFn());
          }
          return reject(new Error(`Antigravity CLI error: ${error.message}${stderr ? ' | ' + stderr.trim() : ''}`));
        }

        try {
          const parsed = extractJsonFromOutput(stdout);
          resolve(parsed);
        } catch (parseErr) {
          if (process.env.MOCK_AGY === 'true' && typeof mockFallbackFn === 'function') {
            return resolve(mockFallbackFn());
          }
          reject(parseErr);
        }
      }
    );
  });
}

/**
 * Read and parse incoming JSON payload from request stream.
 */
function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        return resolve({});
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Serve static files from root workspace directory.
 */
function serveStaticFile(req, res, pathname) {
  let cleanPath = pathname;
  if (cleanPath === '/' || cleanPath === '') {
    cleanPath = '/index.html';
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(cleanPath);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Bad Request: Malformed URI' }));
  }

  const targetPath = path.normalize(path.join(PUBLIC_DIR, decodedPath));
  const rel = path.relative(PUBLIC_DIR, targetPath);

  // Anti-traversal guard
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  fs.stat(targetPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`404 Not Found: ${cleanPath}`);
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(targetPath, 'index.html');
      fs.stat(indexPath, (idxErr, idxStats) => {
        if (idxErr || !idxStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end(`404 Not Found: Directory index missing for ${cleanPath}`);
        }
        streamFile(res, indexPath);
      });
      return;
    }

    streamFile(res, targetPath);
  });
}

function streamFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600'
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read file' }));
    }
  });
  stream.pipe(res);
}

/**
 * Master Request Handler.
 */
async function requestHandler(req, res) {
  try {
    // Common CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const rawPath = (req.url || '/').split('?')[0];
    let pathname = rawPath;
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      pathname = url.pathname;
    } catch (_) {}

    // 1. GET /health
    if (req.method === 'GET' && pathname === '/health') {
      const agyAvailable = await checkAgyAvailable();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        agyAvailable,
        timestamp: new Date().toISOString()
      }));
    }

    // 2. POST /api/ai/generate-plan
    if (req.method === 'POST' && pathname === '/api/ai/generate-plan') {
      try {
        const body = await readJsonBody(req);
        const { topic, level, format } = body;

        if (!topic || typeof topic !== 'string' || !topic.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Topic is required and must be a non-empty string'
          }));
        }

        const prompt = buildGeneratePlanPrompt(topic.trim(), level, format);
        const plan = await runAgyPrompt(prompt, () => getMockPlan(topic.trim(), level, format));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          plan,
          data: plan
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: err.message || 'AI Plan generation failed'
        }));
      }
    }

    // 3. POST /api/ai/studio
    if (req.method === 'POST' && pathname === '/api/ai/studio') {
      try {
        const body = await readJsonBody(req);
        const { topic, level, format, audience, issue, mode } = body;

        if (!topic || typeof topic !== 'string' || !topic.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Topic is required and must be a non-empty string'
          }));
        }

        const prompt = buildStudioPrompt(topic.trim(), level, format, audience, issue, mode);
        const blueprint = await runAgyPrompt(prompt, () => getMockStudio(topic.trim(), level, format, audience, issue, mode));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          data: blueprint,
          plan: blueprint
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: err.message || 'AI Studio blueprint generation failed'
        }));
      }
    }

    // 4. GET /* (Static file server)
    if (req.method === 'GET') {
      return serveStaticFile(req, res, rawPath);
    }

    // 5. Default 405 Method Not Allowed
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
  }
}

/**
 * Factory and server start helpers.
 */
function createServer() {
  return http.createServer(requestHandler);
}

function startServer(port = PORT, host = '0.0.0.0') {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, port: actualPort });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer(PORT).then(({ port }) => {
    console.log(`[TDS Antigravity Server] Running on http://0.0.0.0:${port}`);
  }).catch((err) => {
    console.error('[TDS Antigravity Server] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = {
  createServer,
  startServer,
  requestHandler,
  checkAgyAvailable,
  extractJsonFromOutput,
  buildGeneratePlanPrompt,
  buildStudioPrompt,
  getMockPlan,
  getMockStudio,
  MIME_TYPES
};
