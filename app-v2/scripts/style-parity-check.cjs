'use strict';
// Gate STYLE parity (2026-09-03) — lớp thứ ba, bù điểm mù của 2 gate đã có:
//
//   `app-v2:ui-parity`  đo TẬP class + DÒNG CHỮ trong vùng nội dung.
//   `app-v2:css-parity` đo "class app cũ style thật thì app-v2 có rule hay
//                        không" — KHÔNG so giá trị.
//   gate này            so COMPUTED STYLE từng phần tử giữa 2 bản: màu chữ,
//                        màu nền, viền, cỡ/độ đậm chữ, line-height, padding,
//                        margin, chiều cao, canh lề.
//
// Lý do tồn tại: người dùng mở app-v2 và nói "bảng biểu/ô chữ/màu sắc chưa
// giống" trong khi CẢ HAI gate kia đều xanh. Lần chạy đầu tiên trên tab
// Mean/SD tìm ra 25 selector lệch, trong đó có những thứ nhìn thấy ngay: ô
// nhập bị in đậm (do `font:inherit` trong reset của app-v2 mà app cũ không
// có), hàng tiêu đề bảng Mean/SD bị tô nền xám (bản port tự thêm), nút chọn
// mức dùng nền teal + viền + bo góc thay vì kiểu segmented nền #1c3442 của
// app cũ, `th` thấp 2px và thiếu letter-spacing, mọi ô bảng cao lệch 1px/dòng
// vì thiếu `th,td{line-height:1.4}`.
//
// RATCHET như `ui-parity`/`a11y-ratchet`: baseline giữ SỐ selector còn lệch
// của từng surface; vượt là FAIL, siết bằng `--update-baseline`. Phần còn
// lệch hôm nay phần lớn là khác biệt DOM/nội dung (app cũ có khối mà app-v2
// chưa có, hoặc ngược lại) — không phải cùng một phần tử mà khác màu.
//
// GIỚI HẠN: chỉ đo phần tử ĐẦU TIÊN khớp mỗi selector, và chỉ những selector
// trong danh sách dưới. Nó không thay pixel-diff (D0 mục 5 vẫn để sau).
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { openSeededSession } = require('../../scripts/lib/seed-browser-session');
const { buildParitySeeds } = require('./ui-parity-seed.cjs');

const ROOT = path.join(__dirname, '..', '..');
const V2_ROOT = path.join(ROOT, 'app-v2-dist', 'renderer');
const BASELINE_PATH = path.join(ROOT, 'app-v2', 'tests', 'style-parity-baseline.json');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-v2', 'ui-parity.manifest.json'), 'utf8'));
const updateBaseline = process.argv.includes('--update-baseline');

const PROPS = ['backgroundColor', 'color', 'borderTopWidth', 'borderTopColor', 'borderBottomWidth',
  'borderBottomColor', 'borderLeftWidth', 'borderLeftColor', 'borderRadius', 'fontSize', 'fontWeight',
  'lineHeight', 'padding', 'textTransform', 'letterSpacing', 'textAlign'];

// Phần tử "bảng biểu / ô chữ / màu sắc" dùng chung mọi trang.
const SELECTORS = [
  'table', 'table thead th', 'table tbody td', 'table tbody tr',
  'input', 'select', 'textarea', 'label',
  '.tag', '.pill', '.btn.teal', '.btn.ghost', '.btn.danger',
  '.panel', '.panel-title', '.empty', '.empty-title', '.alert', '.dayseg button',
];

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
        const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8'
          : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.woff2' ? 'font/woff2' : 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type }); response.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const DUMP = `(() => {
  var props = ${JSON.stringify(PROPS)};
  var sels = ${JSON.stringify(SELECTORS)};
  var out = {};
  for (var i = 0; i < sels.length; i++) {
    var el = document.querySelector(sels[i]);
    if (!el) { out[sels[i]] = null; continue; }
    var cs = getComputedStyle(el);
    var rec = {};
    for (var j = 0; j < props.length; j++) rec[props[j]] = cs[props[j]];
    out[sels[i]] = rec;
  }
  return out;
})()`;

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return { surfaces: {} };
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

async function main() {
  if (!fs.existsSync(path.join(V2_ROOT, 'index.html'))) {
    throw new Error('Chưa có app-v2-dist/renderer; chạy npm run app-v2:build:renderer trước.');
  }
  const seeds = buildParitySeeds();
  const baseline = readBaseline();
  const oldSession = await openSeededSession({ headless: true, seedState: seeds.old });
  const server = await startV2Server();
  const failures = [];
  const details = [];
  const measured = {};
  let v2Page;
  try {
    const port = server.address().port;
    v2Page = await oldSession.browser.newPage();
    await v2Page.addInitScript((seed) => localStorage.setItem('qclab-v2-browser-preview', JSON.stringify(seed)), seeds.v2);
    await v2Page.goto(`http://127.0.0.1:${port}/index.html#/dashboard`, { waitUntil: 'load' });
    await v2Page.waitForTimeout(2500);
    const viewport = { width: 1440, height: 2000 };
    await oldSession.page.setViewportSize(viewport);
    await v2Page.setViewportSize(viewport);

    for (const page of manifest.pages) {
      if (page.capture === false) continue;
      await v2Page.goto(`http://127.0.0.1:${port}/index.html#${page.route}`, { waitUntil: 'load' });
      await v2Page.waitForTimeout(700);
      await oldSession.page.evaluate((id) => (window /** @type {any} */).go(id), page.oldId);
      await oldSession.page.waitForTimeout(700);

      const tabs = page.tabs && page.tabs.length ? page.tabs : [null];
      for (const tab of tabs) {
        const surface = tab ? `${page.id}:${tab.id}` : page.id;
        if (tab) {
          for (const target of [oldSession.page, v2Page]) {
            const buttons = target.locator(page.tabNav);
            if (await buttons.count() <= tab.index) { failures.push(`${surface}: không tìm thấy nút tab index ${tab.index}`); continue; }
            await buttons.nth(tab.index).click();
            await target.waitForTimeout(350);
          }
        }
        const oldStyles = await oldSession.page.evaluate(DUMP);
        const v2Styles = await v2Page.evaluate(DUMP);
        const differing = [];
        for (const selector of SELECTORS) {
          const a = oldStyles[selector], b = v2Styles[selector];
          if (!a && !b) continue;
          if (!a || !b) { differing.push({ selector, note: !a ? 'chỉ có ở app-v2' : 'chỉ có ở app cũ' }); continue; }
          const props = PROPS.filter((prop) => a[prop] !== b[prop]);
          if (props.length) differing.push({ selector, props: props.map((prop) => `${prop}: cũ="${a[prop]}" v2="${b[prop]}"`) });
        }
        measured[surface] = differing.length;
        const allowed = baseline.surfaces[surface];
        if (allowed == null) {
          if (differing.length && !updateBaseline) failures.push(`${surface}: surface MỚI còn ${differing.length} selector lệch style, chưa có baseline`);
        } else if (differing.length > allowed) {
          failures.push(`${surface}: ${differing.length} selector lệch style, baseline ${allowed}`);
        }
        if (differing.length) {
          details.push(`  ${surface} (${differing.length}/${allowed == null ? '—' : allowed}):`);
          for (const item of differing) {
            details.push(`    ${item.selector}${item.note ? ' — ' + item.note : ''}`);
            for (const line of item.props || []) details.push(`        ${line}`);
          }
        }
        console.log(`Style parity ${surface}: ${differing.length} selector lệch`);
      }
    }
  } finally {
    if (v2Page) await v2Page.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await oldSession.close();
  }

  if (updateBaseline) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({
      note: baseline.note || 'Baseline gate style parity — SỐ selector còn lệch computed style so với app cũ, theo từng surface. Chỉ siết bằng --update-baseline sau khi thật sự sửa; đừng nâng số bằng tay.',
      updatedAt: new Date().toISOString(),
      surfaces: measured,
    }, null, 2)}\n`, 'utf8');
    console.log(`\nĐã ghi baseline cho ${Object.keys(measured).length} surface vào ${path.relative(ROOT, BASELINE_PATH)}.`);
    return;
  }

  if (details.length) console.log(`\nCHI TIẾT:\n${details.join('\n')}`);
  if (failures.length) {
    console.error(`\nFAIL:\n${failures.map((line) => `  - ${line}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`\nStyle parity: ${Object.keys(measured).length} surface đạt (không surface nào vượt baseline).`);
}

main().catch((error) => { console.error(`LỖI: ${error.message}`); process.exit(1); });
