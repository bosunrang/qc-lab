'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-sheet-month.ts')).href;
const program = `
  import { entrySheetMonthPart, entrySheetMonthValue } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entrySheetMonthPart('2026-08', '2026-01', 'year', '2027'), entrySheetMonthPart('2026-08', '2026-01', 'month', 3), entrySheetMonthPart('2026-08', '2026-01', 'month', 13), entrySheetMonthPart('bad', '2026-01', 'year', 2027), entrySheetMonthValue('2026-12'), entrySheetMonthValue('2026-13')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry sheet month TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['2027-08', '2026-03', '2026-01', '2026-01', '2026-12', null]);
console.log('Entry sheet month TypeScript tests passed');
