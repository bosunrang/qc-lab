'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'same-id-set.ts')).href;
const program = `
  import { sameIdSet } from ${JSON.stringify(source)};
  console.log(JSON.stringify([sameIdSet(['b', 'a', 'a'], ['a', 'b']), sameIdSet(['1'], [1]), sameIdSet(['a'], ['b']), sameIdSet()]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy same id set TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [true, false, false, true]);
console.log('Same id set TypeScript tests passed');
