'use strict';
// Gate "class chết" của app — viết lại 2026-09-11.
//
// BẢN CŨ so class của app với `assets/*.css` của app cũ: "app cũ có rule mà
// app không có" = FAIL. Nghĩa là nó khẳng định app PHẢI giống app cũ về
// giao diện — đúng cơ chế đã kéo ngược mọi cải tiến giao diện của người dùng.
// Quyết định 2026-09-11: app cũ chỉ là tham khảo, app viết code mới. Gate
// này vì vậy không còn đọc `assets/` nữa.
//
// Việc nó làm bây giờ, và CHỈ việc đó: tìm class được dùng trong
// `app/renderer/**/*.tsx` mà KHÔNG có rule nào trong
// `app/renderer/styles/**/*.css`. Đây là lỗi thật và tự đứng vững, không
// cần so với bản nào khác: hoặc CSS bị quên, hoặc class đã chết sau một lần
// đổi tên.
//
// Ratchet theo `app/tests/css-dead-class-baseline.json` (cùng quy ước với
// `tests/a11y-ratchet.json`/`css-hex-ratchet` của repo gốc): danh sách hiện có
// là class dùng làm ĐỊNH DANH cho JS/test chứ không phải để style (`tm-mean`,
// `cfg-assay-rule`…) lẫn class thật sự đã chết chưa dọn. Class MỚI không có
// rule thì FAIL. Siết baseline bằng
// `node app/scripts/css-parity-check.cjs --update-baseline`, không sửa tay
// để cho qua.
//
// GIỚI HẠN: chỉ đọc `className="..."`/`className={`...`}`; class dựng hoàn
// toàn bằng biến bị bỏ qua. Chỉ kiểm "CÓ rule hay KHÔNG", không kiểm giá trị
// rule hay ngữ cảnh `@media`.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const RENDERER = path.join(ROOT, 'app', 'renderer');
const V2_STYLES = path.join(RENDERER, 'styles');
const BASELINE = path.join(ROOT, 'app', 'tests', 'css-dead-class-baseline.json');

function walk(dir, ext, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, ext, out);
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}

const readAll = (files) => files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const usedClasses = new Set();
for (const file of walk(RENDERER, '.tsx')) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = (match[1] || match[2] || '').replace(/\$\{[^}]*\}/g, ' ');
    // Bỏ token KẾT THÚC bằng '-': đó là tiền tố của class ghép động
    // (`className={`levels-${n}`}` → sau khi xoá ${...} còn lại 'levels-'),
    // không phải một class hoàn chỉnh. Class thật (`levels-2`) có rule CSS
    // riêng; đếm phần cụt là báo chết oan cho code đang chạy đúng.
    for (const cls of raw.split(/\s+/)) if (/^[a-z][a-z0-9-]{2,}$/i.test(cls) && !cls.endsWith('-')) usedClasses.add(cls);
  }
}

const v2Css = stripComments(readAll(walk(V2_STYLES, '.css')));
const hasRule = (cls) => new RegExp('\\.' + cls.replace(/-/g, '\\-') + '(?![\\w-])').test(v2Css);

const dead = [...usedClasses].filter((cls) => !hasRule(cls)).sort();
const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { allowed: [] };
const allowed = new Set(baseline.allowed || []);

if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: 'Class dùng trong renderer mà không có rule CSS nào trong app/renderer/styles. Phần lớn là class định danh cho JS/test; phần còn lại là class chết chưa dọn. Chỉ siết xuống, không nới thêm bằng tay.',
    allowed: dead,
  }, null, 2) + '\n');
  console.log(`Đã ghi baseline: ${dead.length} class không có rule CSS.`);
  process.exit(0);
}

const added = dead.filter((cls) => !allowed.has(cls));
const fixed = [...allowed].filter((cls) => usedClasses.has(cls) && hasRule(cls)).sort();

console.log(`Class chết: ${usedClasses.size} class app đang dùng, ${dead.length} không có rule CSS (baseline ${allowed.size}).`);
if (fixed.length) console.log(`  ${fixed.length} class trong baseline nay đã có CSS — chạy --update-baseline để siết: ${fixed.join(', ')}`);
if (added.length) {
  console.error(`\nFAIL: ${added.length} class MỚI không có rule CSS nào trong app/renderer/styles/:`);
  for (const cls of added) console.error('  - ' + cls);
  console.error('\nHoặc viết CSS cho nó, hoặc bỏ class khỏi JSX. Nếu đây là class định danh');
  console.error('cố ý không style, chạy --update-baseline để ghi nhận.');
  process.exit(1);
}
console.log('Class chết: đạt — không có class mới nào thiếu CSS.');
