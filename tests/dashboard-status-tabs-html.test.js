'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-status-tabs-html.ts')).href;
const program = `
  import { createDashboardStatusTabsHtml } from ${JSON.stringify(source)};
  const render = createDashboardStatusTabsHtml({ matches: (item, key) => key === 'missing' ? item.missingToday : item.s === key });
  console.log(render([{ s: 'rej', missingToday: true }, { s: 'warn', missingToday: false }, { s: 'ok', missingToday: true }], 'missing'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard status tabs HTML TypeScript');
assert.match(result.stdout, /dashTestSetStatus\('all'\).*Tất cả<b>3<\/b>/);
assert.match(result.stdout, /class="on" onclick="dashTestSetStatus\('missing'\)">Chưa QC<b>2<\/b>/);
assert.match(result.stdout, /Loại bỏ<b>1<\/b>/);
assert.match(result.stdout, /Đạt<b>1<\/b>/);
console.log('Dashboard status tabs HTML TypeScript tests passed');
