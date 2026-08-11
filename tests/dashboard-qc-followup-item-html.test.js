'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-qc-followup-item-html.ts')).href;
const program = `
  import { createDashboardQcFollowupItemHtml } from ${JSON.stringify(source)};
  const render = createDashboardQcFollowupItemHtml({ escape: value => String(value).replaceAll('<', '&lt;'), testLabel: test => test.name, date: value => 'D:' + value, pointValue: point => 'V:' + point.value, button: (label, action, variant) => '[' + label + '|' + action + '|' + variant + ']', quote: value => String(value).replaceAll("'", "\\\\'") });
  console.log(render({ t: { id: "T'1", name: '<Glucose>', unit: 'mg' }, l: { level: 2 }, p: { date: '2026-08-11', value: 3.2 }, rules: [] }, 'rej'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard QC follow-up item HTML TypeScript');
assert.match(result.stdout, /shift-item rej/);
assert.match(result.stdout, /&lt;Glucose> · M2/);
assert.match(result.stdout, /D:2026-08-11 · V:3.2 mg · —/);
assert.match(result.stdout, /testId:'T\\'1'/);
console.log('Dashboard QC follow-up item HTML TypeScript tests passed');
