'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-qc-format.ts')).href;
const program = `
  import { createReportQcFormat } from ${JSON.stringify(source)};
  const fallback = createReportQcFormat({ format: (value, decimals) => String(value) + ':' + decimals });
  const custom = createReportQcFormat({ format: () => 'fallback', testValue: () => 'value', testStat: () => 'stat', pointValue: () => 'point' });
  console.log(JSON.stringify([fallback.value({}, 1.2), fallback.stat({}, 0.12), fallback.point({ val: 4.5, valueDecimals: 4 }, {}), custom.value({}, 1), custom.stat({}, 1), custom.point({}, {})]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report QC format TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['1.2:3', '0.12:3', '4.5:4', 'value', 'stat', 'point']);
console.log('Report QC format TypeScript tests passed');
