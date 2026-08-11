'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-test-rank.ts')).href;
const program = `
  import { dashboardTestRank } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardTestRank('rej', 0, 2), dashboardTestRank('warn', 2, 2), dashboardTestRank('ok', 1, 2), dashboardTestRank('ok', 2, 2), dashboardTestRank('none', 2, 2)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard test rank TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [0, 1, 2, 3, 4]);
console.log('Dashboard test rank TypeScript tests passed');
