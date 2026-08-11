'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-tree-visibility.ts')).href;
const program = `
  import { entryTreeVisibility } from ${JSON.stringify(source)};
  const nodes = [
    { role: 'machine', key: 'm:A' }, { role: 'group', key: 'g:A1' }, { role: 'assay', search: 'glucose' }, { role: 'assay', search: 'sodium' },
    { role: 'machine', key: 'm:B' }, { role: 'group', key: 'g:B1' }, { role: 'assay', search: 'potassium' },
  ];
  console.log(JSON.stringify([
    entryTreeVisibility(nodes, '', new Set(['m:A', 'g:A1'])),
    entryTreeVisibility(nodes, '', new Set(['m:A'])),
    entryTreeVisibility(nodes, 'sodium', new Set()),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry tree visibility TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [[true, true, true, true, true, false, false], [true, true, false, false, true, false, false], [true, true, false, true, false, false, false]]);
console.log('Entry tree visibility TypeScript tests passed');
