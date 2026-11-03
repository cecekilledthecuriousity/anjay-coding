# Antigravity VPS Docker Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AI course generation from client-side Gemini API calls to a server-side bridge running via Docker on VPS using mounted Antigravity (`agy`).

**Architecture:** A lightweight pure Node.js HTTP server (`server.js`) serves static assets and provides `/api/ai/*` endpoints that trigger `agy -p "<prompt>"` in a child process. Dockerfile and docker-compose.yml mount host binary and credentials. Client gracefully falls back to offline engine on failure.

**Tech Stack:** Node.js (Standard library `http`, `child_process`, `fs`, `path`), Docker & Docker Compose, Vanilla ES6+ JS.

**Spec:** `docs/superpowers/specs/2026-11-03-antigravity-vps-docker-spec.md`

## Global Constraints
- Zero external npm runtime dependencies (use Node standard library in `server.js` for lightweight, zero-maintenance container).
- Do NOT perform `git push` to GitHub or remote repositories (strictly follow user instruction).
- Maintain mirror synchronization between `index.html` and `training_internal_plan.html`.
- Maintain graceful fallback in frontend (`generateSmartPlanOffline`) if backend is unreachable.

---

### Task 1: Create `server.js` with Static File Serving & Antigravity AI Bridge

**Files:**
- Create: `server.js`
- Test: `tests/test-server.js`

**Interfaces:**
- Produces:
  - `POST /api/ai/generate-plan`: accepts `{ topic, level, format }`, runs `agy -p`, returns `{ success: true, data: { ... } }`.
  - `POST /api/ai/studio`: accepts `{ topic, level, format, audience, issue, mode }`, runs `agy -p`, returns `{ success: true, data: { ... } }`.
  - `GET /health`: returns `{ status: "ok", agyAvailable: boolean }`.
  - `GET /*`: static file server with correct MIME types.

- [x] **Step 1: Write integration tests in `tests/test-server.js`**
  - Verify static file serving (`/index.html` returns 200 and html MIME).
  - Verify `/health` endpoint.
  - Verify `/api/ai/generate-plan` rejects invalid payloads and parses mocked/live `agy` responses.
- [x] **Step 2: Implement `server.js` using Node.js standard libraries**
  - Robust child_process handler for `agy -p` with timeout (60s) and buffer size.
  - JSON cleaner regex to extract pure JSON from `agy` markdown formatting.
  - Clean static file router for `.html`, `.css`, `.js`, `.svg`, `.png`, `.json`.
- [x] **Step 3: Run tests to verify `server.js` functionality**
  - Run `node tests/test-server.js` and verify passing.
- [x] **Step 4: Validate syntax**
  - Run `node -c server.js`.

---

### Task 2: Update Frontend AI Generator to Use Backend Bridge

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `training_internal_plan.html`

**Interfaces:**
- Consumes: `POST /api/ai/generate-plan` and `POST /api/ai/studio`.
- Produces: Seamless autofill into form wizard steps 1 & 2 without requiring manual API Key entry.

- [x] **Step 1: Refactor `executeAiGeneration` in `js/app.js`**
  - Change call from `generateWithGeminiLive` to call `/api/ai/generate-plan`.
  - Keep automatic fallback to `generateSmartPlanOffline(topic, level, format)` if fetch fails.
- [x] **Step 2: Refactor `generateStudioWithGeminiLive` in `js/app.js`**
  - Change call to `/api/ai/studio`.
  - Keep automatic fallback to `buildComprehensiveLdBlueprint(...)`.
- [x] **Step 3: Update Modal UI in `index.html` and `training_internal_plan.html`**
  - Remove manual API Key input elements or update status badge to "Antigravity Server AI Engine".
  - Ensure `index.html` and `training_internal_plan.html` remain 100% mirrored.
- [x] **Step 4: Validate JavaScript syntax**
  - Run `node -c js/app.js`.

---

### Task 3: Create Docker & Docker-Compose Configuration

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Produces: Ready-to-deploy Docker environment for VPS mounting `/home/production/.gemini` and `/usr/local/bin/agy`.

- [x] **Step 1: Create `Dockerfile`**
  - Base: `node:20-bookworm-slim` (ensures glibc and binary compatibility with host Linux CLI).
  - Copy app files, expose port 3000.
  - Set `NODE_ENV=production`.
  - Entrypoint: `node server.js`.
- [x] **Step 2: Create `docker-compose.yml`**
  - Service `rt-online`:
    - Build `.`
    - Ports: `3000:3000`
    - Volumes:
      - `/home/production/.gemini:/root/.gemini:ro`
      - `/usr/local/bin/agy:/usr/local/bin/agy:ro`
    - Environment variables: `PORT=3000`.
    - Restart: `unless-stopped`.
- [x] **Step 3: Create `.dockerignore`**
  - Ignore `.git`, `.gemini`, `tests`, `docs`, etc.
- [x] **Step 4: Verify Docker configurations**
  - Validate file contents and check compatibility.

---

### Task 4: Full End-to-End Verification & Documentation

**Files:**
- Modify: `README.md`
- Test: Run complete test suite and server validation

- [x] **Step 1: Update `README.md` with Docker VPS Deployment Guide**
  - Step-by-step instructions for running with `docker compose up -d` on VPS.
  - Explanations of volume mounts for `agy` and `.gemini`.
- [x] **Step 2: Run all verification commands**
  - Run `node -c server.js`
  - Run `node -c js/app.js`
  - Run `node tests/test-server.js`
- [x] **Step 3: Final check**
  - Verify that NO `git push` was performed.
