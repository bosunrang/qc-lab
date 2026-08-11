'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-expanded-tables-state.ts')).href;
const program = `
  import { entryExpandedTablesToggle } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    entryExpandedTablesToggle(new Set(['a', 'b']), 'a'),
    entryExpandedTablesToggle(new Set(['a', 'b']), 'c'),
    entryExpandedTablesToggle(Array.from({ length: 25 }, (_, i) => 'k' + i), 'new', 24),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry expanded tables state TypeScript');
const [closed, opened, capped] = JSON.parse(result.stdout);
assert.deepEqual(closed, ['b']);
assert.deepEqual(opened, ['a', 'b', 'c']);
assert.equal(capped.length, 24);
assert.equal(capped[0], 'k2');
assert.equal(capped.at(-1), 'new');
console.log('Entry expanded tables state TypeScript tests passed');
