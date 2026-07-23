// Automated check for the printed/PDF report stylesheet (assets/modules/reports.js
// openPrint()). Renders the actual HTML the app writes to the print window,
// under `@media print`, in real Chromium — and asserts the header boxes keep
// their teal background. This is exactly the class of bug fixed 2026-07-23
// (missing print-color-adjust:exact stripped header backgrounds when a
// browser's "print backgrounds" setting is off), which no other test in this
// repo can catch: tests/westgard-print.test.js and tests/report-layout.test.js
// only string-match the generated HTML/XLSX structure, never computed CSS.
//
// Not part of `npm test` — needs Playwright + a Chromium download, so it's a
// separate opt-in script (see CLAUDE.md "Tests"). Screenshots are saved for
// human review only; this script does not pixel-diff them (font rendering
// differs across OS/machines, which makes pixel comparison flaky — see
// CLAUDE.md "Button convention"/this file's neighbors for the same
// reasoning applied to other ratchet checks in this repo).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openSeededSession } = require('./lib/seed-browser-session');

const OUT_DIR = path.join(__dirname, '..', 'tests', '__visual__');

// Every one of these calls openPrint() in assets/modules/reports.js, the one
// shared function that builds the print window's HTML/CSS — so checking two
// report types exercises the exact same header/print stylesheet that
// printSigmaPeriod()/printSigmaPeriods()/rcPrint()/rcPrintSummary() reuse.
// Not included here only because they need their own seed data (Sigma
// periods with Bias entries, reagent comparison rows) that
// scripts/lib/seed-browser-session.js doesn't build yet.
const REPORTS = [
  {
    label: 'westgard',
    prepare: async (page) => { await page.evaluate(() => go('westgard')); await page.waitForSelector('.wg-test-picker'); },
    trigger: () => 'printWestgard()',
  },
  {
    label: 'report',
    prepare: async (page) => { await page.evaluate(() => go('report')); await page.waitForSelector('#rTest'); },
    trigger: () => 'printReport()',
  },
];

async function capturePrintHtml(page, prepare, triggerExpr) {
  await prepare(page);
  await page.evaluate(() => {
    window.__captured = null;
    window.open = function () {
      return { document: { write(html) { window.__captured = html; }, close() {} }, focus() {} };
    };
  });
  await page.evaluate((expr) => window.eval(expr), triggerExpr);
  const html = await page.evaluate(() => window.__captured);
  assert.ok(html, `${triggerExpr} did not produce any print HTML (window.open was never called with content — check the report actually had data)`);
  return html;
}

// Renders the captured standalone HTML document under `@media print` and
// checks the exact defect class fixed 2026-07-23: header boxes with a
// background color that isn't forced to print (`print-color-adjust:exact`).
// This is *not* a `backgroundColor` check — that computed value is the same
// with or without print-color-adjust, since the property doesn't change what
// color is computed, only whether Chromium's print/PDF pipeline is allowed to
// paint it when the browser's own "print backgrounds" setting is off (which
// it is, by default). print-color-adjust is itself directly readable via
// getComputedStyle, so asserting it's 'exact' on every element that declares
// a background is the deterministic way to catch this — no PDF rasterizing,
// no pixel diffing, no font-rendering flakiness across machines.
async function checkPrintRendering(browser, html, label) {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.setContent(html, { waitUntil: 'load' });
  const result = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('h3')];
    const badHeaders = headers
      .filter((h) => {
        const cs = getComputedStyle(h);
        const bg = cs.backgroundColor;
        const hasBackground = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        const adjust = cs.printColorAdjust || cs.webkitPrintColorAdjust;
        return hasBackground && adjust !== 'exact';
      })
      .map((h) => h.textContent.trim());
    const pageEl = document.querySelector('.page');
    const overflowPx = pageEl ? pageEl.scrollWidth - pageEl.clientWidth : 0;
    return { headerCount: headers.length, badHeaders, overflowPx };
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: true });
  await page.close();
  return result;
}

async function main() {
  const session = await openSeededSession({ headless: true });
  const failures = [];
  try {
    for (const report of REPORTS) {
      const html = await capturePrintHtml(session.page, report.prepare, report.trigger());
      const result = await checkPrintRendering(session.browser, html, report.label);
      const problems = [];
      if (result.headerCount === 0) problems.push('no <h3> header boxes found at all — report body looks empty');
      if (result.badHeaders.length) problems.push(`header(s) with a background color not forced to print (missing print-color-adjust:exact): ${result.badHeaders.join(', ')}`);
      if (result.overflowPx > 2) problems.push(`report page overflows its own width by ${result.overflowPx}px under print media`);
      if (problems.length) failures.push(`[${report.label}] ${problems.join('; ')}`);
      else console.log(`OK  ${report.label}: ${result.headerCount} header(s), backgrounds all forced to print`);
    }
  } finally {
    await session.close();
  }
  if (failures.length) {
    console.error('\nvisual-check FAILED:');
    failures.forEach((f) => console.error('  - ' + f));
    console.error(`\nScreenshots for review: ${OUT_DIR}`);
    process.exitCode = 1;
  } else {
    console.log(`\nvisual-check passed. Screenshots for review: ${OUT_DIR}`);
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
