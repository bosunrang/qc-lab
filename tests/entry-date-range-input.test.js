'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-date-range-input.ts')).href;
const program = `
  import { createEntryDateRangeInput } from ${JSON.stringify(source)};
  const set = createEntryDateRangeInput(value => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(value)) ? String(value) : null);
  console.log(JSON.stringify([set({ start: '2026-08-01', end: '2026-08-31' }, 'start', 'bad'), set({ start: '2026-08-01', end: '2026-08-31' }, 'end', '2026-08-11')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry date range input TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ start: null, end: '2026-08-31' }, { start: '2026-08-01', end: '2026-08-11' }]);
console.log('Entry date range input TypeScript tests passed');
