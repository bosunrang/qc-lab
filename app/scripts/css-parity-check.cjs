'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const RENDERER = path.join(ROOT, 'app', 'renderer');
const STYLES_DIR = path.join(RENDERER, 'styles');
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

const stylesCss = stripComments(readAll(walk(STYLES_DIR, '.css')));
const hasRule = (cls) => new RegExp('\\.' + cls.replace(/-/g, '\\-') + '(?![\\w-])').test(stylesCss);

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


