// Global name uniqueness: mọi surface CÒN THẬT SỰ chia sẻ một global scope
// (root.X=/window.X=/globalThis.X= trên `assets/core.js` + mọi bundle trong
// `assets/generated/`) phải có tên duy nhất — một module gán lại tên đã có
// sẽ âm thầm GHI ĐÈ binding của module kia; lỗi chỉ lộ ra khi đường code bị
// đè chạy tới, có thể vài tuần sau và ở một tính năng khác. Không trình biên
// dịch nào bắt được lỗi này; bài test này bắt, giống cách
// button-conventions.test.js áp quy ước nút bấm.
//
// Giai đoạn 9 (composition root viết lại/gộp bundle, Bước 1, 2026-08-31) —
// ĐÃ BỎ HẲN cơ chế quét cột-0 cho `function name(`/`const/let/var a=...`
// từng có ở đây. Lý do, xác nhận qua đo thực nghiệm: từ khi
// `assets/core.js`/`assets/generated/*.js` trở thành bundle Rollup định dạng
// `iife` (2026-08-19/20), TOÀN BỘ nội dung file nằm trong MỘT hàm bọc ngoài
// duy nhất (`(function(){...})()` hoặc khuôn UMD tương đương) — bất kỳ
// `function`/`const`/`let`/`var` nào bên trong đó, DÙ nằm ở cột nào trong văn
// bản, đều CHỈ scope trong hàm bọc đó, KHÔNG BAO GIỜ rò rỉ ra global thật sự
// trừ khi được gán tường minh vào `root`/`window`/`globalThis` — đây chính
// là điều `root.X=`/`window.X=`/`globalThis.X=` bên dưới đã bắt trọn, không
// cần cơ chế nào khác. Đo trực tiếp trên 3 file build hiện tại xác nhận cơ
// chế cột-0 cũ tìm được ĐÚNG 0 kết quả (Rollup thụt lề lại bằng tab bên
// trong IIFE, không còn ở cột 0 nữa) — tức là nó đã hoàn toàn vô hiệu, không
// bảo vệ được gì thêm ngoài những gì `root.X=` đã bắt, từ lâu trước khi bài
// test này được viết lại. Giữ nó lại (dù vô hại với 2 bundle tách biệt hiện
// tại) sẽ là RÀO CẢN THẬT nếu gộp 2 bundle Vite thành một và bỏ minify: biến
// nội bộ của thư viện đóng gói (ví dụ zustand's `createStoreImpl`'s
// `let state`) sẽ bị hiểu nhầm thành "khai báo global" và báo trùng giả với
// tên tương tự ở bundle khác, dù hai scope không hề giao nhau. Bỏ cơ chế này
// không mất bảo vệ thật nào — chỉ bỏ một phép quét đã vô hiệu từ trước.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// assets/modules/ rỗng hoàn toàn từ 2026-08-20 (Pha G nhóm C xong) — git không
// theo dõi thư mục rỗng, nên nó có thể không tồn tại trên một checkout sạch;
// không còn quét thư mục này (sẽ không bao giờ có file classic nào nữa).
const FILES = [
  'assets/core.js',
  ...fs.readdirSync(path.join(ROOT, 'assets', 'generated'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => 'assets/generated/' + f),
];
// assets/workers/ có global scope RIÊNG (worker context), không quét chung.
// assets/nav-collapse-init.js là 1 dòng classic KHÔNG bọc IIFE (chạy trực
// tiếp như <script> thường, không defer) — cố tình KHÔNG đưa vào FILES vì nó
// không gán bất kỳ root.X=/window.X=/globalThis.X= nào (chỉ đọc/ghi 1 class
// trên <aside> qua DOM), không có gì để quét.

// Trích key của object literal phẳng `const state={k1:v1,k2:v2,...}` — pattern
// của các file *-ui-state.js (key trở thành global qua defineProperty).
function uiStateKeys(source) {
  const m = /const\s+state=\{/.exec(source);
  if (!m || !/defineProperty\(root,name/.test(source)) return [];
  const keys = [];
  let depth = 0, quote = null, i = m.index + m[0].length - 1; // đứng ở '{'
  for (; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) break; continue; }
    if (depth === 1 && /[A-Za-z_$]/.test(c) && (i === 0 || /[{,\s]/.test(source[i - 1]))) {
      const rest = /^([A-Za-z_$][\w$]*)\s*:/.exec(source.slice(i));
      if (rest) { keys.push(rest[1]); i += rest[0].length - 1; }
    }
  }
  return keys;
}

const seen = new Map(); // name -> [{file, line, kind:'decl'|'assign'}]
const add = (name, file, line, kind) => {
  if (!seen.has(name)) seen.set(name, []);
  seen.get(name).push({ file, line, kind });
};

for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of source.matchAll(/(?:root|window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
    add(m[1], file, source.slice(0, m.index).split('\n').length, 'assign');
  }
}

// UI state đã chuyển sang TypeScript nhưng các key vẫn trở thành global accessor
// cho caller cũ. Quét object trả về của từng create*UiState() để chúng tiếp tục
// tham gia kiểm tra trùng tên với các bundle còn lại. Đây là quét trên SOURCE
// TypeScript (không phải file build), không bị ảnh hưởng bởi cách Rollup đóng
// gói, nên giữ nguyên không đổi.
{
  const file = 'src/presentation/state/ui-state.ts';
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const factory of source.matchAll(/export function create[A-Za-z]+UiState\([^)]*\)\s*\{/g)) {
    const returnAt = source.indexOf('return {', factory.index + factory[0].length);
    if (returnAt < 0) continue;
    const fragment = 'const state=' + source.slice(returnAt + 'return '.length) + '\ndefineProperty(root,name)';
    for (const key of uiStateKeys(fragment)) {
      add(key, file, source.slice(0, returnAt).split('\n').length, 'decl');
    }
  }
}
{
  const file = 'src/compat/modular-pilot.global.ts';
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const match of source.matchAll(/installUiState\(root,\s*['"]([A-Za-z_$][\w$]*)['"]/g)) {
    add(match[1], file, source.slice(0, match.index).split('\n').length, 'assign');
  }
}

// Các cặp trùng CÓ CHỦ ĐÍCH, đã rà soát thủ công — mỗi mục phải kèm lý do.
// Không thêm mục mới nếu chưa xác nhận hai binding thật sự tương thích.
const KNOWN = new Set([
  // (hiện tại không có — mọi trùng lặp đều bị chặn)
]);

const duplicates = [];
for (const [name, sites] of seen) {
  if (sites.length < 2 || KNOWN.has(name)) continue;
  duplicates.push(`${name}: ${sites.map((s) => `${s.file}:${s.line}`).join(', ')}`);
}

assert.deepEqual(
  duplicates,
  [],
  'Tên global bị khai báo trùng — một module sẽ ghi đè âm thầm module kia:\n' + duplicates.join('\n'),
);

console.log(`Global name uniqueness tests passed (${seen.size} tên global trong ${FILES.length} file, 0 trùng)`);
