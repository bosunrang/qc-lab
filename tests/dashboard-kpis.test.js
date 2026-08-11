'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'qc', 'dashboard-kpis.ts')).href;
const program = `
  import { dashboardKpis } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardKpis([{ totalPoints: 3, todayCount: 1, s: 'rej', missingToday: true }, { totalPoints: 4, todayCount: 2, s: 'warn', missingToday: false }, { totalPoints: 0, todayCount: 0, s: 'ok', missingToday: true }], 3), dashboardKpis([], 0)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard KPIs TypeScript');
const [filled, empty] = JSON.parse(result.stdout);
assert.deepEqual(filled, { totalPoints: 7, todayPoints: 3, rejected: 1, warnings: 1, missingToday: 2, completeTests: 1, completionPercent: 33 });
assert.deepEqual(empty, { totalPoints: 0, todayPoints: 0, rejected: 0, warnings: 0, missingToday: 0, completeTests: 0, completionPercent: 0 });
console.log('Dashboard KPIs TypeScript tests passed');
