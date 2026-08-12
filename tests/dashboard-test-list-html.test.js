'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-test-list-html.ts')).href;
const program = `
  import { dashboardTestListHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardTestListHtml(0, '<tr>x</tr>'), dashboardTestListHtml(1, '<tr>x</tr>')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard test list HTML TypeScript');
const [empty, full] = JSON.parse(result.stdout);
assert.equal(empty, '<div class="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>');
assert.match(full, /<th>Mức QC \/ lô<\/th>/);
assert.match(full, /<tbody><tr>x<\/tr><\/tbody>/);
assert.match(full, /id="dashTestEmpty"/);
console.log('Dashboard test list HTML TypeScript tests passed');
