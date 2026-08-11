'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-selection-state.ts')).href;
const program = `
  import { entrySelectionState } from ${JSON.stringify(source)};
  const picked = entrySelectionState.pick('T1', 2);
  console.log(JSON.stringify([picked, entrySelectionState.focus(picked.selection, 3), entrySelectionState.focus(null, 3), entrySelectionState.previousLotKey(picked.selection, 2), entrySelectionState.previousLotKey(null, 2)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry selection state TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ selection: { testId: 'T1', level: 2 }, start: null, end: null, message: '' }, { testId: 'T1', level: 3 }, null, 'T1|2', null]);
console.log('Entry selection state TypeScript tests passed');
