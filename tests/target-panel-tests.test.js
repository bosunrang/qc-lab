'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-panel-tests.ts')).href;
const program = `
  import { targetPanelTests } from ${JSON.stringify(source)};
  console.log(JSON.stringify(targetPanelTests([{ id: 'P1', testIds: ['T2', 'missing', 'T1'] }], [{ id: 'T1', name: 'Na' }, { id: 'T2', name: 'K' }], 'P1').map(item => item.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target panel tests TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['T2', 'T1']);
console.log('Target panel tests TypeScript tests passed');
