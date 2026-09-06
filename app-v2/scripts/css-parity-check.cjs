'use strict';
// Gate CSS parity — bù ĐÚNG điểm mù của `app-v2:ui-parity` (2026-09-03).
//
// Gate UI parity so TẬP class trong vùng nội dung của app cũ với app-v2 theo
// chiều "cũ CÓ mà v2 THIẾU". Nghĩa là một class CÓ trong DOM app-v2 (nên
// không bị coi là thiếu) mà KHÔNG có rule CSS nào trong app-v2 vẫn qua gate —
// dù app cũ có rule thật và hiển thị hoàn toàn khác. Lần rà đầu tiên bằng
// công cụ này tìm ra 30 class như vậy, trong đó có những thứ làm vỡ hẳn bố
// cục: `.sg-setup-fields` (lưới 3 cột của panel "Thiết lập phân tích" Six
// Sigma), `.action-form-panel-head`, `.issue-group`, `.lot-config-left/right`,
// `.wg-rule-item`, `.qc-note-input`, `.range-band-note`, `.rc-*-btn`.
//
// Cách đo: lấy mọi class xuất hiện trong `className` của
// `app-v2/renderer/**/*.tsx`, rồi FAIL nếu class đó có selector trong
// `assets/*.css` (app cũ style thật) mà không có selector nào trong
// `app-v2/renderer/styles/**/*.css`.
//
// GIỚI HẠN đã biết, ghi rõ để không ai tưởng gate này mạnh hơn thực tế:
//   - Chỉ kiểm "CÓ rule hay KHÔNG", không so GIÁ TRỊ rule. Một rule copy sai
//     giá trị, hoặc copy đúng nhưng đặt sai ngữ cảnh `@media` (đã gặp thật:
//     2 rule `.sg-data-head` mobile của app cũ bị copy ra ngoài media nên
//     desktop cũng xếp dọc), gate này KHÔNG thấy — phải đo bằng
//     `getBoundingClientRect()`/ảnh chụp.
//   - Chỉ đọc `className="..."`/`className={`...`}`; class dựng động hoàn
//     toàn bằng biến sẽ bị bỏ qua.
//   - Class KHÔNG bên nào có CSS được liệt kê riêng, KHÔNG tính là lỗi (phần
//     lớn là class chỉ dùng để test/định danh, vd `entryLJStack`).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const RENDERER = path.join(ROOT, 'app-v2', 'renderer');
const V2_STYLES = path.join(RENDERER, 'styles');
const OLD_CSS_DIR = path.join(ROOT, 'assets');

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
    for (const cls of raw.split(/\s+/)) if (/^[a-z][a-z0-9-]{2,}$/i.test(cls)) usedClasses.add(cls);
  }
}

const v2Css = stripComments(readAll(walk(V2_STYLES, '.css')));
const oldCss = stripComments(readAll(
  fs.readdirSync(OLD_CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => path.join(OLD_CSS_DIR, f)),
));
const hasRule = (css, cls) => new RegExp('\\.' + cls.replace(/-/g, '\\-') + '(?![\\w-])').test(css);

const missing = [...usedClasses].filter((c) => hasRule(oldCss, c) && !hasRule(v2Css, c)).sort();
const neither = [...usedClasses].filter((c) => !hasRule(oldCss, c) && !hasRule(v2Css, c)).sort();

console.log(`CSS parity: ${usedClasses.size} class app-v2 đang dùng.`);
console.log(`  ${neither.length} class không bên nào có CSS (bỏ qua): ${neither.join(', ') || '—'}`);
if (missing.length) {
  console.error(`\nFAIL: ${missing.length} class app cũ CÓ CSS mà app-v2 KHÔNG có rule nào:`);
  for (const cls of missing) console.error('  - ' + cls);
  console.error('\nPort rule tương ứng từ assets/*.css sang app-v2/renderer/styles/, giữ nguyên');
  console.error('ngữ cảnh @media của bản cũ (rule mobile copy ra ngoài media sẽ đè lên desktop).');
  process.exit(1);
}
console.log('CSS parity: đạt — mọi class app cũ style thật đều có rule ở app-v2.');
