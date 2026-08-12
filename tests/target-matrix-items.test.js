'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-matrix-items.ts')).href;
const program = `
  import { targetMatrixItems } from ${JSON.stringify(source)};
  const assays = [{ id: 'T1', levels: [{ qcLotId: 'L1', level: 1, mean: 1 }, { qcLotId: 'other', level: 2, mean: 2 }] }, { id: 'T2', levels: [] }];
  const lots = [{ id: 'L1', level: 1, lotNo: 'A', depleted: true }, { id: 'L2', level: 2, lotNo: 'B' }, { id: 'L3', level: 3, lotNo: 'C', depleted: true }];
  const rows = targetMatrixItems(assays, lots, level => !!level, (assay, lot) => assay.id + ':' + lot.id, (assay, level, id) => ({ snapshot: assay.id + ':' + level + ':' + id }));
  console.log(JSON.stringify(rows.map(row => ({ assay: row.t.id, lot: row.lot.id, linked: row.linked?.qcLotId || '', same: row.same?.qcLotId || '', assigned: row.assigned, planned: row.planned, cfg: row.cfg }))));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target matrix items TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ assay: 'T1', lot: 'L1', linked: 'L1', same: 'L1', assigned: true, planned: false, cfg: { qcLotId: 'L1', level: 1, mean: 1 } }, { assay: 'T1', lot: 'L2', linked: '', same: 'other', assigned: true, planned: 'T1:L2', cfg: { snapshot: 'T1:2:L2' } }, { assay: 'T2', lot: 'L2', linked: '', same: '', assigned: false, planned: 'T2:L2', cfg: { snapshot: 'T2:2:L2' } }]);
console.log('Target matrix items TypeScript tests passed');
