'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-loading.ts')).href;
const program = `
  import { createDashboardLoading } from ${JSON.stringify(source)};
  const render = createDashboardLoading({ escape: value => String(value).replace(/&/g, '&amp;'), topUserBox: () => '<aside>User</aside>' });
  console.log(render([{ id: 'A' }, { id: 'B' }], 2, { A: [{}, {}], B: [{}] }, { name: 'PXN & A', dept: 'Hoa sinh' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard loading TypeScript');
assert.match(result.stdout, /PXN &amp; A/);
assert.match(result.stdout, /Điểm QC<\/div><div class="v">3/);
assert.match(result.stdout, /Đang xử lý<\/div><div class="v">2/);
assert.match(result.stdout, /<aside>User<\/aside>/);
console.log('Dashboard loading TypeScript tests passed');
