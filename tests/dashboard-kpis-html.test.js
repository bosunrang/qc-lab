'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-kpis-html.ts')).href;
const program = `
  import { dashboardKpisHtml } from ${JSON.stringify(source)};
  console.log(dashboardKpisHtml([{ label: 'Điểm QC', value: 12 }, { label: 'Vi phạm', value: 2, color: 'var(--red)' }, { label: 'Giao diện', value: '✓', className: 'dash-ready-mark' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard KPIs HTML TypeScript');
assert.match(result.stdout, /<div class="dash-kpis">/);
assert.match(result.stdout, /Điểm QC/);
assert.match(result.stdout, /style="color:var\(--red\)"/);
assert.match(result.stdout, /class="v dash-ready-mark">✓/);
console.log('Dashboard KPIs HTML TypeScript tests passed');
