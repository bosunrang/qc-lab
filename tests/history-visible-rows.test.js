'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-visible-rows.ts')).href;
const program = `
  import { historyVisibleRows } from ${JSON.stringify(source)};
  const normalize = value => String(value ?? '').toLowerCase();
  const rows = [{ id: 'A', l: { level: 1 }, lotNo: 'LOT-01' }, { id: 'B', l: { level: 2 }, lotNo: 'LOT-02' }];
  console.log(JSON.stringify([historyVisibleRows(rows, 'Glucose', 'mức 2', normalize), historyVisibleRows(rows, 'Glucose', 'lot-01', normalize), historyVisibleRows(rows, 'Glucose', '', normalize)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history visible rows TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [[{ id: 'B', l: { level: 2 }, lotNo: 'LOT-02' }], [{ id: 'A', l: { level: 1 }, lotNo: 'LOT-01' }], [{ id: 'A', l: { level: 1 }, lotNo: 'LOT-01' }, { id: 'B', l: { level: 2 }, lotNo: 'LOT-02' }]]);
console.log('History visible rows TypeScript tests passed');
