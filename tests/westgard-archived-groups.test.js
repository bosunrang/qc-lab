'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-archived-groups.ts')).href;
const program = `
  import { westgardArchivedGroups } from ${JSON.stringify(source)};
  const groups = [
    { id: 'active', active: true, status: 'active', name: 'Dang dung' },
    { id: 'stopped-b', active: true, status: 'stopped', stoppedAt: '2026-08-10', name: 'Beta' },
    { id: 'archived', active: false, status: 'active', stoppedAt: '2026-08-11', name: 'Alpha' },
    { id: 'stopped-a', active: true, status: 'stopped', stoppedAt: '2026-08-10', name: 'Alpha' },
  ];
  console.log(JSON.stringify({ ids: westgardArchivedGroups(groups).map(group => group.id), original: groups.map(group => group.id), empty: westgardArchivedGroups(null) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript nhom lo Westgard da luu tru');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.ids, ['archived', 'stopped-a', 'stopped-b']);
assert.deepEqual(output.original, ['active', 'stopped-b', 'archived', 'stopped-a']);
assert.deepEqual(output.empty, []);

console.log('Westgard archived-groups TypeScript tests passed');
