// Lát 0 của dự án "xóa dần global bridge" (xem plan đã duyệt 2026-08-20).
// Quét TOÀN BỘ `root.X=` trong src/compat/modular-pilot.global.ts và phân loại
// từng tên. CHỈ ĐỌC — không sửa modular-pilot.global.ts. Chạy:
//   node scripts/bridge-audit.js
//
// LỊCH SỬ SỬA — hai lượt đầu SAI, ghi lại để không tái phạm:
// (1) Lượt đầu chỉ quét literal `data-action="tenHam"` trong HTML — bỏ sót
//     toàn bộ dạng object `btn(label,{action:'tenHam',args:[...]},cls)` mà
//     hầu hết Pha H2 dùng (ui-primitives.ts mới sinh ra data-action lúc CHẠY).
//     Xác nhận sai bằng ví dụ thật: dashViewTestInEntry bị gắn nhãn DEAD dù
//     rõ ràng là action thật (dashboard-test-action.ts).
// (2) Lượt hai thêm object-form nhưng CROSS-FILE-READ vẫn ra 0 vì loại
//     modular-pilot.global.ts khỏi phạm vi quét — trong khi phần lớn "tiêu
//     thụ" một root.X= THẬT SỰ xảy ra ngay TRONG CHÍNH file đó (đọc lại qua
//     (root as any).X/(globalThis as any).X/root.X!/bare X() ở một chỗ khác,
//     đúng mẫu "lazy closure for testability" đã ghi khắp CLAUDE.md). Lấy mẫu
//     10 tên ngẫu nhiên trong danh sách DEAD của lượt hai rồi tự tay grep —
//     10/10 đều đang được dùng thật (qua tự-tham-chiếu trong bridge, qua
//     tests/typescript-module-pilot.test.js ghim bằng assert.match, hoặc qua
//     deps.pres.X sau một lớp alias `pres: root as any`). Kết luận: KHÔNG thể
//     đơn giản loại trừ chính bridge file khỏi việc đếm "còn ai đọc" — phải
//     đếm SỐ LẦN xuất hiện của tên trong TOÀN VĂN bridge file (không chỉ dòng
//     gán), cộng kiểm tra riêng biệt trong test/các file .ts khác.
//
// Vì các bẫy trên, script này đặt tiêu chí DEAD rất khắt khe — MỌI điều kiện
// dưới đây phải cùng đúng mới xếp một tên vào DEAD:
//   - không thuộc tập action-name (HTML/object-form/index.html)
//   - từ khóa (word-boundary) của tên đó xuất hiện ĐÚNG 1 LẦN trong toàn văn
//     bridge file (chính là dòng gán) — nghĩa là KHÔNG có tự-tham-chiếu nào khác
//   - không xuất hiện ở đâu trong TOÀN BỘ tests/*.test.js (không chỉ 16 file
//     override đã biết)
//   - không xuất hiện dạng `.NAME` ở bất kỳ file .ts nào khác dưới src/
//     (bắt được cả deps.pres.X và mọi kiểu alias khác, dù rộng tay hơn cần
//     thiết — thà giữ nhầm còn hơn xóa nhầm)
// Ngay cả khi qua hết 4 điều kiện, DANH SÁCH DEAD vẫn chỉ là ỨNG VIÊN — mỗi
// tên phải xóa RỒI CHẠY GATE (typecheck/build/test/ui-check/...) mới được
// coi là xong, không tin script này một mình.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BRIDGE_FILE = path.join(ROOT, 'src', 'compat', 'modular-pilot.global.ts');
const bridgeSrc = fs.readFileSync(BRIDGE_FILE, 'utf8');

function walk(dir, exts, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
}
function countWordOccurrences(text, name) {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

// ---------- 1) Tập tên root.X= trong bridge ----------
const rootAssignRe = /^root\.(\w+)\s*=/gm;
const rootNames = new Set();
{
  let m;
  while ((m = rootAssignRe.exec(bridgeSrc))) rootNames.add(m[1]);
}

// ---------- 2) Tập tên action (HTML literal + object-form + index.html) ----------
const ACTION_ATTRS = [
  'data-action', 'data-keydown-action', 'data-mousemove-action', 'data-notify-changed',
  'data-input-action', 'data-focus-action', 'data-change-action', 'data-toggle-action',
];
const actionNames = new Set();
const dynamicActionSites = [];
const srcTsFiles = [];
walk(path.join(ROOT, 'src'), ['.ts'], srcTsFiles);
{
  const files = [...srcTsFiles, path.join(ROOT, 'index.html')];
  const attrRe = new RegExp(`(${ACTION_ATTRS.join('|')})=(?:"([^"]*)"|'([^']*)')`, 'g');
  const objectFormRe = /\{\s*action\s*:\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = attrRe.exec(text))) {
      const value = m[2] !== undefined ? m[2] : m[3];
      if (/^[A-Za-z_$][\w$]*$/.test(value)) actionNames.add(value);
      else dynamicActionSites.push({ file: path.relative(ROOT, file), attr: m[1], value });
    }
    while ((m = objectFormRe.exec(text))) {
      const value = m[1] !== undefined ? m[1] : m[2];
      if (/^[A-Za-z_$][\w$]*$/.test(value)) actionNames.add(value);
    }
  }
}
['toggleSidebarNav', 'exportData'].forEach((n) => actionNames.add(n));
// reagentPageController: gán theo vòng lặp Object.keys, không lộ tên qua grep tĩnh trên bridge.
{
  const factoryFile = path.join(ROOT, 'src', 'presentation', 'reagent', 'reagent-page-controller.ts');
  if (fs.existsSync(factoryFile)) {
    const factorySrc = fs.readFileSync(factoryFile, 'utf8');
    const returnMatch = factorySrc.match(/return\s*\{([\s\S]*?)\};/);
    if (returnMatch) {
      returnMatch[1].split(',').forEach((part) => {
        const name = part.trim().split(':')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) actionNames.add(name);
      });
    }
  }
}

// ---------- 3) Test files: mọi tham chiếu (không chỉ override), + danh sách override riêng để ghi chú ----------
const TEST_OVERRIDE_FILES = new Set([
  'action-workflow-service.test.js', 'backup-download-bridge.test.js', 'backup-roundtrip.test.js',
  'render-downsampling.test.js', 'sigma-comp.test.js', 'local-store.test.js', 'audit-chain-cache.test.js',
  'firebase-merge.test.js', 'lis-client-service.test.js', 'manage-config-service.test.js',
  'manage-history-bridge.test.js', 'report-xlsx.test.js', 'sigma-print.test.js', 'sigma-xlsx.test.js',
  'westgard-print.test.js', 'westgard-worker.test.js',
]);
const testFiles = [];
walk(path.join(ROOT, 'tests'), ['.test.js'], testFiles);
const testReferences = new Map(); // name -> [files]
for (const fpath of testFiles) {
  const text = fs.readFileSync(fpath, 'utf8');
  const fname = path.basename(fpath);
  for (const name of rootNames) {
    if (countWordOccurrences(text, name) > 0) {
      if (!testReferences.has(name)) testReferences.set(name, []);
      testReferences.get(name).push(fname);
    }
  }
}

// ---------- 4) Tự-tham-chiếu trong CHÍNH bridge file (đếm toàn văn, không loại trừ file) ----------
const selfReferenced = new Set();
for (const name of rootNames) {
  if (countWordOccurrences(bridgeSrc, name) > 1) selfReferenced.add(name);
}

// ---------- 5) `.NAME` ở file .ts KHÁC dưới src/ (bắt cả deps.pres.X và mọi alias khác, rộng tay có chủ đích) ----------
const propertyAccessElsewhere = new Map(); // name -> [files]
for (const file of srcTsFiles) {
  if (file === BRIDGE_FILE) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const name of rootNames) {
    if (propertyAccessElsewhere.has(name) && propertyAccessElsewhere.get(name).length >= 3) continue; // đủ ví dụ, khỏi quét thêm cho tên này
    const re = new RegExp(`\\.${name}\\b`);
    if (re.test(text)) {
      const rel = path.relative(ROOT, file);
      if (!propertyAccessElsewhere.has(name)) propertyAccessElsewhere.set(name, []);
      if (!propertyAccessElsewhere.get(name).includes(rel)) propertyAccessElsewhere.get(name).push(rel);
    }
  }
}

// ---------- 6) Phân loại — DEAD chỉ khi KHÔNG khớp bất kỳ điều kiện "còn dùng" nào ----------
const classification = { 'KEEP-ACTION': [], 'KEEP-TEST-REFERENCED': [], 'KEEP-SELF-REFERENCED': [], 'KEEP-PROPERTY-ACCESS-ELSEWHERE': [], DEAD: [] };
for (const name of rootNames) {
  if (actionNames.has(name)) classification['KEEP-ACTION'].push(name);
  else if (testReferences.has(name)) classification['KEEP-TEST-REFERENCED'].push(name);
  else if (selfReferenced.has(name)) classification['KEEP-SELF-REFERENCED'].push(name);
  else if (propertyAccessElsewhere.has(name)) classification['KEEP-PROPERTY-ACCESS-ELSEWHERE'].push(name);
  else classification.DEAD.push(name);
}

// ---------- 7) Báo cáo ----------
const lines = [];
lines.push('# Báo cáo phân loại global bridge (Lát 0, tự động — ' + new Date().toISOString().slice(0, 10) + ', lượt 3 — sau khi sửa 2 lỗi phát hiện qua lấy mẫu tay)');
lines.push('');
lines.push(`Tổng số \`root.X=\` trong \`src/compat/modular-pilot.global.ts\`: **${rootNames.size}**`);
lines.push('');
lines.push('| Nhóm | Số lượng | Ý nghĩa |');
lines.push('| --- | --- | --- |');
lines.push(`| KEEP-ACTION | ${classification['KEEP-ACTION'].length} | data-action-family (literal hoặc object-form) trong HTML/TS hoặc index.html |`);
lines.push(`| KEEP-TEST-REFERENCED | ${classification['KEEP-TEST-REFERENCED'].length} | xuất hiện ở ít nhất 1 file tests/*.test.js (override sau nạp HOẶC chỉ được assert tồn tại, ví dụ typescript-module-pilot.test.js) |`);
lines.push(`| KEEP-SELF-REFERENCED | ${classification['KEEP-SELF-REFERENCED'].length} | được chính modular-pilot.global.ts đọc lại ở một chỗ khác (nội bộ wiring) |`);
lines.push(`| KEEP-PROPERTY-ACCESS-ELSEWHERE | ${classification['KEEP-PROPERTY-ACCESS-ELSEWHERE'].length} | có \`.NAME\` xuất hiện ở một file .ts khác dưới src/ (rộng tay — có thể trùng tên tình cờ, cần soi tay) |`);
lines.push(`| **DEAD** | **${classification.DEAD.length}** | không khớp điều kiện "còn dùng" nào trên — ứng viên xóa, PHẢI xác nhận lại bằng gate trước khi xóa thật |`);
lines.push('');
lines.push(`(16 file test override sau-khi-nạp đã biết trước: ${[...TEST_OVERRIDE_FILES].join(', ')} — vẫn nằm trong KEEP-TEST-REFERENCED, không tách riêng ở lượt này vì tiêu chí test đã rộng hơn.)`);
lines.push('');
if (dynamicActionSites.length) {
  lines.push(`## Chỗ tên action tính động (không lộ qua grep tĩnh, ${dynamicActionSites.length} chỗ, cần soi tay riêng)`);
  dynamicActionSites.forEach((s) => lines.push(`- ${s.file}: ${s.attr}="${s.value}"`));
  lines.push('');
}
lines.push('## Danh sách DEAD (ứng viên xóa `root.X=` — sắp xếp theo dòng trong file)');
lines.push('');
const deadWithLines = classification.DEAD.map((name) => {
  const re = new RegExp(`^root\\.${name}\\s*=`, 'm');
  const idx = bridgeSrc.search(re);
  const lineNo = bridgeSrc.slice(0, idx).split('\n').length;
  return { name, lineNo };
}).sort((a, b) => a.lineNo - b.lineNo);
deadWithLines.forEach(({ name, lineNo }) => lines.push(`- L${lineNo}: \`${name}\``));

const outPath = path.join(ROOT, 'docs', 'bridge-audit-report.md');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log('Tổng root.X=:', rootNames.size);
console.log('KEEP-ACTION:', classification['KEEP-ACTION'].length);
console.log('KEEP-TEST-REFERENCED:', classification['KEEP-TEST-REFERENCED'].length);
console.log('KEEP-SELF-REFERENCED:', classification['KEEP-SELF-REFERENCED'].length);
console.log('KEEP-PROPERTY-ACCESS-ELSEWHERE:', classification['KEEP-PROPERTY-ACCESS-ELSEWHERE'].length);
console.log('DEAD:', classification.DEAD.length);
console.log('Đã ghi báo cáo đầy đủ vào', path.relative(ROOT, outPath));
