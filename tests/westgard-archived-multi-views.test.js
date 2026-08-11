'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-archived-multi-views.ts')).href;
const program = `
  import { westgardArchivedMultiViews } from ${JSON.stringify(source)};
  const rows = [{ t: { id: 'glu' }, l: { level: 2 }, lot: { lotNo: 'L-02' }, mean: 10, sd: 0.5 }];
  const calls = [];
  const views = westgardArchivedMultiViews(rows, (test, level, lotNo) => { calls.push([test.id, level, lotNo]); return [{ value: 10.2 }]; });
  console.log(JSON.stringify({ views, calls, empty: westgardArchivedMultiViews(null, () => []) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript du lieu bieu do Westgard da luu tru');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.calls, [['glu', 2, 'L-02']]);
assert.deepEqual(output.views, [{ level: 2, lot: 'L-02', mean: 10, sd: 0.5, pts: [{ value: 10.2 }], label: 'M2·L-02' }]);
assert.deepEqual(output.empty, []);

console.log('Westgard archived multi-views TypeScript tests passed');
