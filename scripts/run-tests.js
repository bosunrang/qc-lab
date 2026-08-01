// Chạy toàn bộ tests/*.test.js — đường chạy chung của `npm test`, hook pre-commit
// và cả ba job CI. Chỉ dùng module lõi của Node, KHÔNG cần `npm install`.
//
// Tại sao không gọi thẳng `node --test tests/*.test.js`: nếu glob không nở (shell
// không nở và Node cũng không, ví dụ đổi phiên bản Node hoặc đổi shell của runner),
// Node nhận đúng chuỗi `tests/*.test.js` làm tên file, không tìm thấy gì — và
// **thoát với mã 0**. Đã kiểm chứng: `node --test "tests/khong-ton-tai-*.test.js"`
// in "tests 0" rồi exit 0. Nghĩa là cổng chặn commit và cả job CI có thể XANH mà
// không chạy một dòng test nào. Trên Linux shell luôn nở glob nên chuyện này chưa
// từng xảy ra; job Windows thêm ngày 2026-08-01 thì phụ thuộc hẳn vào Node.
//
// Ở đây danh sách file được liệt kê bằng fs rồi truyền tường minh, và số 0 file là
// LỖI. Không còn chỗ nào cho một lần chạy rỗng đi qua như thể đã pass.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const files = fs.readdirSync(TESTS).filter(name => name.endsWith('.test.js')).sort();

if (!files.length) {
  console.error(`Không tìm thấy file test nào trong ${TESTS} — đây là lỗi, không phải "không có gì để chạy".`);
  process.exit(1);
}

const args = ['--test', ...files.map(name => path.join('tests', name)), ...process.argv.slice(2)];
const res = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
if (res.error) { console.error(res.error); process.exit(1); }
process.exit(res.status === null ? 1 : res.status);
