'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-latest-point-text.ts')).href;
const program = `
  import { createDashboardLatestPointText } from ${JSON.stringify(source)};
  const text = createDashboardLatestPointText({ date: value => 'D:' + value, pointValue: point => 'V:' + point.val });
  console.log(JSON.stringify([text({ date: '2026-08-11', _level: 2, val: 3.4 }, {}), text(undefined, {})]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard latest point text TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['D:2026-08-11 · M2 · V:3.4', 'Chưa có điểm']);
console.log('Dashboard latest point text TypeScript tests passed');
