'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-point-context.ts')).href;
const program = `
  import { entryPointContext } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryPointContext('T1', 1, '', 'LOT-A'), entryPointContext('T1', 1, 'LOT-A', 'LOT-A'), entryPointContext('T1', 1, 'LOT-B', 'LOT-A')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry point context TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ parallel: false, selection: { testId: 'T1', level: 1 } }, { parallel: false, selection: { testId: 'T1', level: 1 } }, { parallel: true, selection: { testId: 'T1', level: 1 } }]);
console.log('Entry point context TypeScript tests passed');
