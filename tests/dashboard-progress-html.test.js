'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-progress-html.ts')).href;
const program = `
  import { dashboardProgressHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardProgressHtml(2, 3, 67), dashboardProgressHtml(0, 0, -5), dashboardProgressHtml(3, 3, 120)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard progress HTML TypeScript');
const [normal, low, high] = JSON.parse(result.stdout);
assert.match(normal, /width:67%/);
assert.match(normal, /2\/3 xét nghiệm đã đủ QC hôm nay · 67% hoàn tất/);
assert.match(low, /width:0%/);
assert.match(high, /width:100%/);
console.log('Dashboard progress HTML TypeScript tests passed');
