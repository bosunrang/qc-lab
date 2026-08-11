'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-tree-group-state.ts')).href;
const program = `
  import { entryTreeGroupState } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    entryTreeGroupState(['none', 'ok', 'warn']),
    entryTreeGroupState(['ok', 'rej', 'warn']),
    entryTreeGroupState(['unknown']),
    entryTreeGroupState([]),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry tree group state TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['warn', 'rej', 'none', 'none']);
console.log('Entry tree group state TypeScript tests passed');
