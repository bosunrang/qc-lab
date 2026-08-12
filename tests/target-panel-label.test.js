'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-panel-label.ts')).href;
const program = `
  import { targetPanelLabel } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetPanelLabel([{ id: 'P1', name: 'Hóa sinh' }], 'P1'), targetPanelLabel([], '')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target panel label TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Hóa sinh', 'Panel QC']);
console.log('Target panel label TypeScript tests passed');
