'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-archived-group-match.ts')).href;
const program = `
  import { westgardArchivedGroupMatches } from ${JSON.stringify(source)};
  const group = { name: 'Hoa sinh 08/2026', lotIds: ['L1', 'L2'] };
  const lots = { L1: { lotNo: 'GLU-OLD' }, L2: { lotNo: 'URE-ARCH' } };
  const search = value => String(value || '').toLowerCase();
  const lookup = id => lots[id];
  console.log(JSON.stringify({
    empty: westgardArchivedGroupMatches(group, '', search, lookup),
    name: westgardArchivedGroupMatches(group, 'hoa sinh', search, lookup),
    lot: westgardArchivedGroupMatches(group, 'ure-arch', search, lookup),
    no: westgardArchivedGroupMatches(group, 'khong co', search, lookup),
    missing: westgardArchivedGroupMatches({ name: 'Khac', lotIds: ['none'] }, 'none', search, lookup),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript tim nhom lo Westgard da luu tru');
assert.deepEqual(JSON.parse(result.stdout), { empty: true, name: true, lot: true, no: false, missing: false });

console.log('Westgard archived-group match TypeScript tests passed');
