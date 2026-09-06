// Chạy toàn bộ app-v2/tests/*.test.mjs — cùng kỷ luật với scripts/run-tests.js
// gốc: liệt kê file tường minh bằng fs, KHÔNG dùng glob (node --test glob
// không nở âm thầm exit 0 nếu glob thất bại — xem CLAUDE.md mục "Tests").
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
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
  path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p', path.join(REPO_ROOT, 'tsconfig.app-v2-main.json'),
], { cwd: REPO_ROOT, stdio: 'inherit' });
if (build.status !== 0) { console.error('Build app-v2 main process thất bại — dừng, không chạy test.'); process.exit(1); }

// mock-parity.test.mjs cần thêm bản CommonJS của renderer/browser-mock/* để
// chạy được trong Node (bản thật của nó là ESM+JSX cho Vite). Build riêng —
// xem tsconfig.app-v2-mock.json và ghi chú đầu file test đó.
const buildMock = spawnSync(process.execPath, [
  path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p', path.join(REPO_ROOT, 'tsconfig.app-v2-mock.json'),
], { cwd: REPO_ROOT, stdio: 'inherit' });
if (buildMock.status !== 0) { console.error('Build bản giả lập trình duyệt thất bại — dừng, không chạy test.'); process.exit(1); }

const args = ['--test', ...files.map(name => path.join('tests', name)), ...process.argv.slice(2)];
const res = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
if (res.error) { console.error(res.error); process.exit(1); }
process.exit(res.status === null ? 1 : res.status);
