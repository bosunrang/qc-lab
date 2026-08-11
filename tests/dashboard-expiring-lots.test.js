'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'qc', 'dashboard-expiring-lots.ts')).href;
const program = `
  import { dashboardExpiringLots } from ${JSON.stringify(source)};
  const output = dashboardExpiringLots([
    { t: { id: 'A' }, l: { qcLotId: 'L1', lot: '100', level: 1 }, d: 20 },
    { t: { id: 'B' }, l: { qcLotId: 'L1', lot: '100', level: 1 }, d: 10 },
    { t: { id: 'C' }, l: { lot: '200', level: 2 }, d: -2 },
  ]);
  console.log(JSON.stringify([...output.entries()]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard expiring lots TypeScript');
const output = JSON.parse(result.stdout);
assert.equal(output.length, 2);
assert.equal(output[0][0], 'L1');
assert.equal(output[0][1].d, 10);
assert.equal(output[0][1].count, 2);
assert.equal(output[1][0], '200|2');
console.log('Dashboard expiring lots TypeScript tests passed');
