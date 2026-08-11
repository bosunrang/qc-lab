'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-completion.ts')).href;
const program = `
  import { dashboardCompletion } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardCompletion(3, 1), dashboardCompletion(0, 0), dashboardCompletion(2, 5)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard completion TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ completeTests: 2, percent: 67 }, { completeTests: 0, percent: 0 }, { completeTests: 0, percent: 0 }]);
console.log('Dashboard completion TypeScript tests passed');
