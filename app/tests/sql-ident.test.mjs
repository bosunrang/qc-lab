// Tên bảng/cột ghép vào SQL (kế hoạch kiến trúc C.6): chỉ định danh hợp lệ,
// luôn đặt trong nháy kép; không còn chỗ nào ghép tên trần.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { quoteIdent, quoteIdents } = require('../../app-dist/main/db/sql-ident.js');
const MAIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'main');

test('quoteIdent chỉ nhận định danh SQL thường', () => {
  assert.equal(quoteIdent('qc_points'), '"qc_points"');
  assert.equal(quoteIdents(['id', 'val']), '"id","val"');
  for (const bad of ['', 'a b', 'x;DROP TABLE users', 'a"b', '1abc', 'main.users', "t'--"]) {
    assert.throws(() => quoteIdent(bad), /không hợp lệ/, JSON.stringify(bad));
  }
});

test('không ghép tên bảng/cột trần vào câu SQL', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!file.endsWith('.ts')) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        // Sau từ khoá SQL mà ghép thẳng một biến (không qua quoteIdent).
        if (/\b(FROM|INTO|UPDATE|TABLE|table_info\()\s*(main\.|backup_src\.)?\$\{(?!quoteIdent)/.test(line)) {
          offenders.push(`${path.relative(MAIN, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  };
  walk(MAIN);
  assert.deepEqual(offenders, []);
});
