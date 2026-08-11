'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-header.ts')).href;
const program = `
  import { reportHeaderPresentation } from ${JSON.stringify(source)};
  const esc = value => String(value == null ? '' : value).replace(/&/g, '&amp;');
  console.log(reportHeaderPresentation({ title: '<b>QC</b>', lab: { name: 'BV & A', dept: 'Hoa sinh' }, app: { name: 'QC Lab', version: '2.7.6' }, westgardRules: { '1-2s': true, '1-3s': false, R4s: true }, exportedAt: '11/08/2026 10:00', exportedBy: 'KTV & A', escape: esc }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report header TypeScript');
assert.match(result.stdout, /BV &amp; A/);
assert.match(result.stdout, /1-2s, R4s/);
assert.doesNotMatch(result.stdout, /1-3s/);
assert.match(result.stdout, /<div><b>QC<\/b><\/div>/);
console.log('Report header TypeScript tests passed');
