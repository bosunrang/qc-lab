'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-tree-navigation.ts')).href;
const program = `
  import { createEntryTreeNavigation } from ${JSON.stringify(source)};
  const nav = createEntryTreeNavigation();
  const items = ['a', 'b', 'c'];
  console.log(JSON.stringify([
    nav.target(items, 'b', 'ArrowDown'), nav.target(items, 'a', 'ArrowUp'),
    nav.target(items, 'b', 'Home'), nav.target(items, 'b', 'End'), nav.target(items, 'x', 'ArrowDown'),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry tree navigation TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['c', 'c', 'a', 'c', null]);
console.log('Entry tree navigation TypeScript tests passed');
