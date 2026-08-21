// Bản đồ điểm mù của bộ test — `npm run coverage-map`.
//
// SỬA 2026-08-21: bản gốc (2026-08-01) chỉ đo `assets/**/*.js` — hợp lý lúc đó vì
// gần như mọi logic còn là classic JS ở đó (sigma.js, manage-tests-actions.js,
// firebase-sync.js...). Sau khi toàn bộ các file đó retire sang TypeScript (Pha G
// nhóm C → Pha H → nhóm D, đóng 2026-08-20), `assets/**/*.js` chỉ còn 4 file: ba
// build artifact (`core.js`, `generated/modular-pilot.js`,
// `workers/westgard-worker.js`) và một tiện ích 1 dòng
// (`nav-collapse-init.js`) — đo coverage của "assets" gần như vô nghĩa, vì 99% mã
// nghiệp vụ thật giờ nằm dưới `src/**/*.ts`, nơi bản gốc không hề nhìn tới.
//
// Bản này đo CẢ HAI, tách riêng vì cơ chế nạp khác nhau:
//   (A) `src/**/*.ts` — phần lớn 612 file test import trực tiếp một file .ts qua
//       `spawnSync(process.execPath, ['--input-type=module', ...])`; mỗi lời gọi
//       là một tiến trình con, KẾ THỪA `NODE_V8_COVERAGE` từ tiến trình cha (không
//       file test nào override `env`, đã xác nhận bằng grep) nên V8 tự ghi coverage
//       cho tiến trình con đó với URL script chính là đường dẫn file .ts thật — bắt
//       được TRỰC TIẾP, không cần sourcemap.
//   (B) `assets/**/*.js` — ~61 file test còn lại nạp qua `tests/helpers/sandbox.js`
//       (`vm.runInContext` với `filename: relPath`) NGAY TRONG tiến trình
//       `node --test` chính — vẫn đo được coverage của chính các file build-artifact
//       này (không cần sourcemap vì đây đúng là file được nạp, chỉ là nó sinh ra từ
//       TypeScript thay vì viết tay) nhưng KHÔNG map ngược được về dòng nguồn .ts
//       gốc — mục (B) chỉ có nghĩa là "phần khởi tạo/wiring của bundle có chạy
//       không", không phải "hàm nghiệp vụ nào chưa test".
//
// Vẫn KHÔNG phải cổng chặn — không ngưỡng, không exit 1 vì độ phủ thấp (chỉ exit 1
// khi bộ test tự hỏng hoặc không thấy dữ liệu coverage nào).
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'docs', 'coverage-map.md');

function walk(dir, ext, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) return walk(path.join(dir, e.name), ext, rel);
    return e.name.endsWith(ext) ? [rel] : [];
  });
}

/* Quy cả hai nguồn URL script của V8 (file:// tuyệt đối cho .ts nạp qua import,
   relPath trần cho .js nạp qua vm.runInContext) về đúng MỘT khóa trong `known`,
   phân biệt bằng namespace ('ts:'/'asset:') vì hai cây file có thể trùng tên. */
function scriptKey(url, known) {
  const tsKey = 'ts:' + url;
  if (url.startsWith('file:')) {
    const decoded = decodeURIComponent(url.replace(/^file:\/\/\/?/, '')).replace(/\\/g, '/');
    const atSrc = decoded.toLowerCase().indexOf('/src/');
    if (atSrc !== -1) {
      const rel = 'ts:' + decoded.slice(atSrc + '/src/'.length);
      if (known.has(rel)) return rel;
    }
    const atAssets = decoded.toLowerCase().indexOf('/assets/');
    if (atAssets !== -1) {
      const rel = 'asset:' + decoded.slice(atAssets + '/assets/'.length);
      if (known.has(rel)) return rel;
    }
    return null;
  }
  const assetKey = 'asset:' + url;
  if (known.has(assetKey)) return assetKey;
  if (known.has(tsKey)) return tsKey; // phòng khi Node báo URL tương đối cho .ts (không thấy trong thực tế nhưng vô hại nếu có)
  return null;
}

function paint(covered, functions, size) {
  const ranges = functions.flatMap(fn => fn.ranges || []).slice()
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const local = new Uint8Array(size);
  for (const r of ranges) {
    const from = Math.max(0, r.startOffset), to = Math.min(size, r.endOffset);
    const on = r.count > 0 ? 1 : 0;
    for (let i = from; i < to; i++) local[i] = on;
  }
  for (let i = 0; i < size; i++) if (local[i]) covered[i] = 1;
}

function lineOf(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

function main() {
  const covDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qclab-coverage-'));
  console.log('Chạy bộ test với NODE_V8_COVERAGE...');
  const res = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_V8_COVERAGE: covDir },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const tail = String(res.stdout || '').split('\n').filter(l => /^ℹ (tests|pass|fail)/.test(l));
  tail.forEach(l => console.log('  ' + l));
  if (res.status !== 0) {
    console.error('Bộ test không pass — sửa test trước, bản đồ độ phủ mới có nghĩa.');
    console.error(String(res.stderr || '').slice(-2000));
    process.exitCode = 1;
    return;
  }

  const tsFiles = walk(SRC, '.ts').map(rel => 'ts:' + rel);
  const assetFilesList = walk(ASSETS, '.js').filter(rel => !rel.startsWith('generated/') || rel === 'generated/modular-pilot.js')
    .map(rel => 'asset:' + rel);
  const known = new Set([...tsFiles, ...assetFilesList]);

  const sources = new Map(), covered = new Map(), sizeKB = new Map(), deadFns = new Map(), liveFns = new Map(), loaded = new Set();
  for (const key of known) {
    const isTs = key.startsWith('ts:');
    const rel = key.slice(isTs ? 3 : 6);
    const abs = path.join(isTs ? SRC : ASSETS, rel);
    const src = fs.readFileSync(abs, 'utf8');
    sources.set(key, src);
    covered.set(key, new Uint8Array(src.length));
    sizeKB.set(key, Buffer.byteLength(src, 'utf8') / 1024);
    deadFns.set(key, new Map());
    liveFns.set(key, new Set());
  }

  let scripts = 0;
  for (const file of fs.readdirSync(covDir).filter(f => f.endsWith('.json'))) {
    const payload = JSON.parse(fs.readFileSync(path.join(covDir, file), 'utf8'));
    for (const script of payload.result || []) {
      const key = scriptKey(script.url, known);
      if (!key) continue;
      scripts++; loaded.add(key);
      paint(covered.get(key), script.functions || [], covered.get(key).length);
      for (const fn of script.functions || []) {
        const name = fn.functionName || '';
        if (!name) continue;
        const at = fn.ranges && fn.ranges[0] ? fn.ranges[0].startOffset : 0, fnKey = `${name}@${at}`;
        const ran = (fn.ranges || []).length > 0 && fn.ranges[0].count > 0;
        if (ran) liveFns.get(key).add(fnKey);
        else if (!deadFns.get(key).has(fnKey)) deadFns.get(key).set(fnKey, { name, at });
      }
    }
  }
  fs.rmSync(covDir, { recursive: true, force: true });
  if (!scripts) {
    console.error('Không thấy file src/assets nào trong dữ liệu độ phủ — cách nạp test đã đổi?');
    process.exitCode = 1;
    return;
  }

  function buildRows(prefix) {
    return [...known].filter(k => k.startsWith(prefix)).map((key) => {
      const chars = covered.get(key), total = chars.length;
      let hit = 0;
      for (let i = 0; i < total; i++) if (chars[i]) hit++;
      const dead = [...deadFns.get(key).entries()].filter(([k]) => !liveFns.get(key).has(k)).map(([, fn]) => fn);
      return { rel: key.slice(prefix.length), key, total, hit, kb: sizeKB.get(key), pct: total ? (hit / total) * 100 : 0, uncovered: total - hit, dead, loaded: loaded.has(key) };
    }).filter(r => r.total > 0).sort((a, b) => b.uncovered - a.uncovered);
  }
  const tsRows = buildRows('ts:');
  const assetRows = buildRows('asset:');

  const lines = [];
  lines.push('# Bản đồ điểm mù của bộ test');
  lines.push('');
  lines.push('Sinh bằng `npm run coverage-map` (`NODE_V8_COVERAGE` của Node, không cài thêm gì).');
  lines.push('**Không phải cổng chặn** — không có ngưỡng nào, đây là bản đồ để quyết định viết test');
  lines.push('hoặc tách file, không phải một con số để đuổi.');
  lines.push('');
  lines.push(`Sinh ngày ${new Date().toISOString().slice(0, 10)} · Node ${process.version}`);
  lines.push('');

  function section(title, rows, note) {
    lines.push(`## ${title}`);
    lines.push('');
    if (note) { lines.push(note); lines.push(''); }
    const totalChars = rows.reduce((s, r) => s + r.total, 0), totalHit = rows.reduce((s, r) => s + r.hit, 0);
    lines.push(`${rows.length} file · ${totalChars ? (totalHit / totalChars * 100).toFixed(1) : '0.0'}% ký tự đã chạy.`);
    lines.push('');
    const never = rows.filter(r => !r.loaded);
    if (never.length) {
      lines.push(`**${never.length} file KHÔNG test nào nạp tới** — không phải "độ phủ thấp" mà là không có dữ liệu coverage nào cho file đó:`);
      lines.push('');
      never.forEach(r => lines.push(`- \`${r.rel}\` (${r.kb.toFixed(1)} KB)`));
      lines.push('');
    }
    lines.push('| File | KB | % đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |');
    lines.push('|---|---:|---:|---:|---:|');
    for (const r of rows) {
      const pct = r.loaded ? `${r.pct.toFixed(1)}%` : 'chưa nạp';
      lines.push(`| \`${r.rel}\` | ${r.kb.toFixed(1)} | ${pct} | ${r.uncovered.toLocaleString('vi-VN')} | ${r.loaded ? r.dead.length : '—'} |`);
    }
    lines.push('');
    const withDead = rows.filter(x => x.dead.length);
    if (withDead.length) {
      lines.push('### Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)');
      lines.push('');
      for (const r of withDead) {
        const src = sources.get(r.key);
        const list = r.dead.slice().sort((a, b) => a.at - b.at).slice(0, 10)
          .map(fn => `\`${fn.name}\` (dòng ${lineOf(src, fn.at)})`).join(' · ');
        lines.push(`- **${r.rel}** — ${r.dead.length} hàm: ${list}${r.dead.length > 10 ? ' …' : ''}`);
      }
      lines.push('');
    }
  }

  section('A. `src/**/*.ts` — mã nghiệp vụ thật', tsRows,
    'Đo trực tiếp từ URL script thật của mỗi tiến trình test import file .ts — không qua sourcemap, không xấp xỉ.');
  section('B. `assets/**/*.js` — build artifact nạp qua vm sandbox', assetRows,
    'Chỉ còn 3 build artifact (`core.js`, `generated/modular-pilot.js`, `workers/westgard-worker.js`) + `nav-collapse-init.js` — KHÔNG map ngược được về dòng .ts nguồn (build không sinh sourcemap), nên số ở đây chỉ nói "phần khởi tạo/wiring của bundle có được chạy không", không phải "hàm nghiệp vụ nào thiếu test" — xem mục A cho câu đó.');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

  const tsTotal = tsRows.reduce((s, r) => s + r.total, 0), tsHit = tsRows.reduce((s, r) => s + r.hit, 0);
  console.log(`\nsrc/**/*.ts: ${tsTotal ? (tsHit / tsTotal * 100).toFixed(1) : '0.0'}% trên ${tsRows.length} file (${tsRows.filter(r => !r.loaded).length} chưa test nào nạp tới).`);
  console.log('Năm file .ts nhiều mã chưa chạy nhất:');
  tsRows.slice(0, 5).forEach(r => console.log(`  ${r.rel.padEnd(50)} ${(r.loaded ? r.pct.toFixed(1) + '%' : 'chưa nạp').padStart(8)}  ${r.loaded ? r.dead.length + ' hàm chưa chạy' : ''}`));
  console.log(`\nBản đồ đầy đủ: ${path.relative(ROOT, OUT)}`);
}

main();
