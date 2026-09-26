// Chạy toàn bộ app/e2e/*.e2e.mjs trên bản đã build. Liệt kê tệp tường minh,
// không dùng glob, cùng lý do với run-tests.cjs: glob không khớp thì
// `node --test` thoát 0 mà không chạy gì. Chạy lần lượt từng tệp vì mỗi tệp
// mở một phiên Electron riêng.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const E2E = path.join(__dirname, '..', 'e2e');
const files = fs.readdirSync(E2E).filter((name) => name.endsWith('.e2e.mjs')).sort();
if (!files.length) {
  console.error(`Không tìm thấy test end-to-end nào trong ${E2E}.`);
  process.exit(1);
}
const args = ['--test', '--test-concurrency=1', ...files.map((name) => path.join(E2E, name)), ...process.argv.slice(2)];
const res = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (res.error) { console.error(res.error); process.exit(1); }
process.exit(res.status === null ? 1 : res.status);
