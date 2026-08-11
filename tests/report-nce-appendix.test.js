'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-nce-appendix.ts')).href;
const program = `
  import { createReportNceAppendix } from ${JSON.stringify(source)};
  const render = createReportNceAppendix({ detail: (action, test) => '<article>' + action.id + ':' + test.id + '</article>' });
  console.log(render([{ id: 'NCE-1' }, { id: 'NCE-2' }], { id: 'GLU' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report NCE appendix TypeScript');
assert.match(result.stdout, /Phụ lục - Hồ sơ NCE chi tiết/);
assert.match(result.stdout, /<article>NCE-1:GLU<\/article><article>NCE-2:GLU<\/article>/);
console.log('Report NCE appendix TypeScript tests passed');
