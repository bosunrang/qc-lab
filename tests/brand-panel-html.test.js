'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'brand-panel-html.ts')).href;
const program = `import { createBrandPanelHtml } from ${JSON.stringify(source)}; console.log(createBrandPanelHtml({escapeAttribute:value => 'ATTR:' + value,button:(label, action) => '<button>' + label + ':' + action + '</button>'})({title:'QC Lab',subtitle:'Nội kiểm',markText:'QC',previewHtml:'<preview>'}));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript brand panel HTML');
assert.match(result.stdout, /id="brandTitle"[^>]*value="ATTR:QC Lab"/);
assert.match(result.stdout, /<preview>/);
assert.match(result.stdout, /pickLogo\(event\)/);
assert.match(result.stdout, /saveBrand\(\)/);
assert.match(result.stdout, /clearLogo\(\)/);
console.log('Brand panel HTML TypeScript tests passed');
