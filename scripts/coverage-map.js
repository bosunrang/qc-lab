// Bản đồ điểm mù của bộ test — `npm run coverage-map`.
//
// Repo có 60+ file test nhưng cho tới 2026-08-01 không có công cụ đo độ phủ nào,
// nên con số "60 test" không trả lời được câu duy nhất đáng hỏi: phần nào của
// sigma.js (file lớn nhất repo), manage-tests-actions.js, firebase-sync.js chưa có
// dòng nào chạm tới? Script này lấy câu trả lời bằng cờ đo độ phủ CÓ SẴN của Node
// (`NODE_V8_COVERAGE`) — không cài thêm gì, đúng tinh thần phần còn lại của repo.
//
// Đây KHÔNG phải cổng chặn: nó không có ngưỡng, không exit 1 vì độ phủ thấp (chỉ
// exit 1 khi bản thân bộ test hỏng hoặc không đọc được dữ liệu độ phủ). Mục đích
// là bản đồ để quyết định tách file / viết test tiếp, không phải một con số để đuổi.
//
// Cách đọc số: các file render (draw.js, sigma.js, *-routes.js) chỉ chạy được phần
// thuần trong sandbox `vm` — phần dựng DOM không gọi được, nên độ phủ thấp ở đó là
// ĐÚNG NHƯ THIẾT KẾ chứ không phải nợ test. Điểm đáng chú ý là hàm *thuần* mà chưa
// test nào chạm tới.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'docs', 'coverage-map.md');

/** Mọi file .js dưới assets/, trả về đường dẫn tương đối kiểu 'modules/state.js'. */
function assetFiles(dir = ASSETS, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) return assetFiles(path.join(dir, e.name), rel);
    return e.name.endsWith('.js') ? [rel] : [];
  });
}

/* Sandbox nạp file app qua vm nên url của script là đường dẫn tương đối
   ('modules/state.js'); core.js còn được require() nên xuất hiện thêm dưới dạng
   file:// URL. Quy cả hai về cùng một khóa. */
function assetKey(url, known) {
  if (known.has(url)) return url;
  if (!url.startsWith('file:')) return null;
  const decoded = decodeURIComponent(url.replace(/^file:\/\/\/?/, '')).replace(/\\/g, '/');
  const at = decoded.toLowerCase().indexOf('/assets/');
  if (at === -1) return null;
  const rel = decoded.slice(at + '/assets/'.length);
  return known.has(rel) ? rel : null;
}

/* V8 trả về danh sách hàm, mỗi hàm có các range lồng nhau. Quy ước: range ngoài
   phủ trước, range trong ghi đè — nên sắp theo (bắt đầu tăng, kết thúc giảm) rồi
   tô tuần tự. Một ký tự coi là ĐÃ CHẠY nếu BẤT KỲ tiến trình test nào tô count > 0
   (mỗi file test là một tiến trình riêng, nạp lại sandbox từ đầu). */
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

  const known = new Set(assetFiles());
  const sources = new Map(), covered = new Map(), sizeKB = new Map(), deadFns = new Map(), liveFns = new Map(), loaded = new Set();
  for (const rel of known) {
    const src = fs.readFileSync(path.join(ASSETS, rel), 'utf8');
    sources.set(rel, src);
    // Offset của V8 tính theo ký tự nguồn (UTF-16), KHÔNG theo byte UTF-8 — mã
    // nguồn ở đây đầy tiếng Việt nên hai con số lệch nhau đáng kể (sigma.js: 78 KB
    // trên đĩa nhưng chỉ ~73k ký tự). Độ phủ phải đếm theo KÝ TỰ để khớp offset của
    // V8; còn cột KB trong bảng phải là kích thước THẬT trên đĩa, nếu không nó
    // không khớp với bất kỳ con số KB nào khác trong repo.
    covered.set(rel, new Uint8Array(src.length));
    sizeKB.set(rel, Buffer.byteLength(src, 'utf8') / 1024);
    deadFns.set(rel, new Map());
    liveFns.set(rel, new Set());
  }

  let scripts = 0;
  for (const file of fs.readdirSync(covDir).filter(f => f.endsWith('.json'))) {
    const payload = JSON.parse(fs.readFileSync(path.join(covDir, file), 'utf8'));
    for (const script of payload.result || []) {
      const rel = assetKey(script.url, known);
      if (!rel) continue;
      scripts++;loaded.add(rel);
      paint(covered.get(rel), script.functions || [], covered.get(rel).length);
      for (const fn of script.functions || []) {
        const name = fn.functionName || '';
        if (!name) continue;
        // Khóa theo TÊN + VỊ TRÍ, không chỉ tên: một file có thể có nhiều hàm trùng
        // tên (callback `onerror`, helper lồng nhau). Khóa bằng tên không thì chỉ cần
        // MỘT trong số đó chạy là cả nhóm được tính là đã chạy — bản đồ điểm mù báo
        // thiếu đúng thứ nó sinh ra để tìm. Offset ổn định giữa các tiến trình test
        // nên vẫn gộp đúng cùng một hàm qua nhiều file độ phủ.
        const at = fn.ranges && fn.ranges[0] ? fn.ranges[0].startOffset : 0, key = `${name}@${at}`;
        const ran = (fn.ranges || []).length > 0 && fn.ranges[0].count > 0;
        if (ran) liveFns.get(rel).add(key);
        else if (!deadFns.get(rel).has(key)) deadFns.get(rel).set(key, { name, at });
      }
    }
  }
  fs.rmSync(covDir, { recursive: true, force: true });
  if (!scripts) {
    console.error('Không thấy file assets nào trong dữ liệu độ phủ — sandbox có còn nạp qua vm không?');
    process.exitCode = 1;
    return;
  }

  const rows = [...known].map((rel) => {
    const chars = covered.get(rel), total = chars.length;
    let hit = 0;
    for (let i = 0; i < total; i++) if (chars[i]) hit++;
    const dead = [...deadFns.get(rel).entries()].filter(([key]) => !liveFns.get(rel).has(key)).map(([, fn]) => fn);
    return { rel, total, hit, kb: sizeKB.get(rel), pct: total ? (hit / total) * 100 : 0, uncovered: total - hit, dead, loaded: loaded.has(rel) };
  }).filter(r => r.total > 0).sort((a, b) => b.uncovered - a.uncovered);

  const totalChars = rows.reduce((s, r) => s + r.total, 0), totalHit = rows.reduce((s, r) => s + r.hit, 0);
  const lines = [];
  lines.push('# Bản đồ điểm mù của bộ test');
  lines.push('');
  lines.push('Sinh bằng `npm run coverage-map` (`NODE_V8_COVERAGE` của Node, không cài thêm gì).');
  lines.push('**Không phải cổng chặn** — không có ngưỡng nào, đây là bản đồ để quyết định viết test');
  lines.push('hoặc tách file. Phần dựng DOM của các file render không gọi được trong sandbox `vm`,');
  lines.push('nên độ phủ thấp ở đó là đúng thiết kế; thứ đáng nhìn là **hàm thuần chưa ai chạm tới**.');
  lines.push('');
  lines.push(`Sinh ngày ${new Date().toISOString().slice(0, 10)} · Node ${process.version} · `
    + `${rows.length} file · ${(totalHit / totalChars * 100).toFixed(1)}% mã nguồn đã chạy.`);
  lines.push('');
  const never = rows.filter(r => !r.loaded);
  if (never.length) {
    lines.push(`## ${never.length} file KHÔNG test nào nạp tới`);
    lines.push('');
    lines.push('Không phải "độ phủ thấp" mà là **không có dữ liệu độ phủ nào** — chưa test nào');
    lines.push('nạp file này vào sandbox. Với file render thuần DOM thì đó là giới hạn của');
    lines.push('sandbox `vm`; với file có hàm thuần thì đây là điểm mù thật.');
    lines.push('');
    never.forEach(r => lines.push(`- \`${r.rel}\` (${r.kb.toFixed(1)} KB)`));
    lines.push('');
  }
  lines.push('## Toàn bộ file');
  lines.push('');
  lines.push('| File | KB | % mã đã chạy | Ký tự chưa chạy | Hàm chưa từng chạy |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const r of rows) {
    const pct = r.loaded ? `${r.pct.toFixed(1)}%` : 'chưa nạp';
    lines.push(`| \`${r.rel}\` | ${r.kb.toFixed(1)} | ${pct} | ${r.uncovered.toLocaleString('vi-VN')} | ${r.loaded ? r.dead.length : '—'} |`);
  }
  lines.push('');
  lines.push('## Hàm chưa từng chạy (10 hàm đầu mỗi file, theo thứ tự xuất hiện)');
  lines.push('');
  for (const r of rows.filter(x => x.dead.length)) {
    const src = sources.get(r.rel);
    const list = r.dead.slice().sort((a, b) => a.at - b.at).slice(0, 10)
      .map(fn => `\`${fn.name}\` (dòng ${lineOf(src, fn.at)})`).join(' · ');
    lines.push(`- **${r.rel}** — ${r.dead.length} hàm: ${list}${r.dead.length > 10 ? ' …' : ''}`);
  }
  lines.push('');
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

  console.log(`\nTổng: ${(totalHit / totalChars * 100).toFixed(1)}% mã nguồn đã chạy trên ${rows.length} file assets `
    + `(${never.length} file chưa test nào nạp tới).`);
  console.log('Năm file nhiều mã chưa chạy nhất:');
  rows.slice(0, 5).forEach(r => console.log(`  ${r.rel.padEnd(38)} ${(r.loaded ? r.pct.toFixed(1) + '%' : 'chưa nạp').padStart(8)}  ${r.loaded ? r.dead.length + ' hàm chưa chạy' : ''}`));
  console.log(`\nBản đồ đầy đủ: ${path.relative(ROOT, OUT)}`);
}

main();
