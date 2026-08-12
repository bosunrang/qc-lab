'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-summary-html.ts')).href;
const program = `
  import { targetSummaryHtml } from ${JSON.stringify(source)};
  console.log(targetSummaryHtml({ linked: 3, other: 1, empty: 0, missing: 2 }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target summary HTML TypeScript');
assert.equal(result.stdout.trim(), '<div class="target-summary"><span class="ok"><b>3</b> đã gán mức này</span><span class="warn"><b>1</b> đang dùng lô khác</span><span class="none"><b>0</b> chưa gán lô</span><span class="warn"><b>2</b> thiếu Mean/SD</span></div>');
console.log('Target summary HTML TypeScript tests passed');
