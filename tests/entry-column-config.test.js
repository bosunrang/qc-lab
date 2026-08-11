'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-column-config.ts')).href;
const program = `
  import { createEntryColumnConfig } from ${JSON.stringify(source)};
  const config = { level: 1, lot: 'LOT-A', mean: 10, sd: 1, meanSdHistory: [{ mean: 9 }] };
  const select = createEntryColumnConfig({ levelConfig: () => config, parallelLot: () => ({ lotNo: 'LOT-B', mean: 20, sd: 2, low: 16, high: 24, exp: '2027-01-01' }) });
  console.log(JSON.stringify([select({ id: 'T1' }, 1, ''), select({ id: 'T1' }, 1, 'LOT-B'), select({ id: 'T1' }, 1, 'other')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry column config TypeScript');
const [base, parallel, missing] = JSON.parse(result.stdout);
assert.deepEqual(base, { level: 1, lot: 'LOT-A', mean: 10, sd: 1, meanSdHistory: [{ mean: 9 }] });
assert.deepEqual(parallel, { level: 1, lot: 'LOT-B', mean: 20, sd: 2, low: 16, high: 24, exp: '2027-01-01', meanSdHistory: [], applied: 'mfg' });
assert.equal(missing, null);
console.log('Entry column config TypeScript tests passed');
