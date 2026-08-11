'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-shift-status.ts')).href;
const program = `
  import { dashboardShiftStatus } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    dashboardShiftStatus({ rejected: 1, overdueActions: 2, warnings: 3, missingToday: 4 }),
    dashboardShiftStatus({ rejected: 0, overdueActions: 2, warnings: 3, missingToday: 4 }),
    dashboardShiftStatus({ rejected: 0, overdueActions: 0, warnings: 0, missingToday: 0 }),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard shift status TypeScript');
const output = JSON.parse(result.stdout);
assert.equal(output[0].mood, 'Cần xử lý ngay');
assert.equal(output[1].mood, 'Có hồ sơ NCE quá hạn');
assert.equal(output[2].mood, 'Đang trong kiểm soát');
console.log('Dashboard shift status TypeScript tests passed');
