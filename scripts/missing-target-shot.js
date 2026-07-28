// One-off visual verification for the missing-Mean/SD warning (2026-07-26):
// seeds a state whose level 2 has no valid Mean/SD, boots the app headless,
// asserts the new warnings render, and captures dashboard + Westgard screenshots.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startStaticServer, buildSeedState } = require('./lib/seed-browser-session');

const OUT_DIR = path.join(__dirname, '..', 'tests', '__visual__');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Level 2 stripped of Mean/SD BEFORE first boot, so no IndexedDB mirror from
  // a previous session can win over the seeded localStorage snapshot.
  const seed = buildSeedState();
  seed.tests[0].levels[1] = { level: 2, qcLotId: 'L1102', lot: '1102', mean: 0, sd: 0, meanSdHistory: [] };

  const server = await startStaticServer();
  const { port } = server.address();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript((s) => { localStorage.setItem('qclab', JSON.stringify(s)); }, seed);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof showApp === 'function' && typeof state !== 'undefined' && Array.isArray(state.users) && state.users.length > 0);
    await page.evaluate(() => { currentUser = state.users[0]; showApp(); });
    await page.waitForSelector('#nav button', { timeout: 10000 });

    // 1) Dashboard: panel entry + warn pill.
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.waitForSelector('.dash-test-list', { timeout: 10000 });
    const dash = await page.evaluate(() => ({
      panelEntry: document.body.innerHTML.includes('không được đánh giá Westgard'),
      pill: !!document.querySelector('.dash-level-pill.missing-target'),
      pillText: (document.querySelector('.dash-level-pill.missing-target') || {}).textContent || '',
      assignButton: document.body.innerHTML.includes('Gán Mean/SD'),
    }));
    await page.screenshot({ path: path.join(OUT_DIR, 'missing-target-dashboard.png'), fullPage: true });

    // 2) Westgard page: banner + "Chưa đánh giá" verdicts, scoped to the level-2 block.
    await page.evaluate(() => go('westgard'));
    await page.waitForSelector('.wg-table', { timeout: 10000 });
    const wg = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.panel')];
      const level2 = panels.find(p => (p.querySelector('h3') || {}).textContent?.includes('Mức 2'));
      if (!level2) return { blockFound: false };
      const html = level2.innerHTML;
      return {
        blockFound: true,
        banner: html.includes('chưa có Mean/SD hợp lệ'),
        verdict: html.includes('Chưa đánh giá'),
        noFalsePass: !html.includes('tag ok'),
      };
    });
    await page.screenshot({ path: path.join(OUT_DIR, 'missing-target-westgard.png'), fullPage: true });

    // Trang cuộn trong container nội bộ nên fullPage chỉ bắt được viewport —
    // chụp riêng panel mức 2 để thấy banner + bảng "Chưa đánh giá".
    const level2Panel = await page.evaluateHandle(() => {
      const panels = [...document.querySelectorAll('.panel')];
      return panels.find(p => (p.querySelector('h3') || {}).textContent?.includes('Mức 2')) || null;
    });
    const el = level2Panel.asElement();
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(OUT_DIR, 'missing-target-westgard-level2.png') });
    }

    const all = { ...dash, ...wg };
    delete all.pillText;
    console.log('pill text:', JSON.stringify(dash.pillText));
    const failed = Object.entries(all).filter(([, ok]) => !ok);
    Object.entries(all).forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
    if (failed.length) { console.error('FAILED: ' + failed.map(([n]) => n).join(', ')); process.exit(1); }
    console.log('All missing-target visual checks passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
