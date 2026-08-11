'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-tree-key-command.ts')).href;
const program = `
  import { entryTreeKeyCommand } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    entryTreeKeyCommand('Enter', null), entryTreeKeyCommand('ArrowRight', 'false'), entryTreeKeyCommand('ArrowLeft', 'true'),
    entryTreeKeyCommand('ArrowDown', null), entryTreeKeyCommand('Home', null), entryTreeKeyCommand('ArrowRight', 'true'), entryTreeKeyCommand('x', null),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry tree key command TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['toggle', 'toggle', 'toggle', 'navigate', 'navigate', null, null]);
console.log('Entry tree key command TypeScript tests passed');
