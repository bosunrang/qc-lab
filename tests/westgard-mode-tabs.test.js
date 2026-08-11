'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-mode-tabs.ts')).href;
const program = `
  import { westgardModeTabs } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    westgardModeTabs.view('current', 0),
    westgardModeTabs.view('archived', 3),
    westgardModeTabs.chart('lj'), westgardModeTabs.chart('cusum'),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Westgard mode tabs TypeScript');
const [empty, archived, lj, cusum] = JSON.parse(result.stdout);
assert.equal(empty, '');
assert.match(archived, /wgSetViewMode\('archived'\)/);
assert.match(archived, /Nhóm lô đã dừng\/lưu trữ \(3\)/);
assert.match(archived, /class="on"/);
assert.match(lj, /wgSetChartMode\('lj'\)/);
assert.match(lj, /class="on"/);
assert.match(cusum, /wgSetChartMode\('cusum'\)/);
assert.match(cusum, /Xu hướng CUSUM/);
assert.doesNotMatch(cusum, /<button class="on" onclick="wgSetChartMode\('lj'\)"/);
console.log('Westgard mode tabs TypeScript tests passed');
