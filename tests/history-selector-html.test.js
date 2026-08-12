'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-selector-html.ts')).href;
const program = `
  import { historySelectorHtml } from ${JSON.stringify(source)};
  console.log(historySelectorHtml('<option value="T1">Na</option>', 3, 12));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history selector HTML TypeScript');
assert.match(result.stdout, /<select onchange="setHistoryTest\(this.value\)"><option value="T1">Na<\/option><\/select>/);
assert.match(result.stdout, /<b>3<\/b><span>mốc lô\/Mean-SD<\/span>/);
assert.match(result.stdout, /<b>12<\/b><span>điểm QC đã nhập<\/span>/);
console.log('History selector HTML TypeScript tests passed');
