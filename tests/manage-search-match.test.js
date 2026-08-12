'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-search-match.ts')).href;
const program = `
  import { manageSearchMatch } from ${JSON.stringify(source)};
  const normalize = value => String(value ?? '').toLocaleLowerCase('vi');
  console.log(JSON.stringify([manageSearchMatch(['Hóa sinh', 'AU680'], 'sinh', normalize), manageSearchMatch(['Hóa sinh'], 'miễn dịch', normalize), manageSearchMatch(['Hóa sinh'], '', normalize), manageSearchMatch([null, 'Lô QC'], 'qc', normalize)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage search match TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [true, false, true, true]);
console.log('Manage search match TypeScript tests passed');
