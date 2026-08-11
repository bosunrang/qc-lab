'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'qc', 'range-tea.ts')).href;
const program = `
  import { createRangeTea } from ${JSON.stringify(source)};
  const service = createRangeTea({ teaSource: test => test.source, teaBySource: (_test, source, mean) => source === 'ok' ? mean : source === 'zero' ? 0 : NaN });
  console.log(JSON.stringify([service.percent({ source: 'ok' }, { mean: 12 }), service.percent({ source: 'zero' }, { mean: 12 }), service.percent(null, { mean: 12 }), service.quarter(12), service.quarter(null)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy range TEa TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [12, null, null, 3, null]);
console.log('Range TEa TypeScript tests passed');
