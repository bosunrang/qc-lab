// Shared helper for scripts/visual-check.js and scripts/a11y-audit.js: boots
// a real Chromium tab against the static app with a minimal-but-valid QC
// dataset already seeded, logged in as admin, with no visible login/password
// flow to fight through. Used only by these dev scripts — never loaded by
// the app itself.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// A handful of in-range points per level so print/report/chart code has
// something to draw, deliberately spread across ~2 weeks.
function buildSeedPoints(testId, level, lot, mean, sd, count = 10) {
  const points = [];
  const base = Date.UTC(2026, 6, 1); // 2026-07-01
  for (let i = 0; i < count; i++) {
    const date = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const jitter = ((i % 3) - 1) * sd * 0.4;
    points.push({ id: `${testId}-L${level}-${i}`, date, runId: `R${i}`, level, val: Number((mean + jitter).toFixed(2)), lot, staff: 'NV1' });
  }
  return points;
}

// Minimal state that satisfies QCCore.validateBackup()/validateStateInvariants():
// one operational test (linked panel + active lot group + two Mean/SD levels)
// so operationalTests() is non-empty and every report/print/chart path has
// real data to render, plus one admin user so login can be bypassed.
function buildSeedState() {
  const lot1 = { id: 'L1101', lotNo: '1101', level: 1 };
  const lot2 = { id: 'L1102', lotNo: '1102', level: 2 };
  const testId = 'T-NA';
  return {
    lab: { name: 'Bệnh viện Demo QC Lab', dept: 'Khoa Xét nghiệm', address: '' },
    tests: [{
      id: testId, name: 'Sodium (Na)', unit: 'mmol/L', machine: 'EasyLyte Expand',
      levels: [
        { level: 1, qcLotId: lot1.id, lot: lot1.lotNo, mean: 140, sd: 2.5, meanSdHistory: [{ qcLotId: lot1.id, lot: lot1.lotNo, mean: 140, sd: 2.5 }] },
        { level: 2, qcLotId: lot2.id, lot: lot2.lotNo, mean: 100, sd: 2.2, meanSdHistory: [{ qcLotId: lot2.id, lot: lot2.lotNo, mean: 100, sd: 2.2 }] },
      ],
    }],
    instruments: [{ id: 'I1', name: 'EasyLyte Expand', active: true }],
    qcPanels: [{ id: 'P1', name: 'Panel Hóa sinh', active: true, testIds: [testId], instrumentId: 'I1' }],
    lotGroups: [{ id: 'G1', name: 'Nhóm lô 1101/1102', active: true, status: 'active', lotIds: [lot1.id, lot2.id] }],
    qcLots: [lot1, lot2],
    data: {
      [testId]: [
        ...buildSeedPoints(testId, 1, lot1.lotNo, 140, 2.5),
        ...buildSeedPoints(testId, 2, lot2.lotNo, 100, 2.2),
      ],
    },
    actions: [],
    users: [
      { id: 'U1', username: 'admin', name: 'Quản trị viên', role: 'admin', active: true, passHash: 'seed-not-verified', mustChangePassword: false },
      // A second, non-logged-in user — openUserPerms() refuses to edit the
      // currently logged-in account's own permissions, so testing that
      // modal needs a user other than the one seeded as currentUser above.
      { id: 'U2', username: 'ktv1', name: 'Kỹ thuật viên', role: 'technician', active: true, passHash: 'seed-not-verified', mustChangePassword: false },
    ],
    westgardRules: { '1-3s': true, '1-2s': true, '2-2s': true, 'R4s': true, '4-1s': true, '10x': true },
  };
}

/**
 * Boots the static app in headless Chromium with a seeded dataset and an
 * already-authenticated admin session (login/password-change UI is skipped
 * entirely by setting `currentUser` directly, same trust boundary the app
 * itself has — see CLAUDE.md "Storage and sync model").
 */
async function openSeededSession({ headless = true } = {}) {
  const server = await startStaticServer();
  // Everything after the server is listening runs under this guard: the HTTP
  // server keeps the event loop alive, so a failure here (Chromium missing or
  // crashing on launch, seed page never reaching showApp()) would leave the
  // caller's error handler unable to exit — the script would print the error
  // and then hang until the CI job's timeout instead of failing fast.
  let browser = null;
  const diagnostics = [];
  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless });
    const page = await browser.newPage();
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
    page.on('requestfailed', request => diagnostics.push(`requestfailed: ${request.url()} · ${request.failure()&&request.failure().errorText||''}`));
    const seedState = buildSeedState();

    await page.addInitScript((state) => { localStorage.setItem('qclab', JSON.stringify(state)); }, seedState);
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof showApp === 'function' && typeof state !== 'undefined' && Array.isArray(state.users) && state.users.length > 0);
    await page.evaluate(() => { currentUser = state.users[0]; showApp(); });
    await page.waitForSelector('#nav button', { timeout: 10000 });

    return buildSession(server, browser, page, baseUrl, seedState);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    if (diagnostics.length) console.error('Browser diagnostics:\n' + diagnostics.join('\n'));
    throw err;
  }
}

function buildSession(server, browser, page, baseUrl, seedState) {
  return {
    browser,
    page,
    baseUrl,
    seedState,
    async close() {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = { openSeededSession, buildSeedState, startStaticServer };
