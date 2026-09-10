'use strict';
// Gate UI parity (Giai đoạn D0, docs/APP-V2-PLAN.md): mở CÙNG bộ dữ liệu seed
// trên app cũ (golden master) và app-v2 rồi đối chiếu.
//
// Bản đầu (2026-09-01) chỉ CHỤP ẢNH cặp old/v2 và bắt console error của v2 —
// `oldTitle`/`v2Title` được ghi vào report.json nhưng KHÔNG hề assert bằng
// nhau, selector bắt buộc chỉ kiểm ở v2, và lỗi console phía app cũ không ai
// nghe. Nghĩa là thứ duy nhất nó thật sự chặn là "v2 không có console
// error" — không phải một gate parity. Bản này siết thành 4 lớp:
//
//   1. HARD-FAIL: không console/page error ở CẢ HAI bản (trước chỉ v2).
//   2. HARD-FAIL: mọi `requiredSelectors` phải tồn tại ở CẢ HAI bản — thiếu
//      ở app cũ nghĩa là selector trong manifest bị bịa/đã đổi tên, và gate
//      sẽ vô nghĩa vì chỉ còn kiểm chính app-v2 với chính nó.
//   3. HARD-FAIL: tiêu đề `.head h1` phải giống nhau từng ký tự.
//   4. RATCHET (khớp quy ước tests/a11y-ratchet.json + css-hex-ratchet của
//      repo gốc): đo 2 chỉ số theo chiều "app cũ CÓ mà app-v2 THIẾU" —
//      `missingClasses` (class xuất hiện trong vùng nội dung của app cũ
//      nhưng không có ở app-v2) và `missingTextLines` (dòng chữ hiển thị
//      tương ứng) — rồi so với app-v2/tests/ui-parity-baseline.json. Vượt
//      baseline hoặc thêm surface mới còn lệch mà chưa có baseline thì FAIL.
//      Siết baseline bằng `--update-baseline`, không bao giờ nâng số bằng tay.
//
// CỐ Ý CHƯA CÓ pixel-diff: kế hoạch D0 mục 5 đặt nó SAU khi phần DOM đã ổn
// định. Chỉ số ở lớp 4 là thứ đo được ngay và không phụ thuộc font/DPI.
//
// TAB: một trang có nhiều tab (Cấu hình chung có 8) chỉ được đo ở TRẠNG THÁI
// MẶC ĐỊNH nếu không làm gì thêm — tức 7/8 tab không có gì canh giữ (phát
// hiện 2026-09-02). Trang nào khai `tabNav` + `tabs[]` trong manifest thì
// gate BẤM đúng nút tab thứ `index` ở CẢ HAI bản rồi mới đo, và mỗi tab là
// một surface riêng (`manage:lots/desktop`...). Bấm theo INDEX, không theo
// nhãn: nhãn là chính thứ đang được so, dùng nó để điều hướng thì khi nhãn
// lệch gate sẽ chết vì không tìm thấy nút thay vì báo lệch nhãn.
//
// Cờ: `--all` chụp cả trang `capture:false` trong manifest;
//     `--update-baseline` ghi lại baseline theo số đo của lần chạy này.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { openSeededSession } = require('../../scripts/lib/seed-browser-session');
const { buildParitySeeds, seedV2ViaApi } = require('./ui-parity-seed.cjs');

const ROOT = path.join(__dirname, '..', '..');
const V2_ROOT = path.join(ROOT, 'app-v2-dist', 'renderer');
const OUT_ROOT = path.join(ROOT, 'app-v2', 'tests', '__ui-parity__');
const BASELINE_PATH = path.join(ROOT, 'app-v2', 'tests', 'ui-parity-baseline.json');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-v2', 'ui-parity.manifest.json'), 'utf8'));
const captureAll = process.argv.includes('--all');
const updateBaseline = process.argv.includes('--update-baseline');

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return { surfaces: {} };
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

/** Nới CSP CHỈ khi gate phục vụ bản build.
 *
 * `index.html` khai `script-src 'self'` — đúng cho bản Electron đóng gói,
 * nhưng chặn `WebAssembly.instantiate`, mà bản xem trước dùng SQLite biên
 * dịch sang WASM (sql.js) từ 2026-09-09. Electron thật không cần WASM (nó có
 * `node:sqlite`), nên nới ở đây thay vì hạ CSP của sản phẩm — cùng lý do
 * `vite.app-v2-renderer.config.mjs` chỉ nới CSP khi `ctx.server` tồn tại.
 */
function relaxCspForWasm(html) {
  return html.replace(/script-src 'self'/, "script-src 'self' 'wasm-unsafe-eval'");
}

function startV2Server() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(V2_ROOT, relative);
      if (!file.startsWith(V2_ROOT)) { response.writeHead(403); response.end(); return; }
      fs.readFile(file, (error, data) => {
        if (error) { response.writeHead(404); response.end('Not found'); return; }
        const ext = path.extname(file);
        const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.woff2' ? 'font/woff2' : ext === '.wasm' ? 'application/wasm' : 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type }); response.end(ext === '.html' ? relaxCspForWasm(data.toString('utf8')) : data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

/** Đọc "dấu vân" của vùng nội dung chính: tập class + các dòng chữ hiển
 * thị. Chạy TRONG trang (cả 2 bản dùng chung hàm này) — app cũ render vào
 * `#main`, app-v2 vào `<main>` của AppShell, nên thử lần lượt. */
// Đo MODAL thì truyền `.modal` làm scope (mặc định: vùng nội dung chính).
function regionSignature(scope) {
  return `(() => {
  const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : "document.querySelector('#main') || document.querySelector('main')"};
  if (!root) return { classes: [], lines: [], missingRoot: true };
  const classes = new Set();
  for (const el of root.querySelectorAll('*')) for (const name of el.classList) classes.add(name);
  const lines = (root.innerText || '').split('\\n').map(s => s.replace(/\\s+/g, ' ').trim()).filter(Boolean);
  return { classes: [...classes], lines: [...new Set(lines)], missingRoot: false };
})()`;
}
const REGION_SIGNATURE = regionSignature(null);

function missingFrom(oldList, v2List) {
  const have = new Set(v2List);
  return oldList.filter(item => !have.has(item));
}

/** Bấm nút tab thứ `index` trong `navSelector` rồi chờ React/classic vẽ
 * lại. Trả về lỗi dạng chuỗi nếu không bấm được (để gate báo, không throw
 * làm sập cả lượt chạy). */
async function clickTab(page, navSelector, index, label) {
  const buttons = page.locator(navSelector);
  const count = await buttons.count();
  if (count <= index) return `${label}: chỉ tìm thấy ${count} nút tab ở "${navSelector}", cần index ${index}`;
  await buttons.nth(index).click();
  await page.waitForTimeout(150);
  return null;
}

/** Mở một modal ở CẢ HAI bản rồi trả về lỗi (chuỗi) nếu không mở được.
 * `tabIndex` (tuỳ chọn) bấm tab trước, dùng lại `tabNav` của trang. Trigger
 * là selector nút — phải TỒN TẠI Ở CẢ HAI BẢN, nếu không thì đó chính là
 * một phát hiện (giống nguyên tắc của `requiredSelectors`). */
async function openModal(page, page_def, modal, label) {
  if (modal.tabIndex != null) {
    const tabError = await clickTab(page, page_def.tabNav, modal.tabIndex, label);
    if (tabError) return tabError;
    await page.waitForTimeout(250);
  }
  const trigger = page.locator(modal.trigger);
  if (!(await trigger.count())) return `${label}: không có nút mở modal "${modal.trigger}"`;
  await trigger.first().click();
  try { await page.waitForSelector(modal.scope || '.modal', { timeout: 5000 }); } catch {
    return `${label}: bấm "${modal.trigger}" nhưng không thấy modal (${modal.scope || '.modal'})`;
  }
  await page.waitForTimeout(250);
  return null;
}

async function selectorPresence(page, selectors) {
  const missing = [];
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (!count) missing.push(selector);
  }
  return missing;
}

async function main() {
  if (!fs.existsSync(path.join(V2_ROOT, 'index.html'))) throw new Error('Chưa có app-v2-dist/renderer; chạy npm run app-v2:build:renderer trước.');
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const seeds = buildParitySeeds();
  const baseline = readBaseline();
  const oldSession = await openSeededSession({ headless: true, seedState: seeds.old });
  const v2Server = await startV2Server();
  const diagnostics = [];
  const failures = [];
  const measured = {};
  const report = { generatedAt: new Date().toISOString(), goldenMaster: manifest.goldenMaster, captures: [], diagnostics, failures };
  let v2Page;
  try {
    const port = v2Server.address().port;
    // Lỗi trình duyệt của CẢ HAI bản đều là hard-fail — app cũ là golden
    // master, nếu chính nó lỗi thì mọi số đo so với nó đều không tin được.
    oldSession.page.on('pageerror', error => diagnostics.push(`old pageerror: ${error.message}`));
    oldSession.page.on('console', message => { if (message.type() === 'error') diagnostics.push(`old console: ${message.text()}`); });
    v2Page = await oldSession.browser.newPage();
    v2Page.on('pageerror', error => diagnostics.push(`v2 pageerror: ${error.message}`));
    v2Page.on('console', message => { if (message.type() === 'error') diagnostics.push(`v2 console: ${message.text()}`); });
    // Seed đi qua CHÍNH `window.qcApi` (SQLite thật trong IndexedDB), không
    // còn nhồi blob vào localStorage — bản giả lập viết tay đã bị xoá
    // 2026-09-09, xem ghi chú ở `seedV2ViaApi`.
    await v2Page.goto(`http://127.0.0.1:${port}/?ui-parity=1#/dashboard`, { waitUntil: 'networkidle' });
    await seedV2ViaApi(v2Page, seeds.v2);

    const pages = manifest.pages.filter(page => captureAll || page.capture);
    for (const page of pages) {
      for (const viewport of manifest.viewports) {
       // Trang không khai tab → 1 lượt đo duy nhất (tab = null).
       for (const tab of (page.tabs && page.tabs.length ? page.tabs : [null])) {
        const surface = tab ? `${page.id}:${tab.id}/${viewport.id}` : `${page.id}/${viewport.id}`;
        const selectors = [...page.requiredSelectors, ...((tab && tab.requiredSelectors) || [])];
        await oldSession.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await oldSession.page.evaluate(id => go(id), page.oldId);
        await oldSession.page.waitForTimeout(120);

        await v2Page.setViewportSize({ width: viewport.width, height: viewport.height });
        await v2Page.goto(`http://127.0.0.1:${port}/?ui-parity=1#${page.route}`, { waitUntil: 'networkidle' });
        await v2Page.waitForSelector('.head', { timeout: 10000 });

        if (tab) {
          const oldClick = await clickTab(oldSession.page, page.tabNav, tab.index, 'app cũ');
          const v2Click = await clickTab(v2Page, page.tabNav, tab.index, 'app-v2');
          if (oldClick) failures.push(`${surface}: ${oldClick}`);
          if (v2Click) failures.push(`${surface}: ${v2Click}`);
        }

        for (const selector of selectors) {
          try { await v2Page.waitForSelector(selector, { timeout: 5000 }); } catch { /* báo ở bước kiểm dưới */ }
        }

        // (2) selector bắt buộc phải có ở CẢ HAI bản
        const missingOld = await selectorPresence(oldSession.page, selectors);
        const missingV2 = await selectorPresence(v2Page, selectors);
        if (missingOld.length) failures.push(`${surface}: app CŨ thiếu selector ${missingOld.join(', ')} — selector trong manifest sai/đã đổi tên, gate sẽ vô nghĩa`);
        if (missingV2.length) failures.push(`${surface}: app-v2 thiếu selector ${missingV2.join(', ')}`);

        const oldDir = path.join(OUT_ROOT, 'old');
        const v2Dir = path.join(OUT_ROOT, 'v2');
        fs.mkdirSync(oldDir, { recursive: true }); fs.mkdirSync(v2Dir, { recursive: true });
        const filename = `${page.id}${tab ? '-' + tab.id : ''}-${viewport.id}.png`;
        await oldSession.page.screenshot({ path: path.join(oldDir, filename), fullPage: true });
        await v2Page.screenshot({ path: path.join(v2Dir, filename), fullPage: true });

        // (3) tiêu đề trang phải giống nhau
        const oldTitle = (await oldSession.page.locator('.head h1').first().textContent() || '').trim();
        const v2Title = (await v2Page.locator('.head h1').first().textContent() || '').trim();
        if (oldTitle !== v2Title) failures.push(`${surface}: tiêu đề lệch — app cũ "${oldTitle}" vs app-v2 "${v2Title}"`);

        // (4) ratchet theo chiều "app cũ có mà app-v2 thiếu"
        const oldSig = await oldSession.page.evaluate(REGION_SIGNATURE);
        const v2Sig = await v2Page.evaluate(REGION_SIGNATURE);
        if (oldSig.missingRoot) failures.push(`${surface}: không tìm thấy vùng nội dung (#main) ở app cũ`);
        if (v2Sig.missingRoot) failures.push(`${surface}: không tìm thấy vùng nội dung (<main>) ở app-v2`);
        const missingClasses = missingFrom(oldSig.classes, v2Sig.classes);
        const missingTextLines = missingFrom(oldSig.lines, v2Sig.lines);
        const actual = { missingClasses: missingClasses.length, missingTextLines: missingTextLines.length };
        measured[surface] = actual;

        const allowed = baseline.surfaces && baseline.surfaces[surface];
        if (!updateBaseline) {
          if (!allowed) {
            if (actual.missingClasses || actual.missingTextLines) {
              failures.push(`${surface}: surface MỚI còn lệch (${actual.missingClasses} class, ${actual.missingTextLines} dòng chữ) mà chưa có baseline — chạy lại với --update-baseline sau khi đã xem qua`);
            }
          } else {
            if (actual.missingClasses > allowed.missingClasses) failures.push(`${surface}: thiếu ${actual.missingClasses} class (baseline ${allowed.missingClasses}) — ví dụ: ${missingClasses.slice(0, 8).join(', ')}`);
            if (actual.missingTextLines > allowed.missingTextLines) failures.push(`${surface}: thiếu ${actual.missingTextLines} dòng chữ (baseline ${allowed.missingTextLines}) — ví dụ: ${missingTextLines.slice(0, 5).map(s => JSON.stringify(s)).join(', ')}`);
          }
        }

        report.captures.push({
          page: page.id, tab: tab ? tab.id : null, viewport: viewport.id, oldTitle, v2Title, selectors,
          missing: actual,
          missingClassNames: missingClasses.slice(0, 40),
          missingTextExamples: missingTextLines.slice(0, 20),
        });
        console.log(`UI parity ${surface}: thiếu ${actual.missingClasses} class / ${actual.missingTextLines} dòng chữ`);
       }
      }

      // MODAL: gate chỉ đo trang ở TRẠNG THÁI MẶC ĐỊNH, nên trước 2026-09-03
      // không một modal nào (≈22 cái) có gì canh giữ — phát hiện khi đo tay
      // bên trong modal "Thêm lô QC": KHÔNG một class modal nào của app cũ
      // (`.modal-h`/`.modal-b`/`.modal-f`/`.modal-close`/`.grid2`) tồn tại ở
      // app-v2 mà cả 3 gate vẫn xanh. Mỗi modal là 1 surface riêng
      // (`manage:modal-lot`), đo ở ĐÚNG MỘT viewport (desktop) — nhân 4
      // viewport chỉ làm gate chậm mà lệch cần tìm nằm ở DOM/nội dung.
      for (const modal of page.modals || []) {
        const surface = `${page.id}:modal-${modal.id}`;
        const scope = modal.scope || '.modal';
        const viewport = manifest.viewports[0];
        await oldSession.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await oldSession.page.evaluate(id => go(id), page.oldId);
        await oldSession.page.waitForTimeout(200);
        await v2Page.setViewportSize({ width: viewport.width, height: viewport.height });
        await v2Page.goto(`http://127.0.0.1:${port}/?ui-parity=1#${page.route}`, { waitUntil: 'networkidle' });
        await v2Page.waitForSelector('.head', { timeout: 10000 });

        // Đóng modal còn sót của lượt trước — `go(id)` của app cũ KHÔNG đóng
        // modal đang mở, nên `.modal-bg` sẽ chặn mọi click tiếp theo.
        for (const target of [oldSession.page, v2Page]) {
          for (let attempt = 0; attempt < 3 && await target.locator('.modal-bg').count(); attempt += 1) {
            await target.keyboard.press('Escape');
            await target.waitForTimeout(150);
          }
        }
        const oldOpen = await openModal(oldSession.page, page, modal, 'app cũ');
        const v2Open = await openModal(v2Page, page, modal, 'app-v2');
        if (oldOpen) failures.push(`${surface}: ${oldOpen}`);
        if (v2Open) failures.push(`${surface}: ${v2Open}`);
        if (oldOpen || v2Open) continue;

        const modalSelectors = modal.requiredSelectors || [];
        const missingOld = await selectorPresence(oldSession.page, modalSelectors);
        const missingV2 = await selectorPresence(v2Page, modalSelectors);
        if (missingOld.length) failures.push(`${surface}: app CŨ thiếu selector ${missingOld.join(', ')} — selector trong manifest sai/đã đổi tên`);
        if (missingV2.length) failures.push(`${surface}: app-v2 thiếu selector ${missingV2.join(', ')}`);

        const oldTitle = (await oldSession.page.locator(`${scope} .modal-h h3`).first().textContent().catch(() => '') || '').trim();
        const v2Title = (await v2Page.locator(`${scope} .modal-h h3`).first().textContent().catch(() => '') || '').trim();
        if (oldTitle !== v2Title) failures.push(`${surface}: tiêu đề modal lệch — app cũ "${oldTitle}" vs app-v2 "${v2Title}"`);

        const oldSig = await oldSession.page.evaluate(regionSignature(scope));
        const v2Sig = await v2Page.evaluate(regionSignature(scope));
        const missingClasses = missingFrom(oldSig.classes, v2Sig.classes);
        const missingTextLines = missingFrom(oldSig.lines, v2Sig.lines);
        const actual = { missingClasses: missingClasses.length, missingTextLines: missingTextLines.length };
        measured[surface] = actual;

        const modalDir = { old: path.join(OUT_ROOT, 'old'), v2: path.join(OUT_ROOT, 'v2') };
        await oldSession.page.locator(scope).first().screenshot({ path: path.join(modalDir.old, `${page.id}-modal-${modal.id}.png`) }).catch(() => {});
        await v2Page.locator(scope).first().screenshot({ path: path.join(modalDir.v2, `${page.id}-modal-${modal.id}.png`) }).catch(() => {});

        const allowed = baseline.surfaces && baseline.surfaces[surface];
        if (!updateBaseline) {
          if (!allowed) {
            if (actual.missingClasses || actual.missingTextLines) {
              failures.push(`${surface}: surface MỚI còn lệch (${actual.missingClasses} class, ${actual.missingTextLines} dòng chữ) mà chưa có baseline — chạy lại với --update-baseline sau khi đã xem qua`);
            }
          } else {
            if (actual.missingClasses > allowed.missingClasses) failures.push(`${surface}: thiếu ${actual.missingClasses} class (baseline ${allowed.missingClasses}) — ví dụ: ${missingClasses.slice(0, 8).join(', ')}`);
            if (actual.missingTextLines > allowed.missingTextLines) failures.push(`${surface}: thiếu ${actual.missingTextLines} dòng chữ (baseline ${allowed.missingTextLines}) — ví dụ: ${missingTextLines.slice(0, 5).map(s => JSON.stringify(s)).join(', ')}`);
          }
        }
        report.captures.push({
          page: page.id, modal: modal.id, viewport: viewport.id, oldTitle, v2Title, selectors: modalSelectors,
          missing: actual, missingClassNames: missingClasses.slice(0, 40), missingTextExamples: missingTextLines.slice(0, 20),
        });
        console.log(`UI parity ${surface}: thiếu ${actual.missingClasses} class / ${actual.missingTextLines} dòng chữ`);
      }
    }
  } finally {
    if (v2Page) await v2Page.close().catch(() => {});
    await closeServer(v2Server);
    await oldSession.close();
    fs.writeFileSync(path.join(OUT_ROOT, 'report.json'), JSON.stringify(report, null, 2));
  }

  if (updateBaseline) {
    //  được GIỮ LẠI nguyên vẹn khi sinh lại baseline: đó là chỗ
    // ghi LÝ DO một surface chưa về 0 (vd trang Cài đặt còn 2 panel Firebase).
    // Nếu bị ghi đè mất, người đọc sau sẽ thấy con số khác 0 mà không biết vì sao.
    // `surfaceNotes` được GIỮ LẠI nguyên vẹn khi sinh lại baseline: đó là
    // chỗ ghi LÝ DO một surface chưa về 0 (vd trang Cài đặt còn 2 panel
    // Firebase). Ghi đè mất nó thì người đọc sau chỉ thấy con số khác 0 mà
    // không biết vì sao, rồi tưởng là nợ giao diện chưa làm.
    const next = { note: 'Baseline gate UI parity — CHỈ được siết xuống, không nâng lên bằng tay. Sinh bằng: npm run app-v2:ui-parity -- --update-baseline', goldenMaster: manifest.goldenMaster, updatedAt: new Date().toISOString(), surfaceNotes: baseline.surfaceNotes || {}, surfaces: { ...(baseline.surfaces || {}), ...measured } };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Đã ghi baseline cho ${Object.keys(measured).length} surface vào ${path.relative(ROOT, BASELINE_PATH)}.`);
  }

  if (diagnostics.length) failures.push(`${diagnostics.length} lỗi trình duyệt (xem report.json): ${diagnostics.slice(0, 3).join(' | ')}`);
  if (failures.length) {
    console.error(`\nUI parity FAIL (${failures.length}):`);
    for (const line of failures) console.error(`  - ${line}`);
    throw new Error(`UI parity không đạt: ${failures.length} vấn đề.`);
  }
  console.log(`UI parity: ${report.captures.length} surface đạt (tiêu đề khớp, selector đủ ở cả 2 bản, không lỗi trình duyệt, không vượt baseline).`);
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
