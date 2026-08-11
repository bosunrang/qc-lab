'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-test-search-text.ts')).href;
const program = `
  import { createDashboardTestSearchText } from ${JSON.stringify(source)};
  const text = createDashboardTestSearchText({ normalize: value => String(value).replaceAll(/\\s+/g, ' ').trim().toLowerCase(), label: test => 'LAB:' + test.name });
  console.log(text({ name: 'Glucose', machine: 'M1', section: 'HH', method: 'E', unit: 'mmol' }, [{ l: { level: 1, lot: 'L1' } }, { l: { level: 2 } }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard test search text TypeScript');
assert.equal(result.stdout.trim(), 'glucose lab:glucose m1 hh e mmol m1 l1 m2');
console.log('Dashboard test search text TypeScript tests passed');
