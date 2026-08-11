'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-tree-state.ts')).href;
const program = `
  import { createEntryTreeState } from ${JSON.stringify(source)};
  const state = createEntryTreeState({ activeWestgard: () => ({ byPoint: new Map([['a', { level: 'ok' }], ['b', { level: 'warn' }], ['c', { level: 'rej' }]]) }), operationalLevels: () => [{ level: 1, lot: 'L1' }, { level: 2, lot: 'L2' }, { level: 3, lot: 'L3' }], pointsForLot: (_id, level) => level === 1 ? [{ id: 'a' }] : level === 2 ? [{ id: 'b' }] : [{ id: 'c' }] });
  console.log(JSON.stringify([state({ id: 'T1' }), state(null)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry tree state TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['rej', 'none']);
console.log('Entry tree state TypeScript tests passed');
