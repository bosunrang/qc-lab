'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-shell-html.ts')).href;
const program = `
  import { createManageShellHtml } from ${JSON.stringify(source)};
  console.log(createManageShellHtml({ escape: value => String(value).replaceAll('<', '&lt;') })([{ id: 'lots', label: 'Lô <QC>', count: '2 / 1' }, { id: 'assays', label: 'Xét nghiệm', count: 4 }], 'lots', '<section>Body</section>'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage shell HTML TypeScript');
assert.match(result.stdout, /config-shell-nav/);
assert.match(result.stdout, /class="on" onclick="setManageTab\('lots'\)"/);
assert.match(result.stdout, /Lô &lt;QC>/);
assert.match(result.stdout, /<section>Body<\/section>/);
console.log('Manage shell HTML TypeScript tests passed');
