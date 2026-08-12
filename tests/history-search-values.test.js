'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-search-values.ts')).href;
const program = `
  import { historySearchValues } from ${JSON.stringify(source)};
  const assay = { name: 'Glucose', levels: [{ level: 1, qcLotId: 'L1', lot: 'old', meanSdHistory: [{ qcLotId: 'L1', lot: 'old' }, { lot: 'planned', planned: true }] }, { level: '2', lot: 'fallback' }] };
  console.log(JSON.stringify(historySearchValues(assay, [{ id: 'L1', lotNo: 'LOT-1', level: 1 }, { id: 'L2', lotNo: 'fallback', level: 2 }], () => 'GLU')));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history search values TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Glucose', 'GLU', 1, 'M1', 'Mức 1', 'old', 'old', 'LOT-1', '2', 'M2', 'Mức 2', 'fallback', 'fallback', 'fallback']);
console.log('History search values TypeScript tests passed');
