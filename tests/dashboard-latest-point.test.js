'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-latest-point.ts')).href;
const program = `
  import { createDashboardLatestPoint } from ${JSON.stringify(source)};
  const latest = createDashboardLatestPoint({ runNumber: point => point.run });
  console.log(JSON.stringify([latest([]), latest([{ id: 'a', date: '2026-08-10', run: 3 }, { id: 'b', date: '2026-08-11', run: 1 }, { id: 'c', date: '2026-08-11', run: 2 }]) ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard latest point TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [null, { id: 'c', date: '2026-08-11', run: 2 }]);
console.log('Dashboard latest point TypeScript tests passed');
