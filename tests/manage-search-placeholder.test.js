'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-search-placeholder.ts')).href;
const program = `
  import { manageSearchPlaceholder } from ${JSON.stringify(source)};
  console.log(JSON.stringify([manageSearchPlaceholder('lots'), manageSearchPlaceholder('tearefs'), manageSearchPlaceholder('unknown')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage search placeholder TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Tìm theo số lô, nhóm lô QC...', 'Tìm theo tên xét nghiệm, nhóm, đơn vị...', '']);
console.log('Manage search placeholder TypeScript tests passed');
