'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-range-picker-html.ts')).href;
const program = `
  import { createReportRangePickerHtml } from ${JSON.stringify(source)};
  console.log(createReportRangePickerHtml({ dateBox: (id, value, placeholder, attrs) => '[' + id + '|' + value + '|' + placeholder + '|' + attrs + ']' })('2026-08-01', '2026-08-31'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report range picker HTML TypeScript');
assert.match(result.stdout, /Từ ngày/);
assert.match(result.stdout, /rStartDate\|2026-08-01\|\|onchange="reportRangeChanged\(\)"/);
assert.match(result.stdout, /Đến ngày/);
assert.match(result.stdout, /rEndDate\|2026-08-31/);
console.log('Report range picker HTML TypeScript tests passed');
