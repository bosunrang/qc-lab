'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-period-label.ts')).href;
const program = `
  import { historyPeriodLabel } from ${JSON.stringify(source)};
  console.log(JSON.stringify([historyPeriodLabel('2026-01-01', '2026-01-31', value => 'VN:' + value), historyPeriodLabel('', undefined, value => value)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history period label TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['VN:2026-01-01 → VN:2026-01-31', 'Không giới hạn → Không giới hạn']);
console.log('History period label TypeScript tests passed');
