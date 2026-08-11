'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-comparison-label.ts')).href;
const program = `
  import { reagentComparisonLabelPresentation as p } from ${JSON.stringify(source)};
  const catalog = value => value === 'glu' ? 'Glucose' : '';
  console.log(JSON.stringify({ catalog: p.label({ reagent: 'glu', lotOld: 'A', lotNew: 'B' }, catalog), raw: p.label({ reagent: 'Kali' }, catalog), missing: p.label({}, catalog), oneLot: p.label({ reagent: 'glu', lotNew: 'B' }, catalog) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript nhan phep so sanh hoa chat');
assert.deepEqual(JSON.parse(result.stdout), { catalog: 'Glucose — A→B', raw: 'Kali', missing: 'Hóa chất mới', oneLot: 'Glucose — ?→B' });

console.log('Reagent comparison-label TypeScript tests passed');
