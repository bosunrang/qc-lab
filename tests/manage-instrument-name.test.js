'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-instrument-name.ts')).href;
const program = `
  import { manageInstrumentName } from ${JSON.stringify(source)};
  console.log(JSON.stringify([manageInstrumentName([{ id: 'I1', name: 'AU480' }], 'I1'), manageInstrumentName([], 'I2', 'Máy cũ'), manageInstrumentName([], 'I2')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage instrument name TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['AU480', 'Máy cũ', 'Chưa gán máy']);
console.log('Manage instrument name TypeScript tests passed');
