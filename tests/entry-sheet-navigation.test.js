'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-sheet-navigation.ts')).href;
const program = `
  import { createEntrySheetNavigation } from ${JSON.stringify(source)};
  const inputs = [{ id: 'd1r1l1', d: '01', r: '1', l: '1' }, { id: 'd1r1l2', d: '01', r: '1', l: '2' }, { id: 'd2r1l1', d: '02', r: '1', l: '1' }];
  const nav = createEntrySheetNavigation({ date: item => item.d, run: item => item.r, level: item => item.l });
  console.log(JSON.stringify([nav.target(inputs, inputs[0], 'ArrowRight')?.id, nav.target(inputs, inputs[0], 'Tab', true)?.id, nav.target(inputs, inputs[0], 'ArrowDown')?.id, nav.target(inputs, inputs[2], 'Enter')?.id]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry sheet navigation TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['d1r1l2', 'd1r1l2', 'd2r1l1', 'd1r1l1']);
console.log('Entry sheet navigation TypeScript tests passed');
