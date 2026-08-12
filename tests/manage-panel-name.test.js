'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-panel-name.ts')).href;
const program = `
  import { managePanelName } from ${JSON.stringify(source)};
  console.log(JSON.stringify([managePanelName([{ id: 'P1', name: 'Điện giải' }], 'P1'), managePanelName([], 'P2')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage panel name TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Điện giải', 'Chưa chọn Panel QC']);
console.log('Manage panel name TypeScript tests passed');
