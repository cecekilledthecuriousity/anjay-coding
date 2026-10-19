// scripts/render-stamps-to-png.js
// Renders SVG stamps to high-res transparent PNGs using headless Edge and native CDP
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const STAMPS_DIR = path.join(__dirname, '..', 'assets', 'stamps');
const STAMP_NAMES = [
  'stamp-completed',
  'stamp-verified',
  'stamp-hours',
  'stamp-achievement',
  'stamp-mastery'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('[CDP Renderer] Starting headless Edge on port 9334...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9334;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=400,400',
    'about:blank'
  ]);

  edgeProcess.on('error', (err) => {
    console.error('Failed to spawn Edge:', err);
    process.exit(1);
  });

  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    try {
      versionInfo = await fetchJson(`http://127.0.0.1:${port}/json/version`);
      if (versionInfo) break;
    } catch (e) {
      // Retry
    }
  }

  if (!versionInfo) {
    console.error('Edge CDP not responding.');
    edgeProcess.kill();
    process.exit(1);
  }

  const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const targetPage = pages.find(p => p.type === 'page') || pages[0];
  const wsUrl = targetPage.webSocketDebuggerUrl;

  console.log('[CDP Renderer] Connected to target page:', wsUrl);
  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  };

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 }
  });
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 400,
    height: 400,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Setup DOM structure once
  const initHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      background: transparent !important;
      width: 400px;
      height: 400px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #stage {
      width: 360px;
      height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: 360px;
      height: 360px;
      display: block;
    }
  </style>
</head>
<body>
  <div id="stage"></div>
</body>
</html>`;

  await sendCommand('Page.navigate', {
    url: `data:text/html;charset=utf-8,${encodeURIComponent(initHtml)}`
  });
  await sleep(400);

  for (const name of STAMP_NAMES) {
    const svgPath = path.join(STAMPS_DIR, `${name}.svg`);
    const svgContent = fs.readFileSync(svgPath, 'utf-8');

    // Inject SVG into stage via Runtime.evaluate
    await sendCommand('Runtime.evaluate', {
      expression: `document.getElementById('stage').innerHTML = ${JSON.stringify(svgContent)};`
    });

    await sleep(250);

    const screenshotResult = await sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false
    });

    const pngBuffer = Buffer.from(screenshotResult.data, 'base64');
    const pngPath = path.join(STAMPS_DIR, `${name}.png`);
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`[PNG Rendered] ${name}.png (${pngBuffer.length} bytes)`);
  }

  ws.close();
  edgeProcess.kill();
  console.log('[CDP Renderer] All 5 stamps successfully rendered to transparent PNG!');
}

main().catch((err) => {
  console.error('Fatal error during rendering:', err);
  process.exit(1);
});
