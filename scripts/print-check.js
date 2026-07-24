// Automated check for the DESKTOP print-to-PDF pipeline (Electron). Boots the
// real app in Electron via Playwright, seeds the same dataset as
// scripts/lib/seed-browser-session.js, opens the real print window through
// printWestgard() → openPrint(), then drives the exact main-process path the
// "Lưu PDF" button uses (find print window by token → webContents.printToPDF)
// and asserts on the generated PDF's content stream:
//   - NO full-page fill of the screen-preview background #EEF2F5 — this is the
//     exact 2026-07-24 defect class (2.4.2/2.4.3 printed the gray window/body
//     background over the whole PDF page; root cause was the popup window's
//     backgroundColor showing through because Blink does not paint the body
//     background onto the print canvas).
//   - the teal header #0E8F8F IS still painted (print-color-adjust:exact keeps
//     working — we must not "fix" the gray by stripping backgrounds).
//   - the PDF actually contains report text.
// Nothing else in the repo can catch this: tests/* string-match HTML, and
// visual-check.js renders under @media print in Chromium (which honors print
// media correctly — the bug only existed in Electron's print/PDF pipeline).
//
// Not part of `npm test` — needs Playwright + the Electron binary, so it's an
// opt-in script in the same group as visual-check/a11y-audit (see
// CLAUDE.md "Tests"). On headless Linux CI run it under xvfb.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { _electron } = require('playwright');
const { buildSeedState } = require('./lib/seed-browser-session');

const OUT_DIR = path.join(__dirname, '..', 'tests', '__print__');

// Inflates every FlateDecode stream in the PDF and concatenates the ones that
// look like page content (painting/text operators). Chromium PDFs keep page
// content in a single flate stream; font/image streams are ignored by the
// look-like-content filter. Good enough for color assertions — no PDF library.
function pdfContentStreams(buf) {
  const chunks = [];
  let at = 0;
  for (;;) {
    const s = buf.indexOf('stream', at);
    if (s === -1) break;
    let bodyStart = s + 6;
    if (buf[bodyStart] === 13) bodyStart++; // \r\n
    if (buf[bodyStart] === 10) bodyStart++;
    const e = buf.indexOf('endstream', bodyStart);
    if (e === -1) break;
    const raw = buf.subarray(bodyStart, e);
    try {
      const inflated = zlib.inflateSync(raw);
      if (inflated.includes(' rg') || inflated.includes('Tj') || inflated.includes('TJ')) chunks.push(inflated);
    } catch (err) { /* not a flate stream — skip */ }
    at = e + 9;
  }
  return Buffer.concat(chunks);
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qclab-print-check-'));
  const app = await _electron.launch({ args: ['.', '--user-data-dir=' + userDataDir], timeout: 90000 });
  const failures = [];
  let pdfPath = null;
  try {
    const win = await app.firstWindow();
    // Same seed + login bypass as the browser-session helper: set localStorage,
    // reload, then mark the admin as currentUser and render the app shell.
    await win.evaluate((seed) => { localStorage.setItem('qclab', JSON.stringify(seed)); }, buildSeedState());
    await win.reload();
    await win.waitForFunction(() => typeof showApp === 'function' && typeof state !== 'undefined' && Array.isArray(state.users) && state.users.length > 0, null, { timeout: 30000 });
    await win.evaluate(() => { currentUser = state.users[0]; showApp(); });
    await win.waitForSelector('#nav button', { timeout: 15000 });

    // Real report through the real button path: Westgard page → printWestgard().
    await win.evaluate(() => go('westgard'));
    await win.waitForSelector('.wg-test-picker', { timeout: 15000 });
    await win.evaluate(() => printWestgard());
    const popup = app.context().pages().find((p) => p !== win);
    assert.ok(popup, 'printWestgard() did not open a print window (window.open blocked?)');
    await popup.waitForSelector('.print-btn', { timeout: 15000 });

    // Desktop UX contract: exactly one "Lưu PDF" button (no paper-print button —
    // user decision 2026-07-24) wired to the preload bridge on the opener.
    const contract = await popup.evaluate(() => ({
      buttons: [...document.querySelectorAll('.print-btn')].map((b) => b.textContent.trim()),
      api: window.opener ? typeof window.opener.qcPrintPdf : 'no-opener',
      token: window.__qcPrintToken || '',
    }));
    if (contract.api !== 'object') failures.push(`opener.qcPrintPdf bridge missing in popup (${contract.api})`);
    if (contract.buttons.length !== 1 || contract.buttons[0] !== 'Lưu PDF') failures.push(`print window must have exactly one "Lưu PDF" button, got: ${JSON.stringify(contract.buttons)}`);
    if (!contract.token) failures.push('print window has no __qcPrintToken — main process cannot find it');

    // Drive the same main-process flow as the qc-print:pdf IPC handler.
    const result = await app.evaluate(async ({ BrowserWindow }, token) => {
      let target = null;
      for (const w of BrowserWindow.getAllWindows()) {
        if (w.isDestroyed()) continue;
        const wc = w.webContents;
        if (wc.getURL() !== 'about:blank') continue;
        try { if (await wc.executeJavaScript('window.__qcPrintToken||""') === token) { target = w; break; } } catch (e) { /* closing window */ }
      }
      if (!target) return { error: 'no-print-window' };
      await target.webContents.executeJavaScript('document.body&&document.body.classList.add("printing")').catch(() => {});
      const pdf = await target.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
      return { data: pdf.toString('base64') };
    }, contract.token);
    if (result.error) failures.push(`main process could not produce PDF: ${result.error}`);

    if (result.data) {
      const pdf = Buffer.from(result.data, 'base64');
      fs.mkdirSync(OUT_DIR, { recursive: true });
      pdfPath = path.join(OUT_DIR, 'westgard.pdf');
      fs.writeFileSync(pdfPath, pdf);
      const content = pdfContentStreams(pdf);
      assert.ok(content.length > 0, 'no flate page-content stream found in generated PDF');
      const text = content.toString('latin1');
      // #EEF2F5 cũng là màu MÉP BẢNG hợp lệ (th,td border-bottom) nên không đếm
      // số fill thô được — chỉ báo lỗi khi có HÌNH CHỮ NHẬT LỚN tô màu này (nền
      // cả trang của defect 2026-07-24: 794×1123 re ngay sau khi đặt màu).
      const bigGrayRects = [...text.matchAll(/\.9333\s+\.949\s+\.9608\s+rg/g)]
        .filter((m) => {
          const re = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+re\s*\nf/.exec(text.slice(m.index, m.index + 200));
          return re && Number(re[3]) > 100 && Number(re[4]) > 100;
        }).length;
      const tealFills = (text.match(/\.0549\s+\.5608\s+\.5608\s+rg/g) || []).length;
      const textOps = (text.match(/\bT[jJ]\b/g) || []).length;
      if (bigGrayRects > 0) failures.push(`PDF paints a full-area background in #EEF2F5 (${bigGrayRects} big rect) — the 2026-07-24 gray-page defect is back`);
      if (tealFills < 1) failures.push('PDF lost the teal header background #0E8F8F — print-color-adjust:exact regressed');
      if (textOps < 10) failures.push(`PDF has almost no text (${textOps} text ops) — report body did not render`);
      if (!failures.length) console.log(`OK  westgard.pdf: ${(pdf.length / 1024).toFixed(1)} KB, 0 big gray rects, ${tealFills} teal header fill, ${textOps} text ops`);
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  if (failures.length) {
    console.error('\nprint-check FAILED:');
    failures.forEach((f) => console.error('  - ' + f));
    if (pdfPath) console.error(`\nPDF for review: ${pdfPath}`);
    process.exitCode = 1;
  } else {
    console.log(`\nprint-check passed. PDF for review: ${pdfPath}`);
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
