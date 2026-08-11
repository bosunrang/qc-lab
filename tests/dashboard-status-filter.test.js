'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-status-filter.ts')).href;
const program = `
  import { createDashboardStatusFilter } from ${JSON.stringify(source)};
  const filter = createDashboardStatusFilter();
  console.log(JSON.stringify({ normalized: [filter.normalize('warn'), filter.normalize('invalid')], matches: [filter.matches({ s: 'warn', missingToday: false }, 'warn'), filter.matches({ s: 'ok', missingToday: true }, 'missing'), filter.matches({ s: 'rej', missingToday: false }, 'missing')] }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard status filter TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { normalized: ['warn', 'all'], matches: [true, true, false] });
console.log('Dashboard status filter TypeScript tests passed');
