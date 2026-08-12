'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-rows.ts')).href;
const program = `
  import { historyRows } from ${JSON.stringify(source)};
  const assay = { id: 'T1', levels: [{ level: 1, qcLotId: 'L1', lot: 'old', meanSdHistory: [{ qcLotId: 'L1', lot: 'LOT-1', mean: 1 }, { lot: 'draft', planned: true }] }, { level: 2, lot: 'LOT-2', mean: 2, sd: 0.1, exp: '2026-12-31', applied: 'lab' }] };
  const rows = historyRows(assay, [{ id: 'L1', lotNo: 'LOT-1', level: 1 }, { id: 'L2', lotNo: 'LOT-2', level: 2 }], [{ level: 1, lot: 'LOT-1' }, { level: 2, lot: 'LOT-2' }, { level: 2, lot: 'other' }], id => 'Nhóm-' + id);
  console.log(JSON.stringify(rows.map(row => ({ level: row.l.level, lotNo: row.lotNo, group: row.group, source: row.h.source || '', points: row.pts.length }))));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history rows TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ level: 1, lotNo: 'LOT-1', group: 'Nhóm-L1', source: '', points: 1 }, { level: 2, lotNo: 'LOT-2', group: 'Nhóm-L2', source: 'lab', points: 1 }]);
console.log('History rows TypeScript tests passed');
