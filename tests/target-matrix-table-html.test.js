'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-matrix-table-html.ts')).href;
const program = `
  import { targetMatrixTableHtml } from ${JSON.stringify(source)};
  console.log(targetMatrixTableHtml('<div class="target-row">row</div>'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target matrix table HTML TypeScript');
assert.match(result.stdout, /<div class="target-head">/);
assert.match(result.stdout, /<span>Trung bình mục tiêu<\/span>/);
assert.match(result.stdout, /<div class="target-row">row<\/div>/);
console.log('Target matrix table HTML TypeScript tests passed');
