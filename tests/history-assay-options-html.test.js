'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-assay-options-html.ts')).href;
const program = `
  import { historyAssayOptionsHtml } from ${JSON.stringify(source)};
  console.log(historyAssayOptionsHtml([{ id: 'T1', name: 'Na <ion>' }, { id: 'T2', name: 'K' }], 'T2', assay => assay.name, value => String(value).replace(/</g, '&lt;')));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history assay options HTML TypeScript');
assert.equal(result.stdout.trim(), '<option value="T1" >Na &lt;ion></option><option value="T2" selected>K</option>');
console.log('History assay options HTML TypeScript tests passed');
