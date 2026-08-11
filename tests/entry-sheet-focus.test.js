'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-sheet-focus.ts')).href;
const program = `
  import { createEntrySheetFocus } from ${JSON.stringify(source)};
  const select = createEntrySheetFocus(item => item.empty);
  console.log(JSON.stringify([
    select([{ id: 'saved', empty: false }, { id: 'empty', empty: true }])?.id,
    select([{ id: 'saved', empty: false }])?.id,
    select([]),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry sheet focus TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['empty', 'saved', null]);
console.log('Entry sheet focus TypeScript tests passed');
