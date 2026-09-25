// Chạy toàn bộ app/tests/*.test.mjs — cùng kỷ luật với scripts/run-tests.js
// gốc: liệt kê file tường minh bằng fs, KHÔNG dùng glob (node --test glob
// không nở âm thầm exit 0 nếu glob thất bại — xem CLAUDE.md mục "Tests").
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
// Trình biên dịch là TypeScript 7 (gói `@typescript/native`). Gói `typescript`
// được trỏ sang `@typescript/typescript6` chỉ để typescript-eslint có API
// TypeScript 6 — xem package.json và eslint.config.mjs.
const TSC = path.join(REPO_ROOT, 'node_modules', '@typescript', 'native', 'bin', 'tsc');
const files = fs.readdirSync(TESTS).filter(name => name.endsWith('.test.mjs')).sort();

if (!files.length) {
  console.error(`Không tìm thấy file test nào trong ${TESTS} — đây là lỗi, không phải "không có gì để chạy".`);
  process.exit(1);
}

// Một số module main/ import chéo lẫn nhau (vd manage-validation.ts →
// text-utils.ts) — test các module đó cần bản ĐÃ BUILD (CommonJS), không
// import thẳng .ts qua ESM. Build trước khi chạy test, giống quy ước
// tsconfig.worker.json của repo gốc.
const build = spawnSync(process.execPath, [
  TSC,
  '-p', path.join(REPO_ROOT, 'tsconfig.app-main.json'),
], { cwd: REPO_ROOT, stdio: 'inherit' });
if (build.status !== 0) { console.error('Build app main process thất bại — dừng, không chạy test.'); process.exit(1); }

const buildMock = spawnSync(process.execPath, [
  TSC,
  '-p', path.join(REPO_ROOT, 'tsconfig.app-mock.json'),
], { cwd: REPO_ROOT, stdio: 'inherit' });
if (buildMock.status !== 0) { console.error('Build bản giả lập trình duyệt thất bại — dừng, không chạy test.'); process.exit(1); }

const args = ['--test', ...files.map(name => path.join('tests', name)), ...process.argv.slice(2)];
const res = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
if (res.error) { console.error(res.error); process.exit(1); }
process.exit(res.status === null ? 1 : res.status);


