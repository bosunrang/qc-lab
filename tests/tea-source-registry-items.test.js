'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-source-registry-items.ts')).href;
const program = `
  import { teaSourceRegistryItems } from ${JSON.stringify(source)};
  console.log(JSON.stringify(teaSourceRegistryItems({ clia: { status: 'retired', label: 'CLIA', version: '2024', effectiveDate: '2024-01-01', reviewedDate: '2026-01-01', url: '/clia' }, ricos: { status: 'dynamic', label: 'Ricos' }, eflm: { label: 'EFLM' } }, date => 'VN:' + date)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea source registry items TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ status: 'retired', label: 'CLIA', statusLabel: 'Nguồn cũ', tagClass: 'warn', version: '2024', effectiveDate: 'VN:2024-01-01', reviewedDate: 'VN:2026-01-01', url: '/clia' }, { status: 'dynamic', label: 'Ricos', statusLabel: 'Cập nhật liên tục', tagClass: 'ok', version: '', effectiveDate: '', reviewedDate: 'VN:', url: '' }, { status: '', label: 'EFLM', statusLabel: 'Hiện hành', tagClass: 'none', version: '', effectiveDate: '', reviewedDate: 'VN:', url: '' }]);
console.log('Tea source registry items TypeScript tests passed');
