'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-summary.ts')).href;
const program = `
  import { historySummary } from ${JSON.stringify(source)};
  console.log(JSON.stringify([historySummary([{ pts: [1, 2] }, { pts: [] }, {}]), historySummary([])]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history summary TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ rowCount: 3, pointCount: 2 }, { rowCount: 0, pointCount: 0 }]);
console.log('History summary TypeScript tests passed');
