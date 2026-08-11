'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-search-values.ts')).href;
const program = `
  import { reportSearchValues } from ${JSON.stringify(source)};
  const test = { id: 'glu', name: 'Glucose', machine: 'AU480', unit: 'mmol/L' };
  const values = reportSearchValues(test, {
    testLabel: item => item.name + ' · ' + item.machine,
    operationalLevels: () => [{ lot: 'LOT-01' }, { lot: 'LOT-02' }],
    panelForTest: () => ({ name: 'Hoa sinh' }),
    lotGroupForTest: () => ({ name: 'Nhom thang 8' }),
  });
  console.log(JSON.stringify({ values, fallback: reportSearchValues(test, { testLabel: () => 'Glu', operationalLevels: () => null, panelForTest: () => null, lotGroupForTest: () => null }) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript gia tri tim kiem bao cao');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.values, ['Glucose · AU480', 'Glucose', 'AU480', 'mmol/L', 'Hoa sinh', 'Nhom thang 8', 'LOT-01', 'LOT-02']);
assert.deepEqual(output.fallback, ['Glu', 'Glucose', 'AU480', 'mmol/L', null, null]);

console.log('Report search-values TypeScript tests passed');
