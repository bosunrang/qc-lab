'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-missing-target-item-html.ts')).href;
const program = `
  import { createDashboardMissingTargetItemHtml } from ${JSON.stringify(source)};
  console.log(createDashboardMissingTargetItemHtml({ escape: value => String(value).replaceAll('<', '&lt;'), testLabel: test => test.name, button: (label, action, variant) => '[' + label + '|' + action + '|' + variant + ']' })({ t: { name: '<A>' }, l: { level: 3 } }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard missing target item HTML TypeScript');
assert.match(result.stdout, /shift-item warn/);
assert.match(result.stdout, /&lt;A> · M3/);
assert.match(result.stdout, /Chưa có Mean\/SD hợp lệ/);
assert.match(result.stdout, /Gán Mean\/SD\|go\('manage'\);setManageTab\('targets'\)\|ghost sm/);
console.log('Dashboard missing target item HTML TypeScript tests passed');
