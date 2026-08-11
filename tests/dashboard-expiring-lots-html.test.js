'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-expiring-lots-html.ts')).href;
const program = `
  import { createDashboardExpiringLotsHtml } from ${JSON.stringify(source)};
  const render = createDashboardExpiringLotsHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(JSON.stringify([render([]), render([{ l: { lot: '<A>', level: 2 }, d: 5, count: 2 }, { l: { lot: 'B', level: 1 }, d: -1, count: 1 }]) ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard expiring lots HTML TypeScript');
const [empty, rows] = JSON.parse(result.stdout);
assert.match(empty, /Không có lô sắp hết hạn/);
assert.ok(rows.indexOf('Lô B') < rows.indexOf('Lô &lt;A>'));
assert.match(rows, /Hết hạn 1 ngày/);
assert.match(rows, /2 xét nghiệm · Còn 5 ngày/);
console.log('Dashboard expiring lots HTML TypeScript tests passed');
