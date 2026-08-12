'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-inspection-details-html.ts')).href;
const program = `
  import { createActionInspectionDetailsHtml } from ${JSON.stringify(source)};
  console.log(createActionInspectionDetailsHtml()([{ title: 'Kiểm tra máy', checksHtml: '<div>Đạt</div>' }, { title: 'Kiểm tra hóa chất', checksHtml: '<div>Cần xem lại</div><div>Lot</div>' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action inspection details HTML TypeScript');
assert.match(result.stdout, /<li><b>Kiểm tra máy<\/b><div>Đạt<\/div><\/li>/);
assert.match(result.stdout, /Kiểm tra hóa chất/);
assert.match(result.stdout, /<div>Lot<\/div>/);
console.log('Action inspection details HTML TypeScript tests passed');
