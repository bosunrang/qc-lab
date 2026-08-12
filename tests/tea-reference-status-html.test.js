'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-reference-status-html.ts')).href;
const program = `
  import { teaReferenceStatusHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify(['default', 'override', 'lab', 'custom', 'unknown'].map(teaReferenceStatusHtml)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea reference status HTML TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['<span class="tag none">Mặc định</span>', '<span class="tag warn">Đã sửa</span>', '<span class="tag ok">TEa PXN</span>', '<span class="tag ok">Tự thêm</span>', '<span class="tag none">Mặc định</span>']);
console.log('Tea reference status HTML TypeScript tests passed');
