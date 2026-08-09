// Global name uniqueness: this app runs ~40 modules in ONE shared global scope
// (no bundler, no modules — see AGENTS.md "Architecture"). A top-level
// function/const/let that reuses a name already declared by another module
// silently SHADOWS or REPLACES that module's binding — the failure only shows
// up when the overwritten code path runs, which can be weeks later and in a
// different feature. No compiler catches this; this test does, the same way
// button-conventions.test.js enforces the button rule.
//
// Only Node core modules (pre-commit hook runs on cold checkouts, no npm
// install). The scanner is deliberately line/indent-based, matching this
// codebase's conventions: top-level declarations sit at column 0, nested code
// is indented, one logical declaration per line. It understands:
//   - `function name(` / `async function name(` at column 0
//   - `const/let/var a=..., b=...` declarator lists at column 0
//     (comma-splitting respects strings, template literals, and bracket depth,
//     so `const RCC={teal:'#x',...}` yields only `RCC`)
//   - `root.X=` / `window.X=` / `globalThis.X=` assignments (UMD + app-meta)
//   - các key từ factory UI state TypeScript, vì adapter biến chúng thành global
//     accessor qua Object.defineProperty
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'assets/core.js',
  'assets/app.js',
  ...fs.readdirSync(path.join(ROOT, 'assets', 'generated'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => 'assets/generated/' + f),
  ...fs.readdirSync(path.join(ROOT, 'assets', 'modules'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => 'assets/modules/' + f),
];
// assets/workers/ có global scope RIÊNG (worker context), không quét chung.

function declaratorNames(line) {
  const m = /^(?:const|let|var)\s+/.exec(line);
  if (!m) return [];
  const names = [];
  let depth = 0, quote = null, expectName = true;
  for (let i = m[0].length; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (c === ',' && depth === 0) { expectName = true; continue; }
    if (c === ';' && depth === 0) break;
    if (expectName) {
      if (/[A-Za-z_$]/.test(c)) {
        const id = /^[A-Za-z_$][\w$]*/.exec(line.slice(i))[0];
        names.push(id);
        i += id.length - 1;
      }
      expectName = false;
    }
  }
  return names;
}

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
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    const fn = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (fn) add(fn[1], file, idx + 1, 'decl');
    for (const name of declaratorNames(line)) add(name, file, idx + 1, 'decl');
  });
  for (const m of source.matchAll(/(?:root|window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
    add(m[1], file, source.slice(0, m.index).split('\n').length, 'assign');
  }
  for (const key of uiStateKeys(source)) add(key, file, 1, 'decl');
}

// UI state đã chuyển sang TypeScript nhưng các key vẫn trở thành global accessor
// cho caller cũ. Quét object trả về của từng create*UiState() để chúng tiếp tục
// tham gia kiểm tra trùng tên với các classic script còn lại.
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

// Re-export `globalThis.f=f` ngay trong file khai báo f là CÙNG một binding
// (ví dụ qc-rules.js), không phải ghi đè — bỏ các site 'assign' khi file đó
// đã có 'decl' cùng tên.
for (const [name, sites] of seen) {
  const collapsed = sites.filter((s) => !(s.kind === 'assign' && sites.some((o) => o.file === s.file && o.kind === 'decl')));
  seen.set(name, collapsed);
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
