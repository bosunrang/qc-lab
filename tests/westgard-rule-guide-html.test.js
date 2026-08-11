'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-rule-guide-html.ts')).href;
const program = `
  import { createWestgardRuleGuideHtml } from ${JSON.stringify(source)};
  console.log(createWestgardRuleGuideHtml({ escape: value => String(value).replaceAll('<', '&lt;'), referenceIcon: () => '↗' })([{ id: '1-2s', desc: '<Mô tả>', alert: true, fix: '<Sửa>' }, { id: '1_3s', desc: 'D', alert: false, fix: 'F' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Westgard rule guide HTML TypeScript');
assert.match(result.stdout, /↗ trong bảng/);
assert.match(result.stdout, /&lt;Mô tả>/);
assert.match(result.stdout, /<span class="warn">Cảnh báo<\/span>/);
assert.match(result.stdout, /<span class="rej">Loại bỏ<\/span>/);
assert.match(result.stdout, /&lt;Sửa>/);
console.log('Westgard rule guide HTML TypeScript tests passed');
