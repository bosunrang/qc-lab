'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-extra-run-request.ts')).href;
const program = `
  import { entryExtraRunRequest } from ${JSON.stringify(source)};
  console.log(JSON.stringify(entryExtraRunRequest('T1', '2|LOT-B', '2026-08-11', 3, 4)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry extra run request TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { key: 'T1|2|LOT-B|2026-08-11|4', focus: '2026-08-11|3' });
console.log('Entry extra run request TypeScript tests passed');
