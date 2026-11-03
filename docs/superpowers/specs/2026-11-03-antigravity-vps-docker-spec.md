# Antigravity VPS Docker Integration Specification

**Date:** 2026-11-03  
**Status:** Approved  
**Author:** Antigravity  

## 1. Executive Summary
Transform the training program AI generator from a direct client-side Google Gemini API call to an internal server-side bridge running inside a Docker container on the user's VPS. The backend leverages the pre-installed and authenticated `agy` (Antigravity CLI) on the VPS host via volume mounts (`-v /home/production/.gemini:/root/.gemini` and `-v $(which agy):/usr/local/bin/agy`).

## 2. Requirements & Constraints
1. **Zero Gemini API Keys in Client**: Remove client-side requirement for Gemini API keys.
2. **Server-side Antigravity Execution**: A lightweight Node.js server (`server.js`) handles:
   - Serving static web assets (`index.html`, `training_internal_plan.html`, `css/`, `js/`, `approval/`, etc.).
   - Providing `POST /api/ai/generate-plan` and `POST /api/ai/studio` endpoints.
   - Executing `agy -p "<prompt>"` in a controlled child process.
3. **Resilient Fallback**: If the server or `agy` fails or times out, the client gracefully falls back to the built-in offline smart generator (`generateSmartPlanOffline` / `buildComprehensiveLdBlueprint`).
4. **Dockerization**:
   - `Dockerfile`: Minimal Node.js 20 alpine or slim base, non-root or root mapped to mounted `.gemini`.
   - `docker-compose.yml`: Pre-configured ports (e.g. 3000), volumes (`/home/production/.gemini` -> `/root/.gemini`, `agy` binary -> `/usr/local/bin/agy`), restart policy.
5. **No Git Push**: Do NOT perform any `git push` to GitHub or remote repositories. Keep changes local.
6. **Mirror Sync**: Ensure any UI changes or script references in `index.html` remain synchronized with `training_internal_plan.html`.

## 3. Architecture & Data Flow

```
[ Browser Client ]
       │
       │ POST /api/ai/generate-plan { topic, level, format, audience, issue, mode }
       ▼
[ Node.js Server (server.js) ]
       │
       │ child_process.execFile('agy', ['-p', structuredPrompt], { timeout: 60000 })
       │
       ├──► Volume Mount: /usr/local/bin/agy (Host binary)
       └──► Volume Mount: /root/.gemini (Host auth credentials)
       │
       │ Clean & parse JSON output from stdout
       ▼
[ JSON Response ] ──► [ Browser Form Wizard Auto-fill ]
```

## 4. Components

### 4.1 Server (`server.js`)
- Minimal dependency (pure Node.js standard libraries `http`, `fs`, `path`, `child_process`, or minimal micro-framework if needed, but vanilla Node `http` avoids extra `node_modules` weight).
- Endpoints:
  - `POST /api/ai/generate-plan`: Receives `{ topic, level, format }`, builds L&D curriculum prompt, invokes `agy -p`, parses and returns JSON.
  - `POST /api/ai/studio`: Receives `{ topic, level, format, audience, issue, mode }`, builds enterprise blueprint prompt, invokes `agy -p`, parses and returns JSON.
  - `GET /*`: Serves static files from current directory with proper MIME types.

### 4.2 Client Updates ([`js/app.js`](file:///C:/duta/tools_duta/anjay-coding/js/app.js))
- Update `executeAiGeneration`:
  - Directly calls `/api/ai/generate-plan`.
  - Catches errors and falls back to `generateSmartPlanOffline`.
- Update `generateStudioWithGeminiLive` / studio handler:
  - Calls `/api/ai/studio`.
  - Catches errors and falls back to `buildComprehensiveLdBlueprint`.
- Deprecate/remove the manual Gemini API key prompt from the UI while keeping the local storage clean.

### 4.3 Containerization
- `Dockerfile`:
  - Node.js runtime.
  - Installs runtime dependencies needed by `agy` (such as glibc/libstdc++ if alpine, or using `node:20-slim`/`node:20-bookworm-slim` for maximum binary compatibility with host Linux).
  - Copies project files.
  - Exposes port 3000.
  - CMD `["node", "server.js"]`.
- `docker-compose.yml`:
  - Maps host port `3000:3000`.
  - Mounts:
    - `/home/production/.gemini:/root/.gemini:ro`
    - `/usr/local/bin/agy:/usr/local/bin/agy:ro`
    - (Optionally project directory for live reload or static container).
- `.dockerignore`:
  - Excludes `.git`, `.gemini`, `node_modules`, `tests`, etc.

## 5. Verification & Testing
- Unit/integration test for `server.js` endpoint handling (mocking `agy` or testing static serving and endpoint response formatting).
- Syntax validation with `node -c server.js` and `node -c js/app.js`.
- Docker build test (`docker build -t rt-online .` if docker is available, or syntax verification of Dockerfile and docker-compose.yml).
- Browser UI consistency verification between `index.html` and `training_internal_plan.html`.
