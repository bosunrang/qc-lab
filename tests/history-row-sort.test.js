'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-row-sort.ts')).href;
const program = `
  import { sortHistoryRows } from ${JSON.stringify(source)};
  const rows = [{ id: 'C', l: { level: 2 }, lotNo: 'LOT-B', h: { effectiveFrom: '2026-02-01' } }, { id: 'B', l: { level: 1 }, lotNo: 'LOT-A', h: { effectiveFrom: '2026-02-01' } }, { id: 'A', l: { level: 1 }, lotNo: 'LOT-A', h: { effectiveFrom: '2026-01-01' } }];
  console.log(JSON.stringify(sortHistoryRows(rows).map(row => row.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history row sort TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['A', 'B', 'C']);
console.log('History row sort TypeScript tests passed');
